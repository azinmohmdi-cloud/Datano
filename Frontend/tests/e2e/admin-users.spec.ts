import { test, expect } from "@playwright/test";

const review = "/ui-review/admin/users";
const row = (id: string) => `[data-admin-user-row="${id}"]`;
const multi = row("UI_REVIEW_ADMIN_USER_MULTI");
const noSite = row("UI_REVIEW_ADMIN_USER_NO_SITE");

test("each account owns one row including users without sites and multi-site accounts", async ({ page }) => {
  await page.goto(review);
  await expect(page.getByRole("heading", { name: "کاربران", exact: true })).toBeVisible();
  await expect(page.locator("[data-admin-user-row]")).toHaveCount(3);
  await expect(page.locator(multi)).toHaveCount(1);
  await expect(page.locator(`${multi} [data-admin-site]`)).toHaveCount(2);
  await expect(page.locator(noSite)).toContainText("سارا احمدی");
  await expect(page.locator(noSite)).toContainText("سایتی ثبت نشده است.");
  await expect(page.locator('[data-admin-user-row="UI_REVIEW_ADMIN_USER_INACTIVE"]')).toContainText("غیرفعال");
  await expect(page.locator(`${multi} [data-admin-site="UI_REVIEW_ADMIN_SITE_GROWTH"]`)).toContainText("growth.example.test");
  await expect(page.locator(`${multi} [data-admin-site="UI_REVIEW_ADMIN_SITE_SHOP"]`)).toContainText("shop.growth.example.test");
  for (const id of ["totalUsers", "activeUsers", "connections"]) {
    await expect(page.locator(`[data-admin-metric="${id}"]`)).toHaveCount(1);
  }
  await expect(page.locator('[data-admin-metric="totalUsers"] [data-admin-count]')).toHaveText("۱۲۸");
});

test("each site's three sources keep valid authorization distinct from sync failure and revocation", async ({ page }) => {
  await page.goto(review);
  const growth = page.locator('[data-admin-site="UI_REVIEW_ADMIN_SITE_GROWTH"]');
  await expect(growth.locator('[data-admin-source="ga4"]')).toContainText("اتصال معتبر");
  await expect(growth.locator('[data-admin-source="ga4"]')).toContainText("دریافت موفق");
  await expect(growth.locator('[data-admin-source="gsc"]')).toContainText("اتصال معتبر");
  await expect(growth.locator('[data-admin-source="gsc"]')).toContainText("خطای دریافت داده");
  await expect(growth.locator('[data-admin-source="ads"]')).toContainText("انتخاب نشده");
  const inactive = page.locator('[data-admin-site="UI_REVIEW_ADMIN_SITE_SEO"]');
  await expect(inactive.locator('[data-admin-source="gsc"]')).toContainText("مجوز لغو شده");
  await expect(inactive.locator('[data-admin-source="gsc"]')).not.toContainText("اتصال معتبر");
  await expect(inactive.locator('[data-admin-source="ads"]')).toContainText("اتصال قطع شده");
  await expect(inactive.locator('[data-admin-source="ga4"]')).toContainText("وضعیت نامشخص");
  await expect(page.getByRole("columnheader", { name: "GA4", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Search Console", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Ads", exact: true }).first()).toBeVisible();
});

test("account details disclose in the same row with keyboard and no account-changing controls", async ({ page }) => {
  await page.goto(review);
  const account = page.locator(noSite);
  const trigger = account.locator("summary");
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(account.locator("details")).toHaveAttribute("open", "");
  await expect(account.getByText("تاریخ ثبت‌نام", { exact: true })).toBeVisible();
  await expect(account.locator('[data-admin-registration]')).toHaveText("۱۸ مهر ۱۴۰۵، ۱۲:۰۰");
  await expect(account.locator('[data-admin-email]')).toHaveAttribute("dir", "ltr");
  await expect(page).toHaveURL(new RegExp(`${review}$`));
  await page.keyboard.press("Space");
  await expect(account.locator("details")).not.toHaveAttribute("open", "");
  await expect(trigger).toBeFocused();
  await expect(page.locator("[data-admin-user-row]")).toHaveCount(3);
  await expect(page.locator('[data-admin-users] input, [data-admin-users] select, [data-admin-users] button, [data-admin-users] a')).toHaveCount(0);
});

