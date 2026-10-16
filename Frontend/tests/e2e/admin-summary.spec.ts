import { test, expect } from "@playwright/test";

const review = "/ui-review/admin/users";
const metric = (id: string) => `[data-admin-metric="${id}"]`;
const value = (id: string) => `${metric(id)} [data-admin-count]`;

test("summary counts use account and valid-integration definitions in the existing account shell", async ({ page }) => {
  await page.goto(review);
  await expect(page.getByRole("heading", { name: "پنل مدیریت", exact: true })).toBeVisible();
  await expect(page.locator("[data-admin-metric]")).toHaveCount(3);
  await expect(page.locator(value("totalUsers"))).toHaveText("۱۲۸");
  await expect(page.locator(value("activeUsers"))).toHaveText("۱۰۳");
  await expect(page.locator(value("connections"))).toHaveText("۷۴");
  await expect(page.locator(metric("totalUsers"))).toContainText("همهٔ حساب‌های ثبت‌شده، شامل حساب‌های فعال و غیرفعال.");
  await expect(page.locator(metric("activeUsers"))).toContainText("حساب‌هایی که وضعیت حساب آن‌ها فعال است؛ مستقل از آخرین ورود یا ترافیک سایت.");
  await expect(page.locator(metric("connections"))).toContainText("اتصال‌های فعال با مجوز معتبر، بدون شمارش دوبارهٔ پراپرتی.");
  await expect(page.locator(metric("connections"))).toContainText("خطای دریافت داده به‌تنهایی به معنی قطع اتصال نیست.");
  await expect(page.locator('[data-layout="account"]')).toHaveCount(1);
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("contentinfo")).toHaveCount(1);
  await expect(page.locator("[data-admin-summary]").getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /ویرایش|مسدود|حذف|قاعده/ })).toHaveCount(0);
  await expect(page.getByRole("note")).toContainText("نقش نمونه، نشست یا مجوز واقعی ایجاد نمی‌کند");
});

test("explicit zero counts differ from unavailable and failed counts", async ({ page }) => {
  await page.goto(`${review}?scenario=zero`);
  for (const id of ["totalUsers", "activeUsers", "connections"]) await expect(page.locator(value(id))).toHaveText("۰");
  await expect(page.locator(metric("totalUsers"))).toContainText("حسابی ثبت نشده است.");
  await page.goto(`${review}?scenario=no-connections`);
  await expect(page.locator(value("totalUsers"))).toHaveText("۱۲");
  await expect(page.locator(value("activeUsers"))).toHaveText("۹");
  await expect(page.locator(value("connections"))).toHaveText("۰");
  await expect(page.locator(metric("connections"))).toContainText("اتصال فعالی با مجوز معتبر وجود ندارد.");
  for (const [scenario, text] of [
    ["loading", "در حال دریافت آمار"], ["error", "دریافت این آمار ناموفق بود."], ["unavailable", "این آمار در دسترس نیست."],
  ]) {
    await page.goto(`${review}?scenario=${scenario}`);
    for (const id of ["totalUsers", "activeUsers", "connections"]) {
      await expect(page.locator(value(id))).toHaveText("—");
      await expect(page.locator(metric(id))).toContainText(text);
    }
    await expect(page.getByRole("main").getByRole("button")).toHaveCount(0);
  }
});

test("an independent count failure preserves the other available summaries", async ({ page }) => {
  await page.goto(`${review}?scenario=partial`);
  await expect(page.locator(value("totalUsers"))).toHaveText("۱۲۸");
  await expect(page.locator(value("activeUsers"))).toHaveText("۱۰۳");
  await expect(page.locator(value("connections"))).toHaveText("—");
  await expect(page.locator(metric("connections")).getByRole("alert")).toHaveText("دریافت این آمار ناموفق بود.");
});

test("invalid aggregate counts remain unknown rather than appearing as plausible numbers", async ({ page }) => {
  await page.goto(`${review}?scenario=invalid`);
  for (const id of ["totalUsers", "activeUsers", "connections"]) {
    await expect(page.locator(value(id))).toHaveText("—");
    await expect(page.locator(metric(id))).toContainText("این آمار در دسترس نیست.");
  }
});

