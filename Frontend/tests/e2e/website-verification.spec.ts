import { test, expect } from "@playwright/test";

const sampleTag = '<meta name="datano-verification" content="UI_REVIEW_ONLY_NOT_A_VALID_CHALLENGE">';

test("HTML ownership review shows homepage instructions and copies the exact inert sample", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/ui-review/websites/verify");
  await expect(page.getByRole("heading", { name: "تأیید مالکیت سایت", exact: true })).toBeVisible();
  await expect(page.locator("[data-website-verification]").getByText("example.test", { exact: true })).toBeVisible();
  const code = page.getByRole("textbox", { name: "کد HTML تأیید مالکیت", exact: true });
  await expect(code).toHaveValue(sampleTag);
  await expect(code).toHaveAttribute("readonly", "");
  await expect(page.locator('meta[name="datano-verification"]')).toHaveCount(0);
  await page.getByRole("button", { name: "کپی کد", exact: true }).click();
  await expect(page.locator("[data-clipboard-feedback]")).toHaveText("کد کپی شد.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(sampleTag);
  await page.getByRole("button", { name: "بررسی تأیید", exact: true }).click();
  await expect(page.locator("[data-verification-feedback]")).toContainText("بررسی مالکیت فعلاً در دسترس نیست");
  await expect(page.getByText("سایت با موفقیت تأیید شد", { exact: true })).toHaveCount(0);
});

test("clipboard denial selects the exact code for manual copying without false success", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("Denied")) } }); });
  await page.goto("/ui-review/websites/verify");
  await page.getByRole("button", { name: "کپی کد", exact: true }).click();
  await expect(page.locator("[data-clipboard-feedback]")).toContainText("کپی خودکار انجام نشد");
  const code = page.getByRole("textbox", { name: "کد HTML تأیید مالکیت", exact: true });
  await expect(code).toBeFocused();
  expect(await code.evaluate((element: HTMLTextAreaElement) => element.value.slice(element.selectionStart, element.selectionEnd))).toBe(sampleTag);
  await expect(page.getByText("کد کپی شد.", { exact: true })).toHaveCount(0);
});

test("checking, failed and operational errors remain distinct and retry never grants ownership", async ({ page }) => {
  await page.goto("/ui-review/websites/verify?state=checking");
  await expect(page.locator("[data-verification-feedback]")).toHaveAttribute("role", "status");
  await expect(page.getByRole("button", { name: "در حال بررسی تأیید…", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "کپی کد", exact: true })).toBeDisabled();
  await page.getByLabel("سناریوی تأیید مالکیت", { exact: true }).selectOption("failed");
  await expect(page.locator("[data-verification-feedback]")).toContainText("تأیید سایت انجام نشد");
  await expect(page.locator("[data-verification-feedback]")).toContainText("کد تأیید در سایت شما پیدا نشد.");
  await page.getByRole("button", { name: "تلاش مجدد", exact: true }).click();
  await expect(page.locator("[data-verification-feedback]")).toContainText("بررسی مالکیت فعلاً در دسترس نیست");
  await expect(page.locator("[data-website-verification]")).toHaveAttribute("data-verification-state", "error");
  await expect(page.getByRole("textbox", { name: "کد HTML تأیید مالکیت", exact: true })).toHaveValue(sampleTag);
  await expect(page.getByText("سایت با موفقیت تأیید شد", { exact: true })).toHaveCount(0);
});

