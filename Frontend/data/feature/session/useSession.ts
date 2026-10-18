"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { sessionOptions, type SessionAccount } from "./session";

export interface UseSessionReturn {
  account: SessionAccount | null | undefined;
  checking: boolean;
  failed: boolean;
  retry: () => Promise<unknown>;
}

export default function useSession(): UseSessionReturn {
  const client = useQueryClient();
  const query = useQuery(sessionOptions(client));
  return { account: query.data, checking: query.isPending || query.isFetching,
    failed: query.isError, retry: query.refetch };
}
