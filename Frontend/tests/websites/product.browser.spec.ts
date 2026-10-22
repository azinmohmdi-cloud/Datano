import { expect, test } from "@playwright/test";

test("real registration persists in owner list, duplicate reuses ID, independent hosts remain selectable, logout isolates the next owner", async ({ page, context }) => {
  const api = process.env.DATANO_WEBSITES_API_URL;
  if (!api) throw new Error("Dedicated test API required");
  const suffix = crypto.randomUUID();
  const firstEmail = `fe034-first-${suffix}@example.test`; const secondEmail = `fe034-second-${suffix}@example.test`;
  const password = `Website fixture ${crypto.randomUUID()}`;
  const headers = { Origin: "http://127.0.0.1:3100" };
  async function register(email: string) {
    const csrf = await context.request.get(`${api}/api/auth/csrf`, { headers }); expect(csrf.status()).toBe(200);
    const response = await context.request.post(`${api}/api/auth/register`, { headers: { ...headers, "X-CSRF-Token": (await csrf.json()).payload.csrf_token },
      data: { first_name: "کاربر", last_name: "سایت", email, password } }); expect(response.status()).toBe(201);
  }
  async function login(email: string) {
    await page.goto("/login?returnTo=%2Fwebsites");
    await page.getByLabel("ایمیل", { exact: true }).fill(email); await page.getByLabel("رمز عبور", { exact: true }).fill(password);
    await page.getByRole("button", { name: "ورود به حساب", exact: true }).click(); await expect(page).toHaveURL("/websites");
  }
  async function add(url: string) {
    await page.getByRole("button", { name: "افزودن سایت", exact: true }).click();
    await page.getByLabel("آدرس سایت", { exact: true }).fill(url);
    const response = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/websites/");
    await page.getByRole("button", { name: "ادامه", exact: true }).click();
    const saved = await response; expect(saved.status()).toBe(200);
    const site = (await saved.json()).payload;
    await expect(page.locator("[data-registration-result]")).toContainText(site.hostname);
    await page.getByRole("link", { name: "بازگشت به سایت‌های من", exact: true }).click();
    await expect(page.locator("[data-selected-website]")).toContainText(site.hostname);
    return site;
  }
  await register(firstEmail); await register(secondEmail); await login(firstEmail);
  await expect(page.getByText("هنوز سایتی ثبت نکرده‌اید.", { exact: true })).toBeVisible();
  const hostname = `site-${suffix}.example.test`;
  const first = await add(` HTTPS://${hostname.toUpperCase()}.:443/ `);
  expect(first.hostname).toBe(hostname); expect(first.is_verified).toBe(false); expect(first.challenge_status).toBe("not-issued");
  expect(first.owner_id).toBeUndefined(); expect(first.challenge_digest).toBeUndefined();
  await expect(page.locator("[data-website-row]")).toHaveCount(1);
  await page.reload(); await expect(page.locator("[data-selected-website]")).toContainText(hostname);
  const duplicate = await add(`http://${hostname}/`); expect(duplicate.id).toBe(first.id); expect(duplicate.scheme).toBe("https");
  await expect(page.locator("[data-website-row]")).toHaveCount(1);
  const sibling = await add(`https://www.${hostname}/`); expect(sibling.id).not.toBe(first.id);
  await expect(page.locator("[data-website-row]")).toHaveCount(2);
  await page.reload(); const view = page.getByRole("button", { name: "مشاهده اطلاعات سایت من", exact: true }); await expect(view).toBeDisabled();
  await page.getByRole("button", { name: `انتخاب ${hostname}`, exact: true }).click();
  const detail = page.waitForResponse(r => new URL(r.url()).pathname === `/api/websites/${first.id}`);
  await view.click(); expect((await detail).status()).toBe(200); await expect(page).toHaveURL(`/websites/${first.id}/verify`);
  await page.goto("/profile"); await page.getByRole("button", { name: "خروج از حساب", exact: true }).click();
  await page.getByRole("button", { name: "تأیید خروج", exact: true }).click();
  await expect(page).toHaveURL("/login"); await login(secondEmail);
  await expect(page.getByText("هنوز سایتی ثبت نکرده‌اید.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-website-row]")).toHaveCount(0);
  expect((await context.request.get(`${api}/api/websites/${first.id}`)).status()).toBe(404);
  await page.getByRole("button", { name: "افزودن سایت", exact: true }).click();
  await page.getByLabel("آدرس سایت", { exact: true }).fill(`https://${hostname}`);
  const conflict = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/websites/");
  await page.getByRole("button", { name: "ادامه", exact: true }).click(); expect((await conflict).status()).toBe(409);
  await expect(page.getByText("این دامنه در دسترس نیست. آدرس دیگری وارد کنید.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("آدرس سایت", { exact: true })).toHaveValue(`https://${hostname}`);
  await expect(page.locator("[data-registration-result]")).toHaveCount(0);
  await expect(page.getByText(firstEmail, { exact: false })).toHaveCount(0);
  await page.getByRole("link", { name: "بازگشت به سایت‌های من", exact: true }).click();
  await expect(page.getByText("هنوز سایتی ثبت نکرده‌اید.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
});
