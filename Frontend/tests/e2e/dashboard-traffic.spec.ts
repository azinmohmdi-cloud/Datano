import { test, expect } from "@playwright/test";
import { civilDays, getTrafficSeries, type TrafficSnapshotInput } from "../../components/feature/analytics/TrafficOverview/series";
import type { KPIOverviewSourceInput } from "../../components/feature/analytics/KPIOverview/measurements";

const nowUTC = "2026-10-14T09:00:00Z";
const window = { from: "2026-10-08", to: "2026-10-10" };
const source: KPIOverviewSourceInput = { id: "ga4", title: "GA4", stateLabel: "ready", connected: true, permitted: true, sourceTimezone: "Asia/Tehran", latestFinalDay: "2026-10-13", coverage: { from: "2026-09-01", to: "2026-10-13", complete: true, final: true }, resourceId: "property-one", resourceLabel: "property one", lastSuccessUTC: "2026-10-14T05:00:00Z" };
const snapshot: TrafficSnapshotInput = { websiteId: "website-one", sourceId: "ga4", resourceId: source.resourceId, metric: "sessions", window, coverage: window, state: "ready", quality: "complete", lastSuccessUTC: source.lastSuccessUTC, days: [{ day: window.to, value: 20 }, { day: window.from, value: 0 }, { day: "2026-10-09", value: 10 }] };
const input = { websiteId: snapshot.websiteId, source, window, snapshots: [snapshot], nowUTC };

test("civil days sort without timezone conversion and keep missing days distinct from zero", () => {
  const before = JSON.stringify(input);
  const reading = getTrafficSeries(input);
  expect(reading.days).toEqual([{ day: "2026-10-08", value: 0 }, { day: "2026-10-09", value: 10 }, { day: "2026-10-10", value: 20 }]);
  expect(reading.quality).toBe("complete");
  const gap = getTrafficSeries({ ...input, snapshots: [{ ...snapshot, days: [snapshot.days[0], snapshot.days[1]] }] });
  expect(gap.days[1].value).toBeNull(); expect(gap.days[0].value).toBe(0); expect(gap.quality).toBe("partial");
  expect(getTrafficSeries({ ...input, snapshots: [{ ...snapshot, days: [] }] }).state).toBe("empty");
  expect(civilDays({ from: "2024-02-28", to: "2024-03-01" })).toEqual(["2024-02-28", "2024-02-29", "2024-03-01"]);
  expect(civilDays({ from: "2026-02-30", to: "2026-03-01" })).toEqual([]);
  expect(JSON.stringify(input)).toBe(before);
});

