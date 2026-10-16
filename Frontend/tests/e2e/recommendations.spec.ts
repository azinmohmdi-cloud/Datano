import { test, expect } from "@playwright/test";
import { recommendationDetailsHref, recommendationsHref } from "../../components/feature/recommendations/RecommendationList/navigation";

const review = "/ui-review/websites/recommendations";
const rows = "[data-recommendation-row]";

test("central site list shows source, textual priority and read-only status without a source quota", async ({ page }) => {
  await page.goto(review);
  await expect(page.getByRole("heading", { name: "پیشنهادهای تحلیلی", exact: true })).toBeVisible();
  await expect(page.locator(rows)).toHaveCount(2);
  await expect(page.locator(rows).first()).toContainText("بررسی افت نشست‌های سایت");
  await expect(page.locator(rows).first()).toContainText("اولویت بالا");
  await expect(page.locator(rows).first()).toContainText("جدید");
  await expect(page.locator(rows).first()).toContainText("Google Analytics 4");
  await expect(page.locator(rows).nth(1)).toContainText("در حال بررسی");
  await expect(page.locator('[data-source-condition="ads"]')).toContainText("متصل نشده");
  await expect(page.locator('[data-recommendation-row] a[href*="recommendations"]')).toHaveCount(2);
  await expect(page.getByRole("button", { name: /جزئیات|تغییر وضعیت/ })).toHaveCount(0);
});

test("source filtering is keyboard operable and separates an unconnected source from no results", async ({ page }) => {
  await page.goto(review);
  const filter = page.getByLabel("منبع پیشنهادها", { exact: true });
  await expect(filter).toBeEnabled();
  await filter.focus();
  await expect(filter).toBeFocused();
  await filter.selectOption("gsc");
  await expect(page.locator(rows)).toHaveCount(1);
  await expect(page.locator(rows)).toContainText("Search Console");
  await filter.selectOption("ads");
  await expect(page.locator(rows)).toHaveCount(0);
  await expect(page.getByText("برای این منبع پیشنهادی در فهرست نیست.", { exact: true })).toBeVisible();
  await expect(page.locator('[data-source-condition="ads"]')).toContainText("این منبع به سایت متصل نشده است.");
  await page.getByRole("button", { name: "نمایش همهٔ منابع", exact: true }).click();
  await expect(filter).toHaveValue("all");
  await expect(page.locator(rows)).toHaveCount(2);
});

test("valid no-recommendation, insufficient data and source failures have different explanations", async ({ page }) => {
  for (const [scenario, text] of [
    ["none", "در ارزیابی انجام‌شده، شرط هیچ پیشنهادی برقرار نبوده است."],
    ["insufficient", "دادهٔ کافی برای ارزیابی این منبع وجود ندارد."],
    ["source-error", "دریافت یا ارزیابی این منبع ناموفق بوده است."],
    ["pending", "ارزیابی این منبع هنوز انجام نشده است."],
    ["permission", "دسترسی این منبع نیاز به بررسی دارد."],
  ]) {
    await page.goto(`${review}?scenario=${scenario}`);
    await expect(page.locator(rows)).toHaveCount(0);
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
    if (scenario !== "none") await expect(page.getByText("در ارزیابی انجام‌شده، شرط هیچ پیشنهادی برقرار نبوده است.", { exact: true })).toHaveCount(0);
  }
});

test("stale incomplete and provisional sources do not turn into recommendations", async ({ page }) => {
  await page.goto(`${review}?scenario=quality`);
  await expect(page.locator(rows)).toHaveCount(0);
  for (const text of ["دادهٔ این منبع قدیمی است؛ پیشنهاد تازه‌ای از آن ارائه نشده است.", "پوشش دادهٔ این منبع کامل نیست.", "دادهٔ این منبع هنوز نهایی نشده است."]) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
});

test("partial success keeps available recommendations and single-source sites need no other sources", async ({ page }) => {
  await page.goto(`${review}?scenario=partial`);
  await expect(page.locator(rows)).toHaveCount(1);
  await expect(page.locator('[data-source-condition="gsc"]')).toContainText("خطا");
  await expect(page.locator(rows)).toContainText("Google Analytics 4");
  await page.goto(`${review}?scenario=single`);
  await expect(page.locator(rows)).toHaveCount(1);
  await expect(page.locator(rows)).toContainText("Search Console");
  await page.goto(`${review}?scenario=all-sources`);
  await expect(page.locator(rows)).toHaveCount(3);
  await expect(page.locator(rows).last()).toContainText("Google Ads");
  await expect(page.locator(rows).last()).toContainText("بررسی شده");
});

test("loading error and denied access hide rows and do not claim a successful empty evaluation", async ({ page }) => {
  for (const [scenario, text] of [
    ["loading", "در حال دریافت پیشنهادها"],
    ["error", "دریافت پیشنهادها ناموفق بود."],
    ["forbidden", "به پیشنهادهای این سایت دسترسی ندارید."],
    ["unverified", "ابتدا مالکیت این سایت را تأیید کنید."],
  ]) {
    await page.goto(`${review}?scenario=${scenario}`);
    await expect(page.getByText(text, { exact: true })).toBeVisible();
    await expect(page.locator(rows)).toHaveCount(0);
    await expect(page.getByLabel("منبع پیشنهادها", { exact: true })).toHaveCount(0);
    await expect(page.getByText("در ارزیابی انجام‌شده، شرط هیچ پیشنهادی برقرار نبوده است.", { exact: true })).toHaveCount(0);
  }
});

