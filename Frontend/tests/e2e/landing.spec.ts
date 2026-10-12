import { test, expect } from "@playwright/test";

test("compact mobile navigation opens by keyboard and closes with Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "منوی اصلی", exact: true });
  await expect(toggle).toBeVisible();
  // The native disclosure owns its expanded state, including without JS.
  await expect(page.locator("header details")).not.toHaveAttribute("open");
  await expect(page.getByRole("navigation", { name: "ناوبری اصلی" })).toHaveCount(0);
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("header details")).toHaveAttribute("open", "");
  const navigation = page.getByRole("navigation", { name: "ناوبری اصلی" });
  await expect(navigation.getByRole("link")).toHaveText(["سرویس‌ها", "درباره ما", "حساب کاربری", "ورود"]);
  await page.keyboard.press("Tab");
  await expect(navigation.getByRole("link", { name: "سرویس‌ها" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(navigation).toHaveCount(0);
  await toggle.click();
  await expect(navigation).toBeVisible();
  await page.getByRole("link", { name: "مشاهده سرویس‌ها", exact: true }).focus();
  await expect(navigation).toHaveCount(0);
  await toggle.click();
  await navigation.getByRole("link", { name: "سرویس‌ها", exact: true }).click();
  await expect(page).toHaveURL("/services");
});

test("landing presents the approved sections and honest explanatory preview", async ({ page }) => {
  const errors: string[] = [];
  const apiRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url());
  });
  await page.goto("/");
  await expect(page).toHaveTitle("دیتانو | از داده تا تصمیم روشن");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("داده‌های پراکنده، تصمیم‌های روشن.");
  for (const name of ["مشکل چیست؟", "دیتانو چگونه کمک می‌کند؟", "قابلیت‌های اصلی دیتانو", "چرا دیتانو؟", "دیتانو برای چه کسانی طراحی می‌شود؟", "پیش‌نمایش داشبورد", "قدم بعدی، شناخت بهتر سایت شماست."]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByText("محصول در حال توسعه است؛ اتصال منابع و داشبورد عملیاتی هنوز در دسترس نیست.", { exact: true })).toHaveCount(0);
  const preview = page.getByRole("region", { name: "پیش‌نمایش داشبورد", exact: true });
  await expect(preview.getByText("نمای توضیحی؛ دادهٔ واقعی نیست", { exact: true })).toHaveCount(0);
  await expect(preview.getByText("—", { exact: true })).toHaveCount(4);
  await expect(preview.getByRole("img", { name: "تصویرسازی مسیر تحلیل؛ شکل‌ها بیانگر داده، روند یا نتیجهٔ واقعی نیستند." })).toHaveCount(3);
  await expect(preview.getByText("نمودار مفهومی · بدون مقیاس و داده", { exact: true })).toHaveCount(3);
  await expect(preview.getByRole("button")).toHaveCount(0);
  await expect(preview.getByRole("link")).toHaveCount(0);
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("contentinfo")).toHaveCount(1);
  const menu = page.getByRole("button", { name: "منوی اصلی", exact: true });
  if (await menu.isVisible()) await menu.click();
  await expect(page.getByRole("navigation", { name: "ناوبری اصلی" }).getByRole("link")).toHaveText(["سرویس‌ها", "درباره ما", "حساب کاربری", "ورود"]);
  await expect(page.getByRole("heading", { name: /FAQ|سؤالات متداول|پکیج|مشتریان/ })).toHaveCount(0);
  await expect(page.getByText("ui-review-user@example.test", { exact: true })).toHaveCount(0);
  expect(apiRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("CTAs point to signup and services and keyboard preview navigation stays on the landing", async ({ page }) => {
  await page.goto("/");
  const signup = page.getByRole("link", { name: "شروع استفاده (رایگان)", exact: true });
  await expect(signup).toHaveCount(2);
  for (const link of await signup.all()) await expect(link).toHaveAttribute("href", "/signup");
  await expect(page.getByRole("link", { name: "مشاهده سرویس‌ها", exact: true })).toHaveAttribute("href", "/services");
  const previewLink = page.getByRole("link", { name: "مشاهده پیش‌نمایش داشبورد", exact: true });
  await expect(previewLink).toHaveAttribute("href", "#dashboard-preview");
  await previewLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/#dashboard-preview");
  const preview = page.getByRole("region", { name: "پیش‌نمایش داشبورد", exact: true });
  await expect(preview).toBeFocused();
  await expect(preview.getByRole("heading", { name: "پیش‌نمایش داشبورد", exact: true })).toBeInViewport();
  await page.goBack();
  await expect(page).toHaveURL("/");
  await signup.first().click();
  // FE-011 owns the destination form; FE-007 must navigate to its reserved URL.
  await expect(page).toHaveURL("/signup");
});

test("Persian typography and landing content fit narrow, tablet, desktop, dark and enlarged text", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("main")).toHaveCSS("direction", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-family", /Vazirmatn/);
  await page.evaluate(() => document.fonts.ready);
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const dark of [false, true]) {
      await page.evaluate((enabled) => document.documentElement.classList.toggle("dark", enabled), dark);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const contrast = await page.getByText("نمایش مفهومی", { exact: true }).evaluate((badge) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas unavailable for contrast measurement.");
        function luminance(color: string) {
          if (!ctx) throw new Error("Canvas unavailable.");
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
          const rgb = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map((value) => {
            const srgb = value / 255;
            return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
          });
          return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
        }
        const style = getComputedStyle(badge);
        const foreground = luminance(style.color);
        const background = luminance(style.backgroundColor);
        return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
      });
      expect(contrast, "The explanatory label must remain readable in both themes.").toBeGreaterThanOrEqual(4.5);
      const menu = page.getByRole("button", { name: "منوی اصلی", exact: true });
      if (await menu.isVisible() && !(await page.getByRole("navigation", { name: "ناوبری اصلی" }).count())) await menu.click();
      for (const link of await page.getByRole("navigation", { name: "ناوبری اصلی" }).getByRole("link").all()) {
        const box = await link.boundingBox();
        expect(box).not.toBeNull();
        if (!box) throw new Error("Navigation link has no visible geometry.");
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      }
      if (await menu.isVisible()) await menu.press("Escape");
      // Screenshots are review artifacts, not brittle pixel snapshot assertions.
      if (testInfo.project.name === "desktop") {
        await page.screenshot({ path: testInfo.outputPath(`landing-${width}-${dark ? "dark" : "light"}.png`), fullPage: true, animations: "disabled" });
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const clippedText = await page.getByRole("main").locator("h1, h2, h3, h4, p, dt, dd").evaluateAll((elements) =>
    elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.textContent),
  );
  expect(clippedText, "Enlarged text must wrap inside its container rather than be clipped.").toEqual([]);
  if (testInfo.project.name === "desktop") {
    await page.screenshot({ path: testInfo.outputPath("landing-enlarged-text.png"), fullPage: true, animations: "disabled" });
  }
});

test("landing content and preview anchor work without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("داده‌های پراکنده، تصمیم‌های روشن.");
    const toggle = page.getByRole("button", { name: "منوی اصلی", exact: true });
    await toggle.click();
    await expect(page.getByRole("navigation", { name: "ناوبری اصلی" }).getByRole("link")).toHaveCount(4);
    await toggle.click();
    const link = page.getByRole("link", { name: "مشاهده پیش‌نمایش داشبورد", exact: true });
    await link.click();
    await expect(page).toHaveURL("/#dashboard-preview");
    await expect(page.getByRole("region", { name: "پیش‌نمایش داشبورد", exact: true })).toBeFocused();
  } finally {
    await context.close();
  }
});