test("daily snapshots reject unrelated identity, ambiguous days, invalid counts and unavailable coverage", () => {
  expect(getTrafficSeries({ ...input, websiteId: "other-site" }).state).toBe("unavailable");
  expect(getTrafficSeries({ ...input, source: { ...source, resourceId: "other-property" } }).state).toBe("unavailable");
  expect(getTrafficSeries({ ...input, source: { ...source, id: "gsc" } }).state).toBe("disconnected");
  expect(getTrafficSeries({ ...input, source: { ...source, connected: false } }).state).toBe("disconnected");
  expect(getTrafficSeries({ ...input, source: { ...source, permitted: false } }).state).toBe("permission");
  expect(getTrafficSeries({ ...input, window: { ...window, to: "2026-10-09" } }).state).toBe("unavailable");
  expect(getTrafficSeries({ ...input, snapshots: [snapshot, snapshot] }).state).toBe("unavailable");
  const duplicate = getTrafficSeries({ ...input, snapshots: [{ ...snapshot, days: [...snapshot.days, snapshot.days[1]] }] });
  expect(duplicate.days[0].value).toBeNull(); expect(duplicate.quality).toBe("partial");
  for (const value of [-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    expect(getTrafficSeries({ ...input, snapshots: [{ ...snapshot, days: [{ day: window.from, value }] }] }).state).toBe("empty");
  }
  expect(getTrafficSeries({ ...input, snapshots: [{ ...snapshot, coverage: null }] }).state).toBe("empty");
  expect(getTrafficSeries({ ...input, source: { ...source, coverage: { from: "invalid-day", to: window.to, complete: true, final: true } } }).state).toBe("empty");
  expect(getTrafficSeries({ ...input, snapshots: [{ ...snapshot, coverage: { from: "2026-09-01", to: "2026-09-02" } }] }).state).toBe("empty");
});

test("freshness, provisional days and source-local yesterday remain independent", () => {
  const old = getTrafficSeries({ ...input, snapshots: [{ ...snapshot, lastSuccessUTC: "2026-10-11T08:00:00Z" }] });
  expect(old.state).toBe("ready"); expect(old.freshness).toBe("stale"); expect(old.days[0].value).toBe(0);
  expect(getTrafficSeries({ ...input, snapshots: [{ ...snapshot, lastSuccessUTC: "2026-10-15T08:00:00Z" }] }).freshness).toBe("unknown");
  expect(getTrafficSeries({ ...input, source: { ...source, latestFinalDay: "2026-10-09" } }).quality).toBe("provisional");
  expect(getTrafficSeries({ ...input, snapshots: [{ ...snapshot, quality: "thresholded" }] }).quality).toBe("thresholded");
  expect(getTrafficSeries({ ...input, nowUTC: "2026-10-10T21:30:00Z" }).state).toBe("ready");
  expect(getTrafficSeries({ ...input, source: { ...source, sourceTimezone: "America/Los_Angeles" }, nowUTC: "2026-10-10T21:30:00Z" }).state).toBe("unavailable");
});

test("traffic trend has Persian axes, legend and a chronological data alternative", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard");
  const traffic = page.locator("[data-traffic-overview]");
  await expect(traffic.getByRole("heading", { name: "روند ترافیک", exact: true })).toBeVisible();
  await expect(traffic.locator("[data-traffic-plot]")).toHaveCSS("direction", "ltr");
  await expect(traffic.locator("[data-traffic-legend]")).toContainText("نشست‌ها · بازهٔ فعلی");
  await expect(traffic).toContainText("تعداد نشست‌ها");
  await expect(traffic).toContainText("تاریخ شمسی");
  await traffic.getByText("جدول روزانهٔ نشست‌ها", { exact: true }).click();
  await expect(traffic.getByRole("table")).toBeVisible();
  await expect(traffic.locator("tbody tr")).toHaveCount(28);
  const days = await traffic.locator("[data-traffic-day]").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-traffic-day")));
  expect(days).toEqual([...days].sort());
  expect(days[0]).toBe("2026-09-14"); expect(days.at(-1)).toBe("2026-10-11");
});

test("real zeros draw a baseline while empty daily data draws no chart", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard?site=report-empty");
  const traffic = page.locator("[data-traffic-overview]");
  await expect(traffic.locator(".recharts-area-dot").first()).toBeVisible();
  await expect(traffic.locator(".recharts-area-curve")).toHaveAttribute("d", /^M.+L/);
  const zeroHeights = await traffic.locator(".recharts-area-dot").evaluateAll((dots) => dots.map((dot) => dot.getAttribute("cy")));
  expect(zeroHeights).toHaveLength(28); expect(new Set(zeroHeights).size).toBe(1);
  await traffic.getByText("جدول روزانهٔ نشست‌ها", { exact: true }).click();
  await expect(traffic.locator("[data-daily-current]").first()).toHaveText("۰ صفر ثبت‌شده");
  if (await page.locator("[data-review-tools]").getAttribute("open") === null) await page.locator("[data-review-tools] > summary").click();
  await page.getByLabel("سناریوی روند ترافیک", { exact: true }).selectOption("empty");
  await expect(traffic.locator("[data-traffic-plot]")).toHaveCount(0);
  await expect(traffic).toContainText("دادهٔ روزانه‌ای برای این بازه موجود نیست");
  await traffic.getByText("جدول روزانهٔ نشست‌ها", { exact: true }).click();
  await expect(traffic.locator("[data-daily-current]").first()).toHaveText("— مقدار موجود نیست");
});

test("gaps break the curve and keyboard tooltip localizes the actual day and source", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard?traffic=gaps");
  const traffic = page.locator("[data-traffic-overview]"), chart = traffic.locator(".recharts-surface");
  await expect(traffic.locator('[data-traffic-series="current"]')).toContainText("داده ناقص");
  await expect(chart).toBeVisible();
  await chart.focus();
  await page.keyboard.press("ArrowRight");
  const tooltip = traffic.locator("[data-traffic-tooltip]");
  await expect(tooltip).toBeVisible(); await expect(tooltip).toContainText("GA4"); await expect(tooltip).toContainText("نشست");
  await expect(tooltip).toHaveAttribute("dir", "rtl");
  await page.keyboard.press("ArrowRight");
  await expect(tooltip.locator('[data-tooltip-series="current"]')).toContainText("— مقدار موجود نیست");
  await expect(tooltip).toContainText("۱۴۰۵/۰۶/۲۵");
  const moves = await traffic.locator(".recharts-area-curve").getAttribute("d");
  expect((moves?.match(/M/g) ?? []).length).toBe(2);
  await page.keyboard.press("Escape"); await expect(tooltip).not.toBeVisible();
  await traffic.getByText("جدول روزانهٔ نشست‌ها", { exact: true }).click();
  await expect(traffic.locator("[data-daily-current]").nth(0)).toContainText("۰ صفر ثبت‌شده");
  await expect(traffic.locator("[data-daily-current]").nth(2)).toContainText("— مقدار موجود نیست");
});

