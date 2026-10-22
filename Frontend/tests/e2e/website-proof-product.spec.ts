import { expect, test, type Page } from "@playwright/test";

const account = { id: "proof-owner", first_name: "کاربر", last_name: "سایت", email: "proof@example.test", is_active: true, effective_role: "User", roles: [] };
const token = "a".repeat(43);
const tag = (value = token) => `<meta name="datano-verification" content="${value}">`;
function website() {
  const created = new Date(Date.now() - 172_800_000).toISOString();
  return { id: "proof-site", hostname: "example.test", scheme: "https", url: "https://example.test/", is_verified: false,
    challenge_status: "not-issued", created_at: created, updated_at: created, reservation_expires_at: new Date(Date.now() + 86_400_000).toISOString(), challenge_expires_at: null as string | null, verified_at: null as string | null };
}
function pending(site: ReturnType<typeof website>, seconds = 86_400) {
  const expiry = Date.now() + seconds * 1000;
  return { ...site, challenge_status: "pending", updated_at: new Date(expiry - 86_400_000).toISOString(), challenge_expires_at: new Date(expiry).toISOString(), reservation_expires_at: new Date(expiry).toISOString() };
}
function verified(site: ReturnType<typeof website>) { return { ...site, is_verified: true, challenge_status: "verified", verified_at: new Date().toISOString() }; }
async function session(page: Page) {
  await page.route("**/api/auth/**", route => route.fulfill({ json: { success: true, message: "OK", payload: new URL(route.request().url()).pathname.endsWith("/csrf") ? { csrf_token: "c".repeat(43) } : account } }));
}
const envelope = (payload: unknown) => ({ success: true, message: "PRIVATE SERVER TEXT", payload });

test("copies exact server proof, preserves failed proof, displays real success and hands off sources without report readiness", async ({ page, context }, info) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]); await session(page);
  let site = website(); let issues = 0; let checks = 0;
  await page.route("**/api/websites/**", async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (path.endsWith("/challenge")) {
      issues++; expect(request.postDataJSON()).toEqual({}); expect(await request.headerValue("x-csrf-token")).toBe("c".repeat(43)); site = pending(site);
      await route.fulfill({ json: envelope({ website: site, token, meta_tag: tag() }) });
    } else if (path.endsWith("/verify")) {
      checks++; expect(request.postDataJSON()).toEqual({});
      if (checks === 1) await route.fulfill({ status: 409, json: { detail: "PRIVATE TOKEN OWNER" } });
      else { site = verified(site); await route.fulfill({ json: envelope(site) }); }
    } else await route.fulfill({ json: envelope(path.endsWith(site.id) ? site : { items: [site], total: 1, page: 1, size: 100, pages: 1 }) });
  });
  await page.goto("/websites/proof-site/verify?state=success&token=forged");
  await expect(page.locator("textarea")).toHaveCount(0); expect(issues).toBe(0);
  await page.getByRole("button", { name: "دریافت کد تأیید", exact: true }).click();
  const code = page.getByRole("textbox", { name: "کد HTML تأیید مالکیت", exact: true });
  await expect(code).toHaveValue(tag()); await expect(page.locator('meta[name="datano-verification"]')).toHaveCount(0); expect(issues).toBe(1);
  await page.getByRole("button", { name: "کپی کد", exact: true }).click();
  await expect(page.getByText("کد کپی شد.", { exact: true })).toBeVisible(); expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(tag());
  await page.getByRole("button", { name: "بررسی تأیید", exact: true }).click();
  await expect(page.locator("[data-verification-feedback]")).toContainText("کد معتبر"); await expect(code).toHaveValue(tag());
  await expect(page.getByText("PRIVATE TOKEN OWNER", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "تلاش مجدد", exact: true }).click();
  await expect(page.getByRole("heading", { name: "سایت با موفقیت تأیید شد", exact: true })).toBeVisible();
  await expect(page.locator("textarea")).toHaveCount(0); await expect(page.locator("[data-verification-feedback]")).toContainText("به‌تنهایی گزارش آماده ایجاد نمی‌کند");
  await page.screenshot({ path: info.outputPath("verified.png"), fullPage: true });
  await page.getByRole("button", { name: "اتصال منابع گوگل", exact: true }).click();
  await expect(page).toHaveURL("/websites/proof-site/connect"); await expect(page.getByText("مالکیت: تأیید شده", { exact: true })).toBeVisible();
  await expect(page.getByText("اتصال منابع در حال حاضر در دسترس نیست.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "ورود به حساب", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "بازگشت به سایت‌های من", exact: true }).click();
  await expect(page.locator("[data-website-row]")).toContainText("تأیید شده");
  await expect(page.locator("[data-website-row]")).toContainText("وضعیت گزارش در دسترس نیست");
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
  expect(checks).toBe(2);
});

test("reload keeps existing challenge valid and can verify without recovering plaintext or issuing automatically", async ({ page }) => {
  await session(page); let site: ReturnType<typeof website> = pending(website()); let writes = 0;
  await page.route("**/api/websites/**", route => {
    if (route.request().method() === "POST") { writes++; expect(new URL(route.request().url()).pathname).toMatch(/\/verify$/); site = verified(site); }
    return route.fulfill({ json: envelope(site) });
  });
  await page.goto("/websites/proof-site/verify"); await expect(page.getByRole("button", { name: "بررسی تأیید", exact: true })).toBeEnabled();
  await page.reload(); await expect(page.getByRole("button", { name: "بررسی تأیید", exact: true })).toBeEnabled();
  await expect(page.locator("textarea")).toHaveCount(0); expect(writes).toBe(0);
  await page.getByRole("button", { name: "بررسی تأیید", exact: true }).click();
  await expect(page.getByText("سایت با موفقیت تأیید شد", { exact: true })).toBeVisible(); expect(writes).toBe(1);
});

