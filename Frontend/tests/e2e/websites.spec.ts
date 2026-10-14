import { test, expect } from "@playwright/test";

const firstDomain = "example.test";
const readyDomain = "marketing-performance-team.reports.example.test";

test("public website list requires trusted account data and ignores preview or role query flags", async ({ page, context }) => {
  const requests: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  const response = await page.goto("/websites?account=multiple&state=ready&role=admin&site=report-ready");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("سایت‌های من | دیتانو");
  await expect(page.getByText("برای مشاهده سایت‌های خود، وارد شوید.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-website-row]")).toHaveCount(0);
  await expect(page.getByText(firstDomain, { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-layout="account"]')).toHaveCount(1);
  await expect(context.cookies()).resolves.toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
  expect(requests).toEqual([]);
  await page.getByRole("main").getByRole("link", { name: "ورود به حساب", exact: true }).click();
  await expect(page).toHaveURL("/login");
});

test("empty account offers adding a website without creating a site or visiting a missing next-stage page", async ({ page }) => {
  await page.goto("/ui-review/websites?account=empty");
  await expect(page.getByText("هنوز سایتی ثبت نکرده‌اید.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-website-row]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "مشاهده اطلاعات سایت من", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "افزودن سایت", exact: true }).click();
  await expect(page.locator("[data-website-destination]")).toHaveAttribute("data-website-destination", "add");
  await expect(page.getByText("مقصد نمونه: افزودن سایت.", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/ui-review\/websites/);
  await expect(page.locator("[data-website-row]")).toHaveCount(0);
});

test("single site is selected automatically and ownership takes precedence over report routing", async ({ page }) => {
  await page.goto("/ui-review/websites?account=single");
  await expect(page.locator("[data-website-row]")).toHaveCount(1);
  await expect(page.getByRole("button", { name: `انتخاب ${firstDomain}`, exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-selected-website]")).toContainText(firstDomain);
  await expect(page.locator("[data-website-row]")).toContainText("تأیید نشده");
  await expect(page.locator("[data-website-row]")).toContainText("در انتظار تأیید مالکیت");
  await page.getByRole("button", { name: "مشاهده اطلاعات سایت من", exact: true }).click();
  await expect(page.locator("[data-website-destination]")).toHaveAttribute("data-website-destination", "verify");
  await expect(page.locator("[data-website-destination]")).toContainText(firstDomain);
});

test("multiple sites require explicit selection and retain independent ownership and report states", async ({ page }) => {
  await page.goto("/ui-review/websites?account=multiple");
  await expect(page.locator("[data-website-row]")).toHaveCount(6);
  const view = page.getByRole("button", { name: "مشاهده اطلاعات سایت من", exact: true });
  await expect(view).toBeDisabled();
  const cases = [
    [firstDomain, "verify", "تأیید نشده", "در انتظار تأیید مالکیت"],
    ["www.example.test", "connect", "تأیید شده", "بدون اتصال منابع"],
    ["shop.example.test", "receive", "تأیید شده", "در انتظار دریافت داده"],
    ["blog.example.test", "receive", "تأیید شده", "دریافت داده ناموفق"],
    [readyDomain, "dashboard", "تأیید شده", "گزارش آماده"],
    ["empty.example.test", "dashboard", "تأیید شده", "گزارش آماده، بدون داده"],
  ];
  for (const [domain, destination, ownership, report] of cases) {
    const row = page.locator("[data-website-row]").filter({ has: page.getByRole("heading", { name: domain, exact: true }) });
    await expect(row).toContainText(ownership);
    await expect(row).toContainText(report);
    await row.getByRole("button", { name: `انتخاب ${domain}`, exact: true }).click();
    await expect(page.locator("[data-website-destination]")).toHaveCount(0);
    await expect(page.locator('[aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator("[data-selected-website]")).toContainText(domain);
    await view.click();
    await expect(page.locator("[data-website-destination]")).toHaveAttribute("data-website-destination", destination);
    await expect(page.locator("[data-website-destination]")).toContainText(domain);
    await expect(page.locator("[data-website-destination] bdi")).toHaveCSS("direction", "ltr");
  }
});

test("delete confirmation names the target, explains consequences and restores focus on cancellation", async ({ page }) => {
  await page.goto("/ui-review/websites?account=multiple");
  await page.getByRole("button", { name: `انتخاب ${readyDomain}`, exact: true }).click();
  const trigger = page.getByRole("button", { name: "حذف www.example.test", exact: true });
  await trigger.focus(); await page.keyboard.press("Enter");
  const confirmation = page.getByRole("group", { name: "این سایت حذف شود؟", exact: true });
  await expect(confirmation).toContainText("www.example.test");
  for (const text of ["اتصال منابع این سایت قطع و کارهای دریافت داده لغو می‌شوند.", "داده‌ها و گزارش‌های وابسته از دسترس خارج می‌شوند.", "ثبت دوباره سایت به تأیید مالکیت تازه نیاز دارد؛ تاریخچه مالک قبلی منتقل نمی‌شود."]) await expect(confirmation).toContainText(text);
  await expect(confirmation.getByRole("button", { name: "تأیید حذف", exact: true })).toBeFocused();
  await confirmation.getByRole("button", { name: "انصراف", exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.locator("[data-selected-website]")).toContainText(readyDomain);
  await expect(page.locator("[data-website-row]")).toHaveCount(6);
});

test("confirming deletion reports unavailability and preserves the site and selection without requests or storage effects", async ({ page, context }) => {
  const requests: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  await page.goto("/ui-review/websites?account=single");
  await page.getByRole("button", { name: `حذف ${firstDomain}`, exact: true }).click();
  await page.getByRole("button", { name: "تأیید حذف", exact: true }).click();
  await expect(page.getByText("حذف سایت در حال حاضر در دسترس نیست.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-website-row]")).toHaveCount(1);
  await expect(page.locator("[data-selected-website]")).toContainText(firstDomain);
  await expect(page).toHaveURL(/\/ui-review\/websites/);
  await expect(context.cookies()).resolves.toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
  expect(requests).toEqual([]);
});

test("deterministic loading, failure and deletion scenarios reset safely without becoming an empty account", async ({ page }) => {
  await page.goto("/ui-review/websites?account=multiple&state=loading");
  await expect(page.getByRole("status").filter({ hasText: "در حال دریافت سایت‌ها" })).toBeVisible();
  await expect(page.locator("[data-website-row]")).toHaveCount(0);
  await expect(page.getByText("هنوز سایتی ثبت نکرده‌اید.", { exact: true })).toHaveCount(0);
  await page.getByLabel("سناریوی فهرست").selectOption("error");
  await expect(page.getByText("فهرست سایت‌ها در دسترس نیست.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "افزودن سایت", exact: true })).toBeDisabled();
  await page.getByLabel("سناریوی فهرست").selectOption("delete-pending");
  await expect(page.getByRole("button", { name: "در حال حذف…", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "انصراف", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: `انتخاب ${readyDomain}`, exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("button", { name: "در حال حذف…", exact: true })).toBeDisabled();
  await page.getByLabel("سناریوی فهرست").selectOption("delete-error");
  await expect(page.getByText("حذف سایت در حال حاضر در دسترس نیست.", { exact: true })).toBeVisible();
  await page.getByLabel("نوع حساب نمونه").selectOption("empty");
  await expect(page.getByText("هنوز سایتی ثبت نکرده‌اید.", { exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "این سایت حذف شود؟", exact: true })).toHaveCount(0);
  await page.goto("/ui-review/websites?account=invalid&account=empty&state=unknown&state=loading&site=report-ready&role=admin");
  await expect(page.getByLabel("نوع حساب نمونه")).toHaveValue("multiple");
  await expect(page.getByLabel("سناریوی فهرست")).toHaveValue("ready");
  await expect(page.getByRole("button", { name: "مشاهده اطلاعات سایت من", exact: true })).toBeDisabled();
});

test("both private profile stages navigate to website review and return without page errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const route of ["/ui-review/profile", "/ui-review/profile?emailStep=code&state=ready"]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("پروفایل");
    if (route.includes("emailStep=code")) {
      await expect(page.getByLabel("کد تأیید ایمیل", { exact: true })).toBeVisible();
      await expect(page.getByLabel("کد تأیید ایمیل", { exact: true })).toHaveValue("05371428");
      await expect(page.getByRole("button", { name: "تأیید ایمیل جدید", exact: true })).toBeEnabled();
    }
    const sites = page.getByRole("link", { name: "سایت‌های من", exact: true });
    await expect(sites).toHaveAttribute("href", "/ui-review/websites");
    await sites.focus(); await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/ui-review/websites");
    await expect(page.locator("[data-website-row]")).toHaveCount(6);
    const back = page.getByRole("link", { name: "بازگشت به پروفایل", exact: true });
    await expect(back).toHaveAttribute("href", "/ui-review/profile");
    await back.focus(); await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/ui-review/profile");
    await expect(page.getByRole("link", { name: "سایت‌های من", exact: true })).toBeVisible();
  }
  await page.goto("/ui-review");
  await page.getByRole("link", { name: "بررسی سایت‌ها", exact: true }).click();
  await expect(page).toHaveURL("/ui-review/websites");
  await page.getByRole("link", { name: "بازگشت به پروفایل", exact: true }).click();
  await expect(page).toHaveURL("/ui-review/profile");
  expect(errors).toEqual([]);
});

test("public profile retains guest access and cannot expose website navigation or a query-supplied account", async ({ page }) => {
  const response = await page.goto("/profile?state=ready&role=admin&sitesHref=/ui-review/websites");
  expect(response?.status()).toBe(200);
  await expect(page.getByText("برای مشاهده و ویرایش اطلاعات حساب، وارد شوید.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "سایت‌های من", exact: true })).toHaveCount(0);
  await expect(page.getByRole("main").locator('a[href^="/ui-review"]')).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByText("profile-review@example.test", { exact: true })).toHaveCount(0);
  await expect(page.locator("[data-website-row]")).toHaveCount(0);
  await page.getByRole("main").getByRole("link", { name: "ورود به حساب", exact: true }).click();
  await expect(page).toHaveURL("/login");
});

test("My Websites remains available for all private site-count fixtures and fits both profile compositions", async ({ page }, testInfo) => {
  for (const account of ["empty", "single", "multiple"]) {
    await page.goto(`/ui-review/websites?account=${account}`);
    await expect(page.locator("[data-website-row]")).toHaveCount(account === "empty" ? 0 : account === "single" ? 1 : 6);
    await page.getByRole("link", { name: "بازگشت به پروفایل", exact: true }).click();
    const sites = page.getByRole("link", { name: "سایت‌های من", exact: true });
    await expect(sites).toBeVisible();
    await expect(sites).toHaveAttribute("href", "/ui-review/websites");
  }
  for (const route of ["/ui-review/profile", "/ui-review/profile?emailStep=code&state=ready"]) {
    await page.goto(route);
    const sites = page.getByRole("main").getByRole("link", { name: "سایت‌های من", exact: true });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const dark of [false, true]) {
        await page.evaluate((enabled) => document.documentElement.classList.toggle("dark", enabled), dark);
        await expect(sites).toBeVisible();
        await expect(sites.locator("svg")).toHaveAttribute("aria-hidden", "true");
        expect(await sites.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (testInfo.project.name === "desktop" && [390, 1440].includes(width)) await page.screenshot({ path: testInfo.outputPath(`profile-sites-${route.includes("emailStep=code") ? "code" : "review"}-${width}-${dark ? "dark" : "light"}.png`), fullPage: true, animations: "disabled" });
      }
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.evaluate(() => { document.documentElement.classList.remove("dark"); document.documentElement.style.fontSize = "200%"; });
    expect(await sites.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  }
});

test("website list and confirmation preserve Persian typography, direction and readable layouts", async ({ page }, testInfo) => {
  await page.goto("/ui-review/websites?account=multiple&state=delete-confirm");
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("contentinfo")).toHaveCount(1);
  await expect(page.locator('[data-layout="account"]')).toHaveCount(1);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const dark of [false, true]) {
      await page.evaluate((enabled) => document.documentElement.classList.toggle("dark", enabled), dark);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator("[data-website-row]").first().locator("h2 bdi")).toHaveCSS("direction", "ltr");
      if (testInfo.project.name === "desktop") await page.screenshot({ path: testInfo.outputPath(`websites-${width}-${dark ? "dark" : "light"}.png`), fullPage: true, animations: "disabled" });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.classList.remove("dark"); document.documentElement.style.fontSize = "200%"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const clipped = await page.locator("[data-website-list]").locator("h1, h2, h3, p, button, li, dd").evaluateAll((elements) => elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.textContent));
  expect(clipped).toEqual([]);
  if (testInfo.project.name === "desktop") await page.screenshot({ path: testInfo.outputPath("websites-enlarged-text.png"), fullPage: true, animations: "disabled" });
});

test("without JavaScript the private review exposes no actions and public website access still links to login", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto("/ui-review/websites");
    await expect(page.getByRole("status").filter({ hasText: "در حال آماده‌سازی محیط بررسی" })).toBeVisible();
    await expect(page.getByRole("button", { name: "تأیید حذف", exact: true })).toHaveCount(0);
    await page.goto("/profile");
    await expect(page.getByRole("link", { name: "سایت‌های من", exact: true })).toHaveCount(0);
    await page.getByRole("main").getByRole("link", { name: "ورود به حساب", exact: true }).click();
    await expect(page).toHaveURL("/login");
    await page.goto("/websites");
    await page.getByRole("main").getByRole("link", { name: "ورود به حساب", exact: true }).click();
    await expect(page).toHaveURL("/login");
  } finally { await context.close(); }
});
