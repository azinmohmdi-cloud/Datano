import { readFile } from "node:fs/promises";
import { test, expect, type APIRequestContext } from "@playwright/test";

const api = process.env.DATANO_RECOVERY_API_URL;
const origin = "http://127.0.0.1:3100";
async function post(context: APIRequestContext, path: string, data: unknown) {
  const csrf = await context.get(`${api}/api/auth/csrf`);
  expect(csrf.status()).toBe(200);
  return context.post(`${api}/api/auth/${path}`, { data, headers: { Origin: origin, "X-CSRF-Token": (await csrf.json()).payload.csrf_token } });
}

test("real API/PostgreSQL recovery consumes emailed proof, revokes both session types and requires login", async ({ page, playwright }) => {
  const email = `fe031-${Date.now()}@example.test`;
  const oldPassword = "Original test password!";
  const password = "  رمز عبور تازهٔ آزمایشی  ";
  const first = await playwright.request.newContext();
  const remembered = await playwright.request.newContext();
  try {
    expect((await post(first, "register", { first_name: "آزمایش", last_name: "بازیابی", email, password: oldPassword })).status()).toBe(201);
    for (const [context, remember] of [[first, false], [remembered, true]] as const) {
      expect((await post(context, "login", { email, password: oldPassword, remember_me: remember })).status()).toBe(200);
    }
    await page.goto("/forgot-password");
    await page.getByLabel("ایمیل", { exact: true }).fill(email);
    await page.getByRole("button", { name: "ادامه", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("کد بازیابی");
    let code = "";
    await expect.poll(async () => {
      try {
        const message = JSON.parse(await readFile(process.env.DATANO_RECOVERY_CAPTURE_MAILBOX ?? "", "utf8"));
        if (message.recipient === email && email.endsWith("@example.test") && /^[0-9]{8}$/.test(message.code)) { code = message.code; return true; }
      } catch { /* Background mail may not have completed yet. */ }
      return false;
    }).toBe(true);
    await page.getByRole("textbox", { name: "کد بازیابی", exact: true }).fill(code);
    await page.getByRole("button", { name: "بررسی کد", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("تعیین رمز جدید");
    await page.getByLabel("رمز عبور جدید", { exact: true }).fill(password);
    await page.getByLabel("تکرار رمز عبور جدید", { exact: true }).fill(password);
    await page.getByRole("button", { name: "ثبت رمز جدید", exact: true }).click();
    await expect(page).toHaveURL("/login");
    const cookies = await page.context().cookies();
    expect(cookies.some(cookie => /recovery|session/.test(cookie.name))).toBe(false);
    expect((await page.request.get(`${api}/api/auth/me`)).status()).toBe(401);
    for (const context of [first, remembered]) expect((await context.get(`${api}/api/auth/me`)).status()).toBe(401);
    expect((await post(first, "login", { email, password: oldPassword })).status()).toBe(401);
    await page.getByLabel("ایمیل", { exact: true }).fill(email);
    await page.getByLabel("رمز عبور", { exact: true }).fill(password);
    await page.getByRole("button", { name: "ورود به حساب", exact: true }).click();
    await expect(page).toHaveURL("/profile");
  } finally { await first.dispose(); await remembered.dispose(); }
});
