import type { QueryClient } from "@tanstack/react-query";
import { requestCodeApiAuthPasswordRecoveryRequestPost, resetPasswordApiAuthPasswordRecoveryResetPost, verifyCodeApiAuthPasswordRecoveryVerifyPost } from "@/lib/api/v1";
import { ApiError, isRecord } from "@/lib/api-error";
import { sessionKey } from "@/data/feature/session/session";

export async function requestRecovery(email: string, signal: AbortSignal): Promise<void> {
  await requestCodeApiAuthPasswordRecoveryRequestPost({ email: email.trim() }, { signal });
}

export async function verifyRecovery(email: string, code: string, signal: AbortSignal): Promise<number> {
  const { payload } = await verifyCodeApiAuthPasswordRecoveryVerifyPost({ email: email.trim(), code }, { signal });
  if (!isRecord(payload) || !Number.isInteger(payload.expires_in) || typeof payload.expires_in !== "number"
    || payload.expires_in < 1 || payload.expires_in > 600) throw new ApiError("Invalid recovery response", "protocol");
  // The browser owns the HttpOnly grant. Never retain the envelope/CSRF token.
  return payload.expires_in;
}

export async function resetRecovery(client: QueryClient, password: string, confirmation: string, signal: AbortSignal): Promise<void> {
  await client.cancelQueries();
  await resetPasswordApiAuthPasswordRecoveryResetPost({ password, password_confirmation: confirmation }, { signal });
  await client.cancelQueries();
  client.clear();
  client.setQueryData(sessionKey, null);
}
