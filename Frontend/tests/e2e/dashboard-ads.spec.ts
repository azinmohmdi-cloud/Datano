import { test, expect } from "@playwright/test";
import { formatAdsAmount, getAdsAmount, getAdsReading, validAdsCurrency, type AdsObservationInput, type AdsSourceInput } from "../../components/feature/analytics/AdsPerformance/measurements";

const window = { from: "2026-09-15", to: "2026-10-12" }, nowUTC = "2026-10-14T09:00:00Z";
const source: AdsSourceInput = { id: "ads", title: "Google Ads", stateLabel: "ready", connected: true, permitted: true, sourceTimezone: "Asia/Tehran", latestFinalDay: window.to, coverage: { ...window, complete: true, final: true }, resourceId: "test-account", resourceLabel: "test account", currency: "USD", lastSuccessUTC: "2026-10-13T12:00:00Z" };
const cost: AdsObservationInput = { websiteId: "site-one", sourceId: "ads", resourceId: source.resourceId, metric: "cost", window, coverage: window, state: "ready", quality: "complete", lastSuccessUTC: source.lastSuccessUTC, currency: "USD", reportId: "same-report", basis: "ad-interaction-date", measurement: { kind: "micros", value: "1000000000" } };
const clicks: AdsObservationInput = { ...cost, metric: "clicks", measurement: { kind: "clicks", value: 400 } };
const value: AdsObservationInput = { ...cost, metric: "conversionValue", measurement: { kind: "conversion-value", value: 3000 } };
const input = { websiteId: "site-one", source, window, observations: [cost, clicks, value], nowUTC };
function display(metric: "cost" | "clicks" | "conversions" | "cpc" | "roas", selection = input) {
  const reading = getAdsReading(metric, selection);
  return formatAdsAmount(metric, reading.value, reading.currency);
}

test("micros and currency formatting preserve precision, fractional conversions and tiny nonzero values", () => {
  const amount = getAdsAmount("cost", { kind: "micros", value: "1005000" }).value;
  expect(formatAdsAmount("cost", amount, "USD")).toBe("۱٫۰۱");
  expect(formatAdsAmount("cost", amount, "KWD")).toBe("۱٫۰۰۵");
  expect(formatAdsAmount("cost", amount, "JPY")).toBe("۱");
  const large = getAdsAmount("cost", { kind: "micros", value: "9223372036854775807" });
  expect(large.kind).toBe("value"); expect(formatAdsAmount("cost", large.value, "USD")).toBe("۹٬۲۲۳٬۳۷۲٬۰۳۶٬۸۵۴٫۷۸");
  const tiny = getAdsAmount("cost", { kind: "micros", value: "1" });
  expect(tiny.kind).toBe("value"); expect(formatAdsAmount("cost", tiny.value, "USD")).toBe("کمتر از ۰٫۰۱");
  expect(getAdsAmount("cost", { kind: "micros", value: "0" }).kind).toBe("zero");
  expect(formatAdsAmount("conversions", getAdsAmount("conversions", { kind: "conversions", value: 25.5 }).value, null)).toBe("۲۵٫۵");
  expect(formatAdsAmount("conversions", getAdsAmount("conversions", { kind: "conversions", value: 1e-7 }).value, null)).toBe("کمتر از ۰٫۰۱");
  for (const currency of [null, "usd", "ZZZ", "USD ", "تومان"]) { expect(validAdsCurrency(currency)).toBe(false); expect(formatAdsAmount("cost", amount, currency)).toBe("—"); }
  for (const raw of ["-1", "1.5", "1e6", "invalid", "9223372036854775808"]) expect(getAdsAmount("cost", { kind: "micros", value: raw }).kind).toBe("invalid");
  for (const number of [-1, Infinity, NaN, 1.5]) expect(getAdsAmount("clicks", { kind: "clicks", value: number }).kind).toBe("invalid");
});

