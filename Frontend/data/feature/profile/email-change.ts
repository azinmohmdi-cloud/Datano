import type { QueryClient } from "@tanstack/react-query";
import { getMeApiAuthMeGet, requestEmailChangeApiAuthEmailChangeRequestPost, verifyEmailChangeApiAuthEmailChangeVerifyPost } from "@/lib/api/v1";
import { ApiError, isRecord } from "@/lib/api-error";
import { clearPrivateCache, parseSession, sessionKey, type SessionAccount } from "@/data/feature/session/session";

function ownerOperation(client: QueryClient, ownerId: string, signal: AbortSignal) {
  const query = client.getQueryCache().find({ queryKey: sessionKey, exact: true });
  const initial = client.getQueryData<SessionAccount | null>(sessionKey);
  const stillOwner = () => query !== undefined && client.getQueryCache().find({ queryKey: sessionKey, exact: true }) === query
    && initial?.id === ownerId && client.getQueryData<SessionAccount | null>(sessionKey)?.id === ownerId
    && client.getQueryData<SessionAccount>(sessionKey)?.email === initial.email;
  function check() {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (!stillOwner()) throw new ApiError("Email change session changed", "protocol");
  }
  async function publish(account: SessionAccount) {
    check();
    await client.cancelQueries({ queryKey: sessionKey, exact: true });
    check();
    // Every verified email change rotates the session, even with the same role.
    await clearPrivateCache(client);
    check();
    client.setQueryData(sessionKey, account);
  }
  async function readOwner() {
    check();
    const current = parseSession((await getMeApiAuthMeGet({ signal })).payload);
    check();
    if (current.id !== ownerId || current.email !== initial?.email || current.role !== initial?.role) {
      await publish(current);
      throw new ApiError("Email change session changed", "protocol");
    }
  }
  async function reconcile(error: unknown) {
    // A proof 401 need not mean the session expired. Read privately without
    // setting the session query fetching/loading and discarding the code draft.
    if (signal.aborted || !stillOwner() || !(error instanceof ApiError)
      || !(error.status === 401 || error.kind === "network" || error.kind === "protocol")) return;
    try {
      const current = parseSession((await getMeApiAuthMeGet({ signal })).payload);
      check();
      if (current.id !== ownerId || current.email !== initial?.email || current.role !== initial?.role) await publish(current);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401 && !signal.aborted && stillOwner()) {
        await client.cancelQueries({ queryKey: sessionKey, exact: true });
        check(); await clearPrivateCache(client); check(); client.setQueryData(sessionKey, null);
      }
      // Preserve the original safe failure if identity reconciliation is offline.
    }
  }
  return { check, readOwner, publish, reconcile };
}

export async function requestEmailChange(client: QueryClient, ownerId: string, email: string, signal: AbortSignal): Promise<void> {
  const owner = ownerOperation(client, ownerId, signal);
  owner.check();
  try {
    await owner.readOwner();
    const response = await requestEmailChangeApiAuthEmailChangeRequestPost({ email: email.trim().toLowerCase() }, { signal });
    owner.check();
    if (response.payload !== null) throw new ApiError("Invalid email request acknowledgement", "protocol");
  } catch (error) { await owner.reconcile(error); throw error; }
}

export async function verifyEmailChange(client: QueryClient, ownerId: string, email: string, code: string, signal: AbortSignal): Promise<SessionAccount> {
  const owner = ownerOperation(client, ownerId, signal);
  const target = email.trim().toLowerCase();
  owner.check();
  try {
    await owner.readOwner();
    const { payload } = await verifyEmailChangeApiAuthEmailChangeVerifyPost({ email: target, code }, { signal });
    owner.check();
    if (!isRecord(payload) || !isRecord(payload.user)) throw new ApiError("Invalid email change result", "protocol");
    const saved = parseSession({ ...payload.user, effective_role: payload.effective_role });
    if (saved.id !== ownerId || saved.email !== target) throw new ApiError("Invalid email change owner or destination", "protocol");
    await owner.publish(saved);
    // Return/cache only public identity, never the CSRF-bearing response envelope.
    return saved;
  } catch (error) { await owner.reconcile(error); throw error; }
}