test("the wide table can be scrolled with the keyboard inside its own container", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(review);
  const table = page.getByRole("table", { name: "کاربران", exact: true });
  await expect(table).toBeVisible();
  await table.focus();
  await expect(table).toBeFocused();
  const container = table.locator("..");
  const before = await container.evaluate(element => element.scrollLeft);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => container.evaluate(element => element.scrollLeft)).not.toBe(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("list loading empty failure and unknown states stay independent of summary counts", async ({ page }) => {
  for (const [state, text] of [
    ["loading", "در حال دریافت کاربران"], ["empty", "کاربری در این فهرست نیست."],
    ["error", "دریافت فهرست کاربران ناموفق بود."], ["unavailable", "فهرست کاربران در دسترس نیست."],
  ]) {
    await page.goto(`${review}?users=${state}`);
    await expect(page.getByText(text, { exact: true })).toBeVisible();
    await expect(page.locator("[data-admin-user-row]")).toHaveCount(0);
    await expect(page.locator('[data-admin-metric="totalUsers"] [data-admin-count]')).toHaveText("۱۲۸");
  }
  await page.goto(`${review}?scenario=partial&users=ready`);
  await expect(page.locator("[data-admin-user-row]")).toHaveCount(3);
  await expect(page.locator('[data-admin-metric="connections"] [data-admin-count]')).toHaveText("—");
});

test("long and missing metadata is readable without inventing empty websites or dates", async ({ page }) => {
  await page.goto(`${review}?users=long`);
  await expect(page.locator("[data-admin-user-row]")).toHaveCount(4);
  const unknown = page.locator(row("UI_REVIEW_ADMIN_USER_UNKNOWN"));
  await expect(unknown).toContainText("وضعیت سایت‌ها مشخص نیست.");
  await expect(unknown).not.toContainText("سایتی ثبت نشده است.");
  await unknown.locator("summary").click();
  await expect(unknown.locator('[data-admin-registration]')).toHaveText("—");
});

test("private list selectors reload safely and sample data never creates requests or stored authority", async ({ page, context }) => {
  const operations: string[] = [], errors: string[] = [];
  page.on("request", request => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) operations.push(request.url()); });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(review);
  await page.locator('[data-review-tools] > summary').click();
  await page.getByLabel("سناریوی فهرست کاربران", { exact: true }).selectOption("empty");
  await expect(page.getByText("کاربری در این فهرست نیست.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("[data-admin-user-row]")).toHaveCount(0);
  await page.goto(`${review}?users=empty&users=error&role=admin`);
  await expect(page.locator("[data-admin-user-row]")).toHaveCount(3);
  for (const persona of ["user", "guest", "unknown", "admin&persona=user"]) {
    await page.goto(`${review}?persona=${persona}&users=ready`);
    await expect(page.locator("[data-admin-user-row], [data-admin-metric]")).toHaveCount(0);
  }
  await page.goto(review);
  await page.locator(`${noSite} summary`).click();
  expect(operations).toEqual([]); expect(errors).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
});

test("user table fits RTL layouts through local scrolling while summary card geometry remains equal", async ({ page }) => {
  await page.goto(`${review}?users=long`);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  for (const width of [320, 390, 768, 1440]) for (const dark of [false, true]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(value => document.documentElement.classList.toggle("dark", value), dark);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const cards = await page.locator('[data-admin-metric]').evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { width: r.width, height: r.height }; }));
    expect(Math.max(...cards.map(card => card.width)) - Math.min(...cards.map(card => card.width))).toBeLessThan(1);
    expect(new Set(cards.map(card => card.height)).size).toBe(1);
    if (width === 390 || width === 1440) await page.screenshot({ path: `/private/tmp/datano-fe027-${width}-${dark ? "dark" : "light"}.png`, fullPage: true });
  }
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.locator('[data-admin-users]').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    if (width !== 320) expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("product route never reveals sample users through role flags or browser storage", async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("role", "admin"); });
  await page.goto("/admin/users?role=admin&persona=admin&users=ready");
  await expect(page.getByText("برای مشاهدهٔ پنل مدیریت، وارد شوید.", { exact: true })).toBeVisible();
  await expect(page.locator('[data-admin-users], [data-admin-user-row], [data-review-tools]')).toHaveCount(0);
  await expect(page.getByText(/sara\.admin-review@example\.test|growth\.example\.test/)).toHaveCount(0);
});
