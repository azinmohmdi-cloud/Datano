import Axios from "axios";
import { ApiError } from "@/lib/api-error";
import { recoveryMessages as messages } from "./content";
import type { RecoveryStep } from ".";

export function recoveryFailure(error: unknown, step: RecoveryStep) {
  if (Axios.isCancel(error) || error instanceof DOMException && error.name === "AbortError") return { cancelled: true, message: "" };
  if (!(error instanceof ApiError)) return { message: messages.requestUnavailable };
  if (error.status === 401) {
    if (step === "password") return { message: messages.grantExpired, restart: true };
    if (step === "code") return { message: messages.codeRejected, codeRejected: true };
    return { message: messages.requestUnavailable };
  }
  if (error.status === 429) {
    const raw = error.retryAfter;
    const seconds = raw && /^\d+$/.test(raw) ? Number(raw) : raw ? Math.ceil((Date.parse(raw) - Date.now()) / 1000) : 60;
    return { message: messages.rateLimited, retryAfter: Number.isFinite(seconds) ? Math.max(1, seconds) : 60 };
  }
  if (error.status === 403) return { message: messages.csrfFailed };
  if (error.status === 422) return { message: messages.invalidInput };
  return { message: step === "password" ? messages.resetUnavailable : messages.requestUnavailable };
}
