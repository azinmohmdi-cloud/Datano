import type { QueryClient } from "@tanstack/react-query";
import { getOwnWebsiteApiWebsitesWebsiteIdGet, issueWebsiteChallengeApiWebsitesWebsiteIdChallengePost, verifyWebsiteChallengeApiWebsitesWebsiteIdVerifyPost } from "@/lib/api/v1";
import type { Website } from "@/lib/api/v1/model";
import type { SessionAccount } from "@/data/feature/session/session";
import { ApiError, isRecord } from "@/lib/api-error";
import { ownedOperation, ownerGuard, parseWebsite, websitesKey, websiteSelectionKey } from "./websites";

export interface WebsiteProof { website: Website; metaTag: string }
export const websiteKey = (ownerId: string, id: string) => ["owned-website", ownerId, id] as const;
const invalid = () => new ApiError("Invalid website proof response", "protocol");
const validId = (id: string) => /^[a-zA-Z0-9_-]+$/.test(id);

export function parseWebsiteProof(payload: unknown, expected: Website): WebsiteProof {
  if (!isRecord(payload)) throw invalid();
  const website = parseWebsite(payload.website);
  if (website.id !== expected.id || website.hostname !== expected.hostname || website.scheme !== expected.scheme
    || website.is_verified || website.challenge_status !== "pending" || website.challenge_expires_at === null
    || Date.parse(website.challenge_expires_at) - Date.parse(website.updated_at) !== 86_400_000
    || website.reservation_expires_at !== website.challenge_expires_at
    || Date.parse(website.updated_at) < Date.parse(expected.created_at)
    || typeof payload.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(payload.token)
    || payload.meta_tag !== `<meta name="datano-verification" content="${payload.token}">`) throw invalid();
  // Return only the exact inert tag and public metadata; no envelope/token cache.
  return { website, metaTag: payload.meta_tag };
}

export function websiteOptions(client: QueryClient, owner: SessionAccount, id: string) {
  return { queryKey: websiteKey(owner.id, id), staleTime: 0, gcTime: 0, retry: false as const,
    refetchOnMount: "always" as const, refetchOnWindowFocus: false, refetchOnReconnect: false,
    queryFn: ({ signal }: { signal: AbortSignal }) => readOwnWebsite(client, owner, id, signal) };
}

export async function readOwnWebsite(client: QueryClient, owner: SessionAccount, id: string, signal: AbortSignal): Promise<Website> {
  if (!validId(id)) throw invalid();
  return ownedOperation(client, owner, signal, async () => {
    const site = parseWebsite((await getOwnWebsiteApiWebsitesWebsiteIdGet(id, { signal })).payload);
    if (site.id !== id) throw invalid();
    return site;
  });
}

async function changeProof<T extends { website: Website }>(client: QueryClient, owner: SessionAccount, site: Website,
  signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
  if (!validId(site.id)) throw invalid();
  const guard = ownerGuard(client, owner, signal);
  guard.check();
  await client.cancelQueries({ queryKey: websiteKey(owner.id, site.id), exact: true });
  await client.cancelQueries({ queryKey: websitesKey(owner.id), exact: true });
  guard.check();
  let result: T;
  try {
    result = await ownedOperation(client, owner, signal, operation);
  } finally {
    // A failed/aborted write may already have committed. Only invalidate public
    // site metadata, never cache a mutation envelope or retry a POST implicitly.
    if (guard.current()) {
      await client.cancelQueries({ queryKey: websiteKey(owner.id, site.id), exact: true });
      await client.cancelQueries({ queryKey: websitesKey(owner.id), exact: true });
      if (guard.current()) {
        await client.invalidateQueries({ queryKey: websiteKey(owner.id, site.id), exact: true, refetchType: "none" });
        await client.invalidateQueries({ queryKey: websitesKey(owner.id), exact: true, refetchType: "none" });
      }
    }
  }
  guard.check();
  client.setQueryData(websiteKey(owner.id, site.id), result.website);
  client.setQueryData(websiteSelectionKey(owner.id), result.website.id);
  return result;
}

export function issueWebsiteChallenge(client: QueryClient, owner: SessionAccount, site: Website, signal: AbortSignal): Promise<WebsiteProof> {
  return changeProof(client, owner, site, signal, async () =>
    parseWebsiteProof((await issueWebsiteChallengeApiWebsitesWebsiteIdChallengePost(site.id, {}, { signal })).payload, site));
}

export async function verifyWebsiteChallenge(client: QueryClient, owner: SessionAccount, site: Website, signal: AbortSignal): Promise<Website> {
  const result = await changeProof(client, owner, site, signal, async () => {
    const website = parseWebsite((await verifyWebsiteChallengeApiWebsitesWebsiteIdVerifyPost(site.id, {}, { signal })).payload);
    if (website.id !== site.id || website.hostname !== site.hostname || website.scheme !== site.scheme || !website.is_verified) throw invalid();
    return { website };
  });
  return result.website;
}
