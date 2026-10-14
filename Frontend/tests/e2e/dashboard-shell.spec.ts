import { test, expect } from "@playwright/test";
import { getSourcePeriod, parseSolarDay, previousWindow, sourceCeiling } from "../../components/feature/analytics/DashboardShell/periods";

test("dashboard shell exposes independent 28-day source windows and equal previous comparisons", async ({ page }) => {
  const response = await page.goto("/ui-review/websites/dashboard");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "داشبورد سایت", exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "مقایسه با بازهٔ قبلی هم‌اندازه", exact: true })).toBeChecked();
  const gsc = page.locator('[data-dashboard-source="gsc"]');
  await expect(gsc).toContainText("۱۴۰۵/۰۶/۲۲ تا ۱۴۰۵/۰۷/۱۸");
  await expect(gsc).toContainText("۱۴۰۵/۰۵/۲۵ تا ۱۴۰۵/۰۶/۲۱");
  await expect(gsc.getByText("America/Los_Angeles", { exact: true })).toHaveCSS("direction", "ltr");
  await expect(page.locator('[data-dashboard-source="ga4"]')).toContainText("۱۴۰۵/۰۶/۲۳ تا ۱۴۰۵/۰۷/۱۹");
  await expect(page.locator('[data-dashboard-source="ads"]')).toContainText("۱۴۰۵/۰۶/۲۴ تا ۱۴۰۵/۰۷/۲۰");
  await expect(page.locator('[data-layout="site"]')).toHaveCount(1);
  await expect(page.locator('[data-layout="account"]')).toHaveCount(0);
});

test("civil date conversion handles Nowruz, leap days, source midnight and equal inclusive windows", () => {
  expect(parseSolarDay("۱۴۰۳/۱۲/۳۰")).toBe("2025-03-20");
  expect(parseSolarDay("1404/01/01")).toBe("2025-03-21");
  expect(parseSolarDay("١٤٠٥/٠١/٠١")).toBe("2026-03-21");
  for (const value of ["1404/12/30", "1405/07/31", "1405/13/01", "1405/00/01", "1405/01/00", "1405/01/01junk", "1405/07/32"]) expect(parseSolarDay(value)).toBeNull();
  // The explicitly solar field interprets the year as solar, even if it resembles a Gregorian year.
  expect(parseSolarDay("2026-10-14")).toBe("2648-01-04");
  expect(previousWindow({ from: "2025-03-20", to: "2025-03-22" })).toEqual({ from: "2025-03-17", to: "2025-03-19" });
  expect(previousWindow({ from: "2026-10-10", to: "2026-10-10" })).toEqual({ from: "2026-10-09", to: "2026-10-09" });
  expect(sourceCeiling("2026-03-19T01:00:00Z", "America/Los_Angeles")).toBe("2026-03-17");
  expect(sourceCeiling("2026-03-19T01:00:00Z", "Asia/Tehran")).toBe("2026-03-18");
  expect(sourceCeiling("2026-03-19T01:00:00Z", "invalid-timezone")).toBeNull();
  const source = { id: "gsc", title: "Search Console", stateLabel: "ready", connected: true, permitted: true, sourceTimezone: "America/Los_Angeles", latestFinalDay: "2026-10-10", coverage: { from: "2026-09-13", to: "2026-10-10", complete: true, final: true } };
  const original = JSON.stringify(source);
  expect(getSourcePeriod(source, { mode: "28-days" }, "2026-10-14T09:00:00Z").complete).toBe(true);
  expect(getSourcePeriod({ ...source, latestFinalDay: null }, { mode: "28-days" }, "2026-10-14T09:00:00Z").requested).toBeNull();
  expect(getSourcePeriod({ ...source, latestFinalDay: "2026-10-09" }, { mode: "28-days" }, "2026-10-14T09:00:00Z").requested).toBeNull();
  expect(getSourcePeriod({ ...source, permitted: false }, { mode: "28-days" }, "2026-10-14T09:00:00Z").coverage).toBeNull();
  expect(getSourcePeriod(source, { mode: "custom", window: { from: "2026-08-01", to: "2026-08-10" } }, "2026-10-14T09:00:00Z").coverage).toBeNull();
  expect(JSON.stringify(source)).toBe(original);
});

