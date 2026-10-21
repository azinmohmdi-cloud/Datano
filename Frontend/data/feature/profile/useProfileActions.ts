"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { SessionAccount } from "@/data/feature/session/session";
import { saveProfileNames, type ProfileNames } from "./profile";

export interface UseProfileActionsReturn {
  saveNames: (ownerId: string, names: ProfileNames, signal: AbortSignal) => Promise<SessionAccount>;
}

export default function useProfileActions(): UseProfileActionsReturn {
  const client = useQueryClient();
  // Draft names and request envelopes need no separate query/mutation cache.
  return { saveNames: (ownerId, names, signal) => saveProfileNames(client, ownerId, names, signal) };
}
