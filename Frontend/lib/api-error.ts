export type ApiErrorKind = "http" | "application" | "protocol" | "network" | "configuration";

/** Public transport diagnostics deliberately exclude Axios request/config/cookies. */
export class ApiError<T = unknown> extends Error {
  readonly name = "ApiError";

  constructor(
    message: string,
    readonly kind: ApiErrorKind,
    readonly body?: T,
    readonly status?: number,
    readonly code?: string,
    readonly retryAfter?: string,
  ) {
    super(message);
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
