import { test, expect } from "@playwright/test";
import { formatKPIValue, getKPIFreshness, getKPIReading, getMeasurementValue, validUTCInstant, type KPIObservationInput, type KPIOverviewSourceInput } from "../../components/feature/analytics/KPIOverview/measurements";

const nowUTC = "2026-10-14T09:00:00Z";
const window = { from: "2026-09-13", to: "2026-10-10" };
const source: KPIOverviewSourceInput = { id: "gsc", title: "Search Console", stateLabel: "ready", connected: true, permitted: true, sourceTimezone: "America/Los_Angeles", latestFinalDay: window.to, coverage: { ...window, complete: true, final: true }, resourceId: "test-property", resourceLabel: "test property", lastSuccessUTC: "2026-10-13T12:00:00Z" };
const observation: KPIObservationInput = { websiteId: "test-site", sourceId: "gsc", resourceId: "test-property", metric: "ctr", window, coverage: window, state: "ready", quality: "complete", lastSuccessUTC: "2026-10-13T12:00:00Z", measurement: { kind: "ratio", clicks: 120, impressions: 5000 } };

test("metric and freshness boundaries preserve zero, undefined ratios and exact 72-hour age", () => {
  expect(getMeasurementValue("ctr", observation)).toEqual({ kind: "value", value: 0.024 });
  expect(getMeasurementValue("ctr", { ...observation, measurement: { kind: "ratio", clicks: 0, impressions: 100 } })).toEqual({ kind: "zero", value: 0 });
  expect(getMeasurementValue("ctr", { ...observation, measurement: { kind: "ratio", clicks: 0, impressions: 0 } })).toEqual({ kind: "zero-denominator", value: null });
  expect(getMeasurementValue("ctr", { ...observation, measurement: { kind: "ratio", clicks: null, impressions: 100 } }).kind).toBe("unavailable");
  for (const value of [NaN, Infinity, -1]) expect(getMeasurementValue("users", { ...observation, measurement: { kind: "count", value } }).kind).toBe("invalid");
  expect(getMeasurementValue("ctr", { ...observation, measurement: { kind: "ratio", clicks: 101, impressions: 100 } }).kind).toBe("invalid");
  expect(getMeasurementValue("users", { ...observation, measurement: { kind: "count", value: 0 } })).toEqual({ kind: "zero", value: 0 });
  expect(getMeasurementValue("users", { ...observation, measurement: { kind: "count", value: null } })).toEqual({ kind: "unavailable", value: null });
  expect(formatKPIValue("ctr", 0.024)).toBe("۲٫۴٪");
  expect(formatKPIValue("ctr", 0.000001)).toBe("کمتر از ۰٫۰۱٪");
  expect(formatKPIValue("users", null)).toBe("—");
  expect(getKPIFreshness("2026-10-11T09:00:00Z", nowUTC)).toBe("recent");
  expect(getKPIFreshness("2026-10-11T08:59:59.999Z", nowUTC)).toBe("stale");
  for (const value of [null, "bad-time", "2026-10-15T09:00:00Z", "2026-02-30T09:00:00Z"]) expect(getKPIFreshness(value, nowUTC)).toBe("unknown");
  expect(validUTCInstant("2026-10-13T12:00:00.1Z")).toBe(true);
});

test("observations bind to site, source, property and exact aggregate window without mutating or summing", () => {
  const input = { metric: "ctr" as const, websiteId: "test-site", source, window, observations: [observation], nowUTC };
  const snapshot = JSON.stringify(input);
  expect(getKPIReading(input).value).toBe(0.024);
  expect(getKPIReading({ ...input, websiteId: "second-site" }).kind).toBe("unavailable");
  expect(getKPIReading({ ...input, source: { ...source, resourceId: "other-property" } }).kind).toBe("unavailable");
  expect(getKPIReading({ ...input, source: { ...source, permitted: false } }).kind).toBe("unavailable");
  expect(getKPIReading({ ...input, source: { ...source, connected: false } }).kind).toBe("unavailable");
  expect(getKPIReading({ ...input, window: { ...window, from: "2026-09-14" } }).kind).toBe("unavailable");
  expect(getKPIReading({ ...input, observations: [observation, observation] }).kind).toBe("unavailable");
  expect(getKPIReading({ ...input, observations: [{ ...observation, coverage: { from: "2026-08-01", to: "2026-08-10" } }] }).kind).toBe("unavailable");
  expect(getKPIReading({ ...input, observations: [{ ...observation, quality: "thresholded" }] }).quality).toBe("thresholded");
  expect(getKPIReading({ ...input, observations: [{ ...observation, coverage: null }] }).quality).toBe("partial");
  const old = getKPIReading({ ...input, observations: [{ ...observation, lastSuccessUTC: "2026-10-11T08:00:00Z" }] });
  expect(old.value).toBe(0.024); expect(old.freshness).toBe("stale");
  expect(getKPIFreshness(source.lastSuccessUTC, nowUTC)).toBe("recent");
  expect(JSON.stringify(input)).toBe(snapshot);
});

