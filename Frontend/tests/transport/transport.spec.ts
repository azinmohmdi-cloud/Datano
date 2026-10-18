import { test, expect } from "@playwright/test";
import Axios, { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { AXIOS_INSTANCE, customFetcher, fetcherHookAdapter } from "../../lib/fetcher";
import * as functions from "../../lib/api/v1";
import * as hooks from "../../lib/api/v1/hooks";
import type { StandardResponseStr } from "../../lib/api/v1/model";
import { QueryClient, isCancelledError } from "@tanstack/react-query";

const token = "T".repeat(43);
const envelope = { success: true, message: "ok", payload: { items: [], total: 0, page: 1, size: 20, pages: 0 } };
let requests: InternalAxiosRequestConfig[];
let respond: (config: InternalAxiosRequestConfig) => Promise<AxiosResponse<unknown>>;

function response(config: InternalAxiosRequestConfig, data: unknown = envelope, status = 200): AxiosResponse<unknown> {
  return { config, data, status, statusText: "fixture", headers: new AxiosHeaders() };
}

test.beforeEach(() => {
  requests = [];
  respond = async config => response(config, config.url === "/api/auth/csrf"
    ? { success: true, message: "csrf", payload: { csrf_token: token } } : envelope);
  AXIOS_INSTANCE.defaults.adapter = async config => {
    requests.push(config);
    return respond(config);
  };
});

for (const mutator of ["functions", "hooks"] as const) {
  const get = (signal?: AbortSignal) => mutator === "functions"
    ? customFetcher({ url: "/api/users/", params: { page: 2 }, signal })
    : fetcherHookAdapter({ url: "/api/users/", params: { page: 2 }, signal });
  const post = (signal?: AbortSignal) => mutator === "functions"
    ? customFetcher({ url: "/api/auth/login", method: "POST", data: { email: "person@example.test" }, signal })
    : fetcherHookAdapter({ url: "/api/auth/login", method: "POST", data: { email: "person@example.test" }, signal });

  test(`${mutator}: preserves envelope and sends cookies`, async () => {
    expect(await get()).toEqual(envelope);
    expect(requests).toHaveLength(1);
    expect(requests[0].withCredentials).toBe(true);
    expect(requests[0].url).toContain("/api/users/");
  });

  test(`${mutator}: bootstraps session-bound CSRF before mutation`, async () => {
    await post();
    expect(requests.map(request => request.url)).toEqual(["/api/auth/csrf", "/api/auth/login"]);
    expect(requests[1].headers.get("X-CSRF-Token")).toBe(token);
    expect(requests.every(request => request.withCredentials)).toBe(true);
    expect(requests[1].headers.has("Origin")).toBe(false); // Browser owns Origin.
  });

  test(`${mutator}: rejects HTTP errors without retry or refresh`, async () => {
    respond = async config => response(config, { detail: [{ loc: ["body", "email"], msg: "invalid" }] }, 422);
    await expect(get()).rejects.toMatchObject({ name: "ApiError", kind: "http", status: 422 });
    expect(requests).toHaveLength(1);
  });

  test(`${mutator}: rejects application failure and malformed success`, async () => {
    respond = async config => response(config, { success: false, message: "denied", payload: { error_code: "DENIED" } });
    await expect(get()).rejects.toMatchObject({ name: "ApiError", kind: "application", code: "DENIED" });
    respond = async config => response(config, "<html>upstream failure</html>");
    await expect(get()).rejects.toMatchObject({ name: "ApiError", kind: "protocol" });
  });

  test(`${mutator}: cancellation reaches the active adapter`, async () => {
    const controller = new AbortController();
    let entered: (() => void) | undefined;
    const started = new Promise<void>(resolve => { entered = resolve; });
    respond = config => new Promise((_resolve, reject) => {
      entered?.();
      config.signal?.addEventListener?.("abort", () => reject(new Axios.CanceledError()), { once: true });
    });
    const pending = get(controller.signal);
    await started;
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "ERR_CANCELED" });
  });
}