test("comparison shows actual dates, uses a dashed series and follows the applied checkbox", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard?traffic=comparison");
  const traffic = page.locator("[data-traffic-overview]");
  await expect(traffic.locator('[data-traffic-series="previous"]')).toContainText("دادهٔ روزانه موجود است");
  await expect(traffic.locator(".recharts-line-curve")).toHaveAttribute("stroke-dasharray", "6 5");
  const chart = traffic.locator(".recharts-surface"); await chart.focus(); await page.keyboard.press("ArrowRight");
  const tooltip = traffic.locator("[data-traffic-tooltip]");
  await expect(tooltip).toContainText("۱۴۰۵/۰۶/۲۴"); await expect(tooltip).toContainText("۱۴۰۵/۰۵/۲۷");
  await page.keyboard.press("ArrowLeft");
  await expect(tooltip).toContainText("۱۴۰۵/۰۶/۲۳"); await expect(tooltip).toContainText("۱۴۰۵/۰۵/۲۶");
  await expect(traffic).toContainText("مقایسه بر اساس روز متناظر");
  await traffic.getByText("جدول روزانهٔ نشست‌ها", { exact: true }).click();
  await expect(traffic.getByRole("columnheader")).toHaveCount(4);
  await page.getByRole("checkbox", { name: "مقایسه با بازهٔ قبلی هم‌اندازه", exact: true }).click();
  await expect(traffic.locator('[data-traffic-series="previous"], .recharts-line-curve, [data-daily-previous]')).toHaveCount(0);
});

test("solar range drafts do not change the chart and unknown exact queries never reuse other daily snapshots", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard");
  const traffic = page.locator("[data-traffic-overview]");
  await page.getByLabel("نوع بازه", { exact: true }).selectOption("custom");
  await page.getByRole("textbox", { name: "از تاریخ شمسی", exact: true }).fill("۱۴۰۵/۰۷/۰۱");
  await page.getByRole("textbox", { name: "تا تاریخ شمسی", exact: true }).fill("۱۴۰۵/۰۷/۱۸");
  await expect(traffic.locator('[data-traffic-series="current"]')).toContainText("۱۴۰۵/۰۶/۲۳ تا ۱۴۰۵/۰۷/۱۹");
  await page.getByRole("button", { name: "اعمال بازه", exact: true }).click();
  await expect(traffic.locator('[data-traffic-series="current"]')).toContainText("۱۴۰۵/۰۷/۰۱ تا ۱۴۰۵/۰۷/۱۸");
  await traffic.getByText("جدول روزانهٔ نشست‌ها", { exact: true }).click();
  await expect(traffic.locator("tbody tr")).toHaveCount(18);
  await page.getByRole("textbox", { name: "تا تاریخ شمسی", exact: true }).fill("۱۴۰۵/۰۷/۱۷");
  await page.getByRole("button", { name: "اعمال بازه", exact: true }).click();
  await expect(traffic.locator("[data-traffic-plot]")).toHaveCount(0);
  await expect(traffic).toContainText("دادهٔ روزانهٔ معتبر برای این سایت، منبع و بازه موجود نیست");
  await page.getByLabel("نوع بازه", { exact: true }).selectOption("28-days");
  await expect(traffic.locator("[data-traffic-plot]")).toBeVisible();
});

