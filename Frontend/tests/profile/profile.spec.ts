import { expect, test } from "@playwright/test";
import { AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { QueryClient } from "@tanstack/react-query";
import { AXIOS_INSTANCE } from "../../lib/fetcher";
import { ApiError } from "../../lib/api-error";
import { parseSession, sessionKey, sessionOptions } from "../../data/feature/session/session";
import { saveProfileNames } from "../../data/feature/profile/profile";
import { profileErrorMessage } from "../../components/feature/identity/ProfilePage/errors";

const initial = { id: "owner", first_name: "نام", last_name: "اولیه", email: "owner@example.test", is_active: true, effective_role: "User" };
const saved = { ...initial, first_name: "نام سرور", last_name: "خانوادگی سرور" };
const names = { firstName: "  نام\u200cتازه  ", lastName: "Cafe\u0301" };
const original = AXIOS_INSTANCE.defaults.adapter;
const clients: QueryClient[] = [];
test.afterEach(() => { AXIOS_INSTANCE.defaults.adapter = original; for (const client of clients.splice(0)) client.clear(); });
function client() {
  const result = new QueryClient(); result.setQueryData(sessionKey, parseSession(initial)); clients.push(result); return result;
}
function response(config: InternalAxiosRequestConfig, payload: unknown, status = 200) {
  return { config, status, statusText: "Test", headers: new AxiosHeaders(), data: { success: status === 200, message: "private-server-text", payload } };
}
function adapter(reply: (config: InternalAxiosRequestConfig) => ReturnType<typeof response> | Promise<ReturnType<typeof response>>) {
  AXIOS_INSTANCE.defaults.adapter = (async config => config.url?.endsWith("/csrf")
    ? response(config, { csrf_token: "c".repeat(43) }) : reply(config)) satisfies AxiosAdapter;
}

test("generated PATCH uses exact names, credentials/CSRF and updates only authoritative session cache", async () => {
  const cache = client(); cache.setQueryData(["private-other"], "kept");
  let submitted: unknown; let requests = 0;
  adapter(config => {
    expect(config.withCredentials).toBe(true);
    if (config.method === "patch") {
      requests++; submitted = JSON.parse(config.data);
      expect(config.headers.get("X-CSRF-Token")).toBe("c".repeat(43));
      return response(config, saved);
    }
    return response(config, initial);
  });
  expect(await saveProfileNames(cache, initial.id, { ...names, ...{ role: "Admin", id: "ignored" } }, new AbortController().signal)).toEqual(parseSession(saved));
  expect(submitted).toEqual({ first_name: names.firstName, last_name: names.lastName }); expect(requests).toBe(1);
  expect(cache.getQueryData(sessionKey)).toEqual(parseSession(saved)); expect(cache.getQueryData(["private-other"])).toBe("kept");
  expect(cache.getMutationCache().getAll()).toEqual([]);
  expect(JSON.stringify(cache.getQueryCache().getAll().map(query => query.state.data))).not.toContain("csrf");
});

for (const status of [422, 403, 503]) test(`failed PATCH ${status} preserves cache and does not retry`, async () => {
  const cache = client(); let writes = 0;
  adapter(config => { if (config.method === "patch") writes++; return response(config, initial, config.method === "patch" ? status : 200); });
  await expect(saveProfileNames(cache, initial.id, names, new AbortController().signal)).rejects.toMatchObject({ status });
  expect(writes).toBe(1); expect(cache.getQueryData(sessionKey)).toEqual(parseSession(initial)); expect(cache.getMutationCache().getAll()).toEqual([]);
});

test("wrong-owner response is rejected without poisoning the session cache", async () => {
  const cache = client(); adapter(config => response(config, config.method === "patch" ? { ...saved, id: "other" } : initial));
  await expect(saveProfileNames(cache, initial.id, names, new AbortController().signal)).rejects.toMatchObject({ kind: "protocol" });
  expect(cache.getQueryData(sessionKey)).toEqual(parseSession(initial));
});

test("fresh cookie owner is checked before writing and identity change clears old private cache", async () => {
  const cache = client(); cache.setQueryData(["private-old"], "old"); let writes = 0;
  adapter(config => { if (config.method === "patch") writes++; return response(config, { ...initial, id: "other" }); });
  await expect(saveProfileNames(cache, initial.id, names, new AbortController().signal)).rejects.toMatchObject({ kind: "protocol" });
  expect(writes).toBe(0); expect(cache.getQueryData(sessionKey)).toMatchObject({ id: "other" }); expect(cache.getQueryData(["private-old"])).toBeUndefined();
});

for (const sameOwner of [false, true]) test(`late save cannot restore a replaced session, same owner=${sameOwner}`, async () => {
  const cache = client(); let complete: () => void = () => {}; let started: () => void = () => {};
  const ready = new Promise<void>(resolve => { started = resolve; });
  adapter(config => {
    if (config.method !== "patch") return response(config, initial);
    return new Promise(resolve => { complete = () => resolve(response(config, saved)); started(); });
  });
  const pending = saveProfileNames(cache, initial.id, names, new AbortController().signal);
  const rejected = expect(pending).rejects.toMatchObject({ kind: "protocol" });
  await ready; cache.clear(); const next = parseSession({ ...initial, id: sameOwner ? initial.id : "other" }); cache.setQueryData(sessionKey, next);
  complete(); await rejected; expect(cache.getQueryData(sessionKey)).toEqual(next);
});

test("a late pre-save session read is cancelled so it cannot replace the saved names", async () => {
  const cache = client(); let release: () => void = () => {}; let aborted = false; let isStaleRead = true;
  adapter(config => {
    if (config.method === "patch") return response(config, saved);
    if (!isStaleRead) return response(config, initial);
    isStaleRead = false;
    config.signal?.addEventListener?.("abort", () => { aborted = true; });
    return new Promise(resolve => { release = () => resolve(response(config, initial)); });
  });
  const old = cache.fetchQuery(sessionOptions(cache)).catch(() => undefined);
  await saveProfileNames(cache, initial.id, names, new AbortController().signal);
  release(); await old;
  expect(aborted).toBe(true); expect(cache.getQueryData(sessionKey)).toEqual(parseSession(saved));
});

test("aborted or anonymous calls send no requests; expiry reconciles to anonymous", async () => {
  const cache = client(); const controller = new AbortController(); controller.abort(); let requests = 0;
  adapter(config => { requests++; return response(config, null, 401); });
  await expect(saveProfileNames(cache, initial.id, names, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  expect(requests).toBe(0); cache.setQueryData(["private-old"], "old");
  await expect(saveProfileNames(cache, initial.id, names, new AbortController().signal)).rejects.toMatchObject({ status: 401 });
  expect(cache.getQueryData(sessionKey)).toBeNull(); expect(cache.getQueryData(["private-old"])).toBeUndefined();
  const count = requests;
  await expect(saveProfileNames(cache, initial.id, names, new AbortController().signal)).rejects.toMatchObject({ kind: "protocol" });
  expect(requests).toBe(count);
});

test("error text is fixed Persian and never server content", () => {
  for (const status of [401, 403, 422, 429, 500, 503]) {
    const text = profileErrorMessage(new ApiError("private-secret", "http", { raw: "private-secret" }, status));
    expect(text).not.toContain("private-secret"); expect(text).toMatch(/[آ-ی]/);
  }
});

test("server role change after save clears other protected data and retains verified role", async () => {
  const cache = client(); cache.setQueryData(["private-old-role"], "old");
  adapter(config => response(config, config.method === "patch" ? { ...saved, effective_role: "Admin" } : initial));
  const result = await saveProfileNames(cache, initial.id, names, new AbortController().signal);
  expect(result.role).toBe("Admin"); expect(cache.getQueryData(["private-old-role"])).toBeUndefined();
  expect(cache.getQueryData(sessionKey)).toEqual(result);
});

test("in-flight cancellation reaches transport and never publishes success or cached drafts", async () => {
  const cache = client(); const controller = new AbortController(); let started: () => void = () => {}; let finish: () => void = () => {};
  const ready = new Promise<void>(resolve => { started = resolve; });
  adapter(config => {
    expect(config.signal).toBe(controller.signal);
    if (config.method !== "patch") return response(config, initial);
    return new Promise(resolve => { finish = () => resolve(response(config, saved)); started(); });
  });
  const operation = saveProfileNames(cache, initial.id, names, controller.signal);
  const rejected = expect(operation).rejects.toBeDefined();
  await ready; controller.abort(); finish(); await rejected;
  expect(cache.getQueryData(sessionKey)).toEqual(parseSession(initial)); expect(cache.getMutationCache().getAll()).toEqual([]);
});
