import { expect, test } from "@playwright/test";

test("real server proof is copied, rejects body/old tokens, verifies TLS HTML, persists and isolates the next account", async ({ page, context }) => {
  const api = process.env.DATANO_WEBSITES_API_URL; const publishValue = process.env.DATANO_PROOF_PUBLISH_URL;
  if (!api || !publishValue) throw new Error("Dedicated API and test-only local HTML publishing peer required");
  const publish = publishValue;
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const suffix = crypto.randomUUID(); const email = `fe035-${suffix}@example.test`; const second = `fe035-other-${suffix}@example.test`;
  const password = `Proof fixture ${crypto.randomUUID()}`; const hostname = `proof-${suffix}.example.test`;
  const headers = { Origin: "http://127.0.0.1:3100" };
  async function register(address: string) {
    const csrf = await context.request.get(`${api}/api/auth/csrf`, { headers }); expect(csrf.status()).toBe(200);
    const response = await context.request.post(`${api}/api/auth/register`, { headers: { ...headers, "X-CSRF-Token": (await csrf.json()).payload.csrf_token },
      data: { first_name: "کاربر", last_name: "سایت", email: address, password } }); expect(response.status()).toBe(201);
  }
  async function login(address: string) {
    await page.goto("/login?returnTo=%2Fwebsites"); await page.getByLabel("ایمیل", { exact: true }).fill(address);
    await page.getByLabel("رمز عبور", { exact: true }).fill(password); await page.getByRole("button", { name: "ورود به حساب", exact: true }).click(); await expect(page).toHaveURL("/websites");
  }
  async function check(status: number) {
    const result = page.waitForResponse(r => new URL(r.url()).pathname.endsWith("/verify") && r.request().method() === "POST");
    await page.getByRole("button", { name: /^(بررسی تأیید|تلاش مجدد)$/ }).click();
    expect((await result).status()).toBe(status);
  }
  async function publishTag(meta: string, placement: "head" | "body") {
    const response = await context.request.post(publish, { data: { hostname, meta_tag: meta, placement } }); expect(response.status()).toBe(200);
  }
  await register(email); await register(second); await login(email);
  await page.getByRole("button", { name: "افزودن سایت", exact: true }).click(); await page.getByLabel("آدرس سایت", { exact: true }).fill(`https://${hostname}/`);
  const creation = page.waitForResponse(r => new URL(r.url()).pathname === "/api/websites/" && r.request().method() === "POST");
  await page.getByRole("button", { name: "ادامه", exact: true }).click(); const created = (await (await creation).json()).payload;
  await page.getByRole("link", { name: "تأیید مالکیت سایت", exact: true }).click(); await expect(page).toHaveURL(`/websites/${created.id}/verify`);
  const issuance = page.waitForResponse(r => new URL(r.url()).pathname.endsWith("/challenge") && r.request().method() === "POST");
  await page.getByRole("button", { name: "دریافت کد تأیید", exact: true }).click(); const issued = await issuance; expect(issued.status()).toBe(200); const proof = (await issued.json()).payload;
  const code = page.getByRole("textbox", { name: "کد HTML تأیید مالکیت", exact: true }); await expect(code).toHaveValue(proof.meta_tag);
  expect(proof.token).toMatch(/^[A-Za-z0-9_-]{43}$/); expect(proof.website.is_verified).toBe(false);
  expect(Date.parse(proof.website.challenge_expires_at) - Date.parse(proof.website.updated_at)).toBe(86_400_000);
  await page.getByRole("button", { name: "کپی کد", exact: true }).click(); await expect(page.getByText("کد کپی شد.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(proof.meta_tag);
  await publishTag(proof.meta_tag, "body"); await check(409); await expect(page.getByText("سایت با موفقیت تأیید شد", { exact: true })).toHaveCount(0);
  const renewal = page.waitForResponse(r => new URL(r.url()).pathname.endsWith("/challenge") && r.request().method() === "POST");
  await page.getByRole("button", { name: "درخواست کد تازه", exact: true }).click(); const renewed = (await (await renewal).json()).payload;
  expect(renewed.token).not.toBe(proof.token); await expect(code).toHaveValue(renewed.meta_tag);
  await publishTag(proof.meta_tag, "head"); await check(409);
  await publishTag(renewed.meta_tag, "head"); await page.reload();
  await expect(page.getByRole("button", { name: "بررسی تأیید", exact: true })).toBeEnabled(); await expect(page.locator("textarea")).toHaveCount(0);
  await check(200); await expect(page.getByText("سایت با موفقیت تأیید شد", { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText("سایت با موفقیت تأیید شد", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "اتصال منابع گوگل", exact: true }).click(); await expect(page).toHaveURL(`/websites/${created.id}/connect`);
  await expect(page.getByText(hostname, { exact: true })).toBeVisible(); await expect(page.getByText("مالکیت: تأیید شده", { exact: true })).toBeVisible();
  await expect(page.getByText("برای تهیهٔ گزارش، اتصال یک منبع و دریافت دادهٔ معتبر لازم است.", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "بازگشت به سایت‌های من", exact: true }).click(); await expect(page.locator("[data-website-row]")).toContainText("تأیید شده");
  await expect(page.locator("[data-website-row]")).toContainText("وضعیت گزارش در دسترس نیست");
  await page.getByRole("button", { name: "مشاهده اطلاعات سایت من", exact: true }).click(); await expect(page).toHaveURL(`/websites/${created.id}/connect`);
  await page.goto("/profile"); await page.getByRole("button", { name: "خروج از حساب", exact: true }).click(); await page.getByRole("button", { name: "تأیید خروج", exact: true }).click(); await expect(page).toHaveURL("/login");
  await login(second); await page.goto(`/websites/${created.id}/verify?state=success`);
  await expect(page.getByText("این سایت در دسترس نیست.", { exact: true })).toBeVisible(); await expect(page.locator("textarea, [data-website-verification]")).toHaveCount(0);
  expect((await context.request.get(`${api}/api/websites/${created.id}`)).status()).toBe(404);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
});