test("challenge has a 24-hour review lifetime and expiry disables old proof without fabricating renewal", async ({ page }) => {
  await page.clock.install();
  await page.goto("/ui-review/websites/verify");
  await expect(page.locator("[data-challenge-remaining]")).toHaveText("۲۴:۰۰:۰۰");
  await page.goto("/ui-review/websites/verify?state=expiring");
  await page.clock.fastForward(6000);
  await expect(page.locator("[data-website-verification]")).toHaveAttribute("data-verification-state", "expired");
  await expect(page.locator("[data-challenge-remaining]")).toHaveText("۰۰:۰۰:۰۰");
  await expect(page.getByRole("button", { name: "کپی کد", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "بررسی تأیید", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "درخواست کد تازه", exact: true }).click();
  await expect(page.locator("[data-verification-feedback]")).toContainText("کد منقضی‌شده تمدید یا جایگزین نشده است");
  await expect(page.getByRole("textbox", { name: "کد HTML تأیید مالکیت", exact: true })).toHaveValue(sampleTag);
  await expect(page.locator("[data-challenge-remaining]")).toHaveText("۰۰:۰۰:۰۰");
  await page.goto("/ui-review/websites/verify?state=checking");
  // Wait for the review timer's first tick before advancing a full day after navigation.
  await expect(page.locator("[data-challenge-remaining]")).not.toHaveText("۲۴:۰۰:۰۰");
  await page.clock.fastForward(86401000);
  await expect(page.getByRole("button", { name: "درخواست کد تازه", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "درخواست کد تازه", exact: true }).click();
  await expect(page.locator("[data-verification-feedback]")).toContainText("دریافت کد تازه فعلاً در دسترس نیست");
});

test("late clipboard completion cannot announce copied after challenge expiry", async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => { Object.defineProperty(navigator, "clipboard", { value: { writeText: () => new Promise<void>((resolve) => setTimeout(resolve, 8000)) } }); });
  await page.goto("/ui-review/websites/verify?state=expiring");
  await page.getByRole("button", { name: "کپی کد", exact: true }).click();
  await expect(page.getByRole("button", { name: "در حال کپی…", exact: true })).toBeDisabled();
  await page.clock.fastForward(6000);
  await expect(page.getByRole("button", { name: "درخواست کد تازه", exact: true })).toBeEnabled();
  await page.clock.fastForward(3000);
  await expect(page.locator("[data-website-verification]")).toHaveAttribute("data-verification-state", "expired");
  await expect(page.locator("[data-clipboard-feedback]")).toHaveCount(0);
});

test("success review keeps source connection and report readiness separate and has no side effects", async ({ page, context }) => {
  const requests: string[] = []; const errors: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/ui-review/websites/verify?site=new&state=success");
  await expect(page.getByText("سایت با موفقیت تأیید شد", { exact: true })).toBeVisible();
  await expect(page.locator("[data-verification-feedback]")).toContainText("هنوز منبعی متصل نشده و گزارشی آماده نیست");
  await expect(page.getByRole("textbox", { name: "کد HTML تأیید مالکیت", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "ورود به داشبورد", exact: true }).click();
  await expect(page).toHaveURL("/ui-review/websites/connect?site=new");
  await expect(page.locator("[data-google-source]")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "ادامه برای دریافت داده", exact: true })).toBeDisabled();
  await page.goto("/ui-review/websites/verify?site=new&state=ready");
  await page.getByLabel("سناریوی تأیید مالکیت", { exact: true }).selectOption("ready");
  await page.getByRole("button", { name: "بررسی تأیید", exact: true }).click();
  await page.getByLabel("سناریوی تأیید مالکیت", { exact: true }).selectOption("expired");
  await page.getByRole("button", { name: "درخواست کد تازه", exact: true }).click();
  await page.getByRole("link", { name: "بازگشت به سایت‌های من", exact: true }).click();
  await expect(page.locator("[data-website-row]").first()).toContainText("تأیید نشده");
  expect(requests).toEqual([]); expect(errors).toEqual([]);
  await expect(context.cookies()).resolves.toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
});

