import { test, expect, type Page } from "@playwright/test";

async function fillValidForm(page: Page, password = "یک عبارت فارسی طولانی") {
  await page.getByLabel("نام", { exact: true }).fill("آزین");
  await page.getByLabel("نام خانوادگی", { exact: true }).fill("نمونه");
  await page.getByLabel("ایمیل", { exact: true }).fill("person+tag@example.com");
  await page.getByLabel("رمز عبور", { exact: true }).fill(password);
  await page.getByLabel("تکرار رمز عبور", { exact: true }).fill(password);
}

test("signup has approved fields and blocks acceptance without approved terms", async ({ page }) => {
  const response = await page.goto("/signup");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("ایجاد حساب کاربری | دیتانو");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ایجاد حساب کاربری");
  for (const label of ["نام", "نام خانوادگی", "ایمیل", "رمز عبور", "تکرار رمز عبور"]) {
    await expect(page.getByLabel(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByLabel("رمز عبور", { exact: true })).toHaveAttribute("autocomplete", "new-password");
  await expect(page.getByLabel("نام", { exact: true })).toHaveAttribute("autocomplete", "given-name");
  await expect(page.getByLabel("نام خانوادگی", { exact: true })).toHaveAttribute("autocomplete", "family-name");
  await expect(page.getByRole("checkbox", { name: "شرایط استفاده را می‌پذیرم", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "ایجاد حساب کاربری", exact: true })).toBeDisabled();
  await expect(page.getByText("متن شرایط استفاده هنوز در دسترس نیست؛ ایجاد حساب فعلاً امکان‌پذیر نیست.", { exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "ورود", exact: true })).toHaveAttribute("href", "/login");
  await expect(page.locator("input[name=username], select[name=role], input[name=role]")).toHaveCount(0);
  for (const role of ["banner", "main", "contentinfo"] as const) await expect(page.getByRole(role)).toHaveCount(1);
  await page.getByRole("main").getByRole("link", { name: "ورود", exact: true }).click();
  await expect(page).toHaveURL("/login");
});

test("private validation links errors, focuses first invalid field and requires acceptance", async ({ page }) => {
  await page.goto("/ui-review/signup");
  const submit = page.getByRole("button", { name: "ایجاد حساب کاربری", exact: true });
  await submit.click();
  const firstName = page.getByLabel("نام", { exact: true });
  await expect(firstName).toBeFocused();
  await expect(firstName).toHaveAttribute("aria-invalid", "true");
  const error = page.getByText("نام خود را وارد کنید.", { exact: true });
  await expect(error).toBeVisible();
  const id = await error.getAttribute("id");
  expect(id).toBeTruthy();
  expect((await firstName.getAttribute("aria-describedby"))?.split(" ")).toContain(id);
  await firstName.fill("   ");
  await submit.click();
  await expect(error).toBeVisible();
  await page.getByLabel("ایمیل", { exact: true }).fill("invalid");
  await page.getByLabel("ایمیل", { exact: true }).blur();
  await expect(page.getByText("یک ایمیل معتبر وارد کنید.", { exact: true })).toBeVisible();
  await expect(page.getByText("رمز عبور را دوباره وارد کنید.", { exact: true })).toBeVisible();
  await fillValidForm(page);
  await submit.click();
  await expect(page.getByText("پذیرش شرایط استفاده الزامی است.", { exact: true })).toBeVisible();
  const terms = page.getByRole("checkbox", { name: "شرایط استفاده را می‌پذیرم", exact: true });
  await expect(terms).toBeFocused();
  await terms.press("Space");
  await expect(terms).toBeChecked();
  await expect(page.getByText("پذیرش شرایط استفاده الزامی است.", { exact: true })).toHaveCount(0);
  await submit.click();
  await expect(page.getByText("ایجاد حساب کاربری در حال حاضر در دسترس نیست.", { exact: true })).toBeVisible();
  await expect(firstName).toHaveValue("آزین");
});

test("new passwords use Unicode code points with exact boundaries and no composition requirements", async ({ page }) => {
  await page.goto("/ui-review/signup");
  await fillValidForm(page);
  await page.getByRole("checkbox", { name: "شرایط استفاده را می‌پذیرم", exact: true }).check();
  const password = page.getByLabel("رمز عبور", { exact: true });
  const confirmation = page.getByLabel("تکرار رمز عبور", { exact: true });
  const submit = page.getByRole("button", { name: "ایجاد حساب کاربری", exact: true });
  for (const [value, valid] of [["الف".repeat(4), false], ["😀".repeat(14), false], ["😀".repeat(15), true], ["a".repeat(128), true], ["a".repeat(129), false], [" ".repeat(15), true]] as const) {
    await password.fill(value);
    await confirmation.fill(value);
    await submit.click();
    if (valid) {
      await expect(password).not.toHaveAttribute("aria-invalid", "true");
      await expect(page.getByText("ایجاد حساب کاربری در حال حاضر در دسترس نیست.", { exact: true })).toBeVisible();
    } else {
      await expect(password).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByText("رمز عبور باید بین ۱۵ و ۱۲۸ کاراکتر باشد.", { exact: true })).toBeVisible();
    }
    await expect(password).toHaveValue(value);
  }
  await expect(password).not.toHaveAttribute("maxlength");
  await expect(password).not.toHaveAttribute("minlength");
});

test("confirmation and both visibility controls preserve exact passwords", async ({ page }) => {
  await page.goto("/ui-review/signup");
  const value = "  رمز عبور دقیق فارسی  ";
  await fillValidForm(page, value);
  const password = page.getByLabel("رمز عبور", { exact: true });
  const confirmation = page.getByLabel("تکرار رمز عبور", { exact: true });
  await expect(page.getByText("رمزهای عبور یکسان‌اند.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "نمایش رمز عبور", exact: true }).press("Enter");
  await expect(password).toHaveAttribute("type", "text");
  await expect(confirmation).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "نمایش تکرار رمز عبور", exact: true }).press("Space");
  await expect(confirmation).toHaveAttribute("type", "text");
  await expect(password).toHaveValue(value);
  await expect(confirmation).toHaveValue(value);
  await confirmation.fill(value.trim());
  await confirmation.blur();
  await expect(page.getByText("تکرار رمز عبور با رمز عبور یکسان نیست.", { exact: true })).toBeVisible();
  await confirmation.fill(value);
  await confirmation.blur();
  await expect(page.getByText("رمزهای عبور یکسان‌اند.", { exact: true })).toBeVisible();
  await password.fill(value + "!");
  await expect(page.getByText("تکرار رمز عبور با رمز عبور یکسان نیست.", { exact: true })).toBeVisible();
});

test("private pending and error states never create accounts or persist credentials", async ({ page, context }) => {
  const requests: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  await page.goto("/ui-review/signup?state=pending");
  await expect(page.getByRole("form", { name: "ایجاد حساب کاربری", exact: true })).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("button", { name: "در حال بررسی…", exact: true })).toBeDisabled();
  await expect(page.getByLabel("نام", { exact: true })).toBeDisabled();
  await page.getByLabel("وضعیت فرم ثبت‌نام").selectOption("error");
  await expect(page.getByText("بررسی اطلاعات انجام نشد. دوباره تلاش کنید.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("بررسی اطلاعات انجام نشد. دوباره تلاش کنید.", { exact: true })).toBeVisible();
  await page.getByLabel("وضعیت فرم ثبت‌نام").selectOption("interactive");
  await expect(page).toHaveURL(/state=interactive/);
  await expect(page.getByLabel("نام", { exact: true })).toHaveValue("");
  await fillValidForm(page);
  await page.getByRole("checkbox", { name: "شرایط استفاده را می‌پذیرم", exact: true }).check();
  await page.getByRole("button", { name: "ایجاد حساب کاربری", exact: true }).click();
  await expect(page.getByText("ایجاد حساب کاربری در حال حاضر در دسترس نیست.", { exact: true })).toBeVisible();
  await expect(context.cookies()).resolves.toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
  expect(requests).toEqual([]);
  await page.goto("/signup?state=pending&terms=1");
  await expect(page.getByLabel("نام", { exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "ایجاد حساب کاربری", exact: true })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "شرایط استفاده را می‌پذیرم", exact: true })).toBeDisabled();
});

