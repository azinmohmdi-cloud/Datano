import { test, expect } from "@playwright/test";
import { formatSearchValue, getSearchReading, getSearchTopRows, getSearchValue, type SearchObservationInput, type SearchTopRowsInput } from "../../components/feature/analytics/SearchPerformance/measurements";
import type { KPIOverviewSourceInput } from "../../components/feature/analytics/KPIOverview/measurements";

const window = { from: "2026-09-13", to: "2026-10-10" }, nowUTC = "2026-10-14T09:00:00Z";
const source: KPIOverviewSourceInput = { id: "gsc", title: "Search Console", stateLabel: "ready", connected: true, permitted: true, sourceTimezone: "America/Los_Angeles", latestFinalDay: window.to, coverage: { ...window, complete: true, final: true }, resourceId: "test-gsc-property", resourceLabel: "test property", lastSuccessUTC: "2026-10-13T12:00:00Z" };
const observation: SearchObservationInput = { websiteId: "site-one", sourceId: "gsc", resourceId: source.resourceId, metric: "ctr", scope: "property-aggregate", window, coverage: window, state: "ready", quality: "complete", lastSuccessUTC: source.lastSuccessUTC, measurement: { kind: "ratio", clicks: 120, impressions: 5000 } };
const input = { metric: "ctr" as const, websiteId: "site-one", source, window, observations: [observation], nowUTC };
const rows: SearchTopRowsInput = { ...observation, dimension: "query", rows: [{ id: "one", query: "عبارت", clicks: 50, impressions: 100, position: 1 }, { id: "two", query: "عبارت دوم", clicks: 10, impressions: 500, position: 20 }] };