test("private personas deny guest and ordinary user displays and never create authority", async ({ page, context }) => {
  const requests: string[] = [];
  page.on("request", request => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  await page.goto(review);
  await page.locator("[data-review-tools] > summary").click();
  const persona = page.getByLabel("نقش نمونه", { exact: true });
  await expect(persona).toBeEnabled();
  await persona.focus();
  await expect(persona).toBeFocused();
  for (const [role, text] of [["user", "به پنل مدیریت دسترسی ندارید."], ["guest", "برای مشاهدهٔ پنل مدیریت، وارد شوید."]]) {
    await persona.selectOption(role);
    await expect(page.getByText(text, { exact: true })).toBeVisible();
    await expect(page.locator("[data-admin-metric]")).toHaveCount(0);
  }
  await persona.selectOption("admin");
  await expect(page.locator(value("totalUsers"))).toHaveText("۱۲۸");
  expect(requests).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
});

test("review selectors are deterministic and untrusted query values cannot supply counts or roles", async ({ page }) => {
  await page.goto(`${review}?scenario=no-connections`);
  await page.reload();
  await expect(page.locator(value("totalUsers"))).toHaveText("۱۲");
  await expect(page.locator(value("connections"))).toHaveText("۰");
  for (const query of ["persona=unknown", "persona=admin&persona=user"]) {
    await page.goto(`${review}?${query}&role=admin&totalUsers=999999`);
    await expect(page.locator("[data-admin-metric]")).toHaveCount(0);
    await expect(page.getByText("برای مشاهدهٔ پنل مدیریت، وارد شوید.", { exact: true })).toBeVisible();
  }
  await page.goto(`${review}?persona=admin&scenario=zero&scenario=error&totalUsers=999999&connections=999999`);
  await expect(page.locator(value("totalUsers"))).toHaveText("۱۲۸");
  await expect(page.locator(value("connections"))).toHaveText("۷۴");
});

test("product admin route ignores sample authority and has a working login action", async ({ page, context }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on("request", request => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/admin/users?persona=admin&role=admin&scenario=ready&totalUsers=999999");
  await expect(page).toHaveTitle("پنل مدیریت | دیتانو");
  await expect(page.getByText("برای مشاهدهٔ پنل مدیریت، وارد شوید.", { exact: true })).toBeVisible();
  await expect(page.locator('[data-admin-metric], [data-review-tools], select, a[href^="/ui-review"]')).toHaveCount(0);
  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
  expect(requests).toEqual([]); expect(errors).toEqual([]);
  await page.getByRole("main").getByRole("link", { name: "ورود به حساب", exact: true }).click();
  await expect(page).toHaveURL("/login");
});

test("summary cards fit Persian RTL mobile tablet desktop dark and enlarged text", async ({ page }) => {
  await page.goto(review);
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("body")).toHaveCSS("font-family", /Vazirmatn/);
  for (const width of [320, 390, 768, 1440]) for (const dark of [false, true]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(value => document.documentElement.classList.toggle("dark", value), dark);
    await expect(page.locator("[data-admin-metric]")).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const id of ["totalUsers", "activeUsers", "connections"]) {
      expect(await page.locator(metric(id)).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
    if (width === 390 || width === 1440) await page.screenshot({ path: `/private/tmp/datano-fe026-${width}-${dark ? "dark" : "light"}.png`, fullPage: true });
  }
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.locator("[data-admin-summary]").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    if (width !== 320) expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("product access works without JavaScript and private fixtures stay behind Suspense", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(review);
    await expect(page.getByText("در حال آماده‌سازی محیط بررسی", { exact: true })).toBeVisible();
    await expect(page.locator("[data-admin-metric]:visible")).toHaveCount(0);
    await page.goto("/admin/users?role=admin");
    await expect(page.locator("[data-admin-metric]")).toHaveCount(0);
    await page.getByRole("main").getByRole("link", { name: "ورود به حساب", exact: true }).click();
    await expect(page).toHaveURL("/login");
  } finally { await context.close(); }
});
