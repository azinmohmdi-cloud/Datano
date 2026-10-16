import { test, expect } from "@playwright/test";

const list = "/ui-review/websites/recommendations";
const detail = `${list}/UI_REVIEW_RECOMMENDATION_GA4?site=report-ready&scenario=ready`;

test("list opens inline evidence and closing preserves the same site and filtered list", async ({ page }) => {
  await page.goto(`${list}?site=report-empty&scenario=single`);
  await expect(page.getByLabel("منبع پیشنهادها", { exact: true })).toBeEnabled();
  await page.getByLabel("منبع پیشنهادها", { exact: true }).selectOption("gsc");
  const link = page.getByRole("link", { name: "بررسی نرخ کلیک نتایج جست‌وجو", exact: true });
  const originalUrl = page.url();
  await link.focus(); await page.keyboard.press("Enter");
  expect(page.url()).toBe(originalUrl);
  await expect(page.locator("[data-recommendation-detail]")).toContainText("empty.example.test");
  await expect(page.getByRole("heading", { name: "شواهد تحلیلی", exact: true })).toBeVisible();
  await expect(page.locator("[data-evidence]")).toContainText("۱٬۵۰۰");
  await expect(page.locator("[data-evidence]")).toContainText("America/Los_Angeles");
  await expect(page.getByText("gsc-low-ctr-v1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "مشاهده دلیل و شواهد", exact: true }).click();
  expect(page.url()).toBe(originalUrl);
  await expect(page.getByLabel("منبع پیشنهادها", { exact: true })).toHaveValue("gsc");
  await expect(page.locator("[data-recommendation-row]")).toHaveCount(1);
});

test("detail preserves rule version source civil periods and chronological recorded history", async ({ page }) => {
  await page.goto(detail);
  await expect(page.getByRole("heading", { name: "بررسی افت نشست‌های سایت", exact: true })).toBeVisible();
  await expect(page.locator("[data-recorded-summary]")).toContainText("اولویت بالا");
  await expect(page.locator("[data-recorded-summary]")).toContainText("جدید");
  await expect(page.locator("[data-recorded-summary]")).toContainText("Google Analytics 4");
  await expect(page.locator("[data-evidence]")).toContainText("۱٬۰۵۰");
  await expect(page.locator("[data-evidence]")).toContainText("۱٬۵۰۰");
  await expect(page.locator("[data-evidence]")).toContainText("۱۴۰۵/۰۶/۲۴");
  await expect(page.locator("[data-evidence]")).toContainText("۱۴۰۵/۰۷/۲۰");
  await expect(page.getByText("ga4-sessions-drop-v1", { exact: true })).toBeVisible();
  await expect(page.locator("[data-rule-version]")).toHaveText("1");
  await expect(page.getByRole("heading", { name: "دلیل ایجاد پیشنهاد", exact: true })).toBeVisible();
  await expect(page.locator("[data-recommendation-reason]")).toContainText("۳۰٪");
  await page.goto(`${list}/UI_REVIEW_RECOMMENDATION_ADS?site=report-ready&scenario=all-sources`);
  const history = page.getByRole("list", { name: "تاریخچهٔ ثبت‌شده", exact: true });
  await expect(history.locator("li")).toHaveCount(3);
  await expect(history.locator("li").first()).toContainText("ایجاد پیشنهاد");
  await expect(history.locator("li").last()).toContainText("پایان بررسی");
  await expect(page.locator("[data-evidence]")).toContainText("USD");
});

test("preview tracking never rewrites recorded status evidence or history and resets on reload", async ({ page, context }) => {
  const requests: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  await page.goto(detail);
  const select = page.getByLabel("وضعیت نمایشی", { exact: true });
  await expect(select).toBeEnabled();
  const evidence = await page.locator("[data-evidence]").textContent();
  const history = await page.locator("[data-recorded-history]").textContent();
  const metadata = await page.locator("[data-rule-metadata]").textContent();
  await expect(page.getByText("تغییر وضعیت فقط در همین نماست و در Backend ذخیره نمی‌شود.", { exact: true })).toBeVisible();
  await select.selectOption("reviewing");
  const apply = page.getByRole("button", { name: "اعمال نمایشی وضعیت", exact: true });
  await apply.focus(); await page.keyboard.press("Enter");
  await expect(page.locator("[data-tracking-preview-result]")).toContainText("در حال بررسی");
  await expect(page.locator("[data-tracking-preview-result]")).toContainText("ذخیره نشده");
  await expect(page.locator("[data-recorded-summary]")).toContainText("جدید");
  expect(await page.locator("[data-evidence]").textContent()).toBe(evidence);
  expect(await page.locator("[data-recorded-history]").textContent()).toBe(history);
  expect(await page.locator("[data-rule-metadata]").textContent()).toBe(metadata);
  await page.getByRole("button", { name: "بازنشانی پیش‌نمایش", exact: true }).click();
  await expect(select).toHaveValue("new");
  await select.selectOption("reviewed"); await apply.click();
  await page.reload();
  await expect(select).toHaveValue("new");
  await expect(page.locator("[data-tracking-preview-result]")).toContainText("جدید");
  await select.selectOption("reviewing"); await apply.click();
  const originalRow = page.locator("[data-recommendation-row]").filter({ has: page.getByRole("heading", { name: "بررسی افت نشست‌های سایت", exact: true }) });
  await originalRow.getByRole("button", { name: "مشاهده دلیل و شواهد", exact: true }).click();
  await page.getByRole("link", { name: "بررسی افت نشست‌های سایت", exact: true }).click();
  await expect(select).toHaveValue("new");
  await expect(page.locator("[data-tracking-preview-result]")).toContainText("جدید");
  expect(requests).toEqual([]); expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
});

test("unknown recommendations and mismatched site identities never fall back to another record", async ({ page }) => {
  for (const path of [
    `${list}/unknown?site=report-ready`,
    `${list}/UI_REVIEW_RECOMMENDATION_GA4?site=report-empty`,
    `${list}/UI_REVIEW_RECOMMENDATION_GA4?site=unknown`,
    `${detail}&site=report-empty`,
    `${detail}&view=mismatched`,
  ]) {
    await page.goto(path);
    await expect(page.getByText("پیشنهاد موردنظر پیدا نشد.", { exact: true })).toBeVisible();
    await expect(page.locator("[data-evidence], [data-rule-metadata], [data-tracking], [data-recorded-summary]")).toHaveCount(0);
    await expect(page).toHaveURL(/\/ui-review\/websites\/recommendations\?/);
  }
});

test("page loading failure and access states remain distinct without stale detail content", async ({ page }) => {
  for (const [view, text] of [
    ["loading", "در حال دریافت جزئیات پیشنهاد"], ["error", "دریافت جزئیات پیشنهاد ناموفق بود."],
    ["forbidden", "به این پیشنهاد دسترسی ندارید."], ["unverified", "ابتدا مالکیت این سایت را تأیید کنید."],
  ]) {
    await page.goto(`${detail}&view=${view}`);
    await expect(page.getByText(text, { exact: true })).toBeVisible();
    await expect(page.locator("[data-evidence], [data-recorded-summary], [data-tracking]")).toHaveCount(0);
  }
});

test("missing evidence rule metadata and independent history states preserve other available detail", async ({ page }) => {
  for (const [view, text] of [
    ["no-evidence", "شواهد این پیشنهاد در دسترس نیست."], ["no-measurements", "شواهد این پیشنهاد در دسترس نیست."], ["no-rule", "اطلاعات قاعده در دسترس نیست."],
    ["history-empty", "تاریخچه‌ای برای نمایش موجود نیست."], ["history-error", "دریافت تاریخچه ناموفق بود."],
    ["history-loading", "در حال دریافت تاریخچه"],
  ]) {
    await page.goto(`${detail}&view=${view}`);
    await expect(page.locator("[data-recommendation-detail]").getByText(text, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "بررسی افت نشست‌های سایت", exact: true })).toBeVisible();
    if (view !== "no-evidence" && view !== "no-measurements") await expect(page.locator("[data-evidence]")).toContainText("۱٬۰۵۰");
    else await expect(page.getByRole("table")).toHaveCount(0);
  }
});

test("incomplete provisional and missing values are labeled without inventing zeros or new evidence", async ({ page }) => {
  for (const [view, text] of [["incomplete", "پوشش ناقص"], ["provisional", "داده موقت"], ["unknown-quality", "کیفیت نامشخص"]]) {
    await page.goto(`${detail}&view=${view}`);
    await expect(page.locator("[data-evidence]")).toContainText(text);
  }
  await page.goto(`${detail}&view=missing-values`);
  await expect(page.locator("[data-evidence]")).toContainText("—");
  await expect(page.locator("[data-evidence]")).not.toContainText("۱٬۰۵۰");
});

test("tracking unavailable state does not offer a fake save or hide recorded status", async ({ page }) => {
  await page.goto(`${detail}&view=tracking-unavailable`);
  await expect(page.getByText("تغییر وضعیت در حال حاضر در دسترس نیست.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("وضعیت نمایشی", { exact: true })).toHaveCount(0);
  await expect(page.locator("[data-recorded-summary]")).toContainText("جدید");
});

test("product detail ignores review flags and exposes no fixture or tracking controls", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto("/websites/report-ready/recommendations/UI_REVIEW_RECOMMENDATION_GA4?view=ready&role=admin&preview=1&verified=1");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("پیشنهادهای تحلیلی | دیتانو");
  await expect(page.getByText("برای مشاهدهٔ پیشنهادهای این سایت، وارد شوید.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-evidence], [data-tracking], [data-review-tools], select, a[href^='/ui-review']")).toHaveCount(0);
  await expect(page).toHaveURL(/\/websites\/report-ready\/recommendations\?recommendation=UI_REVIEW_RECOMMENDATION_GA4/);
  expect(await context.cookies()).toEqual([]); expect(errors).toEqual([]);
});

test("detail fits Persian mobile desktop dark and enlarged layouts with shared footer", async ({ page }) => {
  await page.goto(`${list}/UI_REVIEW_RECOMMENDATION_ADS?site=report-ready&scenario=all-sources`);
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("body")).toHaveCSS("font-family", /Vazirmatn/);
  await expect(page.getByRole("main")).toHaveCount(1); await expect(page.getByRole("contentinfo")).toHaveCount(1);
  for (const width of [320, 390, 768, 1440]) for (const dark of [false, true]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate((value) => document.documentElement.classList.toggle("dark", value), dark);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (!dark && (width === 390 || width === 1440)) await page.screenshot({ path: `/private/tmp/datano-fe025-${width}.png`, fullPage: true });
  }
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByLabel("وضعیت نمایشی", { exact: true })).toBeVisible();
});