test("generated function and hook callers both return the backend body", async () => {
  respond = async config => response(config, { success: true, message: "pong", payload: null });
  const direct: StandardResponseStr = await functions.pingApiPingGet();
  const hooked: StandardResponseStr = await hooks.pingApiPingGet();
  expect(hooked).toEqual(direct);
});

test("Axios option headers merge with generated headers without losing values", async () => {
  await fetcherHookAdapter({ url: "/api/ping", headers: { Accept: "application/json" } }, {
    headers: new AxiosHeaders({ "X-Request-ID": "second" }),
  });
  expect(requests[0].headers.get("Accept")).toBe("application/json");
  expect(requests[0].headers.get("X-Request-ID")).toBe("second");
});

for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
  test(`${method} obtains fresh CSRF and ignores caller token`, async () => {
    await customFetcher({ url: "/api/roles/", method, headers: { "X-CSRF-Token": "caller-value" } });
    expect(requests[1].headers.get("X-CSRF-Token")).toBe(token);
  });
}

for (const status of [401, 403, 409, 429, 500]) {
  test(`HTTP ${status} stays an error without credential refresh or replay`, async () => {
    respond = async config => ({ ...response(config, { success: false, message: "denied", payload: { error_code: "DENIED" } }, status),
      headers: new AxiosHeaders({ "Retry-After": "60" }) });
    await expect(functions.pingApiPingGet()).rejects.toMatchObject({ status, code: "DENIED", retryAfter: "60" });
    expect(requests).toHaveLength(1);
  });
}

test("failed or malformed bootstrap never sends a mutation", async () => {
  for (const body of [{ success: true, message: "bad", payload: { csrf_token: "invalid" } }, { success: false, message: "unavailable", payload: null }]) {
    requests = [];
    respond = async config => response(config, body);
    await expect(customFetcher({ url: "/api/roles/", method: "POST" })).rejects.toMatchObject({ name: "ApiError" });
    expect(requests.map(request => request.url)).toEqual(["/api/auth/csrf"]);
  }
});

test("each mutation bootstraps against current cookies instead of reusing cached CSRF", async () => {
  let index = 0;
  respond = async config => response(config, config.url === "/api/auth/csrf"
    ? { success: true, message: "csrf", payload: { csrf_token: (++index === 1 ? "A" : "B").repeat(43) } } : envelope);
  await functions.logoutApiAuthLogoutPost();
  await hooks.logoutApiAuthLogoutPost();
  expect(requests.filter(request => request.method === "post").map(request => request.headers.get("X-CSRF-Token")))
    .toEqual(["A".repeat(43), "B".repeat(43)]);
});

test("external targets are rejected before cookies or CSRF can be sent", async () => {
  for (const config of [{ url: "https://evil.test/api/users/" }, { url: "/api/users/", baseURL: "https://evil.test" },
    { url: "//evil.test/api/users/" }]) {
    await expect(customFetcher(config)).rejects.toMatchObject({ kind: "configuration" });
  }
  expect(requests).toHaveLength(0);
});

test("caller options cannot disable required credentials", async () => {
  await functions.pingApiPingGet({ withCredentials: false });
  expect(requests[0].withCredentials).toBe(true);
});

test("case-insensitive disabled header cannot suppress signed CSRF", async () => {
  await customFetcher({ url: "/api/roles/", method: "POST", headers: { "x-csrf-token": false } });
  expect(requests[1].headers.get("X-CSRF-Token")).toBe(token);
});

test("generated callers preserve query, JSON body and header options", async () => {
  for (const generated of [functions, hooks]) {
    await generated.getUsersApiUsersGet({ page: 3, size: 7 }, { headers: { "X-Request-ID": "query" } });
    expect(requests.at(-1)?.params).toEqual({ page: 3, size: 7 });
    expect(requests.at(-1)?.headers.get("X-Request-ID")).toBe("query");
    await generated.loginApiAuthLoginPost({ email: "person@example.test", password: "exact password" }, {
      headers: new AxiosHeaders({ "X-Request-ID": "login" }),
    });
    const request = requests.at(-1);
    expect(request?.headers.get("Content-Type")).toBe("application/json");
    expect(request?.headers.get("X-Request-ID")).toBe("login");
    expect(JSON.parse(request?.data)).toEqual({ email: "person@example.test", password: "exact password" });
  }
});

