import type { QueryClient } from "@tanstack/react-query";
import { getMeApiAuthMeGet, updateOwnProfileApiAuthMePatch } from "@/lib/api/v1";
import { ApiError } from "@/lib/api-error";
import { clearPrivateCache, parseSession, sessionKey, sessionOptions, type SessionAccount } from "@/data/feature/session/session";

export interface ProfileNames { firstName: string; lastName: string }

export async function saveProfileNames(client: QueryClient, ownerId: string, names: ProfileNames, signal: AbortSignal): Promise<SessionAccount> {
  const query = client.getQueryCache().find({ queryKey: sessionKey, exact: true });
  const stillOwner = () => query !== undefined && client.getQueryCache().find({ queryKey: sessionKey, exact: true }) === query
    && client.getQueryData<SessionAccount | null>(sessionKey)?.id === ownerId;
  function check() {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (!stillOwner()) throw new ApiError("Profile session changed", "protocol");
  }
  check();
  try {
    // Check the cookie owner afresh without triggering a query loading/remount
    // that would discard the draft on a recoverable error.
    const current = parseSession((await getMeApiAuthMeGet({ signal })).payload);
    check();
    if (current.id !== ownerId) {
      await client.fetchQuery(sessionOptions(client));
      throw new ApiError("Profile session changed", "protocol");
    }
    const response = await updateOwnProfileApiAuthMePatch({ first_name: names.firstName, last_name: names.lastName }, { signal });
    const saved = parseSession(response.payload);
    check();
    if (saved.id !== ownerId) throw new ApiError("Invalid profile owner", "protocol");
    // Cancel reads started before save so they cannot overwrite the returned
    // server snapshot. Logout/login replaces the query; never restore it here.
    await client.cancelQueries({ queryKey: sessionKey, exact: true });
    check();
    if (client.getQueryData<SessionAccount>(sessionKey)?.role !== saved.role) await clearPrivateCache(client);
    check();
    client.setQueryData(sessionKey, saved);
    return saved;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && !signal.aborted && stillOwner()) {
      await client.fetchQuery(sessionOptions(client));
    }
    throw error;
  }
}
