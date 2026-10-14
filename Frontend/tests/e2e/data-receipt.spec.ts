import { test, expect } from "@playwright/test";

test("one successful source permits a partial report while other states remain independent", async ({ page }) => {
  await page.goto("/ui-review/websites/receive?ga4=ready&gsc=failed&ads=disconnected");
  await expect(page.getByRole("heading", { name: "دریافت داده و آمادگی گزارش", exact: true })).toBeVisible();
  await expect(page.locator("[data-receipt-source]")).toHaveCount(3);
  await expect(page.locator("[data-report-readiness]")).toHaveAttribute("data-report-readiness", "ready");
  await expect(page.getByText("گزارش جزئی آماده است", { exact: true })).toBeVisible();
  await expect(page.locator('[data-receipt-source="gsc"]')).toHaveAttribute("data-receipt-state", "failed");
  await expect(page.locator('[data-receipt-source="ads"]')).toHaveAttribute("data-receipt-state", "disconnected");
  await page.getByRole("button", { name: "مشاهده گزارش", exact: true }).click();
  await expect(page).toHaveURL("/ui-review/websites/dashboard?site=waiting&ga4=ready&gsc=failed&ads=disconnected");
  await expect(page.locator("[data-dashboard-shell]")).toContainText("shop.example.test");
  await expect(page.locator('[data-dashboard-source="gsc"]')).toContainText("دریافت ناموفق");
  await expect(page.locator('[data-dashboard-source="ads"]')).toContainText("بدون اتصال");
});

test("the six receipt states distinguish unknown, waiting, failure, empty and data", async ({ page }) => {
  const cases = [
    ["disconnected", "بدون اتصال", "disconnected", false], ["queued", "در صف دریافت", "waiting", false],
    ["receiving", "در حال دریافت", "waiting", false], ["failed", "دریافت ناموفق", "not-ready", false],
    ["empty", "دریافت موفق، بدون داده", "empty", true], ["ready", "دریافت موفق، دارای داده", "ready", true],
  ] as const;
  for (const [state, label, readiness, available] of cases) {
    await page.goto(`/ui-review/websites/receive?ga4=${state}&gsc=disconnected&ads=disconnected`);
    const source = page.locator('[data-receipt-source="ga4"]');
    await expect(source).toHaveAttribute("data-receipt-state", state);
    await expect(source.getByText(label, { exact: true }).first()).toBeVisible();
    await expect(page.locator("[data-report-readiness]")).toHaveAttribute("data-report-readiness", readiness);
    if (available) await expect(page.getByRole("button", { name: "مشاهده گزارش", exact: true })).toBeEnabled();
    else {
      await expect(page.getByRole("button", { name: "مشاهده گزارش", exact: true })).toBeDisabled();
      await expect(source.getByText("بدون رکورد در این بازه", { exact: true })).toHaveCount(0);
      await expect(source.locator("[data-source-report-available]")).toHaveCount(0);
    }
  }
});

test("each successful source alone permits a report even when others fail or remain queued", async ({ page }) => {
  for (const id of ["ga4", "gsc", "ads"]) for (const result of ["ready", "empty"]) {
    const states = { ga4: "failed", gsc: "queued", ads: "permission-error", [id]: result };
    await page.goto(`/ui-review/websites/receive?ga4=${states.ga4}&gsc=${states.gsc}&ads=${states.ads}`);
    await expect(page.locator("[data-report-readiness]")).toHaveAttribute("data-report-readiness", result);
    await expect(page.locator("[data-source-report-available]")).toHaveCount(1);
    await expect(page.locator(`[data-receipt-source="${id}"] [data-source-report-available]`)).toBeVisible();
    await expect(page.getByRole("button", { name: "مشاهده گزارش", exact: true })).toBeEnabled();
    if (result === "empty") await expect(page.getByText("گزارش آماده، بدون داده", { exact: true })).toBeVisible();
  }
});

