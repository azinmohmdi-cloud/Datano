import type { QueryClient } from "@tanstack/react-query";
import { getMeApiAuthMeGet, loginApiAuthLoginPost, logoutApiAuthLogoutPost, registerUserApiAuthRegisterPost } from "@/lib/api/v1";
import type { UserLogin, UserRegistration } from "@/lib/api/v1/model";
import { ApiError, isRecord } from "@/lib/api-error";
import type { EffectiveRole } from "./routing";

export interface SessionAccount {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: EffectiveRole;
}
export const sessionKey = ["current-session"] as const;

export function parseSession(payload: unknown): SessionAccount {
  if (!isRecord(payload) || typeof payload.id !== "string" || !payload.id
    || typeof payload.first_name !== "string" || typeof payload.last_name !== "string"
    || typeof payload.email !== "string" || payload.is_active !== true
    || !["Admin", "User", null].includes(payload.effective_role as string | null)) {
    throw new ApiError("Invalid session response", "protocol");
  }
  return { id: payload.id, firstName: payload.first_name, lastName: payload.last_name,
    email: payload.email, role: payload.effective_role as EffectiveRole };
}

export async function clearPrivateCache(client: QueryClient) {
  // Conservatively all other queries/mutations may contain private account data.
  const otherQueries = { predicate: (query: { queryKey: readonly unknown[] }) => query.queryKey[0] !== sessionKey[0] };
  await client.cancelQueries(otherQueries);
  client.removeQueries(otherQueries);
  client.getMutationCache().clear();
}

export function sessionOptions(client: QueryClient) {
  return {
    queryKey: sessionKey,
    queryFn: async ({ signal }: { signal: AbortSignal }): Promise<SessionAccount | null> => {
      const previous = client.getQueryData<SessionAccount | null>(sessionKey);
      let next: SessionAccount | null;
      try { next = parseSession((await getMeApiAuthMeGet({ signal })).payload); }
      catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        next = null;
      }
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      if (!next || previous?.id !== next.id || previous?.role !== next.role) await clearPrivateCache(client);
      return next;
    },
    staleTime: 0, gcTime: 0, retry: false as const, refetchOnMount: "always" as const,
  };
}

export async function loginSession(client: QueryClient, values: UserLogin): Promise<SessionAccount | null> {
  await client.cancelQueries();
  await loginApiAuthLoginPost(values);
  await client.cancelQueries();
  client.clear();
  // Do not cache the login envelope (it contains a CSRF token) or trust input roles.
  return client.fetchQuery(sessionOptions(client));
}

export async function logoutSession(client: QueryClient): Promise<void> {
  await client.cancelQueries();
  await logoutApiAuthLogoutPost();
  await client.cancelQueries();
  client.clear();
  client.setQueryData(sessionKey, null);
}

export async function registerAccount(values: UserRegistration): Promise<void> {
  // Registration creates an active User, not a logged-in session. Never send role,
  // confirmation, terms fixture flags, or a legacy username to the API.
  await registerUserApiAuthRegisterPost({ first_name: values.first_name, last_name: values.last_name,
    email: values.email, password: values.password });
}

