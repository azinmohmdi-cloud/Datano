"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Website } from "@/lib/api/v1/model";
import type { SessionAccount } from "@/data/feature/session/session";
import { readSelectedWebsite, validWebsiteSelection, websitesOptions, websiteSelectionKey } from "./websites";

export interface UseWebsitesReturn {
  sites: readonly Website[];
  selectedId: string | null;
  status: "loading" | "error" | "ready";
  select: (id: string) => void;
  retry: () => Promise<void>;
  readSelected: (id: string, signal: AbortSignal) => Promise<Website>;
}

export default function useWebsites(owner: SessionAccount): UseWebsitesReturn {
  const client = useQueryClient();
  const query = useQuery(websitesOptions(client, owner));
  const selection = useQuery<string | null>({ queryKey: websiteSelectionKey(owner.id), queryFn: () => null, enabled: false });
  const status: "loading" | "error" | "ready" = query.isPending || query.isFetching ? "loading" : query.isError ? "error" : "ready";
  const sites = status === "ready" ? query.data ?? [] : [];
  const selectedId = validWebsiteSelection(sites, selection.data);
  useEffect(() => {
    if (status === "ready" && selection.data && !query.data?.some(site => site.id === selection.data)) {
      client.setQueryData(websiteSelectionKey(owner.id), null);
    }
  }, [client, owner.id, query.data, selection.data, status]);
  return { sites, selectedId, status,
    select: (id: string) => { if (sites.some(site => site.id === id)) client.setQueryData(websiteSelectionKey(owner.id), id); },
    retry: async () => { await query.refetch(); },
    readSelected: (id: string, signal: AbortSignal) => readSelectedWebsite(client, owner, id, signal),
  };
}
