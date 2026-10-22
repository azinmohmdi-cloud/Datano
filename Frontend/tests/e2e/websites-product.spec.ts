import { expect, test, type Page } from "@playwright/test";

const account = { id: "website-owner", first_name: "کاربر", last_name: "سایت", email: "owner@example.test", is_active: true, effective_role: "User", roles: [] };
const stamp = "2026-10-22T10:00:00Z";
const website = (id = "site-one", hostname = "example.test", verified = false) => ({ id, hostname, scheme: "https", url: `https://${hostname}/`, is_verified: verified,
  challenge_status: verified ? "verified" : "not-issued", reservation_expires_at: stamp, challenge_expires_at: null, verified_at: verified ? stamp : null, created_at: stamp, updated_at: stamp });
async function session(page: Page) {
  await page.route("**/api/auth/**", route => route.fulfill({ json: { success: true, message: "OK", payload: new URL(route.request().url()).pathname.endsWith("/csrf") ? { csrf_token: "c".repeat(43) } : account } }));
}
async function list(page: Page, sites: ReturnType<typeof website>[]) {
  await page.route("**/api/websites/**", route => route.fulfill({ json: { success: true, message: "OK", payload: { items: sites, total: sites.length, page: 1, size: 100, pages: 1 } } }));
}

test("authenticated empty account can open the approved add-site form", async ({ page }) => {
  await session(page); await list(page, []);
  await page.goto("/websites?account=multiple&role=Admin");
  await expect(page.getByText("هنوز سایتی ثبت نکرده‌اید.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "افزودن سایت", exact: true }).click();
  await expect(page).toHaveURL("/websites/new");
  await expect(page.getByRole("textbox", { name: "آدرس سایت", exact: true })).toBeVisible();
});

test("confirmed registration replaces empty cache, selects the saved site, survives reload and rechecks before continuing", async ({ page }, info) => {
  await session(page); let saved = false; let writes = 0; let details = 0;
  const site = website("confirmed-id", "www.example.test");
  await page.route("**/api/websites/**", async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (request.method() === "POST") {
      writes++; expect(request.postDataJSON()).toEqual({ url: site.url });
      expect(await request.headerValue("x-csrf-token")).toBe("c".repeat(43)); saved = true;
      await route.fulfill({ json: { success: true, message: "OK", payload: site } });
    } else if (path.endsWith(site.id)) { details++; await route.fulfill({ json: { success: true, message: "OK", payload: site } }); }
    else await route.fulfill({ json: { success: true, message: "OK", payload: { items: saved ? [site] : [], total: saved ? 1 : 0, page: 1, size: 100, pages: 1 } } });
  });
  await page.goto("/websites"); await expect(page.getByText("هنوز سایتی ثبت نکرده‌اید.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "افزودن سایت", exact: true }).click();
  await page.getByLabel("آدرس سایت", { exact: true }).fill(" HTTPS://WWW.Example.TEST.:443/ ");
  await page.getByRole("button", { name: "ادامه", exact: true }).click();
  await expect(page.locator("[data-registration-result]")).toContainText(site.hostname); expect(writes).toBe(1);
  await expect(page.locator("[data-registration-result]")).toContainText("مالکیت: تأیید نشده");
  await page.getByRole("link", { name: "بازگشت به سایت‌های من", exact: true }).click();
  await expect(page.locator("[data-website-row]")).toHaveCount(1);
  await expect(page.locator("[data-selected-website]")).toContainText(site.hostname);
  await expect(page.getByText("هنوز سایتی ثبت نکرده‌اید.", { exact: true })).toHaveCount(0);
  await page.reload(); await expect(page.locator("[data-selected-website]")).toContainText(site.hostname);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("owned-list.png"), fullPage: true });
  await page.getByRole("button", { name: "مشاهده اطلاعات سایت من", exact: true }).click();
  await expect(page).toHaveURL(`/websites/${site.id}/verify`); expect(details).toBe(1);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
});

for (const status of [409, 422, 403, 503]) test(`failed create ${status} preserves input, shows safe Persian error and permits retry`, async ({ page }) => {
  await session(page); let writes = 0; let fail = true;
  await page.route("**/api/websites/**", async route => {
    writes++; await route.fulfill({ status: fail ? status : 200, json: fail ? { detail: "PRIVATE OWNER EMAIL AND TRACE" } : { success: true, message: "OK", payload: website() } });
  });
  await page.goto("/websites/new"); const input = page.getByLabel("آدرس سایت", { exact: true });
  await input.fill("https://example.test/"); await page.getByRole("button", { name: "ادامه", exact: true }).click();
  await expect(page.locator("form [role=alert]")).toBeVisible(); await expect(input).toHaveValue("https://example.test/");
  await expect(page.getByText("PRIVATE OWNER EMAIL AND TRACE")).toHaveCount(0);
  await expect(page.locator("[data-registration-result]")).toHaveCount(0); expect(writes).toBe(1);
  fail = false; await page.getByRole("button", { name: "ادامه", exact: true }).click();
  await expect(page.locator("[data-registration-result]")).toBeVisible(); expect(writes).toBe(2);
});

test("pending create blocks repeated Enter/click and does not announce success before server confirmation", async ({ page }) => {
  await session(page); let writes = 0; let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/websites/**", async route => { writes++; await gate; await route.fulfill({ json: { success: true, message: "OK", payload: website() } }); });
  await page.goto("/websites/new"); await page.getByLabel("آدرس سایت", { exact: true }).fill("https://example.test");
  await page.getByRole("button", { name: "ادامه", exact: true }).click();
  await expect(page.locator("form")).toHaveAttribute("aria-busy", "true");
  await page.keyboard.press("Enter"); await expect(page.getByLabel("آدرس سایت", { exact: true })).toBeDisabled();
  await expect(page.locator("[data-registration-result]")).toHaveCount(0); expect(writes).toBe(1);
  release(); await expect(page.locator("[data-registration-result]")).toBeVisible(); expect(writes).toBe(1);
});

test("same-owner verified duplicate keeps true ownership and does not fabricate a report/source destination", async ({ page }) => {
  await session(page); const site = website("existing", "example.test", true);
  await page.route("**/api/websites/**", route => route.fulfill({ json: { success: true, message: "OK", payload: site } }));
  await page.goto("/websites/new"); await page.getByLabel("آدرس سایت", { exact: true }).fill(site.url);
  await page.getByRole("button", { name: "ادامه", exact: true }).click();
  await expect(page.locator("[data-registration-result]")).toContainText("مالکیت: تأیید شده");
  await expect(page.locator("[data-registration-result] a")).toHaveCount(0);
});

test("multiple sites require selection, verified status remains unknown, and refresh removes a stale selection", async ({ page }) => {
  await session(page); const a = website(); const b = website("two", "shop.example.test", true); let stale = false;
  await page.route("**/api/websites/**", route => {
    const detail = new URL(route.request().url()).pathname.endsWith(b.id);
    return route.fulfill({ status: detail && stale ? 404 : 200, json: detail ? stale ? { detail: "Not found" } : { success: true, message: "OK", payload: b }
      : { success: true, message: "OK", payload: { items: stale ? [] : [a, b], total: stale ? 0 : 2, page: 1, size: 100, pages: 1 } } });
  });
  await page.goto("/websites?site=two"); const view = page.getByRole("button", { name: "مشاهده اطلاعات سایت من", exact: true });
  await expect(view).toBeDisabled(); await page.getByRole("button", { name: `انتخاب ${b.hostname}`, exact: true }).click();
  await expect(page.locator("[data-selected-website]")).toContainText(b.hostname);
  await expect(page.getByText("وضعیت گزارش در دسترس نیست", { exact: true })).toBeVisible();
  await view.click(); await expect(page.getByRole("status")).toContainText("وضعیت گزارش این سایت در دسترس نیست");
  await expect(page).toHaveURL("/websites?site=two"); stale = true; await view.click();
  await expect(page.getByText("هنوز سایتی ثبت نکرده‌اید.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-selected-website]")).toHaveCount(0);
});

test("failed list remains distinct from an empty account and retry loads real data", async ({ page }) => {
  await session(page); let failed = true;
  await page.route("**/api/websites/**", route => route.fulfill({ status: failed ? 503 : 200, json: failed ? { detail: "private" }
    : { success: true, message: "OK", payload: { items: [website()], total: 1, page: 1, size: 100, pages: 1 } } }));
  await page.goto("/websites"); await expect(page.getByText("فهرست سایت‌ها در دسترس نیست.", { exact: true })).toBeVisible();
  await expect(page.getByText("هنوز سایتی ثبت نکرده‌اید.", { exact: true })).toHaveCount(0);
  failed = false; await page.getByRole("button", { name: "تلاش دوباره", exact: true }).click();
  await expect(page.locator("[data-website-row]")).toHaveCount(1);
});

test("a site from the second API page is selectable without hiding other owned sites", async ({ page }) => {
  await session(page); const sites = Array.from({ length: 101 }, (_, i) => website(`site-${i}`, `site${i}.example.test`));
  const pages: number[] = [];
  await page.route("**/api/websites/**", route => { const pageNumber = Number(new URL(route.request().url()).searchParams.get("page")); pages.push(pageNumber);
    return route.fulfill({ json: { success: true, message: "OK", payload: { items: sites.slice((pageNumber - 1) * 100, pageNumber * 100), total: 101, page: pageNumber, size: 100, pages: 2 } } }); });
  await page.goto("/websites"); await expect(page.locator("[data-website-row]")).toHaveCount(101); expect(pages).toEqual([1, 2]);
  await page.getByRole("button", { name: "انتخاب site100.example.test", exact: true }).click();
  await expect(page.locator("[data-selected-website]")).toContainText("site100.example.test");
});

test("account switch during create never publishes the old account result", async ({ page }) => {
  let current = account; let writes = 0;
  await page.route("**/api/auth/**", route => route.fulfill({ json: { success: true, message: "OK", payload: new URL(route.request().url()).pathname.endsWith("/csrf") ? { csrf_token: "c".repeat(43) } : current } }));
  await page.route("**/api/websites/**", async route => {
    if (route.request().method() === "POST") { writes++; current = { ...account, id: "new-owner", email: "other@example.test" };
      await route.fulfill({ json: { success: true, message: "OK", payload: website() } }); }
    else await route.fulfill({ json: { success: true, message: "OK", payload: { items: [], total: 0, page: 1, size: 100, pages: 1 } } });
  });
  await page.goto("/websites/new"); await page.getByLabel("آدرس سایت", { exact: true }).fill("https://example.test");
  await page.getByRole("button", { name: "ادامه", exact: true }).click();
  await expect(page.getByLabel("آدرس سایت", { exact: true })).toHaveValue("");
  await expect(page.locator("[data-registration-result]")).toHaveCount(0); expect(writes).toBe(1);
  await page.getByRole("link", { name: "بازگشت به سایت‌های من", exact: true }).click();
  await expect(page.getByText("هنوز سایتی ثبت نکرده‌اید.", { exact: true })).toBeVisible();
});