test("comparison toggles with keyboard and one-day or cross-year custom ranges remain civil days", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard");
  const comparison = page.getByRole("checkbox", { name: "مقایسه با بازهٔ قبلی هم‌اندازه", exact: true });
  await expect(comparison).toBeEnabled();
  await comparison.focus(); await page.keyboard.press("Space");
  await expect(comparison).not.toBeChecked(); await expect(page.locator("[data-comparison-range]")).toHaveCount(0);
  await page.keyboard.press("Space"); await expect(comparison).toBeChecked();
  await page.getByLabel("نوع بازه", { exact: true }).selectOption("custom");
  await page.getByRole("textbox", { name: "از تاریخ شمسی", exact: true }).fill("١٤٠٥/٠٧/١٨");
  await page.getByRole("textbox", { name: "تا تاریخ شمسی", exact: true }).fill("1405-07-18");
  const apply = page.getByRole("button", { name: "اعمال بازه", exact: true });
  await apply.focus(); await page.keyboard.press("Enter");
  const gsc = page.locator('[data-dashboard-source="gsc"]');
  await expect(gsc.locator("[data-requested-range]")).toContainText("۱۴۰۵/۰۷/۱۸ تا ۱۴۰۵/۰۷/۱۸");
  await expect(gsc.locator("[data-comparison-range]")).toContainText("۱۴۰۵/۰۷/۱۷ تا ۱۴۰۵/۰۷/۱۷");
  await page.getByRole("textbox", { name: "از تاریخ شمسی", exact: true }).fill("1403/12/30");
  await page.getByRole("textbox", { name: "تا تاریخ شمسی", exact: true }).fill("1404/01/02");
  await apply.click();
  await expect(gsc.locator("[data-requested-range]")).toContainText("۱۴۰۳/۱۲/۳۰ تا ۱۴۰۴/۰۱/۰۲");
  await expect(gsc).toContainText("پوشش این بازه موجود نیست");
  await expect(gsc).not.toContainText("پوشش کامل و نهایی");
  await page.getByLabel("نوع بازه", { exact: true }).selectOption("28-days");
  await expect(page.getByRole("textbox", { name: "از تاریخ شمسی", exact: true })).toHaveCount(0);
  await expect(gsc.locator("[data-requested-range]")).toContainText("۱۴۰۵/۰۶/۲۲ تا ۱۴۰۵/۰۷/۱۸");
});

test("site selection clears drafts and compares empty reports without treating missing sources as data", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard");
  await page.getByLabel("نوع بازه", { exact: true }).selectOption("custom");
  await page.getByRole("textbox", { name: "از تاریخ شمسی", exact: true }).fill("bad-date");
  await page.getByRole("button", { name: "اعمال بازه", exact: true }).click();
  await page.getByLabel("انتخاب سایت", { exact: true }).selectOption("report-empty");
  await expect(page).toHaveURL("/ui-review/websites/dashboard?site=report-empty");
  await expect(page.locator("[data-dashboard-shell]")).toContainText("empty.example.test");
  await expect(page.getByLabel("نوع بازه", { exact: true })).toHaveValue("28-days");
  await expect(page.locator('[data-dashboard-shell] [role="alert"]')).toHaveCount(0);
  await expect(page.locator('[data-dashboard-source="gsc"]')).toContainText("دریافت موفق، بدون داده");
  await page.goto("/ui-review/websites/dashboard?site=report-ready&ga4=disconnected&gsc=ready&ads=permission-error");
  await expect(page.locator('[data-dashboard-source="gsc"]')).toContainText("پوشش کامل و نهایی");
  for (const source of ["ga4", "ads"]) {
    await expect(page.locator(`[data-dashboard-source="${source}"] [data-requested-range]`)).toHaveText(/—/);
    await expect(page.locator(`[data-dashboard-source="${source}"]`)).toContainText("پوشش این بازه موجود نیست");
  }
  await page.goto("/ui-review/websites/dashboard?ga4=ready&gsc=incomplete&ads=wrong-window");
  await expect(page.locator('[data-dashboard-source="gsc"]')).toContainText("پوشش موقت");
  await expect(page.locator('[data-dashboard-source="ads"]')).toContainText("پایان نهایی مناسب");
});

