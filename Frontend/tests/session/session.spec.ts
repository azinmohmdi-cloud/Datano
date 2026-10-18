import { test, expect } from "@playwright/test";
import Axios, { AxiosHeaders, type AxiosAdapter } from "axios";
import { QueryClient } from "@tanstack/react-query";
import { AXIOS_INSTANCE } from "../../lib/fetcher";
import { ApiError } from "../../lib/api-error";
import { accountDestination, allowedReturnDestination, loginDestination } from "../../data/feature/session/routing";
import { loginSession, logoutSession, parseSession, registerAccount, sessionKey, sessionOptions } from "../../data/feature/session/session";

import { authErrorMessage } from "../../components/feature/identity/SessionBoundary/messages";

const account = { id: "one", first_name: "نام", last_name: "خانوادگی", email: "one@example.test", is_active: true, effective_role: "User" };
const original = AXIOS_INSTANCE.defaults.adapter;
test.afterEach(() => { AXIOS_INSTANCE.defaults.adapter = original; });
function adapter(reply: (url: string, data: unknown) => { status?: number; payload?: unknown } ) {
  AXIOS_INSTANCE.defaults.adapter = (async config => {
    const result = reply(config.url ?? "", config.data ? JSON.parse(config.data) : undefined);
    return { config, status: result.status ?? 200, statusText: "Test", headers: new AxiosHeaders(),
      data: { success: true, message: "OK", payload: config.url?.endsWith("/csrf") ? { csrf_token: "a".repeat(43) } : result.payload } };
  }) satisfies AxiosAdapter;
}

test("role destinations and strict return allowlist reject external, ambiguous and unauthorized targets", () => {
  expect(accountDestination("User")).toBe("/profile");
  expect(accountDestination("Admin")).toBe("/admin/users");
  expect(accountDestination(null)).toBeNull();
  for (const target of ["https://evil.test", "//evil.test", "/\\evil.test", "/%2f%2fevil.test", "/profile?next=https://evil.test", "/profile#x", "/profile/", "/admin/users", "/login", "/signup", "/account", "/websites/private-site", "/ui-review", " /profile", "/profile\n"]) {
    expect(allowedReturnDestination(target, "User"), target).toBeNull();
    expect(loginDestination("User", target)).toBe("/profile");
  }
  expect(loginDestination("User", "/websites")).toBe("/profile");
  expect(loginDestination("Admin", "/admin/users")).toBe("/admin/users");
  expect(loginDestination(null, "/profile")).toBeNull();
});

test("only validated active server identity maps to session; role arrays and private fields are discarded", () => {
  expect(parseSession({ ...account, roles: [{ name: "Admin" }], csrf_token: "secret" })).toEqual({ id: "one", firstName: "نام", lastName: "خانوادگی", email: account.email, role: "User" });
  for (const invalid of [null, {}, { ...account, is_active: false }, { ...account, effective_role: "admin" }, { ...account, effective_role: undefined }, { ...account, id: 1 }]) {
    expect(() => parseSession(invalid)).toThrow("Invalid session response");
  }
  expect(parseSession({ ...account, effective_role: null }).role).toBeNull();
});

test("logout cancels late private queries, clears query and mutation caches and stores anonymous state", async () => {
  const client = new QueryClient();
  client.setQueryData(sessionKey, parseSession(account));
  client.setQueryData(["private-sites"], { private: "old" });
  await client.getMutationCache().build(client, { mutationFn: async () => "private-result" }).execute(undefined);
  let finish!: (value: string) => void;
  let aborted = false;
  const pending = client.fetchQuery({ queryKey: ["late-private"], queryFn: ({ signal }) => {
    signal.addEventListener("abort", () => { aborted = true; });
    return new Promise<string>(resolve => { finish = resolve; });
  } }).catch(() => undefined);
  adapter(() => ({ payload: null }));
  await logoutSession(client);
  finish("private-late-response"); await pending;
  expect(aborted).toBe(true);
  expect(client.getQueryCache().getAll().map(query => query.queryKey)).toEqual([sessionKey]);
  expect(client.getQueryData(sessionKey)).toBeNull();
  expect(client.getMutationCache().getAll()).toEqual([]);
  client.clear();
});

test("failed logout preserves authenticated cache and is not reported as success", async () => {
  const client = new QueryClient();
  client.setQueryData(sessionKey, parseSession(account)); client.setQueryData(["private"], "kept");
  adapter(url => ({ status: url.endsWith("/logout") ? 503 : 200, payload: null }));
  await expect(logoutSession(client)).rejects.toMatchObject({ status: 503 });
  expect(client.getQueryData(["private"])).toBe("kept");
  expect(client.getQueryData(sessionKey)).toEqual(parseSession(account)); client.clear();
});

test("login clears another account cache and uses fresh me role without caching CSRF or passwords", async () => {
  const client = new QueryClient();
  client.setQueryData(["old-private"], "private");
  let submitted: unknown;
  adapter((url, data) => {
    if (url.endsWith("/login")) { submitted = data; return { payload: { user: account, effective_role: "Admin", csrf_token: "private-csrf" } }; }
    return { payload: account };
  });
  const values = { email: account.email, password: " exact Unicode رمز ", remember_me: true };
  expect((await loginSession(client, values))?.role).toBe("User");
  expect(submitted).toEqual(values);
  expect(client.getQueryData(["old-private"])).toBeUndefined();
  const cached = JSON.stringify(client.getQueryCache().getAll().map(query => query.state.data));
  expect(cached).not.toContain(values.password); expect(cached).not.toContain("private-csrf");
  expect(client.getMutationCache().getAll()).toEqual([]); client.clear();
});

test("session loss or role/account change removes cached private data", async () => {
  for (const next of [null, { ...account, id: "two" }, { ...account, effective_role: null }]) {
    const client = new QueryClient();
    client.setQueryData(sessionKey, parseSession(account)); client.setQueryData(["private"], "old");
    adapter(() => ({ status: next ? 200 : 401, payload: next }));
    const result = await client.fetchQuery(sessionOptions(client));
    expect(result?.id ?? null).toBe(next?.id ?? null);
    expect(client.getQueryData(["private"])).toBeUndefined(); client.clear();
  }
});

test("registration sends only public contract fields and never logs in automatically", async () => {
  const paths: string[] = []; let submitted: unknown;
  adapter((url, data) => { paths.push(url); submitted = data ?? submitted; return { payload: account }; });
  await registerAccount({ first_name: "نام", last_name: "خانوادگی", email: account.email, password: " exact password ", ...{ role: "Admin", username: "ignored", confirmation: "ignored" } });
  expect(submitted).toEqual({ first_name: "نام", last_name: "خانوادگی", email: account.email, password: " exact password " });
  expect(paths).toEqual(["/api/auth/csrf", "/api/auth/register"]);
});

test("expected auth errors have safe Persian messages without raw server content", () => {
  for (const [status, action, phrase] of [[401, "login", "ایمیل یا رمز"], [409, "register", "حسابی با این ایمیل"], [422, "register", "معتبر نیست"], [429, "login", "تعداد درخواست"], [403, "logout", "تأیید نشد"], [503, "logout", "در دسترس نیست"]] as const) {
    expect(authErrorMessage(new ApiError("private server content", "http", { password: "secret" }, status), action)).toContain(phrase);
  }
  expect(Axios.isCancel(new Axios.CanceledError())).toBe(true);
});
