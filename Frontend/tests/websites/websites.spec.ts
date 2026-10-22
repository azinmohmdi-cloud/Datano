import { expect, test } from "@playwright/test";
import { AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { QueryClient } from "@tanstack/react-query";
import { AXIOS_INSTANCE } from "../../lib/fetcher";
import { parseSession, sessionKey } from "../../data/feature/session/session";
import { parseWebsite, readSelectedWebsite, registerWebsite, validWebsiteSelection, websitesKey, websitesOptions, websiteSelectionKey } from "../../data/feature/websites/websites";

const identity = { id: "owner", first_name: "نام", last_name: "خانوادگی", email: "owner@example.test", is_active: true, effective_role: "User" };
const owner = parseSession(identity);
const stamp = "2026-10-22T10:00:00Z";
const site = { id: "site-1", hostname: "example.test", scheme: "https", url: "https://example.test/", is_verified: false,
  challenge_status: "not-issued", created_at: stamp, updated_at: stamp, reservation_expires_at: stamp, challenge_expires_at: null, verified_at: null };
const original = AXIOS_INSTANCE.defaults.adapter;
const clients: QueryClient[] = [];
test.afterEach(() => { AXIOS_INSTANCE.defaults.adapter = original; for (const client of clients.splice(0)) client.clear(); });
function cache() { const client = new QueryClient(); client.setQueryData(sessionKey, owner); clients.push(client); return client; }
function response(config: InternalAxiosRequestConfig, payload: unknown, status = 200) {
  return { config, status, statusText: "Test", headers: new AxiosHeaders(), data: { success: status === 200, message: "private-server-text", payload } };
}
function adapter(reply: (config: InternalAxiosRequestConfig) => ReturnType<typeof response> | Promise<ReturnType<typeof response>>, current = identity) {
  AXIOS_INSTANCE.defaults.adapter = (async config => config.url?.endsWith("/csrf") ? response(config, { csrf_token: "c".repeat(43) })
    : config.url?.endsWith("/me") ? response(config, current) : reply(config)) satisfies AxiosAdapter;
}
const signal = () => new AbortController().signal;

test("runtime parser retains only the public DTO and rejects malformed identity/status/URLs", () => {
  expect(parseWebsite({ ...site, owner_id: "secret", challenge_digest: "secret" })).toEqual(site);
  for (const patch of [{ id: "../other" }, { url: "https://evil.test/" }, { hostname: "EXAMPLE.test" }, { is_verified: true }, { created_at: "bad" }, { challenge_status: "invented" }]) {
    expect(() => parseWebsite({ ...site, ...patch })).toThrow();
  }
});

test("all API pages form one complete sanitized list; no invented readiness or owner is cached", async () => {
  const client = cache(); const requested: number[] = [];
  adapter(config => { const page = Number(config.params.page); requested.push(page);
    const items = Array.from({ length: page === 1 ? 100 : 1 }, (_, index) => ({ ...site, id: `site-${(page - 1) * 100 + index}`, owner_id: "secret" }));
    return response(config, { items, total: 101, page, size: 100, pages: 2 }); });
  const items = await client.fetchQuery(websitesOptions(client, owner));
  expect(items).toHaveLength(101); expect(requested).toEqual([1, 2]);
  expect(JSON.stringify(client.getQueryData(websitesKey(owner.id)))).not.toMatch(/secret|owner_id|report|csrf|private-server-text/);
});

for (const fault of ["page", "total", "duplicates", "missing"]) test(`inconsistent pagination (${fault}) fails instead of exposing a partial/empty list`, async () => {
  const client = cache();
  adapter(config => response(config, { items: fault === "missing" ? [] : [site, site], total: fault === "total" ? 9 : 2,
    page: fault === "page" ? 2 : 1, size: 100, pages: 1 }));
  await expect(client.fetchQuery(websitesOptions(client, owner))).rejects.toMatchObject({ kind: "protocol" });
  expect(client.getQueryData(websitesKey(owner.id))).toBeUndefined();
});

test("creation sends only canonical URL with cookie/CSRF, invalidates old list and selects confirmed site", async () => {
  const client = cache(); client.setQueryData(websitesKey(owner.id), []); let writes = 0;
  adapter(config => { writes++; expect(config.method).toBe("post"); expect(config.withCredentials).toBe(true);
    expect(JSON.parse(config.data)).toEqual({ url: site.url }); expect(config.headers.get("X-CSRF-Token")).toBe("c".repeat(43));
    return response(config, { ...site, owner_id: "secret" }); });
  expect(await registerWebsite(client, owner, site.url, signal())).toEqual(site);
  expect(writes).toBe(1); expect(client.getQueryData(websiteSelectionKey(owner.id))).toBe(site.id);
  expect(client.getQueryState(websitesKey(owner.id))?.isInvalidated).toBe(true);
  expect(client.getQueryData(websitesKey(owner.id))).toEqual([]); // Never invent a complete optimistic list.
  expect(client.getMutationCache().getAll()).toEqual([]);
});

for (const status of [409, 422, 403, 503]) test(`failed create ${status} never retries/selects/succeeds and refreshes ambiguous state`, async () => {
  const client = cache(); client.setQueryData(websitesKey(owner.id), []); let writes = 0;
  adapter(config => { writes++; return response(config, { detail: "private" }, status); });
  await expect(registerWebsite(client, owner, site.url, signal())).rejects.toMatchObject({ status });
  expect(writes).toBe(1); expect(client.getQueryData(websiteSelectionKey(owner.id))).toBeUndefined();
  expect(client.getQueryState(websitesKey(owner.id))?.isInvalidated).toBe(true);
});

test("same-owner duplicate accepts existing original scheme and verified state", async () => {
  const client = cache(); const existing = { ...site, scheme: "http", url: "http://example.test/", is_verified: true, verified_at: stamp, challenge_status: "verified" };
  adapter(config => response(config, existing));
  expect(await registerWebsite(client, owner, site.url, signal())).toEqual(existing);
});

test("selection is restricted to current list; foreign IDs send no detail request; stale 404 clears selection", async () => {
  const client = cache(); client.setQueryData(websitesKey(owner.id), [site]); client.setQueryData(websiteSelectionKey(owner.id), site.id); let requests = 0;
  expect(validWebsiteSelection([parseWebsite(site)], "foreign")).toBe(site.id);
  expect(validWebsiteSelection([], site.id)).toBeNull();
  expect(validWebsiteSelection([parseWebsite(site), parseWebsite({ ...site, id: "two" })], "foreign")).toBeNull();
  adapter(config => { requests++; return response(config, null, 404); });
  await expect(readSelectedWebsite(client, owner, "foreign", signal())).rejects.toMatchObject({ kind: "protocol" }); expect(requests).toBe(0);
  await expect(readSelectedWebsite(client, owner, site.id, signal())).rejects.toMatchObject({ status: 404 });
  expect(client.getQueryData(websiteSelectionKey(owner.id))).toBeNull();
  expect(client.getQueryState(websitesKey(owner.id))?.isInvalidated).toBe(true);
});

for (const changed of [{ id: "other" }, { email: "changed@example.test" }, { effective_role: "Admin" }]) test(`fresh cookie identity change ${JSON.stringify(changed)} blocks writes and clears private state`, async () => {
  const client = cache(); client.setQueryData(websitesKey(owner.id), [site]); let writes = 0;
  adapter(config => { writes++; return response(config, site); }, { ...identity, ...changed });
  await expect(registerWebsite(client, owner, site.url, signal())).rejects.toMatchObject({ kind: "protocol" });
  expect(writes).toBe(0); expect(client.getQueryData(websitesKey(owner.id))).toBeUndefined();
  expect(client.getQueryData(sessionKey)).toEqual(parseSession({ ...identity, ...changed }));
});

for (const sameOwner of [false, true]) test(`late create cannot publish after session replacement, same owner=${sameOwner}`, async () => {
  const client = cache(); let finish: () => void = () => {}; let started: () => void = () => {};
  const ready = new Promise<void>(resolve => { started = resolve; });
  adapter(config => new Promise(resolve => { finish = () => resolve(response(config, site)); started(); }));
  const operation = registerWebsite(client, owner, site.url, signal()); const rejected = expect(operation).rejects.toMatchObject({ kind: "protocol" });
  await ready; client.clear(); client.setQueryData(sessionKey, { ...owner, id: sameOwner ? owner.id : "other" }); finish(); await rejected;
  expect(client.getQueryData(websiteSelectionKey(owner.id))).toBeUndefined(); expect(client.getQueryData(websitesKey(owner.id))).toBeUndefined();
});

test("owner switch after response rejects the result and publishes the new session", async () => {
  const client = cache(); let me = 0;
  AXIOS_INSTANCE.defaults.adapter = (async config => response(config, config.url?.endsWith("/csrf") ? { csrf_token: "c".repeat(43) }
    : config.url?.endsWith("/me") ? { ...identity, id: ++me === 1 ? owner.id : "other" } : site)) satisfies AxiosAdapter;
  await expect(registerWebsite(client, owner, site.url, signal())).rejects.toMatchObject({ kind: "protocol" });
  expect(client.getQueryData(sessionKey)).toMatchObject({ id: "other" }); expect(client.getQueryData(websiteSelectionKey(owner.id))).toBeUndefined();
});

test("anonymous and aborted operations send no requests", async () => {
  const client = cache(); let requests = 0; adapter(config => { requests++; return response(config, site); });
  const controller = new AbortController(); controller.abort();
  await expect(registerWebsite(client, owner, site.url, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  client.clear(); await expect(registerWebsite(client, owner, site.url, signal())).rejects.toMatchObject({ kind: "protocol" }); expect(requests).toBe(0);
});

test("expired cookie during list clears private queries and publishes anonymous session", async () => {
  const client = cache(); client.setQueryData(websiteSelectionKey(owner.id), site.id);
  AXIOS_INSTANCE.defaults.adapter = (async config => response(config, null, 401)) satisfies AxiosAdapter;
  await expect(client.fetchQuery(websitesOptions(client, owner))).rejects.toBeDefined();
  // Query cancellation rejects its observer before cache/session cleanup settles.
  await expect.poll(() => client.getQueryData(sessionKey)).toBeNull();
  expect(client.getQueryData(websitesKey(owner.id))).toBeUndefined(); expect(client.getQueryData(websiteSelectionKey(owner.id))).toBeUndefined();
});

test("late list response cannot enter a replaced account cache", async () => {
  const client = cache(); let finish: () => void = () => {}; let started: () => void = () => {};
  const ready = new Promise<void>(resolve => { started = resolve; });
  adapter(config => new Promise(resolve => { finish = () => resolve(response(config, { items: [site], total: 1, page: 1, size: 100, pages: 1 })); started(); }));
  const operation = client.fetchQuery(websitesOptions(client, owner)); const rejected = expect(operation).rejects.toBeDefined();
  await ready; client.clear(); client.setQueryData(sessionKey, { ...owner, id: "other" }); finish(); await rejected;
  expect(client.getQueryData(websitesKey(owner.id))).toBeUndefined(); expect(client.getQueryData(sessionKey)).toMatchObject({ id: "other" });
});

test("detail with another ID cannot authorize navigation", async () => {
  const client = cache(); client.setQueryData(websitesKey(owner.id), [site]);
  adapter(config => response(config, { ...site, id: "other-site" }));
  await expect(readSelectedWebsite(client, owner, site.id, signal())).rejects.toMatchObject({ kind: "protocol" });
});

test("aborting an in-flight create blocks selection and invalidates an ambiguous list", async () => {
  const client = cache(); client.setQueryData(websitesKey(owner.id), []);
  const controller = new AbortController(); let finish: () => void = () => {}; let started: () => void = () => {};
  const ready = new Promise<void>(resolve => { started = resolve; });
  adapter(config => { expect(config.signal).toBe(controller.signal); return new Promise(resolve => { finish = () => resolve(response(config, site)); started(); }); });
  const operation = registerWebsite(client, owner, site.url, controller.signal); const rejected = expect(operation).rejects.toBeDefined();
  await ready; controller.abort(); finish(); await rejected;
  expect(client.getQueryData(websiteSelectionKey(owner.id))).toBeUndefined(); expect(client.getQueryState(websitesKey(owner.id))?.isInvalidated).toBe(true);
});
