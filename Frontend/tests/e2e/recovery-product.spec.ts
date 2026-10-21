import { expect, test, type Page } from "@playwright/test";

async function api(page: Page, verifyStatus = 200, resetStatus = 200, expiresIn = 600) {
  const calls: { path: string; body: Record<string, string> }[] = [];
  await page.route("**/api/auth/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const status = path.endsWith("/verify") ? verifyStatus : path.endsWith("/reset") ? resetStatus : path.endsWith("/me") ? 401 : 200;
    if (request.method() === "POST") calls.push({ path, body: request.postDataJSON() });
    await route.fulfill({ status, json: { success: status === 200, message: "private-provider-message", payload:
      path.endsWith("/csrf") ? { csrf_token: "c".repeat(43) } : path.endsWith("/verify") && status === 200 ? { expires_in: expiresIn, csrf_token: "v".repeat(43) } : null } });
  });
  return calls;
}
async function requestCode(page: Page) {
  await page.goto("/forgot-password?step=password&email=ignored@example.test");
  await expect(page.getByLabel("ایمیل", { exact: true })).toHaveValue("");
  await page.getByLabel("ایمیل", { exact: true }).fill("person@example.test");
  await page.getByRole("button", { name: "ادامه", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("کد بازیابی");
}
test("product recovery uses three real API operations, exact Unicode password and returns to anonymous login", async ({ page }) => {
  const calls = await api(page);
  await requestCode(page);
  await page.getByRole("textbox", { name: "کد بازیابی", exact: true }).fill("۰۱۲۳۴۵۶۷");
  await page.getByRole("button", { name: "بررسی کد", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("تعیین رمز جدید");
  const password = "  رمز تازه و طولانی من  ";
  await page.getByLabel("رمز عبور جدید", { exact: true }).fill(password);
  await page.getByLabel("تکرار رمز عبور جدید", { exact: true }).fill(password);
  await page.getByRole("button", { name: "ثبت رمز جدید", exact: true }).click();
  await expect(page).toHaveURL("/login");
  expect(calls.map(call => call.path)).toEqual(["/api/auth/password-recovery/request", "/api/auth/password-recovery/verify", "/api/auth/password-recovery/reset"]);
  expect(calls[1].body).toEqual({ email: "person@example.test", code: "01234567" });
  expect(calls[2].body).toEqual({ password, password_confirmation: password });
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
});

test("product code expiry blocks verify and permits a fresh request without claiming delivery", async ({ page }) => {
  await page.clock.install();
  const calls = await api(page);
  await requestCode(page);
  await expect(page.getByText("درخواست ثبت شد. اگر این ایمیل واجد شرایط باشد، کد بازیابی ارسال می‌شود.", { exact: true })).toBeVisible();
  await page.clock.fastForward(600_000);
  await expect(page.getByText("مهلت کد به پایان رسیده است. کد تازه درخواست کنید.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "بررسی کد", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "ارسال مجدد کد", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "کد بازیابی", exact: true })).toBeEnabled();
  expect(calls.map(call => call.path)).toEqual(Array(2).fill("/api/auth/password-recovery/request"));
});

for (const serverRejects of [false, true]) test(`product grant ${serverRejects ? "server rejection" : "expiry"} clears secrets and restarts at email`, async ({ page }) => {
  await page.clock.install();
  const calls = await api(page, 200, serverRejects ? 401 : 200, 2);
  await requestCode(page);
  await page.getByRole("textbox", { name: "کد بازیابی", exact: true }).fill("01234567");
  await page.getByRole("button", { name: "بررسی کد", exact: true }).click();
  await expect(page.getByLabel("رمز عبور جدید", { exact: true })).toBeFocused();
  await page.getByLabel("رمز عبور جدید", { exact: true }).fill("Exact new password!");
  await page.getByLabel("تکرار رمز عبور جدید", { exact: true }).fill("Exact new password!");
  if (serverRejects) await page.getByRole("button", { name: "ثبت رمز جدید", exact: true }).click();
  else await page.clock.fastForward(2000);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("بازیابی رمز عبور");
  await expect(page.getByText("مجوز تغییر رمز معتبر نیست یا منقضی شده است. دوباره درخواست بازیابی کنید.", { exact: true })).toBeVisible();
  await expect(page.locator('input[name="password"]')).toHaveValue("");
  await expect(page.locator('input[name="code"]')).toHaveValue("");
  expect(calls.filter(call => call.path.endsWith("/reset"))).toHaveLength(serverRejects ? 1 : 0);
});

test("product Retry-After prevents another POST and raw provider errors never reach UI", async ({ page }) => {
  await page.clock.install();
  const calls = await api(page);
  let failures = 1;
  await page.route("**/api/auth/password-recovery/request", async route => {
    calls.push({ path: new URL(route.request().url()).pathname, body: route.request().postDataJSON() });
    await route.fulfill({ status: failures-- > 0 ? 429 : 200, headers: { "Retry-After": "90" },
      json: { success: failures < 0, message: "DO-NOT-DISPLAY-private-secret", payload: null } });
  });
  await page.goto("/forgot-password");
  await page.getByLabel("ایمیل", { exact: true }).fill("person@example.test");
  const submit = page.getByRole("button", { name: "ادامه", exact: true });
  await submit.click();
  await expect(page.getByText("تعداد درخواست‌ها بیش از حد مجاز است. پس از پایان زمان انتظار دوباره تلاش کنید.", { exact: true })).toBeVisible();
  await submit.click();
  expect(calls).toHaveLength(1);
  await expect(page.getByText(/DO-NOT-DISPLAY/)).toHaveCount(0);
  await page.clock.fastForward(90_000);
  await submit.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("کد بازیابی");
  expect(calls).toHaveLength(2);
});

test("product previous from a consumed code restarts email; reload never restores a stage or secrets", async ({ page }) => {
  await api(page);
  await requestCode(page);
  await page.getByRole("textbox", { name: "کد بازیابی", exact: true }).fill("01234567");
  await page.getByRole("button", { name: "بررسی کد", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("تعیین رمز جدید");
  await page.getByRole("button", { name: "مرحله قبل", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("بازیابی رمز عبور");
  await expect(page.locator('input[name="code"]')).toHaveValue("");
  await page.reload();
  await expect(page.getByLabel("ایمیل", { exact: true })).toHaveValue("");
  await page.getByRole("link", { name: "بازگشت به ورود", exact: true }).click();
  await expect(page).toHaveURL("/login");
});

test("product duplicate submit is suppressed and leaving aborts a pending request", async ({ page }) => {
  const calls = await api(page);
  let release!: () => void;
  let received!: () => void;
  const started = new Promise<void>(resolve => { received = resolve; });
  await page.route("**/api/auth/password-recovery/request", async route => {
    calls.push({ path: new URL(route.request().url()).pathname, body: route.request().postDataJSON() });
    received(); await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { success: true, message: "OK", payload: null } }).catch(() => {});
  });
  await page.goto("/forgot-password");
  await page.getByLabel("ایمیل", { exact: true }).fill("person@example.test");
  await page.getByRole("button", { name: "ادامه", exact: true }).click();
  await started;
  await expect(page.locator("[data-recovery-primary]")).toBeDisabled();
  await page.locator("form").evaluate(form => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  expect(calls).toHaveLength(1);
  await page.getByRole("link", { name: "بازگشت به ورود", exact: true }).click();
  await expect(page).toHaveURL("/login"); release();
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("کد بازیابی");
});

test("product code cooldown, five rejected attempts and resend clear stale code", async ({ page }) => {
  await page.clock.install();
  const calls = await api(page, 401);
  await requestCode(page);
  const resend = page.getByRole("button", { name: "ارسال مجدد کد", exact: true });
  await expect(resend).toBeDisabled();
  const code = page.getByRole("textbox", { name: "کد بازیابی", exact: true });
  for (let index = 0; index < 5; index++) {
    await code.fill("00000000");
    await page.getByRole("button", { name: "بررسی کد", exact: true }).click();
    await expect(page.getByText(index === 4 ? "تعداد تلاش‌ها به پایان رسیده است. کد تازه درخواست کنید." : "کد معتبر نیست یا مهلت و تعداد تلاش آن به پایان رسیده است.", { exact: true })).toBeVisible();
  }
  await expect(code).toBeDisabled();
  await page.clock.fastForward(61_000);
  await resend.click();
  await expect(code).toHaveValue("");
  await expect(code).toBeEnabled();
  expect(calls.filter(call => call.path.endsWith("/request"))).toHaveLength(2);
});