test("overview cards identify sources, units, whole-window values and successful sync times", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard");
  await expect(page.getByRole("heading", { name: "نمای کلی عملکرد", exact: true })).toBeVisible();
  await expect(page.locator("[data-kpi-card]")).toHaveCount(4);
  const users = page.locator('[data-kpi-card="users"]');
  await expect(users.locator("[data-kpi-value]")).toHaveText("۱٬۲۳۴");
  await expect(users).toContainText("GA4"); await expect(users).toContainText("کاربر");
  await expect(users).toContainText("۱۴۰۵/۰۶/۲۳ تا ۱۴۰۵/۰۷/۱۹");
  await expect(page.locator('[data-kpi-card="ctr"] [data-kpi-value]')).toHaveText("۲٫۴٪");
  await expect(page.locator('[data-kpi-card="ctr"]')).toContainText("Search Console");
  await expect(page.locator('[data-kpi-card="ctr"]')).toContainText("درصد");
  await expect(page.locator('[data-source-freshness="ga4"]')).toContainText("۱۴۰۵/۰۷/۲۱, ۱۵:۳۰");
  await expect(users).toContainText("کل بازه");
});

test("actual zero, missing values, zero denominator, partial and stale data remain distinct", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard?kpi=mixed");
  const users = page.locator('[data-kpi-card="users"]'), sessions = page.locator('[data-kpi-card="sessions"]');
  await expect(users.locator("[data-kpi-value]")).toHaveText("۰");
  await expect(users).toContainText("صفر ثبت‌شده");
  await expect(page.locator('[data-kpi-card="keyEvents"] [data-kpi-value]')).toHaveText("—");
  await expect(page.locator('[data-kpi-card="keyEvents"]')).toContainText("مقدار موجود نیست");
  await expect(page.locator('[data-kpi-card="ctr"] [data-kpi-value]')).toHaveText("—");
  await expect(page.locator('[data-kpi-card="ctr"]')).toContainText("تعداد نمایش صفر است");
  await expect(sessions.locator("[data-kpi-value]")).toHaveText("۳۲۱");
  await expect(sessions).toContainText("داده ناقص");
  await expect(users).toContainText("داده قدیمی");
});

test("partial, thresholded, loading and failed metrics preserve other sources and truthful values", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard?kpi=thresholded");
  await expect(page.locator('[data-kpi-card="users"]')).toContainText("محدودیت نمایش منبع");
  await expect(page.locator('[data-kpi-card="users"] [data-kpi-value]')).toHaveText("۱٬۲۳۴");
  if (await page.locator("[data-review-tools]").getAttribute("open") === null) await page.locator("[data-review-tools] > summary").click();
  await page.getByLabel("سناریوی شاخص‌ها", { exact: true }).selectOption("loading");
  const sessions = page.locator('[data-kpi-card="sessions"]');
  await expect(sessions.getByRole("status")).toContainText("در حال دریافت مقدار");
  await expect(sessions.locator("[data-kpi-value]")).toHaveText("—");
  await expect(page.locator('[data-kpi-card="ctr"] [data-kpi-value]')).toHaveText("۲٫۴٪");
  if (await page.locator("[data-review-tools]").getAttribute("open") === null) await page.locator("[data-review-tools] > summary").click();
  await page.getByLabel("سناریوی شاخص‌ها", { exact: true }).selectOption("error");
  await expect(sessions.getByRole("alert")).toContainText("دریافت مقدار ناموفق بود");
  await expect(page.locator('[data-kpi-card="users"] [data-kpi-value]')).toHaveText("۱٬۲۳۴");
  if (await page.locator("[data-review-tools]").getAttribute("open") === null) await page.locator("[data-review-tools] > summary").click();
  await page.getByLabel("سناریوی شاخص‌ها", { exact: true }).selectOption("partial");
  await expect(sessions).toContainText("داده ناقص");
  await expect(sessions).not.toContainText("داده کامل و نهایی");
});

