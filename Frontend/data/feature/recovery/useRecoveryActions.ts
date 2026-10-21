"use client";

import { useQueryClient } from "@tanstack/react-query";
import { requestRecovery, resetRecovery, verifyRecovery } from "./recovery";

export interface UseRecoveryActionsReturn {
  request: (email: string, signal: AbortSignal) => Promise<void>;
  verify: (email: string, code: string, signal: AbortSignal) => Promise<number>;
  reset: (password: string, confirmation: string, signal: AbortSignal) => Promise<void>;
}

export default function useRecoveryActions(): UseRecoveryActionsReturn {
  const client = useQueryClient();
  // Plain actions keep recovery codes and passwords out of query/mutation caches.
  return { request: requestRecovery, verify: verifyRecovery,
    reset: (password, confirmation, signal) => resetRecovery(client, password, confirmation, signal) };
}
