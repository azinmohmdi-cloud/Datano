"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { Website } from "@/lib/api/v1/model";
import type { SessionAccount } from "@/data/feature/session/session";
import { registerWebsite } from "./websites";

export interface UseWebsiteActionsReturn {
  register: (url: string, signal: AbortSignal) => Promise<Website>;
}

export default function useWebsiteActions(owner: SessionAccount): UseWebsiteActionsReturn {
  const client = useQueryClient();
  // Draft URLs and mutation envelopes do not need a separate cache entry.
  return { register: (url, signal) => registerWebsite(client, owner, url, signal) };
}