test("CPC and ROAS distinguish compatible ratios, real zero and zero denominator", () => {
  expect(display("cost")).toBe("۱٬۰۰۰"); expect(display("cpc")).toBe("۲٫۵"); expect(display("roas")).toBe("۳");
  const noClicks = { ...input, observations: [cost, { ...clicks, measurement: { kind: "clicks" as const, value: 0 } }, value] };
  expect(getAdsReading("cpc", noClicks).reason).toBe("clicks-zero"); expect(display("cpc", noClicks)).toBe("—"); expect(display("roas", noClicks)).toBe("۳");
  const noCost = { ...input, observations: [{ ...cost, measurement: { kind: "micros" as const, value: "0" } }, clicks, value] };
  expect(getAdsReading("cpc", noCost).kind).toBe("zero"); expect(getAdsReading("roas", noCost).reason).toBe("cost-zero"); expect(display("roas", noCost)).toBe("—");
  const noValue = { ...input, observations: [cost, clicks, { ...value, measurement: { kind: "conversion-value" as const, value: 0 } }] };
  expect(getAdsReading("roas", noValue).kind).toBe("zero"); expect(display("roas", noValue)).toBe("۰");
  expect(getAdsReading("roas", { ...input, observations: [cost, clicks] }).kind).toBe("unavailable");
});

test("ratios reject incompatible currencies, provenance, coverage, identity and exact window without mutation", () => {
  const before = JSON.stringify(input);
  for (const replacement of [
    { currency: "EUR" }, { reportId: "another-report" }, { basis: "conversion-date" }, { basis: null },
    { coverage: { ...window, from: "2026-09-16" } }, { lastSuccessUTC: "2026-10-13T11:00:00Z" },
    { websiteId: "other-site" }, { resourceId: "another-account" }, { window: { ...window, to: "2026-10-11" } },
  ]) expect(getAdsReading("roas", { ...input, observations: [cost, clicks, { ...value, ...replacement }] }).value).toBeNull();
  expect(getAdsReading("roas", { ...input, observations: [cost, clicks, value, value] }).value).toBeNull();
  expect(getAdsReading("cost", { ...input, source: { ...source, permitted: false } }).reason).toBe("permission");
  expect(getAdsReading("cost", { ...input, source: { ...source, connected: false } }).reason).toBe("disconnected");
  expect(getAdsReading("cost", { ...input, source: { ...source, currency: "EUR" } }).reason).toBe("currency");
  expect(display("clicks", { ...input, source: { ...source, currency: null } })).toBe("۴۰۰");
  const incompatible = getAdsReading("roas", { ...input, observations: [cost, { ...value, coverage: null }] });
  expect(incompatible.reason).toBe("incompatible"); expect(incompatible.coverage).toBeNull();
  expect(JSON.stringify(input)).toBe(before);
});

test("derived quality and freshness preserve stale values and independent failures", () => {
  const old = input.observations.map((observation) => ({ ...observation, window: { from: "2026-09-13", to: "2026-10-10" }, coverage: { from: "2026-09-13", to: "2026-10-10" }, lastSuccessUTC: "2026-10-11T08:00:00Z" }));
  const stale = { ...input, window: old[0].window, source: { ...source, latestFinalDay: "2026-10-10", coverage: { ...old[0].window, complete: true, final: true } }, observations: old };
  expect(getAdsReading("roas", stale).freshness).toBe("stale"); expect(display("roas", stale)).toBe("۳");
  expect(getAdsReading("cost", { ...input, observations: [{ ...cost, lastSuccessUTC: "2026-10-15T09:00:00Z" }] }).freshness).toBe("unknown");
  const partial = { ...input, observations: input.observations.map((observation) => ({ ...observation, quality: "partial" as const })) };
  expect(getAdsReading("cpc", partial).quality).toBe("partial"); expect(display("roas", partial)).toBe("۳");
  const loading = { ...input, observations: [{ ...cost, state: "loading" as const }, clicks, value] };
  expect(getAdsReading("cost", loading).kind).toBe("loading"); expect(getAdsReading("cpc", loading).kind).toBe("loading"); expect(display("clicks", loading)).toBe("۴۰۰");
});