test("search metrics distinguish zero, missing, undefined CTR and source aggregate position", () => {
  expect(getSearchValue("clicks", { kind: "count", value: 0 })).toEqual({ kind: "zero", value: 0 });
  expect(getSearchValue("position", { kind: "position", value: 7.35 })).toEqual({ kind: "value", value: 7.35 });
  expect(getSearchValue("position", { kind: "position", value: null }).kind).toBe("unavailable");
  expect(getSearchValue("ctr", { kind: "ratio", clicks: 0, impressions: 100 })).toEqual({ kind: "zero", value: 0 });
  expect(getSearchValue("ctr", { kind: "ratio", clicks: 0, impressions: 0 })).toEqual({ kind: "zero-denominator", value: null });
  expect(getSearchValue("ctr", { kind: "ratio", clicks: null, impressions: 100 }).kind).toBe("unavailable");
  for (const value of [-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) expect(getSearchValue("impressions", { kind: "count", value }).kind).toBe("invalid");
  for (const value of [0, 0.5, NaN, Infinity]) expect(getSearchValue("position", { kind: "position", value }).kind).toBe("invalid");
  expect(getSearchValue("ctr", { kind: "ratio", clicks: 101, impressions: 100 }).kind).toBe("invalid");
  expect(getSearchValue("ctr", { kind: "count", value: 2 }).kind).toBe("invalid");
  expect(formatSearchValue("ctr", 0.024)).toBe("۲٫۴٪"); expect(formatSearchValue("position", 7.35)).toBe("۷٫۳۵"); expect(formatSearchValue("position", null)).toBe("—");
});

test("aggregate identity and scope never fall back to top rows or ambiguous snapshots", () => {
  const before = JSON.stringify({ input, rows });
  expect(getSearchReading(input).value).toBe(0.024);
  for (const wrong of [
    { websiteId: "another-site" }, { source: { ...source, resourceId: "another-property" } }, { source: { ...source, id: "ga4" } },
    { source: { ...source, connected: false } }, { source: { ...source, permitted: false } }, { window: { ...window, to: "2026-10-09" } },
    { observations: [observation, observation] }, { observations: [{ ...observation, scope: "top-rows" as const }] },
    { observations: [{ ...observation, coverage: { from: "2026-08-01", to: "2026-08-02" } }] },
  ]) expect(getSearchReading({ ...input, ...wrong }).kind).toBe("unavailable");
  const selection = { ...input, snapshots: [rows] };
  expect(getSearchTopRows(selection).rows).toHaveLength(2);
  expect(getSearchReading({ ...input, observations: [] }).value).toBeNull();
  expect(getSearchTopRows({ ...selection, websiteId: "other" }).rows).toEqual([]);
  expect(getSearchTopRows({ ...selection, window: { ...window, to: "2026-10-09" } }).rows).toEqual([]);
  expect(getSearchTopRows({ ...selection, snapshots: [rows, rows] }).state).toBe("unavailable");
  expect(getSearchTopRows({ ...selection, snapshots: [{ ...rows, rows: [rows.rows[0], rows.rows[0]] }] }).state).toBe("unavailable");
  expect(JSON.stringify({ input, rows })).toBe(before);
});

test("per-value quality and freshness do not inherit a recent unrelated source sync", () => {
  expect(getSearchReading({ ...input, observations: [{ ...observation, lastSuccessUTC: "2026-10-11T09:00:00Z" }] }).freshness).toBe("recent");
  const stale = getSearchReading({ ...input, observations: [{ ...observation, lastSuccessUTC: "2026-10-11T08:00:00Z" }] });
  expect(stale.freshness).toBe("stale"); expect(stale.value).toBe(0.024);
  for (const lastSuccessUTC of [null, "2026-02-30T08:00:00Z", "2026-10-15T08:00:00Z"]) expect(getSearchReading({ ...input, observations: [{ ...observation, lastSuccessUTC }] }).freshness).toBe("unknown");
  expect(getSearchReading({ ...input, observations: [{ ...observation, coverage: null }] }).quality).toBe("partial");
  expect(getSearchReading({ ...input, observations: [{ ...observation, quality: "thresholded" }] }).quality).toBe("thresholded");
  expect(getSearchReading({ ...input, source: { ...source, coverage: { ...window, complete: false, final: false } } }).quality).toBe("provisional");
  expect(getSearchReading({ ...input, observations: [{ ...observation, state: "loading" }] }).kind).toBe("loading");
  expect(getSearchTopRows({ ...input, snapshots: [{ ...rows, state: "error" }] }).rows).toEqual([]);
});

test("search performance identifies four aggregate metrics and separates top queries", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard");
  const search = page.locator("[data-search-performance]");
  await expect(search.getByRole("heading", { name: "عملکرد جست‌وجو", exact: true })).toBeVisible();
  await expect(search.locator("[data-search-metric]")).toHaveCount(4);
  for (const label of ["کلیک‌ها", "نمایش‌ها", "نرخ کلیک", "میانگین جایگاه"]) await expect(search.getByRole("heading", { name: label, exact: true })).toBeVisible();
  await expect(search).toContainText("Search Console");
  await expect(search).toContainText("ردیف‌های برتر، کل جمعیت جست‌وجو نیستند");
  await expect(search.getByRole("table")).toBeVisible();
  for (const [metric, value] of [["clicks", "۱۲۰"], ["impressions", "۵٬۰۰۰"], ["ctr", "۲٫۴٪"], ["position", "۷٫۳۵"]]) await expect(search.locator(`[data-search-metric="${metric}"] [data-search-value]`)).toHaveText(value);
  await expect(search).toContainText("America/Los_Angeles"); await expect(search).toContainText("۱۴۰۵/۰۶/۲۲ تا ۱۴۰۵/۰۷/۱۸");
  await expect(search.locator('[data-search-row="search-review-first"] [data-search-cell="ctr"]')).toContainText("۲٪");
  await expect(search.locator('[data-search-row="search-review-first"] [data-search-cell="position"]')).toContainText("۱");
  await expect(search.locator('[data-search-top-rows]')).toContainText("جامع‌بودن فهرست تضمین نشده است");
  await expect(search.locator('[data-search-top-rows]')).not.toContainText("داده کامل و نهایی");
});

test("independent zero, partial, missing and ratio states retain consistent overview CTR", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard?search=mixed");
  const search = page.locator("[data-search-performance]");
  await expect(search.locator('[data-search-metric="clicks"]')).toHaveAttribute("data-search-kind", "zero");
  await expect(search.locator('[data-search-metric="impressions"]')).toHaveAttribute("data-search-quality", "partial");
  await expect(search.locator('[data-search-metric="impressions"] [data-search-value]')).toHaveText("۵٬۰۰۰");
  await expect(search.locator('[data-search-metric="position"] [data-search-value]')).toHaveText("—");
  await expect(search.locator('[data-search-metric="ctr"] [data-search-value]')).toHaveText("۰٪");
  await expect(page.locator('[data-kpi-card="ctr"] [data-kpi-value]')).toHaveText("۰٪");
  await expect(search.locator('[data-search-row="search-review-first"] [data-search-cell="clicks"]')).toContainText("۰");
  if (await page.locator("[data-review-tools]").getAttribute("open") === null) await page.locator("[data-review-tools] > summary").click();
  await page.getByLabel("سناریوی عملکرد جست‌وجو", { exact: true }).selectOption("zero-denominator");
  await expect(search.locator('[data-search-metric="impressions"] [data-search-value]')).toHaveText("۰");
  await expect(search.locator('[data-search-metric="ctr"]')).toHaveAttribute("data-search-kind", "zero-denominator");
  await expect(search.locator('[data-search-metric="ctr"] [data-search-value]')).toHaveText("—");
  await expect(page.locator('[data-kpi-card="ctr"] [data-kpi-value]')).toHaveText("—");
});

