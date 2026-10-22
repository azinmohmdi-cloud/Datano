import { expect, test } from "@playwright/test";
import { AxiosHeaders, type AxiosAdapter } from "axios";
import { QueryClient } from "@tanstack/react-query";
import { AXIOS_INSTANCE } from "../../lib/fetcher";
import { parseSession, sessionKey } from "../../data/feature/session/session";
import { parseWebsite, websitesKey } from "../../data/feature/websites/websites";
import { issueWebsiteChallenge, readOwnWebsite, parseWebsiteProof, verifyWebsiteChallenge, websiteKey, websiteOptions } from "../../data/feature/websites/websiteProof";

const account = { id: "owner", first_name: "نام", last_name: "خانوادگی", email: "owner@example.test", is_active: true, effective_role: "User" };
const owner = parseSession(account);
const site = parseWebsite({ id: "site-one", hostname: "example.test", scheme: "https", url: "https://example.test/", is_verified: false,
  challenge_status: "not-issued", created_at: "2026-10-22T09:00:00Z", updated_at: "2026-10-22T09:00:00Z", reservation_expires_at: "2026-10-23T09:00:00Z", challenge_expires_at: null, verified_at: null });
const pending = { ...site, challenge_status: "pending" as const, updated_at: "2026-10-22T10:00:00Z", challenge_expires_at: "2026-10-23T10:00:00Z", reservation_expires_at: "2026-10-23T10:00:00Z" };
const token = "a".repeat(43);
const metaTag = `<meta name="datano-verification" content="${token}">`;
const original = AXIOS_INSTANCE.defaults.adapter;
test.afterEach(() => { AXIOS_INSTANCE.defaults.adapter = original; });

test("real issuance sends only empty JSON and publishes the exact server tag without caching plaintext", async () => {
  const client = new QueryClient(); client.setQueryData(sessionKey, owner); client.setQueryData(websitesKey(owner.id), [site]); let writes = 0;
  AXIOS_INSTANCE.defaults.adapter = (async config => {
    let payload: unknown = account;
    if (config.url?.endsWith("/csrf")) payload = { csrf_token: "c".repeat(43) };
    else if (config.url?.endsWith("/challenge")) {
      writes++; expect(config.method).toBe("post"); expect(JSON.parse(config.data)).toEqual({});
      expect(config.withCredentials).toBe(true); expect(config.headers.get("X-CSRF-Token")).toBe("c".repeat(43));
      payload = { website: pending, token, meta_tag: metaTag };
    }
    return { config, status: 200, statusText: "Test", headers: new AxiosHeaders(), data: { success: true, message: "private text", payload } };
  }) satisfies AxiosAdapter;
  try {
    const proof = await issueWebsiteChallenge(client, owner, site, new AbortController().signal);
    expect(proof.metaTag).toBe(metaTag); expect(proof.website).toEqual(pending); expect(writes).toBe(1);
    expect(JSON.stringify(client.getQueryCache().getAll().map(query => query.state.data))).not.toContain(token);
    expect(client.getMutationCache().getAll()).toEqual([]);
  } finally { client.clear(); }
});

// Controlled API adapter exercises real generated callers and the shared transport.
const verified = { ...pending, is_verified: true, challenge_status: "verified" as const, verified_at: "2026-10-22T11:00:00Z", updated_at: "2026-10-22T11:00:00Z" };
const caches: QueryClient[] = [];
function cache() { const client = new QueryClient(); client.setQueryData(sessionKey, owner); client.setQueryData(websitesKey(owner.id), [site]); caches.push(client); return client; }
test.afterEach(() => { for (const client of caches.splice(0)) client.clear(); });
function respond(config: Parameters<AxiosAdapter>[0], payload: unknown, status = 200) {
  return { config, status, statusText: "Test", headers: new AxiosHeaders(), data: { success: status === 200, message: "PRIVATE", payload } };
}
function reply(operation: (config: Parameters<AxiosAdapter>[0]) => ReturnType<typeof respond> | Promise<ReturnType<typeof respond>>, current = account) {
  AXIOS_INSTANCE.defaults.adapter = (async config => config.url?.endsWith("/csrf") ? respond(config, { csrf_token: "c".repeat(43) })
    : config.url?.endsWith("/me") ? respond(config, current) : operation(config)) satisfies AxiosAdapter;
}
const signal = () => new AbortController().signal;

test("proof parser rejects mismatched, malformed, non-pending and non-24-hour issuance", () => {
  const value = { website: pending, token, meta_tag: metaTag };
  expect(parseWebsiteProof({ ...value, owner_id: "secret", ignored: "secret" }, site)).toEqual({ website: pending, metaTag });
  for (const patch of [{ token: "short" }, { meta_tag: `${metaTag}<script>bad()</script>` },
    { website: { ...pending, id: "other" } }, { website: { ...pending, scheme: "http", url: "http://example.test/" } },
    { website: { ...pending, hostname: "foreign.test", url: "https://foreign.test/" } }, { website: verified },
    { website: { ...pending, challenge_expires_at: "2026-10-24T10:00:00Z" } }, { website: { ...pending, challenge_expires_at: null } }]) {
    expect(() => parseWebsiteProof({ ...value, ...patch }, site)).toThrow();
  }
});

