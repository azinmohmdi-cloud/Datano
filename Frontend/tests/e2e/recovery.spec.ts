import { test, expect, type Page } from "@playwright/test";

async function geometry(page: Page) {
  const measure = (selector: string) => page.locator(selector).evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height };
  });
  return { card: await measure("[data-auth-frame]"), action: await measure("[data-recovery-primary]") };
}

test("public recovery validates email and never announces delivery or advances without an API", async ({ page, context }) => {
  const requests: string[] = [];
  await page.route("**/api/auth/csrf", route => route.fulfill({ status: 503, json: { success: false, message: "Unavailable", payload: null } }));
  await page.route("**/api/auth/me", route => route.fulfill({ status: 401, json: { success: false, message: "Unauthorized", payload: null } }));
  page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  const response = await page.goto("/forgot-password?step=password&state=ready");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("بازیابی رمز عبور | دیتانو");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("بازیابی رمز عبور");
  await expect(page.locator('[data-auth-step][aria-current="step"]')).toHaveText(/ایمیل/);
  await page.getByRole("button", { name: "ادامه", exact: true }).click();
  const email = page.getByLabel("ایمیل", { exact: true });
  await expect(email).toBeFocused();
  await expect(page.getByText("ایمیل خود را وارد کنید.", { exact: true })).toBeVisible();
  await email.fill("invalid");
  await page.getByRole("button", { name: "ادامه", exact: true }).click();
  await expect(page.getByText("یک ایمیل معتبر وارد کنید.", { exact: true })).toBeVisible();
  await email.fill("person+tag@example.com");
  await page.getByRole("button", { name: "ادامه", exact: true }).click();
  await expect(page.getByText("بازیابی رمز عبور در حال حاضر در دسترس نیست.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("بازیابی رمز عبور");
  await expect(page.getByRole("textbox", { name: "کد بازیابی", exact: true })).toHaveCount(0);
  await expect(context.cookies()).resolves.toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
  expect(requests.map(url => new URL(url).pathname)).toEqual(["/api/auth/csrf"]);
  await page.getByRole("link", { name: "بازگشت به ورود", exact: true }).click();
  await expect(page).toHaveURL("/login");
});

test("private flow keeps one frame, action position, values and keyboard focus across all stages", async ({ page }) => {
  await page.goto("/ui-review/recovery");
  await page.getByLabel("ایمیل", { exact: true }).fill("edited@example.test");
  await page.evaluate(() => document.fonts.ready);
  const first = await geometry(page);
  await page.getByRole("button", { name: "ادامه", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("کد بازیابی");
  await expect(page.getByRole("textbox", { name: "کد بازیابی", exact: true })).toBeFocused();
  await page.getByRole("textbox", { name: "کد بازیابی", exact: true }).fill("۰۱۲۳۴۵۶۷");
  await expect(page.getByRole("textbox", { name: "کد بازیابی", exact: true })).toHaveValue("01234567");
  const second = await geometry(page);
  await page.getByRole("button", { name: "بررسی کد", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("تعیین رمز جدید");
  await expect(page.getByLabel("رمز عبور جدید", { exact: true })).toBeFocused();
  const third = await geometry(page);
  for (const current of [second, third]) {
    expect(current.card).not.toBeNull();
    expect(current.action).not.toBeNull();
    if (!first.card || !first.action || !current.card || !current.action) throw new Error("Frame geometry missing");
    for (const key of ["x", "y", "width", "height"] as const) expect(Math.abs(current.card[key] - first.card[key])).toBeLessThanOrEqual(1);
    expect(Math.abs(current.action.y - first.action.y)).toBeLessThanOrEqual(1);
  }
  await page.getByLabel("رمز عبور جدید", { exact: true }).fill("  رمز عبور جدید طولانی  ");
  await page.getByLabel("تکرار رمز عبور جدید", { exact: true }).fill("  رمز عبور جدید طولانی  ");
  await page.getByRole("button", { name: "مرحله قبل", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "کد بازیابی", exact: true })).toHaveValue("01234567");
  await page.getByRole("button", { name: "مرحله قبل", exact: true }).click();
  await expect(page.getByLabel("ایمیل", { exact: true })).toHaveValue("edited@example.test");
  await page.getByRole("button", { name: "ادامه", exact: true }).click();
  await page.getByRole("button", { name: "بررسی کد", exact: true }).click();
  await expect(page.getByLabel("رمز عبور جدید", { exact: true })).toHaveValue("  رمز عبور جدید طولانی  ");
  await expect(page.getByLabel("تکرار رمز عبور جدید", { exact: true })).toHaveValue("  رمز عبور جدید طولانی  ");
});

test("code format errors are linked and exact eight digits preserve leading zero", async ({ page }) => {
  await page.goto("/ui-review/recovery?step=code");
  const code = page.getByRole("textbox", { name: "کد بازیابی", exact: true });
  for (const value of ["1234567", "123456789", "12x45678"]) {
    await code.fill(value);
    await page.getByRole("button", { name: "بررسی کد", exact: true }).click();
    await expect(code).toHaveValue(value);
    await expect(code).toHaveAttribute("aria-invalid", "true");
    const error = page.getByText("کد باید دقیقاً ۸ رقم باشد.", { exact: true });
    await expect(error).toBeVisible();
    expect((await code.getAttribute("aria-describedby"))?.split(" ")).toContain(await error.getAttribute("id"));
  }
  await code.fill("٠١٢٣٤٥٦٧");
  await expect(code).toHaveValue("01234567");
  await expect(code).toHaveCSS("direction", "ltr");
  await page.getByRole("button", { name: "بررسی کد", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("تعیین رمز جدید");
});

test("private clock enforces resend cooldown, expires, and resets without claiming email delivery", async ({ page }) => {
  await page.clock.install();
  await page.goto("/ui-review/recovery?step=code");
  const resend = page.getByRole("button", { name: "ارسال مجدد کد", exact: true });
  await expect(page.getByRole("textbox", { name: "کد بازیابی", exact: true })).toBeEnabled();
  await expect(resend).toBeDisabled();
  await page.clock.fastForward(61_000);
  await expect(resend).toBeEnabled();
  await page.getByRole("textbox", { name: "کد بازیابی", exact: true }).fill("01234567");
  await resend.click();
  await expect(resend).toBeDisabled();
  await expect(page.getByRole("textbox", { name: "کد بازیابی", exact: true })).toHaveValue("");
  await expect(page.getByText("زمان‌سنج نمونه بازنشانی شد؛ ایمیلی ارسال نشده است.", { exact: true })).toBeVisible();
  await page.clock.fastForward(601_000);
  await expect(page.getByText("مهلت کد به پایان رسیده است. کد تازه درخواست کنید.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "بررسی کد", exact: true })).toBeDisabled();
  await expect(resend).toBeEnabled();
  await resend.click();
  await expect(page.getByText("مهلت کد به پایان رسیده است. کد تازه درخواست کنید.", { exact: true })).toHaveCount(0);
});

test("invalid code fixture reaches five attempts and can request a fresh sample", async ({ page }) => {
  await page.goto("/ui-review/recovery?step=code&state=error");
  await expect(page.getByText("کد واردشده درست نیست.", { exact: true })).toBeVisible();
  const verify = page.getByRole("button", { name: "بررسی کد", exact: true });
  for (let attempt = 0; attempt < 5; attempt++) await verify.click();
  await expect(verify).toBeDisabled();
  await expect(page.getByText("تعداد تلاش‌ها به پایان رسیده است. کد تازه درخواست کنید.", { exact: true })).toBeVisible();
  await page.getByLabel("سناریوی آغازین").selectOption("locked");
  await expect(page).toHaveURL(/state=locked/);
  const resend = page.getByRole("button", { name: "ارسال مجدد کد", exact: true });
  await expect(resend).toBeEnabled();
  await resend.click();
  await expect(page.getByRole("textbox", { name: "کد بازیابی", exact: true })).toBeEnabled();
  await expect(page.getByRole("textbox", { name: "کد بازیابی", exact: true })).toHaveValue("");
});

test("new-password policy, exact confirmation and visibility never produce a real reset", async ({ page, context }) => {
  const requests: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  await page.goto("/ui-review/recovery?step=password");
  const password = page.getByLabel("رمز عبور جدید", { exact: true });
  const confirmation = page.getByLabel("تکرار رمز عبور جدید", { exact: true });
  const submit = page.getByRole("button", { name: "ثبت رمز جدید", exact: true });
  for (const [value, valid] of [["😀".repeat(14), false], ["😀".repeat(15), true], ["a".repeat(128), true], ["a".repeat(129), false]] as const) {
    await password.fill(value);
    await confirmation.fill(value);
    await submit.click();
    if (valid) await expect(page.getByText("تغییر رمز عبور در حال حاضر در دسترس نیست.", { exact: true })).toBeVisible();
    else await expect(page.getByText("رمز عبور باید بین ۱۵ و ۱۲۸ کاراکتر باشد.", { exact: true })).toBeVisible();
  }
  await password.fill("  رمز عبور جدید طولانی  ");
  await confirmation.fill("رمز عبور جدید طولانی");
  await submit.click();
  await expect(page.getByText("تکرار رمز عبور با رمز عبور یکسان نیست.", { exact: true })).toBeVisible();
  await confirmation.fill("  رمز عبور جدید طولانی  ");
  await page.getByRole("button", { name: "نمایش رمز عبور جدید", exact: true }).press("Enter");
  await expect(password).toHaveAttribute("type", "text");
  await expect(confirmation).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "نمایش تکرار رمز عبور جدید", exact: true }).press("Space");
  await expect(confirmation).toHaveAttribute("type", "text");
  await submit.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("تعیین رمز جدید");
  await expect(context.cookies()).resolves.toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
  expect(requests).toEqual([]);
});

test("all stages remain Persian, responsive, inert when inactive and usable with reduced viewport height", async ({ page }, testInfo) => {
  await page.goto("/ui-review/recovery");
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const dark of [false, true]) {
      await page.evaluate((enabled) => document.documentElement.classList.toggle("dark", enabled), dark);
      for (const step of ["email", "code", "password"]) {
        await page.getByLabel("مرحله بررسی").selectOption(step);
        await expect(page).toHaveURL(new RegExp(`step=${step}`));
        await expect(page.locator(`[data-recovery-panel=${step}]`)).toBeVisible();
        await expect(page.locator("[data-recovery-panel][inert]")).toHaveCount(2);
        await expect(page.locator('[data-auth-step][aria-current="step"]')).toHaveCount(1);
        await expect(page.getByRole("main")).toHaveCSS("background-image", /linear-gradient/);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (testInfo.project.name === "desktop") await page.screenshot({ path: testInfo.outputPath(`recovery-${step}-${width}-${dark ? "dark" : "light"}.png`), fullPage: true, animations: "disabled" });
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 420 });
  await page.getByRole("button", { name: "ثبت رمز جدید", exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "ثبت رمز جدید", exact: true })).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.classList.remove("dark"); document.documentElement.style.fontSize = "200%"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const clipped = await page.locator("[data-auth-frame]").locator("h1, p, label, button, [data-auth-step]").evaluateAll((elements) => elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.textContent));
  expect(clipped).toEqual([]);
  if (testInfo.project.name === "desktop") await page.screenshot({ path: testInfo.outputPath("recovery-enlarged-text.png"), fullPage: true, animations: "disabled" });
});

test("pending and errors can be reviewed at every stage and no-JS public form stays safe", async ({ page, browser, baseURL }) => {
  for (const step of ["email", "code", "password"]) {
    await page.goto(`/ui-review/recovery?step=${step}&state=pending`);
    await expect(page.getByRole("form")).toHaveAttribute("aria-busy", "true");
    await expect(page.locator("[data-recovery-primary]")).toBeDisabled();
    await expect(page.getByRole("status").filter({ hasText: "در حال بررسی درخواست" })).toBeVisible();
  }
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: { width: 390, height: 844 } });
  try {
    const staticPage = await context.newPage();
    await staticPage.goto("/forgot-password");
    await expect(staticPage.getByRole("button", { name: "ادامه", exact: true })).toBeDisabled();
    await expect(staticPage.getByLabel("ایمیل", { exact: true })).toBeDisabled();
    await staticPage.getByRole("link", { name: "بازگشت به ورود", exact: true }).click();
    await expect(staticPage).toHaveURL("/login");
  } finally { await context.close(); }
});
