import { test, expect } from "@playwright/test";

test("login has the approved fields, links and shared Persian shell", async ({ page }) => {
  const response = await page.goto("/login");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("ورود به حساب کاربری | دیتانو");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ورود به حساب کاربری");
  await expect(page.getByLabel("ایمیل", { exact: true })).toHaveAttribute("autocomplete", "username");
  await expect(page.getByLabel("رمز عبور", { exact: true })).toHaveAttribute("autocomplete", "current-password");
  await expect(page.getByRole("checkbox", { name: "مرا به خاطر بسپار", exact: true })).not.toBeChecked();
  await expect(page.getByRole("link", { name: "ثبت‌نام", exact: true })).toHaveAttribute("href", "/signup");
  await expect(page.getByRole("link", { name: "فراموشی رمز عبور؟", exact: true })).toHaveAttribute("href", "/forgot-password");
  for (const role of ["banner", "main", "contentinfo"] as const) await expect(page.getByRole(role)).toHaveCount(1);
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("main").locator("svg[role=img], figure, canvas, table")).toHaveCount(0);
  const recovery = page.getByRole("link", { name: "فراموشی رمز عبور؟", exact: true });
  await recovery.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/forgot-password");
  await page.goBack();
  await expect(page).toHaveURL("/login");
  await page.getByRole("link", { name: "ثبت‌نام", exact: true }).click();
  await expect(page).toHaveURL("/signup");
});

test("validation is Persian, linked, recoverable and preserves login password semantics", async ({ page }) => {
  await page.goto("/login");
  const email = page.getByLabel("ایمیل", { exact: true });
  const password = page.getByLabel("رمز عبور", { exact: true });
  const submit = page.getByRole("button", { name: "ورود به حساب", exact: true });
  await submit.click();
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("ایمیل خود را وارد کنید.", { exact: true })).toBeVisible();
  await expect(page.getByText("رمز عبور خود را وارد کنید.", { exact: true })).toBeVisible();
  const emailErrorId = await page.getByText("ایمیل خود را وارد کنید.", { exact: true }).getAttribute("id");
  expect(emailErrorId).toBeTruthy();
  expect((await email.getAttribute("aria-describedby"))?.split(" ")).toContain(emailErrorId);
  await email.fill("invalid-email");
  await password.fill(" ");
  await submit.click();
  await expect(page.getByText("یک ایمیل معتبر وارد کنید.", { exact: true })).toBeVisible();
  await expect(password).not.toHaveAttribute("aria-invalid", "true");
  await email.fill("person+tag@example.com");
  await expect(page.getByText("یک ایمیل معتبر وارد کنید.", { exact: true })).toHaveCount(0);
  await password.fill("Old123");
  await submit.click();
  await expect(page.getByRole("alert").filter({ hasText: "ورود به حساب در حال حاضر در دسترس نیست." })).toBeVisible();
  await expect(email).toHaveValue("person+tag@example.com");
  await expect(password).toHaveValue("Old123");
  await expect(password).not.toHaveAttribute("minlength");
  await password.fill("corrected password");
  await expect(page.getByText("ورود به حساب در حال حاضر در دسترس نیست.", { exact: true })).toHaveCount(0);
});

test("password visibility and remember-me work by keyboard without auth or storage effects", async ({ page, context }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url());
  });
  await page.goto("/login");
  const storage = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  const email = page.getByLabel("ایمیل", { exact: true });
  const password = page.getByLabel("رمز عبور", { exact: true });
  await email.fill("person+tag@example.com");
  await expect(email).toHaveCSS("direction", "ltr");
  await password.fill(" رمز دقیق با فاصله ");
  await expect(password).toHaveAttribute("type", "password");
  const show = page.getByRole("button", { name: "نمایش رمز عبور", exact: true });
  await show.focus();
  await page.keyboard.press("Enter");
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue(" رمز دقیق با فاصله ");
  const hide = page.getByRole("button", { name: "مخفی‌کردن رمز عبور", exact: true });
  await expect(hide).toHaveAttribute("aria-pressed", "true");
  await hide.press("Space");
  await expect(password).toHaveAttribute("type", "password");
  const remember = page.getByRole("checkbox", { name: "مرا به خاطر بسپار", exact: true });
  await remember.focus();
  await page.keyboard.press("Space");
  await expect(remember).toBeChecked();
  await page.getByRole("button", { name: "ورود به حساب", exact: true }).click();
  await expect(page.getByText("ورود به حساب در حال حاضر در دسترس نیست.", { exact: true })).toBeVisible();
  await expect(page).toHaveURL("/login");
  await expect(context.cookies()).resolves.toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual(storage);
  expect(requests).toEqual([]);
  await page.reload();
  await expect(remember).not.toBeChecked();
  await expect(password).toHaveAttribute("type", "password");
  await expect(page.getByText("ورود به حساب در حال حاضر در دسترس نیست.", { exact: true })).toHaveCount(0);
});