test("Ads section identifies independent metrics, original currency and compatible ROAS", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard");
  const ads = page.locator("[data-ads-performance]");
  await expect(ads.getByRole("heading", { name: "عملکرد تبلیغات", exact: true })).toBeVisible();
  for (const title of ["هزینهٔ تبلیغات", "کلیک‌های تبلیغات", "تبدیل‌های تبلیغات", "هزینهٔ هر کلیک", "بازده هزینهٔ تبلیغات"]) await expect(ads.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(ads).toContainText("Google Ads");
  await expect(ads.locator('[data-ads-metric="cost"]')).toContainText("USD");
  await expect(ads.locator('[data-ads-metric="roas"] [data-ads-value]')).toHaveText("۳");
  for (const [metric, amount] of [["cost", "۱٬۰۰۰"], ["clicks", "۴۰۰"], ["conversions", "۲۵٫۵"], ["cpc", "۲٫۵"]]) await expect(ads.locator(`[data-ads-metric="${metric}"] [data-ads-value]`)).toHaveText(amount);
  await expect(ads).toContainText("۱۴۰۵/۰۶/۲۴ تا ۱۴۰۵/۰۷/۲۰");
});

test("actual account currency is retained across EUR, JPY and KWD without conversion", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard");
  const ads = page.locator("[data-ads-performance]");
  for (const [scenario, currency, cpc] of [["eur", "EUR", "۲٫۵"], ["jpy", "JPY", "۳"], ["kwd", "KWD", "۲٫۵"]]) {
    await page.getByLabel("سناریوی عملکرد تبلیغات", { exact: true }).selectOption(scenario);
    await expect(ads.locator("[data-ads-account-currency]")).toHaveText(currency);
    await expect(ads.locator('[data-ads-metric="cost"] [data-ads-currency]')).toHaveText(currency);
    await expect(ads.locator('[data-ads-metric="cost"] [data-ads-value]')).toHaveText("۱٬۰۰۰");
    await expect(ads.locator('[data-ads-metric="cpc"] [data-ads-value]')).toHaveText(cpc);
    await expect(ads.locator('[data-ads-metric="roas"] [data-ads-value]')).toHaveText("۳");
    await expect(ads.locator('[data-ads-metric="cost"]')).not.toContainText("تومان");
  }
});

test("missing or incompatible ROAS inputs never conceal cost, clicks or independent conversions", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard?adsMetric=missing-value");
  const ads = page.locator("[data-ads-performance]"), roas = ads.locator('[data-ads-metric="roas"]');
  for (const scenario of ["missing-value", "currency-mismatch", "basis-mismatch", "coverage-mismatch"]) {
    await page.getByLabel("سناریوی عملکرد تبلیغات", { exact: true }).selectOption(scenario);
    await expect(roas.locator("[data-ads-value]")).toHaveText("—");
    await expect(ads.locator('[data-ads-metric="cost"] [data-ads-value]')).toHaveText("۱٬۰۰۰");
    await expect(ads.locator('[data-ads-metric="cpc"] [data-ads-value]')).toHaveText("۲٫۵");
    await expect(ads.locator('[data-ads-metric="conversions"] [data-ads-value]')).toHaveText("۲۵٫۵");
  }
  await expect(roas).toContainText("گزارش، پوشش یا مبنای اندازه‌گیری ورودی‌ها سازگار نیست");
  await page.getByLabel("سناریوی عملکرد تبلیغات", { exact: true }).selectOption("unknown-currency");
  await expect(ads.locator('[data-ads-metric="cost"] [data-ads-value]')).toHaveText("—");
  await expect(ads.locator('[data-ads-metric="clicks"] [data-ads-value]')).toHaveText("۴۰۰");
  await expect(roas).toContainText("ارز معتبر و یکسان");
});