test("mixed empty and data results preserve their meanings and a full report needs no partial label", async ({ page }) => {
  await page.goto("/ui-review/websites/receive?ga4=empty&gsc=ready&ads=failed");
  await expect(page.getByText("گزارش جزئی آماده است", { exact: true })).toBeVisible();
  await expect(page.locator('[data-receipt-source="ga4"]')).toContainText("بدون رکورد در این بازه");
  await expect(page.locator('[data-receipt-source="gsc"]')).toContainText("داده موجود است");
  await page.getByLabel("وضعیت دریافت Google Ads", { exact: true }).selectOption("ready");
  await expect(page.getByText("گزارش آماده است", { exact: true })).toBeVisible();
  await expect(page.locator("[data-source-report-available]")).toHaveCount(3);
});

test("incomplete, nonfinal, wrong-window and permission failures cannot become successful empty reports", async ({ page }) => {
  for (const state of ["incomplete", "wrong-window", "permission-error"]) {
    await page.goto(`/ui-review/websites/receive?ga4=${state}&gsc=disconnected&ads=disconnected`);
    await expect(page.locator("[data-report-readiness]")).toHaveAttribute("data-report-readiness", "not-ready");
    await expect(page.locator("[data-source-report-available]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "مشاهده گزارش", exact: true })).toBeDisabled();
    await expect(page.getByText("گزارش آماده، بدون داده", { exact: true })).toHaveCount(0);
    if (state !== "permission-error") await expect(page.locator('[data-receipt-source="ga4"]')).toContainText("پوشش ناقص یا موقت");
  }
});

test("an existing valid result remains available during a new receive or failed retry", async ({ page }) => {
  for (const [choice, state] of [["refreshing", "receiving"], ["retry-failed", "failed"]]) {
    await page.goto(`/ui-review/websites/receive?ga4=${choice}&gsc=disconnected&ads=disconnected`);
    await expect(page.locator('[data-receipt-source="ga4"]')).toHaveAttribute("data-receipt-state", state);
    await expect(page.locator("[data-report-readiness]")).toHaveAttribute("data-report-readiness", "ready");
    await expect(page.getByRole("button", { name: "مشاهده گزارش", exact: true })).toBeEnabled();
    await expect(page.locator('[data-receipt-source="ga4"]')).toContainText("آخرین دریافت موفق، به وقت تهران");
  }
});

test("source windows are final civil days in Persian and UTC success times are displayed in Tehran", async ({ page }) => {
  await page.goto("/ui-review/websites/receive?ga4=ready&gsc=ready&ads=empty");
  const ranges = { ga4: ["۱۴۰۵/۰۶/۲۳", "۱۴۰۵/۰۷/۱۹"], gsc: ["۱۴۰۵/۰۶/۲۲", "۱۴۰۵/۰۷/۱۸"], ads: ["۱۴۰۵/۰۶/۲۴", "۱۴۰۵/۰۷/۲۰"] };
  for (const id of ["ga4", "gsc", "ads"] as const) {
    const card = page.locator(`[data-receipt-source="${id}"]`);
    await expect(card).toContainText(`${ranges[id][0]} تا ${ranges[id][1]}`);
    await expect(card).toContainText("۱۴۰۵/۰۷/۲۱, ۱۵:۳۰");
    await expect(card.getByText("پوشش کامل و نهایی", { exact: true })).toBeVisible();
    await expect(card.getByText(id === "gsc" ? "America/Los_Angeles" : "Asia/Tehran", { exact: true })).toHaveCSS("direction", "ltr");
  }
});

test("unavailable status and retry actions keep all source results without requests, cookies or storage", async ({ page, context }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/ui-review/websites/receive?ga4=ready&gsc=failed&ads=queued");
  const ga4 = page.locator('[data-receipt-source="ga4"]'), gsc = page.locator('[data-receipt-source="gsc"]');
  const check = ga4.getByRole("button", { name: "بررسی وضعیت منبع", exact: true });
  await expect(check).toBeVisible(); await expect(check).toBeEnabled();
  await check.focus(); await expect(check).toBeFocused(); await page.keyboard.press("Enter");
  await expect(ga4.getByRole("alert")).toContainText("اطلاعات موجود حفظ شده‌اند");
  await expect(gsc.getByRole("alert")).toHaveCount(0);
  await gsc.getByRole("button", { name: "تلاش مجدد دریافت", exact: true }).click();
  await expect(gsc.getByRole("alert")).toContainText("وضعیت این منبع حفظ شده است");
  await page.getByRole("button", { name: "به‌روزرسانی وضعیت", exact: true }).click();
  await expect(page.locator("[data-receipt-operation-error]")).toContainText("اطلاعات موجود حفظ شده‌اند");
  await expect(page.locator('[data-receipt-source="ads"]').getByRole("button", { name: "در صف دریافت", exact: true })).toBeDisabled();
  await expect(page.locator("[data-report-readiness]")).toHaveAttribute("data-report-readiness", "ready");
  await expect(ga4).toHaveAttribute("data-receipt-state", "ready"); await expect(gsc).toHaveAttribute("data-receipt-state", "failed");
  await expect(page.locator("[data-source-report-available]")).toHaveCount(1);
  expect(requests).toEqual([]); expect(errors).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
});

test("ownership and repeated or arbitrary selectors cannot supply trusted receipt data", async ({ page }) => {
  await page.goto("/ui-review/websites/receive?site=unverified&ga4=ready&gsc=empty&ads=ready&verified=1");
  await expect(page.locator("[data-report-readiness]")).toHaveAttribute("data-report-readiness", "ownership-required");
  await expect(page.locator('[data-receipt-source][data-receipt-state="disconnected"]')).toHaveCount(3);
  await expect(page.locator("[data-source-report-available]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "مشاهده گزارش", exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "تأیید مالکیت سایت", exact: true }).click();
  await expect(page).toHaveURL("/ui-review/websites/verify?site=unverified");
  await page.goto("/ui-review/websites/receive?site=unknown&site=unverified&ga4=ready&ga4=empty&gsc=unknown&ads=unknown");
  await expect(page.locator('[data-receipt-source="ga4"]')).toHaveAttribute("data-receipt-state", "disconnected");
  await expect(page.locator('[data-receipt-source="gsc"]')).toHaveAttribute("data-receipt-state", "queued");
  await expect(page.locator("[data-data-receipt]")).toContainText("shop.example.test");
});

test("source management and connection handoff preserve the same site and only eligible connected sources", async ({ page }) => {
  await page.goto("/ui-review/websites/receive?site=failed&ga4=ready&gsc=permission-error&ads=disconnected");
  await page.getByRole("link", { name: "مدیریت اتصال منابع", exact: true }).first().click();
  await expect(page).toHaveURL("/ui-review/websites/connect?site=failed&ga4=connected&gsc=revoked&ads=disconnected");
  await expect(page.locator("[data-google-connections]")).toContainText("blog.example.test");
  await expect(page.locator('[data-google-source="ga4"]')).toHaveAttribute("data-source-state", "connected");
  await expect(page.locator('[data-google-source="gsc"]')).toHaveAttribute("data-source-state", "revoked");
  await page.getByLabel("سناریوی Google Ads", { exact: true }).selectOption("connected");
  await expect(page.locator('[data-google-source="ads"]')).toHaveAttribute("data-source-state", "connected");
  await page.getByRole("button", { name: "ادامه برای دریافت داده", exact: true }).click();
  await expect(page).toHaveURL("/ui-review/websites/receive?site=failed&ga4=queued&gsc=disconnected&ads=queued");
  await expect(page.locator("[data-data-receipt]")).toContainText("blog.example.test");
  await expect(page.locator('[data-receipt-state="queued"]')).toHaveCount(2);
  await expect(page.getByRole("button", { name: "مشاهده گزارش", exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "بازگشت به سایت‌های من", exact: true }).click();
  await expect(page).toHaveURL("/ui-review/websites");
});

test("the public receipt page stays guest-only despite sample, ownership, job and readiness flags", async ({ page, context }) => {
  const errors: string[] = [], requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  const response = await page.goto("/websites/arbitrary-id/receive?site=report-ready&ga4=ready&gsc=empty&ads=ready&verified=1&role=admin&job=success");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("دریافت داده و آمادگی گزارش | دیتانو");
  await expect(page.getByText("برای مشاهده وضعیت دریافت داده سایت، وارد شوید.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-receipt-source], [data-report-readiness], input, select")).toHaveCount(0);
  await expect(page.locator('a[href^="/ui-review"]')).toHaveCount(0);
  await page.getByRole("link", { name: "بازگشت به سایت‌های من", exact: true }).click(); await expect(page).toHaveURL("/websites");
  await page.goBack();
  await page.getByRole("main").getByRole("link", { name: "ورود به حساب", exact: true }).click(); await expect(page).toHaveURL("/login");
  expect(errors).toEqual([]); expect(requests).toEqual([]); expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
});

test("review selectors reset operation errors and readiness safely without retaining prior success", async ({ page }) => {
  await page.goto("/ui-review/websites/receive?ga4=ready&gsc=disconnected&ads=disconnected");
  await page.getByRole("button", { name: "به‌روزرسانی وضعیت", exact: true }).click();
  await expect(page.locator("[data-receipt-operation-error]")).toBeVisible();
  await page.getByLabel("وضعیت دریافت GA4", { exact: true }).selectOption("failed");
  await expect(page.locator("[data-report-readiness]")).toHaveAttribute("data-report-readiness", "not-ready");
  await expect(page.locator("[data-receipt-operation-error]")).toHaveCount(0);
  await page.getByLabel("سایت نمونه", { exact: true }).selectOption("no-connection");
  await expect(page.locator('[data-receipt-state="disconnected"]')).toHaveCount(3);
  await expect(page.locator("[data-report-readiness]")).toHaveAttribute("data-report-readiness", "disconnected");
});

test("Persian RTL receipt cards fit mobile, tablet, desktop, dark tokens and enlarged text", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/ui-review/websites/receive?site=report-ready&ga4=ready&gsc=failed&ads=empty");
  await expect(page.locator("html")).toHaveAttribute("lang", "fa"); await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("body")).toHaveCSS("font-family", /Vazirmatn/);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const dark of [false, true]) {
      await page.evaluate((darkMode) => document.documentElement.classList.toggle("dark", darkMode), dark);
      for (const selector of await page.getByRole("combobox").all()) expect((await selector.boundingBox())!.height).toBeGreaterThanOrEqual(48);
      await expect(page.getByRole("button", { name: "به‌روزرسانی وضعیت", exact: true })).toBeEnabled();
      await page.getByRole("button", { name: "به‌روزرسانی وضعیت", exact: true }).focus();
      await expect(page.getByRole("button", { name: "به‌روزرسانی وضعیت", exact: true })).toBeFocused();
    }
    await page.screenshot({ path: `/private/tmp/datano-fe-018-private-${width}.png`, fullPage: true });
  }
  for (const width of [390, 1440]) for (const state of ["disconnected", "queued", "receiving", "failed", "empty", "ready"]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/ui-review/websites/receive?ga4=${state}&gsc=${state}&ads=${state}`);
    await expect(page.getByRole("heading", { name: "دریافت داده و آمادگی گزارش", exact: true })).toBeVisible();
    await expect(page.locator(`[data-receipt-state="${state}"]`)).toHaveCount(3);
    for (const dark of [false, true]) {
      await page.evaluate((darkMode) => document.documentElement.classList.toggle("dark", darkMode), dark);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `/private/tmp/datano-fe-018-${state}-${width}-${dark ? "dark" : "light"}.png`, fullPage: true });
    }
  }
  await page.evaluate(() => { document.documentElement.classList.remove("dark"); document.documentElement.style.fontSize = "200%"; });
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/private/tmp/datano-fe-018-private-enlarged.png", fullPage: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/ui-review/websites/receive?ga4=receiving&gsc=disconnected&ads=disconnected");
  await expect(page.locator('[data-receipt-source="ga4"] .lucide-loader-circle')).toHaveCSS("animation-name", "none");
  expect(errors).toEqual([]);
});

test("without JavaScript private sample actions remain inaccessible and public login is usable", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    await page.goto("/ui-review/websites/receive?ga4=ready&gsc=empty&ads=ready");
    await expect(page.getByText("در حال آماده‌سازی محیط بررسی", { exact: true })).toBeVisible();
    await expect(page.locator("[data-data-receipt]")).toBeHidden();
    await expect(page.getByRole("region", { name: "دریافت داده و آمادگی گزارش", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "مشاهده گزارش", exact: true })).toHaveCount(0);
    await page.goto("/websites/arbitrary-id/receive?ga4=ready");
    await expect(page.getByText("برای مشاهده وضعیت دریافت داده سایت، وارد شوید.", { exact: true })).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: "ورود به حساب", exact: true }).click();
    await expect(page).toHaveURL("/login");
  } finally { await context.close(); }
});