test("private login pending and error fixtures are deterministic and issue no auth requests", async ({ page, context }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url());
  });
  await page.goto("/ui-review/login?state=pending");
  await expect(page.getByLabel("وضعیت فرم ورود")).toHaveValue("pending");
  await expect(page.getByRole("form", { name: "ورود به حساب کاربری", exact: true })).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("status").filter({ hasText: "در حال بررسی اطلاعات" })).toBeVisible();
  await expect(page.getByLabel("ایمیل", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("رمز عبور", { exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "در حال ورود…", exact: true })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "مرا به خاطر بسپار", exact: true })).toBeDisabled();
  await page.getByLabel("وضعیت فرم ورود").selectOption("error");
  await expect(page.getByText("ایمیل یا رمز عبور درست نیست.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("ایمیل", { exact: true })).toHaveValue("login-review@example.test");
  await page.reload();
  await expect(page.getByText("ایمیل یا رمز عبور درست نیست.", { exact: true })).toBeVisible();
  await page.getByLabel("وضعیت فرم ورود").selectOption("idle");
  await expect(page.getByText("ایمیل یا رمز عبور درست نیست.", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("ایمیل", { exact: true })).toHaveValue("");
  await expect(context.cookies()).resolves.toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
  expect(requests).toEqual([]);
  await page.goto("/login?state=pending");
  await expect(page.getByLabel("ایمیل", { exact: true })).toBeEnabled();
  await expect(page.getByText("login-review@example.test", { exact: true })).toHaveCount(0);
});

test("login stays readable across viewports, themes and 200 percent text", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-family", /Vazirmatn/);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const dark of [false, true]) {
      await page.evaluate((value) => document.documentElement.classList.toggle("dark", value), dark);
      await expect(page.getByRole("main")).toHaveCSS("background-image", /linear-gradient/);
      await expect(page.getByRole("banner")).toHaveCSS("background-image", "none");
      await expect(page.getByRole("contentinfo")).toHaveCSS("background-image", "none");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.getByRole("main").locator("h1, p, a, label, button").evaluateAll((elements) =>
        elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.textContent),
      )).toEqual([]);
      if (testInfo.project.name === "desktop") await page.screenshot({ path: testInfo.outputPath(`login-${width}-${dark ? "dark" : "light"}.png`), fullPage: true, animations: "disabled" });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.classList.remove("dark"); document.documentElement.style.fontSize = "200%"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.getByRole("main").locator("h1, p, a, label, button").evaluateAll((elements) =>
    elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => ({ text: element.textContent, id: element.id, role: element.getAttribute("role"), width: element.clientWidth, scrollWidth: element.scrollWidth })),
  )).toEqual([]);
  expect(await page.getByLabel("رمز عبور", { exact: true }).evaluate((input) => {
    const style = getComputedStyle(input);
    return input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) >= parseFloat(style.fontSize) * 2;
  }), "Enlarged password text must retain usable input space beside the visibility control.").toBe(true);
  if (testInfo.project.name === "desktop") await page.screenshot({ path: testInfo.outputPath("login-enlarged-text.png"), fullPage: true, animations: "disabled" });
  expect(errors).toEqual([]);
});

test("without JavaScript login never submits credentials through native navigation", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ورود به حساب کاربری");
    await expect(page.getByRole("button", { name: "ورود به حساب", exact: true })).toBeDisabled();
    await expect(page.getByLabel("رمز عبور", { exact: true })).toBeDisabled();
    await expect(page.getByText("برای استفاده از فرم ورود، JavaScript مرورگر را فعال کنید.", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "ثبت‌نام", exact: true }).click();
    await expect(page).toHaveURL("/signup");
  } finally { await context.close(); }
});
