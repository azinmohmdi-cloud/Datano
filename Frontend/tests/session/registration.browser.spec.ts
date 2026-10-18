import { test, expect } from "@playwright/test";

test("actual signup controller registers through real CSRF/API without auto-login; duplicate email is recoverable", async ({ page, context }) => {
  const email = `fe030-${crypto.randomUUID()}@example.test`;
  async function fill() {
    await page.goto("/");
    await page.getByLabel("نام", { exact: true }).fill("کاربر");
    await page.getByLabel("نام خانوادگی", { exact: true }).fill("آزمایش");
    await page.getByLabel("ایمیل", { exact: true }).fill(email);
    await page.getByLabel("رمز عبور", { exact: true }).fill(" رمز دقیق فارسی برای آزمایش ");
    await page.getByLabel("تکرار رمز عبور", { exact: true }).fill(" رمز دقیق فارسی برای آزمایش ");
    await page.getByText("شرایط استفاده را می‌پذیرم", { exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "شرایط استفاده را می‌پذیرم", exact: true })).toBeChecked();
  }
  await fill();
  await page.getByRole("button", { name: "ایجاد حساب کاربری", exact: true }).click();
  await expect(page.getByText("ثبت‌نام آزمایشی انجام شد.")).toBeVisible();
  expect((await context.cookies()).some(cookie => cookie.name.includes("session"))).toBe(false);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
  await fill();
  await page.getByRole("button", { name: "ایجاد حساب کاربری", exact: true }).click();
  await expect(page.getByText("حسابی با این ایمیل وجود دارد. وارد شوید.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("ایمیل", { exact: true })).toHaveValue(email);
  await expect(page.getByRole("button", { name: "ایجاد حساب کاربری", exact: true })).toBeEnabled();
  await page.getByLabel("ایمیل", { exact: true }).fill(`corrected-${email}`);
  await expect(page.getByText("حسابی با این ایمیل وجود دارد. وارد شوید.", { exact: true })).toHaveCount(0);
});