test("already canceled operations perform no bootstrap or request", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(hooks.logoutApiAuthLogoutPost({ signal: controller.signal })).rejects.toMatchObject({ code: "ERR_CANCELED" });
  expect(requests).toHaveLength(0);
});

test("abort while bootstrapping prevents the mutation", async () => {
  const controller = new AbortController();
  let entered: (() => void) | undefined;
  const started = new Promise<void>(resolve => { entered = resolve; });
  respond = config => new Promise((_resolve, reject) => {
    entered?.();
    config.signal?.addEventListener?.("abort", () => reject(new Axios.CanceledError()), { once: true });
  });
  const pending = functions.logoutApiAuthLogoutPost({ signal: controller.signal });
  await started;
  controller.abort();
  await expect(pending).rejects.toMatchObject({ code: "ERR_CANCELED" });
  expect(requests.map(request => request.url)).toEqual(["/api/auth/csrf"]);
});

test("canceling a queued bootstrap is immediate and leaves other mutations usable", async () => {
  let release: (() => void) | undefined;
  let entered: (() => void) | undefined;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  let bootstraps = 0;
  respond = async config => {
    if (config.url === "/api/auth/csrf") {
      bootstraps++;
      if (bootstraps === 1) { entered?.(); await blocked; }
      return response(config, { success: true, message: "csrf", payload: { csrf_token: token } });
    }
    return response(config);
  };
  const first = functions.logoutApiAuthLogoutPost();
  await started;
  const controller = new AbortController();
  const canceled = hooks.logoutApiAuthLogoutPost({ signal: controller.signal });
  controller.abort();
  try {
    await expect(canceled).rejects.toMatchObject({ code: "ERR_CANCELED" });
    expect(bootstraps).toBe(1);
  } finally { release?.(); }
  await first;
  await functions.logoutApiAuthLogoutPost();
  expect(bootstraps).toBe(2);
  expect(requests.filter(request => request.method === "post")).toHaveLength(2);
});

test("generated React Query options propagate query cancellation to Axios", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let entered: (() => void) | undefined;
  const started = new Promise<void>(resolve => { entered = resolve; });
  respond = config => new Promise((_resolve, reject) => {
    entered?.();
    config.signal?.addEventListener?.("abort", () => reject(new Axios.CanceledError()), { once: true });
  });
  try {
    const pending = client.fetchQuery(hooks.getPingApiPingGetQueryOptions()).catch(error => error);
    await started;
    await client.cancelQueries();
    expect(isCancelledError(await pending)).toBe(true);
    expect(requests[0].signal?.aborted).toBe(true);
  } finally { client.clear(); }
});

test("network errors contain no private Axios request diagnostics", async () => {
  respond = async config => { throw new Axios.AxiosError("private-request-marker", "ERR_NETWORK", config); };
  const error = await functions.pingApiPingGet({ headers: { Authorization: "private-header-marker" }, data: "private-body-marker" }).catch(error => error);
  expect(error).toMatchObject({ name: "ApiError", kind: "network", code: "ERR_NETWORK" });
  expect(error.config).toBeUndefined();
  expect(JSON.stringify(error)).not.toMatch(/private-(request|header|body)-marker/);
});

test("cancellation stays recognizable without retaining private request config", async () => {
  respond = async config => {
    const error = new Axios.CanceledError("private-cancel-marker");
    error.config = config;
    throw error;
  };
  const error = await functions.pingApiPingGet({ data: "private-body-marker" }).catch(error => error);
  expect(Axios.isCancel(error)).toBe(true);
  expect(error.config).toBeUndefined();
  expect(JSON.stringify(error)).not.toContain("private-");
});
