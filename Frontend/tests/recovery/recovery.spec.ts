import { test, expect } from "@playwright/test";
import Axios, { AxiosHeaders, type AxiosAdapter } from "axios";
import { QueryClient } from "@tanstack/react-query";
import { AXIOS_INSTANCE } from "../../lib/fetcher";
import { ApiError } from "../../lib/api-error";
import { requestRecovery, verifyRecovery, resetRecovery } from "../../data/feature/recovery/recovery";
import { sessionKey } from "../../data/feature/session/session";
import { recoveryFailure } from "../../components/feature/identity/RecoveryForm/errors";

const original = AXIOS_INSTANCE.defaults.adapter;
test.afterEach(() => { AXIOS_INSTANCE.defaults.adapter = original; });
function adapter(reply: (path: string) => { status?: number; payload?: unknown }) {
  const calls: { path: string; data: unknown; credentials: boolean | undefined; csrf: unknown }[] = [];
  AXIOS_INSTANCE.defaults.adapter = (async config => {
    const path = config.url ?? "";
    calls.push({ path, data: config.data ? JSON.parse(config.data) : undefined, credentials: config.withCredentials, csrf: config.headers.get("X-CSRF-Token") });
    const result = reply(path);
    return { config, status: result.status ?? 200, statusText: "Test", headers: new AxiosHeaders(),
      data: { success: true, message: "OK", payload: path.endsWith("/csrf") ? { csrf_token: "a".repeat(43) } : result.payload } };
  }) satisfies AxiosAdapter;
  return calls;
}
const signal = () => new AbortController().signal;

test("generated recovery operations carry credentials, fresh CSRF, canonical request shape and exact secrets", async () => {
  const calls = adapter(() => ({ payload: { expires_in: 600, csrf_token: "never-retain-this-token" } }));
  await requestRecovery(" user@example.test ", signal());
  expect(await verifyRecovery("user@example.test", "01234567", signal())).toBe(600);
  const client = new QueryClient();
  await resetRecovery(client, " exact Unicode رمز ", " exact Unicode رمز ", signal());
  expect(calls.map(call => call.path)).toEqual(["csrf", "password-recovery/request", "csrf", "password-recovery/verify", "csrf", "password-recovery/reset"].map(path => `/api/auth/${path}`));
  expect(calls[1].data).toEqual({ email: "user@example.test" });
  expect(calls[3].data).toEqual({ email: "user@example.test", code: "01234567" });
  expect(calls[5].data).toEqual({ password: " exact Unicode رمز ", password_confirmation: " exact Unicode رمز " });
  expect(calls.every(call => call.credentials)).toBe(true);
  expect(calls.filter(call => call.data).every(call => call.csrf === "a".repeat(43))).toBe(true);
  expect(client.getMutationCache().getAll()).toEqual([]); client.clear();
});

test("reset cancels late private reads, clears both caches and leaves only anonymous session", async () => {
  const client = new QueryClient(); client.setQueryData(["private"], "old");
  await client.getMutationCache().build(client, { mutationFn: async () => "old-private" }).execute(undefined);
  let finish!: (value: string) => void; let aborted = false;
  const pending = client.fetchQuery({ queryKey: ["late"], queryFn: ({ signal }) => {
    signal.addEventListener("abort", () => { aborted = true; });
    return new Promise<string>(resolve => { finish = resolve; });
  } }).catch(() => undefined);
  adapter(() => ({ payload: null }));
  await resetRecovery(client, "New exact password!", "New exact password!", signal());
  finish("late-private-result"); await pending;
  expect(aborted).toBe(true);
  expect(client.getQueryCache().getAll().map(query => query.queryKey)).toEqual([sessionKey]);
  expect(client.getQueryData(sessionKey)).toBeNull(); expect(client.getMutationCache().getAll()).toEqual([]); client.clear();
});

test("failed reset preserves private cache and is never treated as success", async () => {
  const client = new QueryClient(); client.setQueryData(["private"], "kept");
  adapter(path => ({ status: path.endsWith("/reset") ? 503 : 200, payload: null }));
  await expect(resetRecovery(client, "New exact password!", "New exact password!", signal())).rejects.toMatchObject({ status: 503 });
  expect(client.getQueryData(["private"])).toBe("kept"); client.clear();
});

test("aborted recovery never bootstraps CSRF or submits a code/password", async () => {
  const calls = adapter(() => ({ payload: null }));
  const controller = new AbortController(); controller.abort();
  await expect(requestRecovery("user@example.test", controller.signal)).rejects.toMatchObject({ name: "CanceledError" });
  await expect(verifyRecovery("user@example.test", "01234567", controller.signal)).rejects.toMatchObject({ name: "CanceledError" });
  expect(calls).toEqual([]);
});

test("malformed grant lifetimes cannot advance the flow or leak CSRF", async () => {
  for (const payload of [null, {}, { expires_in: 0 }, { expires_in: 601 }, { expires_in: 1.5 }, { expires_in: "600" }]) {
    adapter(() => ({ payload }));
    await expect(verifyRecovery("user@example.test", "01234567", signal())).rejects.toMatchObject({ kind: "protocol" });
  }
});

test("safe Persian failures distinguish rejected proof, lost grant, rate limits and cancellation", () => {
  const privateMessage = "DO-NOT-DISPLAY-private-secret";
  expect(recoveryFailure(new ApiError(privateMessage, "http", undefined, 401), "code").codeRejected).toBe(true);
  expect(recoveryFailure(new ApiError(privateMessage, "http", undefined, 401), "password").restart).toBe(true);
  expect(recoveryFailure(new ApiError(privateMessage, "http", undefined, 401), "email").codeRejected).toBeUndefined();
  for (const status of [403, 422, 429, 500, 503]) for (const stage of ["email", "code", "password"] as const) {
    const failure = recoveryFailure(new ApiError(privateMessage, "http", undefined, status, undefined, "90"), stage);
    expect(failure.message).not.toContain(privateMessage); expect(failure.message).toMatch(/[آ-ی]/);
    if (status === 429) expect(failure.retryAfter).toBe(90);
  }
  expect(recoveryFailure(new ApiError(privateMessage, "http", undefined, 429, undefined, "invalid"), "email").retryAfter).toBe(60);
  expect(recoveryFailure(new Axios.CanceledError(), "code").cancelled).toBe(true);
});