test("private site changes reset filters and cannot leak rows from the previous site", async ({ page }) => {
  await page.goto(review);
  await page.getByLabel("منبع پیشنهادها", { exact: true }).selectOption("ga4");
  await page.locator('[data-review-tools] > summary').click();
  await page.getByLabel("سایت نمونه", { exact: true }).selectOption("report-empty");
  await expect(page.getByLabel("منبع پیشنهادها", { exact: true })).toHaveValue("all");
  await expect(page.locator("[data-recommendation-site]")).toContainText("empty.example.test");
  await expect(page.locator(rows)).toHaveCount(1);
  await expect(page.getByText("بررسی افت نشست‌های سایت", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator(rows)).toHaveCount(1);
  await page.goto(`${review}?site=report-empty&site=report-ready&scenario=error&scenario=none&role=admin`);
  await expect(page.locator("[data-recommendation-site]")).toContainText("marketing-performance-team.reports.example.test");
  await expect(page.locator(rows)).toHaveCount(2);
});

test("product route ignores fixture and role flags and performs no requests or storage mutations", async ({ page, context }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto("/websites/arbitrary-id/recommendations?scenario=all-sources&site=report-ready&role=admin&verified=1");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("پیشنهادهای تحلیلی | دیتانو");
  await expect(page.getByText("برای مشاهدهٔ پیشنهادهای این سایت، وارد شوید.", { exact: true })).toBeVisible();
  await expect(page.locator(`${rows}, [data-review-tools], select, a[href^="/ui-review"]`)).toHaveCount(0);
  await expect(page.getByText(/marketing-performance-team\.reports\.example\.test|empty\.example\.test/)).toHaveCount(0);
  expect(requests).toEqual([]); expect(errors).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
  await page.getByRole("main").getByRole("link", { name: "ورود به حساب", exact: true }).click();
  await expect(page).toHaveURL("/login");
});

test("Persian list fits small wide dark and enlarged layouts with shared site shell and footer", async ({ page }) => {
  await page.goto(`${review}?scenario=all-sources`);
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("body")).toHaveCSS("font-family", /Vazirmatn/);
  await expect(page.locator('[data-layout="site"]')).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("contentinfo")).toHaveCount(1);
  for (const width of [320, 390, 768, 1440]) for (const dark of [false, true]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate((value) => document.documentElement.classList.toggle("dark", value), dark);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator(rows)).toHaveCount(3);
    if (!dark && (width === 390 || width === 1440)) await page.screenshot({ path: `/private/tmp/datano-fe024-${width}.png`, fullPage: true });
  }
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await page.setViewportSize({ width: 320, height: 900 });
  // The unchanged shared header overflows at 320px/200%; verify the feature fits
  // and does not increase that baseline. Keep whole-page checks at supported 390px/200%.
  expect(await page.locator("[data-recommendations]").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  const recommendationOverflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await expect(page.getByRole("heading", { name: "بررسی افزایش هزینهٔ هر کلیک", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto("/websites");
  await expect(page.getByText("برای مشاهده سایت‌های خود، وارد شوید.", { exact: true })).toBeVisible();
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await page.setViewportSize({ width: 320, height: 900 });
  const sharedShellOverflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(recommendationOverflow).toBeLessThanOrEqual(sharedShellOverflow);
});

test("detail destinations remain site-scoped and encode identifiers", () => {
  expect(recommendationsHref("site/one")).toBe("/websites/site%2Fone/recommendations");
  expect(recommendationDetailsHref("site/one", "rule?#1")).toBe("/websites/site%2Fone/recommendations/rule%3F%231");
});

test("list navigation retains the selected site and the dashboard offers only a list entry", async ({ page }) => {
  await page.goto(`${review}?site=report-empty`);
  await expect(page.getByRole("link", { name: "مدیریت اتصال منابع", exact: true })).toHaveAttribute("href", "/ui-review/websites/connect?site=report-empty");
  await expect(page.getByRole("link", { name: "وضعیت دریافت داده", exact: true })).toHaveAttribute("href", "/ui-review/websites/receive?site=report-empty");
  await page.getByRole("link", { name: "داشبورد سایت", exact: true }).click();
  await expect(page).toHaveURL("/ui-review/websites/dashboard?site=report-empty");
  await expect(page.getByLabel("انتخاب سایت", { exact: true })).toHaveValue("report-empty");
  await expect(page.locator('[data-recommendations], [data-recommendation-row]')).toHaveCount(0);
  await expect(page.locator('[data-dashboard-recommendations-entry] a')).toHaveAttribute("href", "/ui-review/websites/recommendations?site=report-empty");
});

test("without JavaScript review data stays behind Suspense and product login remains usable", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(review);
    await expect(page.getByText("در حال آماده‌سازی محیط بررسی", { exact: true })).toBeVisible();
    await expect(page.locator("[data-recommendations]")).toBeHidden();
    await page.goto("/websites/site-one/recommendations");
    await page.getByRole("main").getByRole("link", { name: "ورود به حساب", exact: true }).click();
    await expect(page).toHaveURL("/login");
  } finally { await context.close(); }
});
