"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Website } from "@/lib/api/v1/model";
import type { SessionAccount } from "@/data/feature/session/session";
import { issueWebsiteChallenge, readOwnWebsite, verifyWebsiteChallenge, websiteOptions, websiteKey, type WebsiteProof } from "./websiteProof";

export interface UseWebsiteProofReturn {
  site: Website | undefined;
  status: "loading" | "error" | "ready";
  error: unknown;
  retry: () => Promise<void>;
  issue: (site: Website, signal: AbortSignal) => Promise<WebsiteProof>;
  verify: (site: Website, signal: AbortSignal) => Promise<Website>;
  read: (signal: AbortSignal) => Promise<Website>;
}
export default function useWebsiteProof(owner: SessionAccount, id: string): UseWebsiteProofReturn {
  const client = useQueryClient();
  const query = useQuery(websiteOptions(client, owner, id));
  return { site: query.data, status: query.isPending || query.isFetching ? "loading" : query.isError ? "error" : "ready", error: query.error,
    retry: async () => { await query.refetch(); },
    issue: (site, signal) => issueWebsiteChallenge(client, owner, site, signal),
    verify: (site, signal) => verifyWebsiteChallenge(client, owner, site, signal),
    read: async signal => {
      const site = await readOwnWebsite(client, owner, id, signal);
      client.setQueryData(websiteKey(owner.id, id), site);
      return site;
    } };
}
