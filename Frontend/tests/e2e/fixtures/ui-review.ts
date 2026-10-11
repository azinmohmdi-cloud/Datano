import { test as base, expect, type Page } from "@playwright/test";

export const reviewSample = {
  path: "/ui-review?scope=public&state=ready&persona=guest",
  email: "ui-review-user@example.test",
  urls: ["https://preview-one.example.test", "https://preview-two.example.test"],
} as const;

// Playwright supplies a fresh page/context per test; never share sessions or pages.
export const test = base.extend<{ reviewPage: Page }>({
  reviewPage: async ({ page }, run) => {
    await page.goto(reviewSample.path);
    await expect(page.getByRole("heading", { name: "بررسی خصوصی رابط کاربری", exact: true })).toBeVisible();
    await expect(page.getByLabel("فضای نمایشی")).toHaveValue("public");
    await expect(page.getByLabel("وضعیت نمایشی")).toHaveValue("ready");
    await expect(page.getByLabel("نقش نمونه")).toHaveValue("guest");
    await expect(page.getByLabel("ایمیل نمونه", { exact: true })).toHaveValue(reviewSample.email);
    await run(page);
  },
});

export { expect };
