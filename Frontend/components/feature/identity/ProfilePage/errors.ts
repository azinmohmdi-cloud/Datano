import { ApiError } from "@/lib/api-error";
import { profileMessages as messages } from "./content";

export function profileErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 422) return messages.namesInvalid;
    if (error.status === 403) return messages.namesDenied;
    if (error.status === 429) return messages.namesLimited;
  }
  return messages.namesUnavailable;
}

export function emailChangeFailure(error: unknown, verification: boolean) {
  if (error instanceof ApiError) {
    if (error.status === 401 && verification) return { message: messages.emailProofRejected, codeRejected: true };
    if (error.status === 409) return { message: messages.emailTaken, restart: true };
    if (error.status === 403) return { message: messages.emailDenied };
    if (error.status === 422) return { message: messages.emailInputInvalid };
    if (error.status === 429) {
      const raw = error.retryAfter;
      const seconds = raw && /^\d+$/.test(raw) ? Number(raw) : raw ? Math.ceil((Date.parse(raw) - Date.now()) / 1000) : 60;
      return { message: messages.emailLimited, retryAfter: Number.isFinite(seconds) ? Math.max(1, seconds) : 60 };
    }
  }
  return { message: messages.emailUnavailable };
}