test("zero clicks and zero cost are undefined denominators while zero conversion value yields ROAS zero", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard?adsMetric=zero-clicks");
  const ads = page.locator("[data-ads-performance]");
  await expect(ads.locator('[data-ads-metric="cpc"] [data-ads-value]')).toHaveText("—");
  await expect(ads.locator('[data-ads-metric="cpc"]')).toContainText("تعداد کلیک صفر است");
  await expect(ads.locator('[data-ads-metric="roas"] [data-ads-value]')).toHaveText("۳");
  await page.getByLabel("سناریوی عملکرد تبلیغات", { exact: true }).selectOption("zero-value");
  await expect(ads.locator('[data-ads-metric="roas"]')).toHaveAttribute("data-ads-kind", "zero");
  await expect(ads.locator('[data-ads-metric="roas"] [data-ads-value]')).toHaveText("۰");
  await page.goto("/ui-review/websites/dashboard?site=report-empty");
  await expect(ads.locator('[data-ads-metric="cost"] [data-ads-value]')).toHaveText("۰");
  await expect(ads.locator('[data-ads-metric="roas"] [data-ads-value]')).toHaveText("—");
  await expect(ads.locator('[data-ads-metric="roas"]')).toContainText("هزینه صفر است");
});

test("loading, error, partial and stale Ads states preserve other source metrics", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard?adsMetric=loading");
  const ads = page.locator("[data-ads-performance]");
  for (const metric of ["cost", "cpc", "roas"]) await expect(ads.locator(`[data-ads-metric="${metric}"]`).getByRole("status")).toHaveText("در حال دریافت مقدار");
  await expect(ads.locator('[data-ads-metric="conversions"] [data-ads-value]')).toHaveText("۲۵٫۵");
  await page.getByLabel("سناریوی عملکرد تبلیغات", { exact: true }).selectOption("error");
  await expect(ads.locator('[data-ads-metric="conversions"]').getByRole("alert")).toHaveText("دریافت مقدار ناموفق بود");
  await expect(ads.locator('[data-ads-metric="roas"] [data-ads-value]')).toHaveText("۳");
  await page.getByLabel("سناریوی عملکرد تبلیغات", { exact: true }).selectOption("partial");
  await expect(ads.locator('[data-ads-metric="cpc"]')).toHaveAttribute("data-ads-quality", "partial");
  await expect(ads.locator('[data-ads-metric="roas"] [data-ads-value]')).toHaveText("۳");
  await page.getByLabel("سناریوی عملکرد تبلیغات", { exact: true }).selectOption("stale");
  await expect(ads.locator('[data-ads-metric="cost"]')).toHaveAttribute("data-ads-freshness", "stale");
  await expect(ads.locator('[data-ads-metric="cost"] [data-ads-value]')).toHaveText("۱٬۰۰۰");
  await expect(page.locator('[data-source-freshness="ads"]')).toContainText("داده قدیمی");
  await expect(page.locator('[data-kpi-card="ctr"] [data-kpi-value]')).toHaveText("۲٫۴٪");
  await expect(page.locator('[data-kpi-card="keyEvents"] [data-kpi-value]')).toHaveText("۴۲");
});