test("stale values remain visible and timestamps are independent per source", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard?kpi=stale");
  const ga4 = page.locator('[data-source-freshness="ga4"]'), gsc = page.locator('[data-source-freshness="gsc"]');
  await expect(ga4).toContainText("داده قدیمی");
  await expect(gsc).toContainText("دریافت موفق در ۷۲ ساعت گذشته");
  await expect(page.locator('[data-kpi-card="users"] [data-kpi-value]')).toHaveText("۱٬۲۳۴");
  await expect(page.locator('[data-kpi-card="users"]')).toContainText("۱۴۰۵/۰۷/۱۹, ۱۱:۳۰");
  await expect(page.locator('[data-kpi-card="users"]')).toContainText("۱۴۰۵/۰۶/۲۲ تا ۱۴۰۵/۰۷/۱۸");
  await expect(page.locator('[data-dashboard-source="ga4"] [data-requested-range]')).toContainText("۱۴۰۵/۰۶/۲۲ تا ۱۴۰۵/۰۷/۱۸");
  await expect(page.getByLabel("نوع بازه", { exact: true })).toBeEnabled();
  if (await page.locator("[data-review-tools]").getAttribute("open") === null) await page.locator("[data-review-tools] > summary").click();
  await page.getByLabel("سناریوی شاخص‌ها", { exact: true }).selectOption("unknown-time");
  await expect(ga4).toContainText("زمان دریافت موفق مشخص نیست");
  await expect(page.locator('[data-kpi-card="users"] [data-kpi-value]')).toHaveText("۱٬۲۳۴");
});

test("range changes never reuse aggregates from another window or sum unique users", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard");
  const users = page.locator('[data-kpi-card="users"]');
  await expect(users).toContainText("کاربران یکتای کل بازه");
  await page.getByLabel("نوع بازه", { exact: true }).selectOption("custom");
  await page.getByRole("textbox", { name: "از تاریخ شمسی", exact: true }).fill("۱۴۰۵/۰۷/۰۱");
  await page.getByRole("textbox", { name: "تا تاریخ شمسی", exact: true }).fill("۱۴۰۵/۰۷/۱۸");
  await expect(users.locator("[data-kpi-value]")).toHaveText("۱٬۲۳۴");
  await page.getByRole("button", { name: "اعمال بازه", exact: true }).click();
  await expect(users.locator("[data-kpi-value]")).toHaveText("۷۷۷");
  await expect(page.locator('[data-kpi-card="ctr"] [data-kpi-value]')).toHaveText("۵٪");
  await page.getByRole("textbox", { name: "تا تاریخ شمسی", exact: true }).fill("۱۴۰۵/۰۷/۱۷");
  await page.getByRole("button", { name: "اعمال بازه", exact: true }).click();
  await expect(users.locator("[data-kpi-value]")).toHaveText("—");
  await expect(users).toContainText("مقدار معتبر برای این سایت، منبع و بازه موجود نیست");
  await expect(page.locator("[data-kpi-comparison]")).toHaveCount(4);
  const compare = page.getByRole("checkbox", { name: "مقایسه با بازهٔ قبلی هم‌اندازه", exact: true });
  await compare.focus(); await page.keyboard.press("Space");
  await expect(page.locator("[data-kpi-comparison]")).toHaveCount(0);
  await page.getByLabel("نوع بازه", { exact: true }).selectOption("28-days");
  await expect(users.locator("[data-kpi-value]")).toHaveText("۱٬۲۳۴");
});