test("metric loading or failure and top-row failure do not conceal successful metrics", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard?search=loading");
  const search = page.locator("[data-search-performance]");
  await expect(search.locator('[data-search-metric="ctr"]').getByRole("status")).toHaveText("در حال دریافت مقدار");
  await expect(search.locator('[data-search-metric="clicks"] [data-search-value]')).toHaveText("۱۲۰");
  await expect(search.locator('[data-search-metric="position"] [data-search-value]')).toHaveText("۷٫۳۵");
  if (await page.locator("[data-review-tools]").getAttribute("open") === null) await page.locator("[data-review-tools] > summary").click();
  await page.getByLabel("سناریوی عملکرد جست‌وجو", { exact: true }).selectOption("error");
  await expect(search.locator('[data-search-metric="position"]').getByRole("alert")).toHaveText("دریافت مقدار ناموفق بود");
  await expect(search.locator('[data-search-metric="ctr"] [data-search-value]')).toHaveText("۲٫۴٪");
  if (await page.locator("[data-review-tools]").getAttribute("open") === null) await page.locator("[data-review-tools] > summary").click();
  await page.getByLabel("سناریوی عملکرد جست‌وجو", { exact: true }).selectOption("rows-error");
  await expect(search.locator('[data-search-top-rows]').getByRole("alert")).toHaveText("دریافت عبارت‌های برتر ناموفق بود");
  await expect(search.locator('[data-search-metric="position"] [data-search-value]')).toHaveText("۷٫۳۵");
});

test("top queries remain a subset even when there is no aggregate or no returned query", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard?search=no-totals");
  const search = page.locator("[data-search-performance]");
  await expect(search.getByRole("table")).toBeVisible();
  await expect(search.locator('[data-search-value]')).toHaveText(["—", "—", "—", "—"]);
  await expect(page.locator('[data-kpi-card="ctr"] [data-kpi-value]')).toHaveText("—");
  await expect(search).toContainText("شاخص‌های بالا از جمع یا میانگین این ردیف‌ها محاسبه نمی‌شوند");
  if (await page.locator("[data-review-tools]").getAttribute("open") === null) await page.locator("[data-review-tools] > summary").click();
  await page.getByLabel("سناریوی عملکرد جست‌وجو", { exact: true }).selectOption("empty-rows");
  await expect(search.getByRole("table")).toHaveCount(0);
  await expect(search).toContainText("عبارت برتری برای این بازه دریافت نشده است");
  await expect(search.locator('[data-search-metric="clicks"] [data-search-value]')).toHaveText("۱۲۰");
  await page.goto("/ui-review/websites/dashboard?site=report-empty");
  await expect(search.locator('[data-search-metric="clicks"] [data-search-value]')).toHaveText("۰");
  await expect(search.locator('[data-search-metric="position"] [data-search-value]')).toHaveText("—");
});

test("stale and partial source reports preserve values, coverage and independent GA4 data", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard?search=stale");
  const search = page.locator("[data-search-performance]");
  await expect(search.locator('[data-search-metric="clicks"]')).toHaveAttribute("data-search-freshness", "stale");
  await expect(search.locator('[data-search-metric="clicks"] [data-search-value]')).toHaveText("۱۲۰");
  await expect(search.locator('[data-search-metric="clicks"]')).toContainText("۱۴۰۵/۰۷/۱۹, ۱۱:۳۰");
  await expect(page.locator('[data-source-freshness="gsc"]')).toContainText("داده قدیمی");
  await expect(page.locator('[data-kpi-card="sessions"]')).toHaveAttribute("data-kpi-freshness", "recent");
  if (await page.locator("[data-review-tools]").getAttribute("open") === null) await page.locator("[data-review-tools] > summary").click();
  await page.getByLabel("سناریوی عملکرد جست‌وجو", { exact: true }).selectOption("partial");
  await expect(search.locator('[data-search-metric="position"]')).toHaveAttribute("data-search-quality", "partial");
  await expect(search.locator('[data-search-metric="position"] [data-search-value]')).toHaveText("۷٫۳۵");
});

