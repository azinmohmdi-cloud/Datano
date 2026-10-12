import { test, expect } from "@playwright/test";

test("about explains the product's purpose without invented claims or extra features", async ({ page }) => {
  const errors: string[] = [];
  const apiRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url());
  });
  const response = await page.goto("/about");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("درباره دیتانو | دیتانو");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("درباره دیتانو");
  await expect(main.getByRole("heading", { level: 2 })).toHaveText(["مأموریت ما", "رویکرد ما"]);
  await expect(main.getByText(/هدف دیتانو، فراهم کردن فضایی فارسی و یکپارچه/)).toBeVisible();
  await expect(main.getByText(/تصمیم نهایی همیشه با کاربر است/)).toBeVisible();
  await expect(main.getByRole("img")).toHaveCount(0);
  await expect(main.locator("figure, form, input, canvas, table, [data-slot=card]")).toHaveCount(0);
  await expect(main.getByRole("button")).toHaveCount(0);
  await expect(main.getByRole("link")).toHaveCount(1);
  const copy = await main.innerText();
  expect(copy).not.toMatch(/محصول در حال توسعه|آماده نبودن|بک‌اند|صرفاً نمایشی|داشبورد واقعی نیست|هنوز عملیاتی نیست/);
  expect(copy).not.toMatch(/تضمین رشد|مشتریان ما|اعضای تیم|سابقهٔ فعالیت|تلفن|تماس با ما|@|https?:\/\//);
  expect(copy).not.toMatch(/[0-9۰-۹]/);
  for (const role of ["banner", "main", "contentinfo"] as const) await expect(page.getByRole(role)).toHaveCount(1);
  expect(apiRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("about is reachable through shared navigation and its services link works by keyboard", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "منوی اصلی", exact: true });
  if (await toggle.isVisible()) await toggle.click();
  const navigation = page.getByRole("navigation", { name: "ناوبری اصلی" });
  await navigation.getByRole("link", { name: "درباره ما", exact: true }).click();
  await expect(page).toHaveURL("/about");
  if (await toggle.isVisible()) await toggle.click();
  await expect(navigation.getByRole("link")).toHaveText(["سرویس‌ها", "درباره ما", "حساب کاربری", "ورود"]);
  await expect(navigation.getByRole("link", { name: "درباره ما", exact: true })).toHaveAttribute("aria-current", "page");
  if (await toggle.isVisible()) await toggle.press("Escape");
  const services = page.getByRole("main").getByRole("link", { name: "آشنایی با سرویس‌های دیتانو", exact: true });
  await expect(services).toHaveAttribute("href", "/services");
  await services.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/services");
  await page.getByRole("contentinfo").getByRole("link", { name: "درباره ما", exact: true }).click();
  await expect(page).toHaveURL("/about");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("درباره دیتانو");
});

test("about stays readable in Persian across sizes and themes without changing other page backdrops", async ({ page }, testInfo) => {
  await page.goto("/about");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-family", /Vazirmatn/);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const dark of [false, true]) {
      await page.evaluate((enabled) => document.documentElement.classList.toggle("dark", enabled), dark);
      const background = await page.getByRole("main").evaluate((element) => getComputedStyle(element).backgroundImage);
      expect(background).toBe(dark
        ? "linear-gradient(135deg, rgb(25, 23, 31), rgb(30, 27, 43))"
        : "linear-gradient(135deg, rgb(242, 248, 253), rgb(247, 244, 253))");
      await expect(page.getByRole("banner")).toHaveCSS("background-image", "none");
      await expect(page.getByRole("contentinfo")).toHaveCSS("background-image", "none");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const clipped = await page.getByRole("main").locator("h1, h2, p, a").evaluateAll((elements) =>
        elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.textContent),
      );
      expect(clipped).toEqual([]);
      if (testInfo.project.name === "desktop") await page.screenshot({ path: testInfo.outputPath(`about-${width}-${dark ? "dark" : "light"}.png`), fullPage: true, animations: "disabled" });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const clipped = await page.getByRole("main").locator("h1, h2, p, a").evaluateAll((elements) =>
    elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.textContent),
  );
  expect(clipped).toEqual([]);
  if (testInfo.project.name === "desktop") await page.screenshot({ path: testInfo.outputPath("about-enlarged-text.png"), fullPage: true, animations: "disabled" });
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; document.documentElement.classList.remove("dark"); });
  await page.goto("/services");
  expect(await page.getByRole("main").evaluate((element) => getComputedStyle(element).backgroundImage)).toBe("linear-gradient(135deg, rgb(247, 244, 253), rgb(242, 248, 253))");
  await page.goto("/");
  await expect(page.getByRole("main")).toHaveCSS("background-image", "none");
});

test("about content and public navigation work without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("درباره دیتانو");
    await expect(page.getByRole("main").getByRole("link")).toHaveCount(1);
    await page.getByRole("main").getByRole("link", { name: "آشنایی با سرویس‌های دیتانو", exact: true }).click();
    await expect(page).toHaveURL("/services");
    await page.getByRole("contentinfo").getByRole("link", { name: "درباره ما", exact: true }).click();
    await expect(page).toHaveURL("/about");
    await page.getByRole("button", { name: "منوی اصلی", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "ناوبری اصلی" }).getByRole("link", { name: "درباره ما", exact: true })).toBeVisible();
  } finally { await context.close(); }
});
