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