test("actual expiry disables old copy/check and renewal replaces the exact code only after successful issuance", async ({ page }) => {
  await page.clock.install(); await session(page); let site = website(); let issues = 0;
  await page.route("**/api/websites/**", route => {
    if (route.request().method() !== "POST") return route.fulfill({ json: envelope(site) });
    issues++;
    if (issues === 2) return route.fulfill({ status: 503, json: { detail: "private" } });
    site = pending(site, issues === 1 ? 3 : 86_400);
    return route.fulfill({ json: envelope({ website: site, token: issues === 1 ? token : "b".repeat(43), meta_tag: tag(issues === 1 ? token : "b".repeat(43)) }) });
  });
  await page.goto("/websites/proof-site/verify"); await page.getByRole("button", { name: "دریافت کد تأیید", exact: true }).click();
  const code = page.getByRole("textbox", { name: "کد HTML تأیید مالکیت", exact: true }); await expect(code).toHaveValue(tag());
  await page.clock.fastForward(5000); await expect(page.locator("[data-website-verification]")).toHaveAttribute("data-verification-state", "expired");
  await expect(page.getByRole("button", { name: "کپی کد", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "درخواست کد تازه", exact: true }).click();
  await expect(page.locator("[data-verification-feedback]")).toContainText("انجام درخواست امکان‌پذیر نیست"); await expect(code).toHaveValue(tag());
  await page.getByRole("button", { name: "درخواست کد تازه", exact: true }).click(); await expect(code).toHaveValue(tag("b".repeat(43)));
  await expect(page.getByRole("button", { name: "کپی کد", exact: true })).toBeEnabled(); expect(issues).toBe(3);
});

for (const status of [404, 503]) test(`detail failure ${status} does not expose a proof or allow writes`, async ({ page }) => {
  await session(page); let reads = 0; let writes = 0;
  await page.route("**/api/websites/**", route => { if (route.request().method() === "POST") writes++; else reads++;
    return route.fulfill({ status, json: { detail: "PRIVATE OWNER" } }); });
  await page.goto("/websites/foreign/verify?state=success");
  await expect(page.getByText(status === 404 ? "این سایت در دسترس نیست." : "دریافت اطلاعات سایت امکان‌پذیر نیست.", { exact: true })).toBeVisible();
  await expect(page.locator("textarea, [data-website-verification]")).toHaveCount(0); expect(writes).toBe(0);
  if (status === 503) { await page.getByRole("button", { name: "تلاش دوباره", exact: true }).click(); await expect.poll(() => reads).toBe(2); }
});

test("pending issuance is single flight and clipboard denial selects the exact inert code", async ({ page }) => {
  await session(page); let site = website(); let writes = 0; let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.addInitScript(() => { Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) } }); });
  await page.route("**/api/websites/**", async route => {
    if (route.request().method() === "POST") { writes++; await gate; site = pending(site); await route.fulfill({ json: envelope({ website: site, token, meta_tag: tag() }) }); }
    else await route.fulfill({ json: envelope(site) });
  });
  await page.goto("/websites/proof-site/verify"); await page.getByRole("button", { name: "دریافت کد تأیید", exact: true }).click();
  await expect(page.getByRole("button", { name: "در حال دریافت کد…", exact: true })).toBeDisabled(); await page.keyboard.press("Enter"); expect(writes).toBe(1);
  release(); await expect(page.getByRole("textbox", { name: "کد HTML تأیید مالکیت", exact: true })).toHaveValue(tag());
  await page.getByRole("button", { name: "کپی کد", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "کد HTML تأیید مالکیت", exact: true })).toBeFocused();
  await expect(page.locator("[data-clipboard-feedback]")).toContainText("کپی خودکار انجام نشد"); expect(writes).toBe(1);
});

test("anonymous route flags do not reveal proof and preserve a safe onboarding return path", async ({ page }) => {
  let writes = 0;
  await page.route("**/api/auth/**", route => route.fulfill({ status: 401, json: { detail: "Unauthorized" } }));
  page.on("request", request => { if (request.method() === "POST") writes++; });
  await page.goto("/websites/proof-site/verify?state=success&token=forged");
  await expect(page).toHaveURL("/login?returnTo=%2Fwebsites%2Fproof-site%2Fverify");
  await expect(page.locator("textarea, [data-website-verification]")).toHaveCount(0); expect(writes).toBe(0);
});

test("approved proof layout remains RTL, keyboard accessible and unclipped in themes and enlarged text", async ({ page }, info) => {
  await session(page); let site = website();
  await page.route("**/api/websites/**", route => {
    if (route.request().method() === "POST") { site = pending(site); return route.fulfill({ json: envelope({ website: site, token, meta_tag: tag() }) }); }
    return route.fulfill({ json: envelope(site) });
  });
  await page.goto("/websites/proof-site/verify"); await page.getByRole("button", { name: "دریافت کد تأیید", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const code = page.getByRole("textbox", { name: "کد HTML تأیید مالکیت", exact: true }); await expect(code).toHaveValue(tag()); await expect(code).toHaveCSS("direction", "ltr");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const dark of [false, true]) {
      await page.evaluate(value => document.documentElement.classList.toggle("dark", value), dark);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator("[data-website-verification]").locator("h1, h2, p, li, a, button, label, dd").evaluateAll(elements => elements.filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent))).toEqual([]);
      if (info.project.name === "desktop" && [390, 1440].includes(width)) await page.screenshot({ path: info.outputPath(`proof-${width}-${dark ? "dark" : "light"}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 390, height: 900 }); await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  await code.focus(); await page.keyboard.press("Tab"); await expect(page.getByRole("button", { name: "کپی کد", exact: true })).toBeFocused();
});