test("own detail works without a list and rejects another ID or unsafe route parameter", async () => {
  const client = cache(); client.removeQueries({ queryKey: websitesKey(owner.id) }); let reads = 0;
  reply(config => { reads++; return respond(config, site); });
  expect(await client.fetchQuery(websiteOptions(client, owner, site.id))).toEqual(site); expect(reads).toBe(1);
  await expect(readOwnWebsite(client, owner, "../other", signal())).rejects.toMatchObject({ kind: "protocol" }); expect(reads).toBe(1);
  reply(config => respond(config, { ...site, id: "other" }));
  await expect(readOwnWebsite(client, owner, site.id, signal())).rejects.toMatchObject({ kind: "protocol" });
});

test("verification accepts only authoritative verified state and refreshes public metadata without readiness", async () => {
  const client = cache(); let writes = 0;
  reply(config => { writes++; expect(config.url).toBe(`/api/websites/${site.id}/verify`); expect(JSON.parse(config.data)).toEqual({}); return respond(config, { ...verified, report: "ready", owner_id: "secret" }); });
  expect(await verifyWebsiteChallenge(client, owner, site, signal())).toEqual(verified);
  expect(client.getQueryData(websiteKey(owner.id, site.id))).toEqual(verified); expect(writes).toBe(1);
  expect(client.getQueryState(websitesKey(owner.id))?.isInvalidated).toBe(true);
  expect(JSON.stringify(client.getQueryCache().getAll().map(q => q.state.data))).not.toMatch(/report|secret|PRIVATE/);
});

for (const status of [401, 403, 404, 409, 429, 503]) test(`failed verify ${status} is never retried or cached as success`, async () => {
  const client = cache(); let writes = 0;
  reply(config => { writes++; return respond(config, { token: "PRIVATE" }, status); });
  await expect(verifyWebsiteChallenge(client, owner, site, signal())).rejects.toMatchObject({ status });
  expect(writes).toBe(1); expect(client.getQueryData(websiteKey(owner.id, site.id))).toBeUndefined();
  expect(client.getQueryState(websitesKey(owner.id))?.isInvalidated).toBe(true);
  expect(client.getMutationCache().getAll()).toEqual([]);
});

for (const payload of [pending, { ...verified, id: "other" }, { ...verified, hostname: "other.test", url: "https://other.test/" }]) test(`successful HTTP with unchecked proof ${payload.id}/${payload.hostname}/${payload.is_verified} cannot grant`, async () => {
  const client = cache(); reply(config => respond(config, payload));
  await expect(verifyWebsiteChallenge(client, owner, site, signal())).rejects.toMatchObject({ kind: "protocol" });
  expect(client.getQueryData(websiteKey(owner.id, site.id))).toBeUndefined();
});

for (const sameAccount of [false, true]) test(`late issuance after session replacement cannot publish plaintext or public state, sameAccount=${sameAccount}`, async () => {
  const client = cache(); let start: () => void = () => {}; let finish: () => void = () => {};
  const started = new Promise<void>(resolve => { start = resolve; });
  reply(config => new Promise(resolve => { finish = () => resolve(respond(config, { website: pending, token, meta_tag: metaTag })); start(); }));
  const operation = issueWebsiteChallenge(client, owner, site, signal()); const rejected = expect(operation).rejects.toMatchObject({ kind: "protocol" });
  await started; client.clear(); client.setQueryData(sessionKey, { ...owner, id: sameAccount ? owner.id : "other" }); finish(); await rejected;
  expect(client.getQueryData(websiteKey(owner.id, site.id))).toBeUndefined();
  expect(JSON.stringify(client.getQueryCache().getAll().map(q => q.state.data))).not.toContain(token);
});

test("abort during a committed-looking verify never publishes success and invalidates old list", async () => {
  const client = cache(); const controller = new AbortController(); let start: () => void = () => {}; let finish: () => void = () => {};
  const started = new Promise<void>(resolve => { start = resolve; });
  reply(config => new Promise(resolve => { finish = () => resolve(respond(config, verified)); start(); }));
  const operation = verifyWebsiteChallenge(client, owner, site, controller.signal); const rejected = expect(operation).rejects.toBeDefined();
  await started; controller.abort(); finish(); await rejected;
  expect(client.getQueryData(websiteKey(owner.id, site.id))).toBeUndefined();
  expect(client.getQueryState(websitesKey(owner.id))?.isInvalidated).toBe(true);
});

test("fresh cookie identity change blocks issuance before a write and clears old private cache", async () => {
  const client = cache(); let writes = 0;
  reply(config => { writes++; return respond(config, { website: pending, token, meta_tag: metaTag }); }, { ...account, id: "other" });
  await expect(issueWebsiteChallenge(client, owner, site, signal())).rejects.toMatchObject({ kind: "protocol" });
  expect(writes).toBe(0); expect(client.getQueryData(websitesKey(owner.id))).toBeUndefined(); expect(client.getQueryData(sessionKey)).toMatchObject({ id: "other" });
});
