import Axios, { type AxiosRequestConfig } from "axios";
import { ApiError, isRecord } from "./api-error";

const apiBaseURL = process.env.NEXT_PUBLIC_API_URL_V1 || undefined;

export const AXIOS_INSTANCE = Axios.create({
  baseURL: apiBaseURL,
  withCredentials: true,
});

type Signal = AxiosRequestConfig["signal"];
const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
// Serializing bootstrap establishes the first nonce cookie before another request
// can bootstrap. Tokens are request-local, never cached across session changes.
let bootstrapTail: Promise<void> = Promise.resolve();

function throwIfAborted(signal: Signal): void {
  if (signal?.aborted) throw new Axios.CanceledError();
}

function waitWithSignal<T>(pending: Promise<T>, signal: Signal): Promise<T> {
  throwIfAborted(signal);
  if (!signal) return pending;
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Axios.CanceledError());
    signal.addEventListener?.("abort", abort, { once: true });
    pending.then(resolve, reject).finally(() => signal.removeEventListener?.("abort", abort));
  });
}

function assertTrustedTarget(config: AxiosRequestConfig): void {
  try {
    const browserOrigin = typeof window === "undefined" ? undefined : window.location.origin;
    const trusted = new URL(apiBaseURL || "/", browserOrigin);
    const target = new URL(AXIOS_INSTANCE.getUri(config), trusted);
    if (target.origin !== trusted.origin || target.username || target.password) throw new Error();
  } catch {
    throw new ApiError("API URL must use the configured origin", "configuration");
  }
}

function failure(body: unknown, status: number, kind: "http" | "application", retryAfter?: string): ApiError {
  const payload = isRecord(body) && isRecord(body.payload) ? body.payload : undefined;
  return new ApiError(
    isRecord(body) && typeof body.message === "string" ? body.message : "API request failed",
    kind, body, status, typeof payload?.error_code === "string" ? payload.error_code : undefined, retryAfter,
  );
}

function retryAfter(headers: unknown): string | undefined {
  if (!isRecord(headers)) return undefined;
  const value = Object.entries(headers).find(([name]) => name.toLowerCase() === "retry-after")?.[1];
  return typeof value === "string" ? value : undefined;
}

async function requestEnvelope<T>(config: AxiosRequestConfig): Promise<T> {
  throwIfAborted(config.signal);
  try {
    const response = await AXIOS_INSTANCE.request<T>({ ...config, withCredentials: true });
    const body: unknown = response.data;
    if (response.status < 200 || response.status >= 300) {
      throw failure(body, response.status, "http", retryAfter(response.headers));
    }
    if (!isRecord(body) || typeof body.success !== "boolean" || typeof body.message !== "string" || !("payload" in body)) {
      throw new ApiError("Invalid API response envelope", "protocol");
    }
    if (!body.success) throw failure(body, response.status, "application");
    return response.data;
  } catch (error) {
    if (Axios.isCancel(error)) throw new Axios.CanceledError();
    if (error instanceof ApiError) throw error;
    if (Axios.isAxiosError<unknown>(error)) {
      if (error.response) {
        throw failure(error.response.data, error.response.status, "http", retryAfter(error.response.headers));
      }
      throw new ApiError("API network request failed", "network", undefined, undefined, error.code);
    }
    throw error;
  }
}

async function csrfToken(config: AxiosRequestConfig): Promise<string> {
  const pending = bootstrapTail.then(async () => {
    throwIfAborted(config.signal);
    const body = await requestEnvelope<unknown>({ url: "/api/auth/csrf", method: "GET",
      signal: config.signal, timeout: config.timeout });
    if (!isRecord(body) || !isRecord(body.payload) || typeof body.payload.csrf_token !== "string"
      || !/^[A-Za-z0-9_-]{43}$/.test(body.payload.csrf_token)) {
      throw new ApiError("Invalid CSRF bootstrap response", "protocol");
    }
    return body.payload.csrf_token;
  });
  bootstrapTail = pending.then(() => undefined, () => undefined);
  return waitWithSignal(pending, config.signal);
}

export const customFetcher = async <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  // Axios takes url/method/data only from its second argument, while merging headers.
  const request = Axios.mergeConfig(config, { ...config, ...options });
  request.withCredentials = true;
  throwIfAborted(request.signal);
  assertTrustedTarget(request);
  if (!safeMethods.has((request.method || "GET").toUpperCase())) {
    request.headers = { ...request.headers, "X-CSRF-Token": await csrfToken(request) };
  }
  return requestEnvelope<T>(request);
};

/** Both Orval targets explicitly generate Axios request configurations. */
export const fetcherHookAdapter = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => customFetcher<T>(config, options);
export type ErrorType<Error> = ApiError<Error>;

export type BodyType<BodyData> = BodyData;
