import { test, expect } from "@playwright/test";

const servicesTitle = "سرویس‌های دیتانو؛ از داده تا تصمیم";
const servicesIntroduction = "از تحلیل رفتار کاربران و عملکرد جست‌وجو تا بررسی تبلیغات و پیشنهادهای هوشمند مبتنی بر داده؛ دیتانو در حال توسعه است تا تمام این امکانات را در یک فضای فارسی و یکپارچه کنار هم قرار دهد و مسیر شناخت، تحلیل و بهبود عملکرد سایت شما را روشن‌تر کند.";

test("services presents the focused final structure and unchanged conceptual sources", async ({ page }) => {
  const errors: string[] = [];
  const apiRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url());
  });
  const response = await page.goto("/services");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("سرویس‌های دیتانو | دیتانو");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(servicesTitle);
  await expect(page.getByText(servicesIntroduction, { exact: true })).toBeVisible();
  for (const name of ["Google Analytics 4", "Search Console", "Google Ads", "پیشنهادهای مبتنی بر قواعد"]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  const main = page.getByRole("main");
  await expect(main.getByRole("region")).toHaveCount(4);
  const hero = main.getByRole("region", { name: servicesTitle, exact: true });
  await expect(hero.getByRole("link")).toHaveCount(0);
  await expect(hero.getByRole("button")).toHaveCount(0);
  await expect(hero.getByRole("figure")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "از دریافت داده تا پیشنهاد قابل‌بررسی", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "داشبورد یکپارچه", exact: true })).toHaveCount(0);
  await expect(page.locator("#service-workflow, #service-dashboard-title")).toHaveCount(0);
  await expect(page.getByText("انتخاب منابع مستقل است؛ اتصال هر سه سرویس اجباری نیست.", { exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByRole("img")).toHaveCount(2);
  await expect(page.getByText("نمودار مفهومی؛ بدون مقیاس و دادهٔ واقعی", { exact: true })).toHaveCount(2);
  await expect(page.getByRole("main").getByRole("button")).toHaveCount(0);
  for (const role of ["banner", "main", "contentinfo"] as const) await expect(page.getByRole(role)).toHaveCount(1);
  await expect(page.getByText("ui-review-user@example.test", { exact: true })).toHaveCount(0);
  expect(apiRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("header navigation and the single closing signup CTA retain their destinations", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "منوی اصلی", exact: true });
  if (await toggle.isVisible()) await toggle.click();
  const navigation = page.getByRole("navigation", { name: "ناوبری اصلی" });
  await navigation.getByRole("link", { name: "سرویس‌ها", exact: true }).click();
  await expect(page).toHaveURL("/services");
  if (await toggle.isVisible()) await toggle.click();
  await expect(navigation.getByRole("link", { name: "سرویس‌ها", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(navigation.getByRole("link")).toHaveText(["سرویس‌ها", "درباره ما", "حساب کاربری", "ورود"]);
  if (await toggle.isVisible()) await toggle.press("Escape");
  const signup = page.getByRole("link", { name: "شروع استفاده (رایگان)", exact: true });
  await expect(signup).toHaveCount(1);
  await expect(page.getByRole("main").getByRole("link")).toHaveCount(1);
  await expect(signup).toHaveAttribute("href", "/signup");
  const closing = page.getByRole("region", { name: "مسیر تحلیل سایت شما، از اینجا شروع می‌شود.", exact: true });
  await expect(closing.getByRole("link", { name: "شروع استفاده (رایگان)", exact: true })).toHaveCount(1);
  await signup.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/signup");
  await page.goBack();
  await expect(page).toHaveURL("/services");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(servicesTitle);
});

test("services remains readable in Persian across responsive sizes, both themes and enlarged text", async ({ page }, testInfo) => {
  await page.goto("/services");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-family", /Vazirmatn/);
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const dark of [false, true]) {
      await page.evaluate((enabled) => document.documentElement.classList.toggle("dark", enabled), dark);
      const pageBackdrop = await page.getByRole("main").evaluate((element) => getComputedStyle(element).backgroundImage);
      expect(pageBackdrop).toContain("linear-gradient");
      await expect(page.getByRole("banner")).toHaveCSS("background-image", "none");
      await expect(page.getByRole("contentinfo")).toHaveCSS("background-image", "none");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const svg of await page.getByRole("main").getByRole("img").all()) {
        const box = await svg.boundingBox();
        expect(box).not.toBeNull();
        if (!box) throw new Error("Conceptual SVG is not visible.");
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      }
      if (testInfo.project.name === "desktop") await page.screenshot({ path: testInfo.outputPath(`services-${width}-${dark ? "dark" : "light"}.png`), fullPage: true, animations: "disabled" });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const clipped = await page.getByRole("main").locator("h1, h2, h3, h4, p, dt, dd").evaluateAll((elements) =>
    elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.textContent),
  );
  expect(clipped).toEqual([]);
  if (testInfo.project.name === "desktop") await page.screenshot({ path: testInfo.outputPath("services-enlarged-text.png"), fullPage: true, animations: "disabled" });
  await page.goto("/");
  await expect(page.locator(".page-surface-editorial")).toHaveCount(0);
});

test("services and its single signup CTA remain available without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    const response = await page.goto("/services");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(servicesTitle);
    await expect(page.getByRole("main").getByRole("link")).toHaveCount(1);
    await page.getByRole("link", { name: "شروع استفاده (رایگان)", exact: true }).click();
    await expect(page).toHaveURL("/signup");
  } finally { await context.close(); }
});
