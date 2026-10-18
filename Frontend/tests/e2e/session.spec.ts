import { test, expect, type Page } from "@playwright/test";

const user = { id: "session-user", first_name: "کاربر", last_name: "واقعی", email: "session@example.test", is_active: true, effective_role: "User" };
const envelope = (payload: unknown) => ({ success: true, message: "OK", payload });

async function sessionAPI(page: Page, initial: boolean, role: string | null = "User") {
  let authenticated = initial;
  await page.route("**/api/auth/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/csrf")) return route.fulfill({ json: envelope({ csrf_token: "a".repeat(43) }) });
    if (path.endsWith("/me")) return route.fulfill({ status: authenticated ? 200 : 401, json: authenticated ? envelope({ ...user, effective_role: role }) : { detail: "Unauthorized" } });
    if (path.endsWith("/login")) {
      authenticated = true;
      // A fresh /me response, rather than this contradictory role, decides routing.
      return route.fulfill({ json: envelope({ user, effective_role: "Admin", csrf_token: "b".repeat(43) }) });
    }
    if (path.endsWith("/logout")) { authenticated = false; return route.fulfill({ json: envelope(null) }); }
    return route.abort();
  });
}

test("account waits for server identity and sends User to profile", async ({ page }) => {
  await sessionAPI(page, true);
  await page.goto("/account?role=Admin");
  await expect(page).toHaveURL("/profile");
  await expect(page.locator("[data-profile-current-email]")).toHaveText(user.email);
});

test("account sends server Admin to the admin route", async ({ page }) => {
  await sessionAPI(page, true, "Admin");
  await page.goto("/account?role=User");
  await expect(page).toHaveURL("/admin/users");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("پنل مدیریت");
  await expect(page.getByRole("main").getByRole("link", { name: "ورود به حساب", exact: true })).toHaveCount(0);
});

test("guest is sent to login without rendering protected profile", async ({ page }) => {
  await sessionAPI(page, false);
  await page.goto("/profile?role=Admin");
  await expect(page).toHaveURL("/login?returnTo=%2Fprofile");
  await expect(page.locator("[data-profile-current-email]")).toHaveCount(0);
  await expect(page.getByLabel("ایمیل", { exact: true })).toBeEnabled();
});

test("login uses a fresh trusted role, validates return target and preserves exact password", async ({ page }) => {
  await sessionAPI(page, false);
  let submitted: unknown;
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/auth/login") submitted = request.postDataJSON(); });
  await page.goto("/login?returnTo=%2Fadmin%2Fusers&role=Admin");
  await page.getByLabel("ایمیل", { exact: true }).fill("person@example.test");
  await page.getByLabel("رمز عبور", { exact: true }).fill(" رمز دقیق با فاصله ");
  await page.getByRole("checkbox", { name: "مرا به خاطر بسپار", exact: true }).check();
  await page.getByRole("button", { name: "ورود به حساب", exact: true }).click();
  await expect(page).toHaveURL("/profile");
  expect(submitted).toEqual({ email: "person@example.test", password: " رمز دقیق با فاصله ", remember_me: true });
});

test("logout confirms, revokes server session, leaves profile and browser back cannot restore identity", async ({ page }) => {
  await sessionAPI(page, true);
  await page.goto("/profile");
  await page.getByRole("button", { name: "خروج از حساب", exact: true }).click();
  await page.getByRole("button", { name: "انصراف", exact: true }).click();
  await expect(page.locator("[data-profile-current-email]")).toHaveText(user.email);
  await page.getByRole("button", { name: "خروج از حساب", exact: true }).click();
  await page.getByRole("button", { name: "تأیید خروج", exact: true }).click();
  await expect(page).toHaveURL("/login");
  await page.goto("/profile");
  await expect(page).toHaveURL("/login?returnTo=%2Fprofile");
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
});

test("pending and failed session lookup never display login or protected content prematurely", async ({ page }) => {
  let finish!: () => void;
  const held = new Promise<void>(resolve => { finish = resolve; });
  await page.route("**/api/auth/me", async route => { await held; await route.fulfill({ status: 503, json: { detail: "Unavailable" } }); });
  await page.goto("/login");
  await expect(page.getByText("در حال بررسی نشست…", { exact: true })).toBeVisible();
  await expect(page.getByLabel("رمز عبور", { exact: true })).toHaveCount(0);
  finish();
  await expect(page.getByText("بررسی نشست امکان‌پذیر نیست. دوباره تلاش کنید.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("رمز عبور", { exact: true })).toHaveCount(0);
  await page.unroute("**/api/auth/me");
  await sessionAPI(page, false);
  await page.getByRole("button", { name: "تلاش دوباره", exact: true }).click();
  await expect(page.getByLabel("رمز عبور", { exact: true })).toBeEnabled();
});

test("a session with no active effective role cannot show account pages and can still log out", async ({ page }) => {
  await sessionAPI(page, true, null);
  await page.goto("/account?role=Admin");
  await expect(page.getByText("این حساب نقش فعالی برای ادامه ندارد.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-profile-current-email], [data-admin-summary]")).toHaveCount(0);
  await page.getByRole("button", { name: "خروج از حساب", exact: true }).click();
  await expect(page).toHaveURL("/login");
});

test("logout failure keeps the account and drafted values and allows retry", async ({ page }) => {
  await sessionAPI(page, true);
  await page.route("**/api/auth/logout", route => route.fulfill({ status: 503, json: { detail: "Unavailable" } }));
  await page.goto("/profile");
  await page.getByLabel("نام", { exact: true }).fill("نام پیش‌نویس");
  await page.getByRole("button", { name: "خروج از حساب", exact: true }).click();
  await page.getByRole("button", { name: "تأیید خروج", exact: true }).click();
  await expect(page.getByText("خروج از حساب در حال حاضر در دسترس نیست.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("نام", { exact: true })).toHaveValue("نام پیش‌نویس");
  await expect(page.locator("[data-profile-current-email]")).toHaveText(user.email);
  await expect(page.getByRole("button", { name: "تأیید خروج", exact: true })).toBeEnabled();
});