test("list and receipt handoffs retain the site and source states, including independently proven sites", async ({ page }) => {
  await page.goto("/ui-review/websites?account=multiple");
  await page.getByRole("button", { name: "انتخاب empty.example.test", exact: true }).click();
  await page.getByRole("button", { name: "مشاهده اطلاعات سایت من", exact: true }).click();
  await expect(page).toHaveURL("/ui-review/websites/dashboard?site=report-empty");
  await page.getByRole("link", { name: "وضعیت دریافت داده", exact: true }).click();
  await expect(page).toHaveURL("/ui-review/websites/receive?site=report-empty&ga4=empty&gsc=empty&ads=empty");
  await page.getByRole("button", { name: "مشاهده گزارش", exact: true }).click();
  await expect(page.locator("[data-dashboard-shell]")).toContainText("empty.example.test");
  await page.goto("/ui-review/websites/receive?site=proof-example&ga4=ready&gsc=failed&ads=disconnected");
  const domain = await page.locator("[data-data-receipt] dl").first().locator("dd").textContent();
  await page.getByRole("button", { name: "مشاهده گزارش", exact: true }).click();
  await expect(page).toHaveURL("/ui-review/websites/dashboard?site=proof-example&ga4=ready&gsc=failed&ads=disconnected");
  await expect(page.locator("[data-dashboard-shell]")).toContainText(domain ?? "missing domain");
  await expect(page.getByLabel("انتخاب سایت", { exact: true })).toHaveValue("proof-example");
});

test("ownership, missing reports, loading and failure remain separate, and selectors cannot grant access", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard?site=unverified&ga4=ready&gsc=ready&ads=ready&verified=1");
  await expect(page.getByText("ابتدا مالکیت این سایت را تأیید کنید.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-dashboard-source]")).toHaveCount(0);
  await expect(page.getByLabel("نوع بازه", { exact: true })).toBeDisabled();
  await page.goto("/ui-review/websites/dashboard?site=no-connection");
  await expect(page.getByText("گزارش این سایت هنوز آماده نیست.", { exact: true })).toBeVisible();
  await page.goto("/ui-review/websites/dashboard?view=loading");
  await expect(page.getByRole("status").filter({ hasText: "در حال آماده‌سازی بازه‌های گزارش" })).toBeVisible();
  await expect(page.locator("[data-dashboard-source]")).toHaveCount(0);
  await page.getByLabel("سناریوی پوسته", { exact: true }).selectOption("error");
  await expect(page.getByText("اطلاعات بازه‌ها در دسترس نیست.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("نوع بازه", { exact: true })).toBeDisabled();
  await page.goto("/ui-review/websites/dashboard?site=unverified&site=report-empty&view=error&view=loading&ga4=disconnected&ga4=ready");
  await expect(page.getByLabel("انتخاب سایت", { exact: true })).toHaveValue("report-ready");
  await expect(page.getByLabel("سناریوی پوسته", { exact: true })).toHaveValue("ready");
  await expect(page.locator('[data-dashboard-source="ga4"]')).toContainText("دریافت موفق، دارای داده");
});

test("the public dashboard uses the site shell and exposes no sample data, controls or auth effects", async ({ page, context }) => {
  const errors: string[] = [], requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  const response = await page.goto("/websites/arbitrary-id?role=admin&site=report-ready&ga4=ready&verified=1");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("داشبورد سایت | دیتانو");
  await expect(page.getByText("برای مشاهده داشبورد سایت، وارد شوید.", { exact: true })).toBeVisible();
  await expect(page.locator('[data-layout="site"]')).toHaveCount(1);
  await expect(page.locator('[data-layout="account"]')).toHaveCount(0);
  await expect(page.locator('[data-dashboard-source], [data-dashboard-shell], input, select, a[href^="/ui-review"]')).toHaveCount(0);
  await page.getByRole("main").getByRole("link", { name: "ورود به حساب", exact: true }).click();
  await expect(page).toHaveURL("/login");
  expect(errors).toEqual([]); expect(requests).toEqual([]); expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
});

test("range interactions issue no API calls or storage writes and are reproducible on reload", async ({ page, context }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/ui-review/websites/dashboard?site=report-ready&gsc=ready&ga4=disconnected&ads=failed");
  await page.getByLabel("نوع بازه", { exact: true }).selectOption("custom");
  await page.getByRole("textbox", { name: "از تاریخ شمسی", exact: true }).fill("1405/07/01");
  await page.getByRole("textbox", { name: "تا تاریخ شمسی", exact: true }).fill("1405/07/18");
  await page.getByRole("button", { name: "اعمال بازه", exact: true }).click();
  await expect(page.locator("[data-active-range]")).toContainText("۱۴۰۵/۰۷/۰۱");
  await page.reload();
  await expect(page.getByLabel("نوع بازه", { exact: true })).toHaveValue("28-days");
  await expect(page.locator('[data-dashboard-source="ads"]')).toContainText("دریافت ناموفق");
  expect(requests).toEqual([]); expect(errors).toEqual([]); expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
});

test("Persian RTL dashboard controls fit narrow, wide, dark and enlarged layouts with a shared footer", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard");
  await expect(page.locator("html")).toHaveAttribute("lang", "fa"); await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("body")).toHaveCSS("font-family", /Vazirmatn/);
  await expect(page.getByRole("main")).toHaveCount(1); await expect(page.getByRole("contentinfo")).toHaveCount(1);
  await expect(page.getByRole("contentinfo")).toContainText("© 2026 Datano. تمامی حقوق محفوظ است.");
  await page.getByLabel("نوع بازه", { exact: true }).selectOption("custom");
  for (const width of [320, 390, 768, 1440]) for (const dark of [false, true]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate((value) => document.documentElement.classList.toggle("dark", value), dark);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const select of await page.getByRole("combobox").all()) expect((await select.boundingBox())?.height).toBeGreaterThanOrEqual(48);
    await page.screenshot({ path: `/private/tmp/datano-fe-019-${width}-${dark ? "dark" : "light"}.png`, fullPage: true });
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/private/tmp/datano-fe-019-enlarged.png", fullPage: true });
});