test("comparison and solar Apply use exact windows without reusing another report or stale table", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard?search=comparison");
  const search = page.locator("[data-search-performance]");
  await expect(search.locator('[data-search-metric="clicks"] [data-search-comparison]')).toContainText("۹۰");
  await expect(search.locator('[data-search-metric="ctr"] [data-search-comparison]')).toContainText("۲٪");
  const compare = page.getByRole("checkbox", { name: "مقایسه با بازهٔ قبلی هم‌اندازه", exact: true });
  await compare.focus(); await page.keyboard.press("Space");
  await expect(search.locator("[data-search-comparison]")).toHaveCount(0);
  await page.getByLabel("نوع بازه", { exact: true }).selectOption("custom");
  await page.getByRole("textbox", { name: "از تاریخ شمسی", exact: true }).fill("۱۴۰۵/۰۷/۰۱");
  await page.getByRole("textbox", { name: "تا تاریخ شمسی", exact: true }).fill("۱۴۰۵/۰۷/۱۸");
  await expect(search.locator('[data-search-metric="clicks"] [data-search-value]')).toHaveText("۱۲۰");
  await page.getByRole("button", { name: "اعمال بازه", exact: true }).click();
  await expect(search.locator('[data-search-metric="clicks"] [data-search-value]')).toHaveText("۵۰");
  await expect(search.locator('[data-search-metric="ctr"] [data-search-value]')).toHaveText("۵٪");
  await expect(search.locator('[data-search-row="search-review-first"] [data-search-cell="ctr"]')).toContainText("۴٪");
  await page.getByRole("textbox", { name: "تا تاریخ شمسی", exact: true }).fill("۱۴۰۵/۰۷/۱۷");
  await page.getByRole("button", { name: "اعمال بازه", exact: true }).click();
  await expect(search.locator("[data-search-value]")).toHaveText(["—", "—", "—", "—"]);
  await expect(search.getByRole("table")).toHaveCount(0);
});

test("source permissions, review selectors and public access never grant data or write storage", async ({ page, context }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/ui-review/websites/dashboard?gsc=permission-error&ga4=ready");
  const search = page.locator("[data-search-performance]");
  await expect(search.locator('[data-search-metric="clicks"]')).toContainText("مجوز این منبع در دسترس نیست");
  await expect(search.getByRole("table")).toHaveCount(0);
  await expect(page.locator('[data-kpi-card="sessions"] [data-kpi-value]')).toHaveText("۲٬۴۶۸");
  await page.goto("/ui-review/websites/dashboard?search=mixed&search=error&clicks=999999&role=admin");
  await expect(page.getByLabel("سناریوی عملکرد جست‌وجو", { exact: true })).toHaveValue("valid");
  if (await page.locator("[data-review-tools]").getAttribute("open") === null) await page.locator("[data-review-tools] > summary").click();
  await page.getByLabel("سناریوی عملکرد جست‌وجو", { exact: true }).selectOption("mixed");
  await expect.poll(() => new URL(page.url()).searchParams.getAll("search")).toEqual(["mixed"]);
  await expect(search.locator('[data-search-metric="clicks"] [data-search-value]')).toHaveText("۰");
  await page.reload();
  await expect(search.locator('[data-search-metric="clicks"] [data-search-value]')).toHaveText("۰");
  await page.getByLabel("انتخاب سایت", { exact: true }).selectOption("report-empty");
  await expect(page.getByLabel("سناریوی عملکرد جست‌وجو", { exact: true })).toHaveValue("valid");
  await page.goto("/websites/arbitrary-id?search=mixed&gsc=ready&role=admin");
  await expect(page.locator("[data-search-performance], [data-search-row], input, select")).toHaveCount(0);
  expect(requests).toEqual([]); expect(errors).toEqual([]); expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
});

test("Persian RTL cards and query table fit small screens, both themes and enlarged text", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard?search=mixed");
  const search = page.locator("[data-search-performance]");
  await expect(search).toHaveCSS("direction", "rtl"); await expect(search).toHaveCSS("font-family", /Vazirmatn/);
  for (const width of [320, 390, 768, 1440]) for (const dark of [false, true]) {
    await page.setViewportSize({ width, height: 900 }); await page.evaluate((value) => document.documentElement.classList.toggle("dark", value), dark);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await search.screenshot({ path: `/private/tmp/datano-fe-022-${width}-${dark ? "dark" : "light"}.png`, animations: "disabled" });
  }
  await page.setViewportSize({ width: 390, height: 900 }); await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await search.locator('[data-search-metric="position"]').screenshot({ path: "/private/tmp/datano-fe-022-enlarged.png", animations: "disabled" });
});