test("comparison and custom Apply are exact-window scoped and draft changes cannot alter Ads", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard?adsMetric=comparison");
  const ads = page.locator("[data-ads-performance]");
  await expect(ads.locator('[data-ads-metric="cost"] [data-ads-comparison]')).toContainText("۸۰۰");
  await expect(ads.locator('[data-ads-metric="roas"] [data-ads-comparison]')).toContainText("۲٫۵");
  const compare = page.getByRole("checkbox", { name: "مقایسه با بازهٔ قبلی هم‌اندازه", exact: true });
  await compare.focus(); await page.keyboard.press("Space"); await expect(ads.locator("[data-ads-comparison]")).toHaveCount(0);
  await page.getByLabel("نوع بازه", { exact: true }).selectOption("custom");
  await page.getByRole("textbox", { name: "از تاریخ شمسی", exact: true }).fill("۱۴۰۵/۰۷/۰۱");
  await page.getByRole("textbox", { name: "تا تاریخ شمسی", exact: true }).fill("۱۴۰۵/۰۷/۱۸");
  await expect(ads.locator('[data-ads-metric="cost"] [data-ads-value]')).toHaveText("۱٬۰۰۰");
  await page.getByRole("button", { name: "اعمال بازه", exact: true }).click();
  await expect(ads.locator('[data-ads-metric="cost"] [data-ads-value]')).toHaveText("۲۵۰");
  await expect(ads.locator('[data-ads-metric="conversions"] [data-ads-value]')).toHaveText("۱۲٫۵");
  await page.getByRole("textbox", { name: "تا تاریخ شمسی", exact: true }).fill("۱۴۰۵/۰۷/۱۷");
  await page.getByRole("button", { name: "اعمال بازه", exact: true }).click();
  await expect(ads.locator("[data-ads-value]")).toHaveText(["—", "—", "—", "—", "—"]);
});

test("permission, selector reset and public access cannot create data or auth effects", async ({ page, context }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/ui-review/websites/dashboard?ads=permission-error&ga4=ready");
  const ads = page.locator("[data-ads-performance]");
  await expect(ads.locator('[data-ads-metric="cost"]')).toContainText("مجوز حساب تبلیغاتی در دسترس نیست");
  await expect(ads.locator('[data-ads-account-currency]')).toHaveText("—");
  await page.goto("/ui-review/websites/dashboard?adsMetric=eur&adsMetric=zero&cost=999999&currency=IRR&role=admin");
  await expect(page.getByLabel("سناریوی عملکرد تبلیغات", { exact: true })).toHaveValue("valid");
  await expect(ads.locator('[data-ads-account-currency]')).toHaveText("USD");
  await page.getByLabel("سناریوی عملکرد تبلیغات", { exact: true }).selectOption("eur");
  await expect.poll(() => new URL(page.url()).searchParams.getAll("adsMetric")).toEqual(["eur"]); await page.reload();
  await expect(ads.locator('[data-ads-account-currency]')).toHaveText("EUR");
  await page.getByLabel("انتخاب سایت", { exact: true }).selectOption("report-empty");
  await expect(page.getByLabel("سناریوی عملکرد تبلیغات", { exact: true })).toHaveValue("valid");
  await page.goto("/websites/arbitrary-id?adsMetric=valid&ads=ready&currency=USD&role=admin");
  await expect(page.locator("[data-ads-performance], [data-ads-metric], input, select")).toHaveCount(0);
  expect(requests).toEqual([]); expect(errors).toEqual([]); expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
});

test("Persian RTL currency and Ads cards fit small screens, themes and enlarged text", async ({ page }) => {
  await page.goto("/ui-review/websites/dashboard?adsMetric=mixed");
  const ads = page.locator("[data-ads-performance]");
  await expect(ads).toHaveCSS("direction", "rtl"); await expect(ads).toHaveCSS("font-family", /Vazirmatn/);
  await expect(ads.locator('[data-ads-metric="cost"] [data-ads-currency]')).toHaveCSS("direction", "ltr");
  for (const width of [320, 390, 768, 1440]) for (const dark of [false, true]) {
    await page.setViewportSize({ width, height: 900 }); await page.evaluate((value) => document.documentElement.classList.toggle("dark", value), dark);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await ads.screenshot({ path: `/private/tmp/datano-fe-023-${width}-${dark ? "dark" : "light"}.png`, animations: "disabled" });
  }
  await page.setViewportSize({ width: 390, height: 900 }); await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await ads.locator('[data-ads-metric="cost"]').screenshot({ path: "/private/tmp/datano-fe-023-enlarged.png", animations: "disabled" });
});
