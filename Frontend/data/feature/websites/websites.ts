import type { QueryClient } from "@tanstack/react-query";
import { createWebsiteApiWebsitesPost, getMeApiAuthMeGet, getOwnWebsiteApiWebsitesWebsiteIdGet, getOwnWebsitesApiWebsitesGet } from "@/lib/api/v1";
import type { Website } from "@/lib/api/v1/model";
import { ApiError, isRecord } from "@/lib/api-error";
import { clearPrivateCache, parseSession, sessionKey, type SessionAccount } from "@/data/feature/session/session";

export const websitesKey = (ownerId: string) => ["owned-websites", ownerId] as const;
export const websiteSelectionKey = (ownerId: string) => ["website-selection", ownerId] as const;
const invalid = () => new ApiError("Invalid website response", "protocol");
const date = (value: unknown): value is string => typeof value === "string" && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));

/** Reconstruct the public DTO: extra fields, server messages and proof material never enter cache. */
export function parseWebsite(value: unknown): Website {
  if (!isRecord(value) || typeof value.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(value.id)
    || typeof value.hostname !== "string" || value.hostname.length > 253
    || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value.hostname)
    || value.hostname.split(".").some(label => label.length > 63)
    || (value.scheme !== "http" && value.scheme !== "https") || value.url !== `${value.scheme}://${value.hostname}/`
    || typeof value.is_verified !== "boolean"
    || (value.challenge_status !== "not-issued" && value.challenge_status !== "pending" && value.challenge_status !== "expired" && value.challenge_status !== "verified")
    || value.is_verified !== (value.challenge_status === "verified")
    || !date(value.created_at) || !date(value.updated_at) || !date(value.reservation_expires_at)
    || (value.challenge_expires_at !== null && !date(value.challenge_expires_at))
    || (value.verified_at !== null && !date(value.verified_at)) || value.is_verified !== (value.verified_at !== null)) throw invalid();
  return { id: value.id, hostname: value.hostname, scheme: value.scheme, url: value.url, is_verified: value.is_verified,
    challenge_status: value.challenge_status, created_at: value.created_at, updated_at: value.updated_at,
    reservation_expires_at: value.reservation_expires_at, challenge_expires_at: value.challenge_expires_at, verified_at: value.verified_at };
}

function sameIdentity(left: SessionAccount | null | undefined, right: SessionAccount | null) {
  return Boolean(left && right && left.id === right.id && left.email === right.email && left.role === right.role);
}

// The public website DTO has no owner field. Check the cookie identity around each
// operation, and reject late results even after a same-account logout/login.
function ownerGuard(client: QueryClient, owner: SessionAccount, signal: AbortSignal) {
  const query = client.getQueryCache().find({ queryKey: sessionKey, exact: true });
  const current = () => Boolean(query && client.getQueryCache().find({ queryKey: sessionKey, exact: true }) === query
    && sameIdentity(client.getQueryData<SessionAccount | null>(sessionKey), owner));
  function check() {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (!current()) throw invalid();
  }
  async function fresh() {
    check();
    let next: SessionAccount | null;
    try { next = parseSession((await getMeApiAuthMeGet({ signal })).payload); }
    catch (error) { if (!(error instanceof ApiError) || error.status !== 401) throw error; next = null; }
    check();
    if (!sameIdentity(next, owner)) {
      await client.cancelQueries({ queryKey: sessionKey, exact: true });
      if (current()) await clearPrivateCache(client);
      // Clearing private queries aborts our own list read. Still publish the
      // authoritative session, unless another login has replaced it meanwhile.
      if (current()) client.setQueryData(sessionKey, next);
      throw invalid();
    }
  }
  return { check, fresh, current };
}

async function ownedOperation<T>(client: QueryClient, owner: SessionAccount, signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
  const guard = ownerGuard(client, owner, signal);
  try {
    await guard.fresh();
    const result = await operation();
    guard.check();
    await guard.fresh();
    guard.check();
    return result;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && !signal.aborted && guard.current()) {
      try { await guard.fresh(); } catch { /* Preserve the original failure; no automatic write retry. */ }
    }
    throw error;
  }
}

export function websitesOptions(client: QueryClient, owner: SessionAccount) {
  return { queryKey: websitesKey(owner.id), staleTime: 0, retry: false as const, refetchOnMount: "always" as const,
    queryFn: ({ signal }: { signal: AbortSignal }) => ownedOperation(client, owner, signal, async () => {
      const items: Website[] = [];
      let total: number | undefined;
      let pages = 1;
      for (let page = 1; page <= pages; page++) {
        const payload: unknown = (await getOwnWebsitesApiWebsitesGet({ page, size: 100 }, { signal })).payload;
        if (!isRecord(payload) || !Array.isArray(payload.items) || !Number.isSafeInteger(payload.total) || typeof payload.total !== "number" || payload.total < 0
          || payload.page !== page || payload.size !== 100 || payload.pages !== Math.max(1, Math.ceil(payload.total / 100))
          || (total !== undefined && total !== payload.total)
          || payload.items.length !== Math.min(100, Math.max(0, payload.total - (page - 1) * 100))) throw invalid();
        total = payload.total;
        pages = Math.max(1, Math.ceil(total / 100));
        items.push(...payload.items.map(parseWebsite));
      }
      if (new Set(items.map(site => site.id)).size !== items.length) throw invalid();
      return items;
    }),
  };
}

export function validWebsiteSelection(sites: readonly Website[], selectedId: string | null | undefined): string | null {
  return sites.some(site => site.id === selectedId) ? selectedId ?? null : sites.length === 1 ? sites[0].id : null;
}

export async function registerWebsite(client: QueryClient, owner: SessionAccount, url: string, signal: AbortSignal): Promise<Website> {
  const guard = ownerGuard(client, owner, signal);
  guard.check();
  await client.cancelQueries({ queryKey: websitesKey(owner.id), exact: true });
  guard.check();
  let site: Website;
  try {
    site = await ownedOperation(client, owner, signal, async () => {
      const result = parseWebsite((await createWebsiteApiWebsitesPost({ url }, { signal })).payload);
      if (result.hostname !== new URL(url).hostname.replace(/\.$/, "")) throw invalid();
      return result;
    });
  } finally {
    if (guard.current()) {
      // A failed/aborted response can still follow a committed reservation.
      await client.cancelQueries({ queryKey: websitesKey(owner.id), exact: true });
      if (guard.current()) await client.invalidateQueries({ queryKey: websitesKey(owner.id), exact: true, refetchType: "none" });
    }
  }
  guard.check();
  client.setQueryData(websiteSelectionKey(owner.id), site.id);
  return site;
}

export async function readSelectedWebsite(client: QueryClient, owner: SessionAccount, id: string, signal: AbortSignal): Promise<Website> {
  const guard = ownerGuard(client, owner, signal);
  guard.check();
  if (!client.getQueryData<Website[]>(websitesKey(owner.id))?.some(site => site.id === id)) throw invalid();
  try {
    return await ownedOperation(client, owner, signal, async () => {
      const site = parseWebsite((await getOwnWebsiteApiWebsitesWebsiteIdGet(id, { signal })).payload);
      if (site.id !== id) throw invalid();
      return site;
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404 && guard.current() && !signal.aborted) {
      client.setQueryData(websiteSelectionKey(owner.id), null);
      await client.invalidateQueries({ queryKey: websitesKey(owner.id), exact: true });
    }
    throw error;
  }
}