test("without JavaScript private controls remain inaccessible and public login works", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("/ui-review/websites/dashboard");
    await expect(page.getByText("در حال آماده‌سازی محیط بررسی", { exact: true })).toBeVisible();
    await expect(page.locator("[data-dashboard-shell]")).toBeHidden();
    await expect(page.getByRole("combobox", { name: "انتخاب سایت", exact: true })).toHaveCount(0);
    await page.goto("/websites/arbitrary-id");
    await page.getByRole("main").getByRole("link", { name: "ورود به حساب", exact: true }).click();
    await expect(page).toHaveURL("/login");
  } finally { await context.close(); }
});

test("solar custom dates apply on submit, preserve drafts on errors and distinguish nonfinal coverage", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard");
  await page.getByLabel("نوع بازه", { exact: true }).selectOption("custom");
  const from = page.getByRole("textbox", { name: "از تاریخ شمسی", exact: true });
  const to = page.getByRole("textbox", { name: "تا تاریخ شمسی", exact: true });
  await from.fill("۱۴۰۵/۰۷/۰۱"); await to.fill("۱۴۰۵/۰۷/۲۱");
  await page.getByRole("button", { name: "اعمال بازه", exact: true }).click();
  await expect(page.locator('[data-dashboard-source="gsc"]')).toContainText("۱۴۰۵/۰۷/۰۱ تا ۱۴۰۵/۰۷/۲۱");
  await expect(page.locator('[data-dashboard-source="gsc"]')).toContainText("شامل روزهای نهایی‌نشده");
  await expect(page.locator('[data-dashboard-source="gsc"]')).toContainText("۱۴۰۵/۰۷/۰۱ تا ۱۴۰۵/۰۷/۱۸");
  await to.fill("۱۴۰۵/۰۷/۲۲");
  await page.getByRole("button", { name: "اعمال بازه", exact: true }).click();
  await expect(page.locator('[data-dashboard-shell] [role="alert"]')).toContainText("روز قبل");
  await expect(to).toHaveValue("۱۴۰۵/۰۷/۲۲");
  await expect(page.locator('[data-dashboard-source="gsc"] [data-requested-range]')).toContainText("۱۴۰۵/۰۷/۲۱");
  await to.fill("۱۴۰۵/۰۶/۳۱");
  await page.getByRole("button", { name: "اعمال بازه", exact: true }).click();
  await expect(page.locator('[data-dashboard-shell] [role="alert"]')).toContainText("پایان بازه");
  await from.fill("۱۴۰۴/۱۲/۳۰"); await to.fill("۱۴۰۵/۰۷/۱۸");
  await page.getByRole("button", { name: "اعمال بازه", exact: true }).click();
  await expect(page.locator('[data-dashboard-shell] [role="alert"]')).toContainText("تاریخ شمسی معتبر");
  await expect(from).toBeFocused();
});