test("unverified list and independently registered sample navigate to the matching ownership review", async ({ page }) => {
  await page.goto("/ui-review/websites?account=single");
  await page.getByRole("button", { name: "مشاهده اطلاعات سایت من", exact: true }).click();
  await expect(page).toHaveURL("/ui-review/websites/verify?site=unverified");
  await expect(page.locator("[data-website-verification]").getByText("example.test", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "بازگشت به سایت‌های من", exact: true }).click();
  await expect(page).toHaveURL("/ui-review/websites");
  await page.goto("/ui-review/websites/new?state=registered");
  await page.getByRole("link", { name: "تأیید مالکیت سایت", exact: true }).click();
  await expect(page).toHaveURL("/ui-review/websites/verify?site=new");
  await expect(page.locator("[data-website-verification]").getByText("new.example.test", { exact: true })).toBeVisible();
  await page.getByLabel("سایت نمونه", { exact: true }).selectOption("unverified");
  await expect(page.locator("[data-website-verification]").getByText("example.test", { exact: true })).toBeVisible();
});

test("public route and query flags never expose a challenge, sample success or invented site", async ({ page }) => {
  for (const route of ["/websites/unverified/verify?state=success&site=new", "/websites/arbitrary-id/verify?token=UI_REVIEW_ONLY_NOT_A_VALID_CHALLENGE&role=admin"]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle("تأیید مالکیت سایت | دیتانو");
    await expect(page.getByText("برای تأیید مالکیت سایت، وارد شوید.", { exact: true })).toBeVisible();
    await expect(page.locator("textarea, [data-website-verification], meta[name='datano-verification']")).toHaveCount(0);
    await expect(page.locator('a[href^="/ui-review"]')).toHaveCount(0);
    await page.getByRole("main").getByRole("link", { name: "ورود به حساب", exact: true }).click();
    await expect(page).toHaveURL("/login");
  }
  await page.goto("/ui-review/websites/verify?site=arbitrary&state=success&state=expired");
  await expect(page.locator("[data-website-verification]")).toHaveAttribute("data-verification-state", "ready");
  await expect(page.locator("[data-website-verification]").getByText("example.test", { exact: true })).toBeVisible();
});

test("verification uses Persian RTL and remains readable across viewports, themes and enlarged text", async ({ page }, testInfo) => {
  for (const state of ["ready", "checking", "failed", "expired", "error", "success"]) {
    await page.goto(`/ui-review/websites/verify?state=${state}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "fa");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("main")).toHaveCount(1); await expect(page.getByRole("banner")).toHaveCount(1); await expect(page.getByRole("contentinfo")).toHaveCount(1);
    const root = page.locator("[data-website-verification]");
    expect(await root.evaluate((element) => getComputedStyle(element).fontFamily)).toContain("Vazirmatn");
    if (state !== "success") await expect(root.locator("textarea")).toHaveCSS("direction", "ltr");
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const dark of [false, true]) {
        await page.evaluate((enabled) => document.documentElement.classList.toggle("dark", enabled), dark);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const clipped = await root.locator("h1, h2, p, li, a, button, label, dt, dd").evaluateAll((elements) => elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.textContent));
        expect(clipped).toEqual([]);
        if (testInfo.project.name === "desktop" && [390, 1440].includes(width) && ["ready", "expired", "success"].includes(state)) await page.screenshot({ path: testInfo.outputPath(`verify-${state}-${width}-${dark ? "dark" : "light"}.png`), fullPage: true, animations: "disabled" });
      }
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.evaluate(() => { document.documentElement.classList.remove("dark"); document.documentElement.style.fontSize = "200%"; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  }
});

test("without JavaScript private proof is absent and public login still works", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage(); await page.goto("/ui-review/websites/verify?state=success");
    await expect(page.getByRole("region", { name: "تأیید مالکیت سایت", exact: true })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "کد HTML تأیید مالکیت", exact: true })).toHaveCount(0);
    await page.goto("/websites/arbitrary/verify");
    await page.getByRole("main").getByRole("link", { name: "ورود به حساب", exact: true }).click();
    await expect(page).toHaveURL("/login");
  } finally { await context.close(); }
});
