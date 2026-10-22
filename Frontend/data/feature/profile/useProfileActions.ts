"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { SessionAccount } from "@/data/feature/session/session";
import { saveProfileNames, type ProfileNames } from "./profile";
import { requestEmailChange, verifyEmailChange } from "./email-change";

export interface UseProfileActionsReturn {
  saveNames: (ownerId: string, names: ProfileNames, signal: AbortSignal) => Promise<SessionAccount>;
  requestEmail: (ownerId: string, email: string, signal: AbortSignal) => Promise<void>;
  verifyEmail: (ownerId: string, email: string, code: string, signal: AbortSignal) => Promise<SessionAccount>;
}

export default function useProfileActions(): UseProfileActionsReturn {
  const client = useQueryClient();
  // Draft names and request envelopes need no separate query/mutation cache.
  return { saveNames: (ownerId, names, signal) => saveProfileNames(client, ownerId, names, signal),
    requestEmail: (ownerId, email, signal) => requestEmailChange(client, ownerId, email, signal),
    verifyEmail: (ownerId, email, code, signal) => verifyEmailChange(client, ownerId, email, code, signal) };
}
