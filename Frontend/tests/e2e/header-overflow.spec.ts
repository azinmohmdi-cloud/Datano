import { test, expect } from "@playwright/test";

test("320px header with 200 percent text keeps its full-size menu inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/login");
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  const header = page.getByRole("banner");
  const menu = header.getByRole("button", { name: "منوی اصلی", exact: true });
  const box = await menu.boundingBox();
  if (!box) throw new Error("Menu has no visible bounds");
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.width).toBe(44);
  expect(box.height).toBe(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await expect(header.getByRole("link", { name: "دیتانو، صفحه اصلی", exact: true }).locator("svg")).toHaveCSS("width", "44px");
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(header.getByRole("navigation", { name: "ناوبری اصلی" }).getByRole("link")).toHaveCount(4);
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(header.locator("details")).not.toHaveAttribute("open");
});

test("standard mobile header keeps its spacing and native menu without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 320, height: 900 } });
  try {
    const page = await context.newPage();
    await page.goto("/login");
    const header = page.getByRole("banner");
    await expect(header.locator(":scope > div")).toHaveCSS("column-gap", "16px");
    const menu = header.getByRole("button", { name: "منوی اصلی", exact: true });
    await menu.focus(); await page.keyboard.press("Enter");
    const navigation = header.getByRole("navigation", { name: "ناوبری اصلی" });
    await expect(navigation.getByRole("link")).toHaveCount(4);
    await navigation.getByRole("link", { name: "سرویس‌ها", exact: true }).click();
    await expect(page).toHaveURL("/services");
  } finally { await context.close(); }
});