test("source permission and receipt failure do not turn missing metrics into zero or hide retained valid results", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard?ga4=permission-error&gsc=ready&ads=disconnected");
  for (const id of ["users", "sessions", "keyEvents"]) {
    const card = page.locator(`[data-kpi-card="${id}"]`);
    await expect(card.locator("[data-kpi-value]")).toHaveText("—");
    await expect(card).toContainText("مجوز این منبع در دسترس نیست");
  }
  await expect(page.locator('[data-kpi-card="ctr"] [data-kpi-value]')).toHaveText("۲٫۴٪");
  await page.goto("/ui-review/websites/dashboard?ga4=retry-failed&gsc=ready&ads=disconnected");
  await expect(page.locator('[data-kpi-card="users"] [data-kpi-value]')).toHaveText("۱٬۲۳۴");
  await expect(page.locator('[data-source-freshness="ga4"]')).toContainText("دریافت ناموفق");
  await page.goto("/ui-review/websites/dashboard?site=report-empty");
  await expect(page.locator('[data-kpi-card="users"] [data-kpi-value]')).toHaveText("۰");
  await expect(page.locator('[data-kpi-card="ctr"] [data-kpi-value]')).toHaveText("—");
  await expect(page.locator('[data-kpi-card="ctr"]')).toContainText("تعداد نمایش صفر است");
});

test("site and scenario changes reset safely and repeated selectors cannot supply measurement data", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard?kpi=mixed");
  await page.getByLabel("انتخاب سایت", { exact: true }).selectOption("report-empty");
  await expect(page.getByLabel("سناریوی شاخص‌ها", { exact: true })).toHaveValue("valid");
  await expect(page.locator('[data-kpi-card="sessions"] [data-kpi-value]')).toHaveText("۰");
  await page.goto("/ui-review/websites/dashboard?kpi=mixed&kpi=missing&value=999999&role=admin");
  await expect(page.getByLabel("سناریوی شاخص‌ها", { exact: true })).toHaveValue("valid");
  await expect(page.locator('[data-kpi-card="users"] [data-kpi-value]')).toHaveText("۱٬۲۳۴");
  if (await page.locator("[data-review-tools]").getAttribute("open") === null) await page.locator("[data-review-tools] > summary").click();
  await page.getByLabel("سناریوی شاخص‌ها", { exact: true }).selectOption("zero");
  await expect(page.locator('[data-kpi-card="ctr"] [data-kpi-value]')).toHaveText("۰٪");
  await page.reload();
  await expect(page.getByLabel("سناریوی شاخص‌ها", { exact: true })).toHaveValue("zero");
  await expect(page.locator('[data-kpi-card="ctr"] [data-kpi-value]')).toHaveText("۰٪");
});

test("KPI review makes no requests, cookie or storage changes and stays out of the public guest route", async ({ page, context }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/ui-review/websites/dashboard?kpi=mixed");
  if (await page.locator("[data-review-tools]").getAttribute("open") === null) await page.locator("[data-review-tools] > summary").click();
  await page.getByLabel("سناریوی شاخص‌ها", { exact: true }).selectOption("missing");
  await expect(page.locator('[data-kpi-card="users"] [data-kpi-value]')).toHaveText("—");
  await page.goto("/websites/arbitrary-id?kpi=valid&value=1234&ga4=ready&role=admin");
  await expect(page.getByText("برای مشاهده داشبورد سایت، وارد شوید.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-kpi-overview], [data-source-freshness], [data-kpi-card], input, select")).toHaveCount(0);
  expect(requests).toEqual([]); expect(errors).toEqual([]); expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
});

test("KPI cards retain Persian RTL semantics and fit mobile, desktop, dark and enlarged text", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard?kpi=mixed");
  await expect(page.getByRole("heading", { name: "نمای کلی عملکرد", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "fa"); await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("body")).toHaveCSS("font-family", /Vazirmatn/);
  await expect(page.locator('[data-kpi-card="ctr"]').getByText("Search Console", { exact: true })).toHaveCSS("direction", "ltr");
  for (const width of [320, 390, 768, 1440]) for (const dark of [false, true]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate((value) => document.documentElement.classList.toggle("dark", value), dark);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator("[data-kpi-overview]").screenshot({ path: `/private/tmp/datano-fe-020-${width}-${dark ? "dark" : "light"}.png`, animations: "disabled" });
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('[data-kpi-card="users"]').screenshot({ path: "/private/tmp/datano-fe-020-enlarged-card.png", animations: "disabled" });
  await page.goto("/ui-review/websites/dashboard?kpi=loading");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator('[data-kpi-card="sessions"] .lucide-loader-circle')).toHaveCSS("animation-name", "none");
});
