import { test, expect } from "@playwright/test";

test("public profile is an honest access state without sample identity or query-controlled authentication", async ({ page, context }) => {
  const requests: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  const response = await page.goto("/profile?state=ready&role=admin&emailStep=code");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("پروفایل | دیتانو");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("پروفایل");
  await expect(page.getByText("برای مشاهده و ویرایش اطلاعات حساب، وارد شوید.", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByText("profile-review@example.test", { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-layout="account"]')).toHaveCount(1);
  await expect(context.cookies()).resolves.toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
  expect(requests).toEqual([]);
  await page.getByRole("main").getByRole("link", { name: "ورود به حساب", exact: true }).click();
  await expect(page).toHaveURL("/login");
});

test("private profile edits names with linked validation and scoped reset without mutating account data", async ({ page }) => {
  await page.goto("/ui-review/profile");
  await expect(page.locator("[data-profile-account-name]")).toHaveText("آزین نمونه");
  await expect(page.locator("[data-profile-current-email]")).toHaveText("profile-review@example.test");
  await expect(page.getByRole("combobox")).toHaveCount(2);
  await expect(page.locator('input[name="role"], input[name="username"], input[name="is_active"], [role="checkbox"]')).toHaveCount(0);
  const first = page.getByLabel("نام", { exact: true });
  const last = page.getByLabel("نام خانوادگی", { exact: true });
  const save = page.getByRole("button", { name: "ذخیره تغییرات", exact: true });
  await expect(save).toBeDisabled();
  await first.fill("   "); await last.fill("");
  await save.click();
  await expect(first).toBeFocused();
  const error = page.getByText("نام خود را وارد کنید.", { exact: true });
  await expect(error).toBeVisible();
  await expect(first).toHaveAttribute("aria-invalid", "true");
  expect((await first.getAttribute("aria-describedby"))?.split(" ")).toContain(await error.getAttribute("id"));
  await first.fill("نام تازه"); await last.fill("خانوادگی تازه");
  await page.getByLabel("ایمیل جدید", { exact: true }).fill("preserved@example.test");
  await save.click();
  await expect(page.getByText("ذخیره اطلاعات در حال حاضر در دسترس نیست.", { exact: true })).toBeVisible();
  await expect(first).toHaveValue("نام تازه");
  await expect(last).toHaveValue("خانوادگی تازه");
  await expect(page.locator("[data-profile-account-name]")).toHaveText("آزین نمونه");
  await page.getByRole("button", { name: "بازنشانی نام‌ها", exact: true }).click();
  await expect(first).toHaveValue("آزین"); await expect(last).toHaveValue("نمونه");
  await expect(page.getByLabel("ایمیل جدید", { exact: true })).toHaveValue("preserved@example.test");
  await expect(save).toBeDisabled();
});

test("email change validates the new address, retains fields across steps and never replaces current email", async ({ page, context }) => {
  const requests: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  await page.goto("/ui-review/profile");
  const email = page.getByLabel("ایمیل جدید", { exact: true });
  const next = page.getByRole("button", { name: "ادامه برای تأیید", exact: true });
  for (const [value, error] of [["", "ایمیل جدید خود را وارد کنید."], ["invalid", "یک ایمیل معتبر وارد کنید."], ["PROFILE-REVIEW@EXAMPLE.TEST", "ایمیل جدید باید با ایمیل فعلی متفاوت باشد."]]) {
    await email.fill(value); await next.click();
    await expect(email).toBeFocused();
    await expect(page.getByText(error, { exact: true })).toBeVisible();
  }
  await page.getByLabel("نام", { exact: true }).fill("ورودی حفظ‌شده");
  await email.fill("profile-review+tag@example.test");
  await next.click();
  const code = page.getByRole("textbox", { name: "کد تأیید ایمیل", exact: true });
  await expect(code).toBeFocused();
  await expect(code).toHaveValue("");
  await code.fill("۰۱۲۳۴۵۶۷");
  await expect(code).toHaveValue("01234567");
  await page.getByRole("button", { name: "تأیید ایمیل جدید", exact: true }).click();
  await expect(page.getByText("تغییر ایمیل در حال حاضر در دسترس نیست.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-profile-current-email]")).toHaveText("profile-review@example.test");
  await page.getByRole("button", { name: "ویرایش ایمیل جدید", exact: true }).click();
  await expect(email).toBeFocused();
  await expect(email).toHaveValue("profile-review+tag@example.test");
  await expect(page.getByLabel("نام", { exact: true })).toHaveValue("ورودی حفظ‌شده");
  await next.click();
  await expect(code).toHaveValue("01234567");
  await expect(context.cookies()).resolves.toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
  expect(requests).toEqual([]);
});

test("independent email-code review preserves leading zeros and reports exact-length and invalid-code errors", async ({ page }) => {
  await page.goto("/ui-review/profile?emailStep=code");
  const code = page.getByRole("textbox", { name: "کد تأیید ایمیل", exact: true });
  await expect(code).toHaveValue("05371428");
  const verify = page.getByRole("button", { name: "تأیید ایمیل جدید", exact: true });
  for (const value of ["1234567", "123456789", "12x45678"]) {
    await code.fill(value); await verify.click();
    await expect(code).toHaveValue(value);
    const error = page.getByText("کد باید دقیقاً ۸ رقم باشد.", { exact: true });
    await expect(error).toBeVisible();
    expect((await code.getAttribute("aria-describedby"))?.split(" ")).toContain(await error.getAttribute("id"));
  }
  await code.fill("٠١٢٣٤٥٦٧");
  await expect(code).toHaveValue("01234567");
  await expect(code).toHaveCSS("direction", "ltr");
  await verify.click();
  await expect(page.getByText("تغییر ایمیل در حال حاضر در دسترس نیست.", { exact: true })).toBeVisible();
  await page.getByLabel("سناریوی آغازین").selectOption("code-error");
  await expect(page).toHaveURL(/state=code-error/);
  await expect(page.getByText("کد واردشده درست نیست.", { exact: true })).toBeVisible();
  for (let attempt = 0; attempt < 5; attempt++) await verify.click();
  await expect(verify).toBeDisabled();
  await expect(page.getByText("تعداد تلاش‌ها به پایان رسیده است. کد تازه درخواست کنید.", { exact: true })).toBeVisible();
});

test("private email clock covers cooldown, expiry and resend without sending email or losing name edits", async ({ page }) => {
  await page.clock.install();
  await page.goto("/ui-review/profile?emailStep=code");
  const code = page.getByRole("textbox", { name: "کد تأیید ایمیل", exact: true });
  const resend = page.getByRole("button", { name: "ارسال مجدد کد", exact: true });
  await expect(code).toBeEnabled();
  await expect(resend).toBeDisabled();
  await page.getByLabel("نام", { exact: true }).fill("نام حفظ‌شده");
  await page.clock.fastForward(61_000);
  await expect(resend).toBeEnabled();
  await resend.click();
  await expect(code).toHaveValue("");
  await expect(resend).toBeDisabled();
  await expect(page.getByText("زمان‌سنج نمونه بازنشانی شد؛ ایمیلی ارسال نشده است.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("نام", { exact: true })).toHaveValue("نام حفظ‌شده");
  await page.clock.fastForward(601_000);
  await expect(page.getByText("مهلت کد به پایان رسیده است. کد تازه درخواست کنید.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "تأیید ایمیل جدید", exact: true })).toBeDisabled();
  await expect(resend).toBeEnabled();
  await resend.click();
  await expect(code).toBeEnabled();
  await expect(page.locator("[data-profile-current-email]")).toHaveText("profile-review@example.test");
});

test("logout confirmation is keyboard-accessible and cancellation and unavailable logout preserve account and edits", async ({ page, context }) => {
  const requests: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  await page.goto("/ui-review/profile");
  await page.getByLabel("نام", { exact: true }).fill("نام ویرایش‌شده");
  await page.getByRole("button", { name: "خروج از حساب", exact: true }).press("Enter");
  const confirm = page.getByRole("button", { name: "تأیید خروج", exact: true });
  await expect(confirm).toBeFocused();
  await page.getByRole("button", { name: "انصراف", exact: true }).press("Space");
  await expect(page.getByRole("button", { name: "خروج از حساب", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "خروج از حساب", exact: true }).click();
  await confirm.click();
  await expect(page.getByText("خروج از حساب در حال حاضر در دسترس نیست.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("نام", { exact: true })).toHaveValue("نام ویرایش‌شده");
  await expect(page.locator("[data-profile-current-email]")).toHaveText("profile-review@example.test");
  await expect(page).toHaveURL("/ui-review/profile");
  await expect(context.cookies()).resolves.toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
  expect(requests).toEqual([]);
});

test("private loading, pending and error fixtures are deterministic and reachable without backend or role selection", async ({ page }) => {
  await page.goto("/ui-review/profile");
  for (const [state, text] of [["loading", "در حال دریافت اطلاعات حساب"], ["error", "اطلاعات حساب در دسترس نیست."], ["names-error", "ذخیره اطلاعات در حال حاضر در دسترس نیست."], ["email-error", "تغییر ایمیل در حال حاضر در دسترس نیست."], ["logout-error", "خروج از حساب در حال حاضر در دسترس نیست."]]) {
    await page.getByLabel("سناریوی آغازین").selectOption(state);
    await expect(page).toHaveURL(new RegExp(`state=${state}`));
    await expect(page.getByText(text, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
  for (const [state, text] of [["names-pending", "در حال ذخیره…"], ["email-pending", "در حال بررسی…"], ["logout-pending", "در حال خروج…"]]) {
    await page.getByLabel("سناریوی آغازین").selectOption(state);
    await expect(page).toHaveURL(new RegExp(`state=${state}`));
    await expect(page.getByRole("status").filter({ hasText: text })).toBeVisible();
    await expect(page.getByLabel("نام", { exact: true })).toBeDisabled();
  }
  await page.goto("/ui-review/profile?state=unknown&state=names-pending&emailStep=invalid&role=admin");
  await expect(page.getByLabel("نام", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("ایمیل جدید", { exact: true })).toBeVisible();
  await expect(page.locator('[data-profile-current-email]')).toHaveText("profile-review@example.test");
  await expect(page.getByRole("combobox")).toHaveCount(2);
});

test("profile follows the Persian shared shell and gradient across viewports, themes and enlarged text", async ({ page }, testInfo) => {
  await page.goto("/ui-review/profile?emailStep=code");
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator('[data-layout="account"]')).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const dark of [false, true]) {
      await page.evaluate((enabled) => document.documentElement.classList.toggle("dark", enabled), dark);
      await expect(page.getByRole("main")).toHaveCSS("background-image", /linear-gradient/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator("[data-profile-current-email] bdi")).toHaveCSS("direction", "ltr");
      if (testInfo.project.name === "desktop") await page.screenshot({ path: testInfo.outputPath(`profile-${width}-${dark ? "dark" : "light"}.png`), fullPage: true, animations: "disabled" });
    }
  }
  await page.setViewportSize({ width: 390, height: 420 });
  await page.getByRole("button", { name: "تأیید ایمیل جدید", exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "تأیید ایمیل جدید", exact: true })).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.classList.remove("dark"); document.documentElement.style.fontSize = "200%"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const clipped = await page.locator(".page-surface-profile").locator("h1, h2, h3, p, label, button, dd").evaluateAll((elements) => elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.textContent));
  expect(clipped).toEqual([]);
  if (testInfo.project.name === "desktop") await page.screenshot({ path: testInfo.outputPath("profile-enlarged-text.png"), fullPage: true, animations: "disabled" });
});

test("catalogue links to profile review and no-JS cannot submit private edits while public login remains usable", async ({ page, browser, baseURL }) => {
  await page.goto("/ui-review");
  await page.getByRole("link", { name: "بررسی پروفایل", exact: true }).click();
  await expect(page).toHaveURL("/ui-review/profile");
  await expect(page.getByLabel("نام", { exact: true })).toHaveValue("آزین");
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: { width: 390, height: 844 } });
  try {
    const staticPage = await context.newPage();
    await staticPage.goto("/ui-review/profile");
    await expect(staticPage.getByRole("status").filter({ hasText: "در حال آماده‌سازی محیط بررسی" })).toBeVisible();
    await expect(staticPage.getByRole("textbox")).toHaveCount(0);
    await expect(staticPage.getByRole("button", { name: "ادامه برای تأیید", exact: true })).toHaveCount(0);
    await expect(staticPage.getByRole("button", { name: "خروج از حساب", exact: true })).toHaveCount(0);
    await staticPage.goto("/profile");
    await staticPage.getByRole("main").getByRole("link", { name: "ورود به حساب", exact: true }).click();
    await expect(staticPage).toHaveURL("/login");
  } finally { await context.close(); }
});