test("loading, failure, permission and stale readings stay truthful and independent of other KPIs", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard?kpi=loading");
  const traffic = page.locator("[data-traffic-overview]");
  await expect(traffic.getByRole("status")).toHaveText("در حال دریافت روند ترافیک");
  await expect(page.locator('[data-kpi-card="ctr"] [data-kpi-value]')).toHaveText("۲٫۴٪");
  if (await page.locator("[data-review-tools]").getAttribute("open") === null) await page.locator("[data-review-tools] > summary").click();
  await page.getByLabel("سناریوی شاخص‌ها", { exact: true }).selectOption("error");
  await expect(traffic.getByRole("alert")).toHaveText("دریافت روند ترافیک ناموفق بود");
  if (await page.locator("[data-review-tools]").getAttribute("open") === null) await page.locator("[data-review-tools] > summary").click();
  await page.getByLabel("سناریوی شاخص‌ها", { exact: true }).selectOption("stale");
  await expect(traffic.locator('[data-traffic-series="current"]')).toContainText("داده قدیمی");
  await expect(traffic.locator("[data-traffic-plot]")).toBeVisible();
  await page.goto("/ui-review/websites/dashboard?ga4=permission-error&gsc=ready");
  await expect(traffic.locator("[data-traffic-plot]")).toHaveCount(0); await expect(traffic).toContainText("مجوز GA4 در دسترس نیست");
  await page.goto("/ui-review/websites/dashboard?ga4=disconnected&gsc=ready");
  await expect(traffic).toContainText("GA4 متصل نیست");
});

test("traffic review allowlists selectors, resets on site changes and has no auth or data side effects", async ({ page, context }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/ui-review/websites/dashboard?traffic=gaps&traffic=empty&sessions=999999&role=admin");
  await expect(page.getByLabel("سناریوی روند ترافیک", { exact: true })).toHaveValue("valid");
  if (await page.locator("[data-review-tools]").getAttribute("open") === null) await page.locator("[data-review-tools] > summary").click();
  await page.getByLabel("سناریوی روند ترافیک", { exact: true }).selectOption("comparison");
  await expect(page).toHaveURL(/traffic=comparison/);
  await page.reload(); await expect(page.getByLabel("سناریوی روند ترافیک", { exact: true })).toHaveValue("comparison");
  await page.getByLabel("انتخاب سایت", { exact: true }).selectOption("report-empty");
  await expect(page.getByLabel("سناریوی روند ترافیک", { exact: true })).toHaveValue("valid");
  await page.goto("/websites/arbitrary-id?traffic=comparison&ga4=ready&role=admin");
  await expect(page.locator("[data-traffic-overview], .recharts-wrapper, input, select")).toHaveCount(0);
  await expect(page.getByText("برای مشاهده داشبورد سایت، وارد شوید.", { exact: true })).toBeVisible();
  expect(requests).toEqual([]); expect(errors).toEqual([]); expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
});

test("chart remains chronological at narrow sizes, dark themes, enlarged text and touch", async ({ page }, testInfo) => {
  await page.goto("/ui-review/websites/dashboard?traffic=comparison");
  const traffic = page.locator("[data-traffic-overview]");
  await expect(traffic.locator(".recharts-area-dot").first()).toBeVisible();
  for (const width of [320, 390, 768, 1440]) for (const dark of [false, true]) {
    await page.setViewportSize({ width, height: 900 }); await page.evaluate((value) => document.documentElement.classList.toggle("dark", value), dark);
    await expect(traffic.locator("[data-traffic-plot]")).toHaveCSS("direction", "ltr");
    await expect.poll(async () => {
      const positions = await traffic.locator(".recharts-area-dot").evaluateAll((dots) => dots.map((dot) => Number(dot.getAttribute("cx"))));
      return positions.length === 28 && positions.every((x, index) => index === 0 || x > positions[index - 1]);
    }).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await traffic.screenshot({ path: `/private/tmp/datano-fe-021-${width}-${dark ? "dark" : "light"}.png`, animations: "disabled" });
  }
  await page.setViewportSize({ width: 390, height: 900 });
  const dot = traffic.locator(".recharts-area-dot").first();
  if (testInfo.project.name === "mobile") await dot.tap(); else await dot.hover();
  await expect(traffic.locator("[data-traffic-tooltip]")).toBeVisible();
  const box = await traffic.locator("[data-traffic-tooltip]").boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error("Tooltip has no visible bounds");
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(900);
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(traffic.locator(".recharts-surface")).toHaveCSS("font-family", /Vazirmatn/);
  await traffic.screenshot({ path: "/private/tmp/datano-fe-021-enlarged.png", animations: "disabled" });
  await traffic.getByText("جدول روزانهٔ نشست‌ها", { exact: true }).focus(); await page.keyboard.press("Enter");
  await expect(traffic.getByRole("table")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
