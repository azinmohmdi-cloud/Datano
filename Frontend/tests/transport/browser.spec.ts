import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

for (const target of ["functions", "hooks"] as const) {
  test(`${target}: real API cookies, CSRF rotation, errors and logout`, async ({ page, context }) => {
    const calls: { path: string; method: string; origin?: string; csrf: boolean }[] = [];
    const observations: Promise<void>[] = [];
    page.on("request", request => {
      const url = new URL(request.url());
      if (!url.pathname.startsWith("/api/")) return;
      observations.push(request.allHeaders().then(headers => {
        calls.push({ path: url.pathname, method: request.method(), origin: headers.origin,
          csrf: /^[A-Za-z0-9_-]{43}$/.test(headers["x-csrf-token"] || "") });
      }));
    });
    await page.goto("/");
    await page.waitForFunction(() => Boolean(window.datanoTransport));
    const result = await page.evaluate(async ({ target, email }) => {
      const api = window.datanoTransport?.[target];
      if (!api) throw new Error("Transport harness unavailable");
      const password = "Transport fixture password 123!";
      const registration = await api.registerUserApiAuthRegisterPost({ first_name: "Transport", last_name: "Owner", email, password });
      const login = await api.loginApiAuthLoginPost({ email, password, remember_me: true });
      const me = await api.getMeApiAuthMeGet();
      const forbidden = await api.getUsersApiUsersGet().then(() => 0, error => error.status);
      const readableCookie = document.cookie;
      const logout = await api.logoutApiAuthLogoutPost();
      const expired = await api.getMeApiAuthMeGet().then(() => 0, error => error.status);
      const relogin = await api.loginApiAuthLoginPost({ email, password });
      const fresh = await api.getMeApiAuthMeGet();
      return { registered: registration.success && registration.payload?.is_active,
        identity: login.payload?.user.id === me.payload?.id, role: me.payload?.effective_role,
        csrfRotated: login.payload?.csrf_token !== relogin.payload?.csrf_token,
        forbidden, expired, logout: logout.success && logout.payload === null,
        fresh: fresh.success, readableCookie, localStorage: localStorage.length, sessionStorage: sessionStorage.length };
    }, { target, email: `transport-${randomUUID()}@example.test` });
    expect(result).toEqual({ registered: true, identity: true, role: "User", csrfRotated: true,
      forbidden: 403, expired: 401, logout: true, fresh: true, readableCookie: "", localStorage: 0, sessionStorage: 0 });
    const cookies = await context.cookies();
    expect(cookies.some(cookie => cookie.name === "datano_session_dev" && cookie.httpOnly)).toBe(true);
    expect(cookies.some(cookie => cookie.name === "datano_csrf_dev" && cookie.httpOnly)).toBe(true);
    await Promise.all(observations);
    expect(calls.filter(call => call.method === "POST").every(call => call.csrf && call.origin === "http://127.0.0.1:3139")).toBe(true);
    expect(calls.some(call => call.path === "/api/auth/refresh")).toBe(false);
  });

  test(`${target}: browser abort cancels the actual generated request`, async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => Boolean(window.datanoTransport));
    let release: (() => void) | undefined;
    const released = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/ping", async route => { await released; await route.abort(); });
    const entered = page.waitForRequest(request => new URL(request.url()).pathname === "/api/ping");
    const pending = page.evaluate(async target => {
      const api = window.datanoTransport?.[target];
      if (!api) throw new Error("Transport harness unavailable");
      const controller = new AbortController();
      window.abortTransportTest = () => controller.abort();
      return api.pingApiPingGet({ signal: controller.signal }).then(() => "unexpected-success", error => error.code);
    }, target);
    try {
      await entered;
      await page.evaluate(() => window.abortTransportTest?.());
      expect(await pending).toBe("ERR_CANCELED");
    } finally { release?.(); }
  });
}