test("signup fits Persian RTL, both themes and enlarged text without changing approved pages", async ({ page }, testInfo) => {
  await page.goto("/signup");
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-family", /Vazirmatn/);
  await page.evaluate(() => document.fonts.ready);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const dark of [false, true]) {
      await page.evaluate((enabled) => document.documentElement.classList.toggle("dark", enabled), dark);
      await expect(page.getByRole("main")).toHaveCSS("background-image", /linear-gradient/);
      await expect(page.getByRole("banner")).toHaveCSS("background-image", "none");
      await expect(page.getByRole("contentinfo")).toHaveCSS("background-image", "none");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.getByRole("main").locator("h1, p, a, label, button").evaluateAll((elements) => elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.textContent))).toEqual([]);
      if (testInfo.project.name === "desktop") await page.screenshot({ path: testInfo.outputPath(`signup-${width}-${dark ? "dark" : "light"}.png`), fullPage: true, animations: "disabled" });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.classList.remove("dark"); document.documentElement.style.fontSize = "200%"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.getByRole("main").locator("h1, p, a, label, button").evaluateAll((elements) => elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.textContent))).toEqual([]);
  for (const label of ["رمز عبور", "تکرار رمز عبور"]) {
    expect(await page.getByLabel(label, { exact: true }).evaluate((input) => {
      const style = getComputedStyle(input);
      return input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) >= parseFloat(style.fontSize) * 2;
    })).toBe(true);
  }
  if (testInfo.project.name === "desktop") await page.screenshot({ path: testInfo.outputPath("signup-enlarged-text.png"), fullPage: true, animations: "disabled" });
});

test("without JavaScript signup cannot submit credentials and the login link remains usable", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto("/signup");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ایجاد حساب کاربری");
    await expect(page.getByLabel("رمز عبور", { exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "ایجاد حساب کاربری", exact: true })).toBeDisabled();
    await page.getByRole("main").getByRole("link", { name: "ورود", exact: true }).click();
    await expect(page).toHaveURL("/login");
  } finally { await context.close(); }
});
