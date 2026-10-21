import { expect, test } from "@playwright/test";

const initial = { id: "profile-owner", first_name: "نام", last_name: "اولیه", email: "profile@example.test", is_active: true, effective_role: "User", roles: [] };

test("product profile saves names through the API and displays the authoritative result", async ({ page }) => {
  let account = { ...initial };
  const writes: unknown[] = [];
  await page.route("**/api/auth/**", async route => {
    const request = route.request();
    if (new URL(request.url()).pathname.endsWith("/csrf")) {
      await route.fulfill({ json: { success: true, message: "OK", payload: { csrf_token: "c".repeat(43) } } });
      return;
    }
    if (request.method() === "PATCH") {
      const names = request.postDataJSON();
      writes.push(names);
      account = { ...account, ...names };
    }
    await route.fulfill({ json: { success: true, message: "OK", payload: account } });
  });
  await page.goto("/profile?role=Admin");
  await expect(page.locator("[data-profile-account-name]")).toHaveText("نام اولیه");
  await page.getByLabel("نام", { exact: true }).fill("نام تازه");
  await page.getByLabel("نام خانوادگی", { exact: true }).fill("خانوادگی تازه");
  await page.getByRole("button", { name: "ذخیره تغییرات", exact: true }).click();
  await expect(page.locator("[data-profile-account-name]")).toHaveText("نام تازه خانوادگی تازه");
  expect(writes).toEqual([{ first_name: "نام تازه", last_name: "خانوادگی تازه" }]);
  await expect(page.getByRole("button", { name: "ذخیره تغییرات", exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel("نام", { exact: true })).toHaveValue("نام تازه");
});

test("failed save keeps drafts and retry displays the server result with no duplicate submission", async ({ page }) => {
  let writes = 0; let account = { ...initial }; let finish: () => Promise<void> = async () => {};
  await page.route("**/api/auth/**", async route => {
    const request = route.request();
    if (new URL(request.url()).pathname.endsWith("/csrf")) return route.fulfill({ json: { success: true, message: "OK", payload: { csrf_token: "c".repeat(43) } } });
    if (request.method() === "PATCH") {
      writes++;
      if (writes === 1) {
        finish = () => route.fulfill({ status: 503, json: { success: false, message: "private-error-must-stay-hidden", payload: null } });
        return;
      }
      account = { ...account, first_name: "نام ذخیره‌شده", last_name: "خانوادگی ذخیره‌شده" };
    }
    await route.fulfill({ json: { success: true, message: "OK", payload: account } });
  });
  await page.goto("/profile");
  const first = page.getByLabel("نام", { exact: true }); const last = page.getByLabel("نام خانوادگی", { exact: true });
  await first.fill("نام پیش‌نویس"); await last.fill("خانوادگی پیش‌نویس");
  await page.getByRole("button", { name: "ذخیره تغییرات", exact: true }).click();
  await expect(page.getByRole("button", { name: "در حال ذخیره…", exact: true })).toBeDisabled();
  await expect(first).toBeDisabled();
  await page.locator('form[aria-labelledby="profile-names-title"]').evaluate(form => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  expect(writes).toBe(1);
  await finish();
  await expect(page.getByText("ذخیره اطلاعات در حال حاضر در دسترس نیست.", { exact: true })).toBeVisible();
  await expect(first).toHaveValue("نام پیش‌نویس"); await expect(last).toHaveValue("خانوادگی پیش‌نویس");
  await expect(page.locator("[data-profile-account-name]")).toHaveText("نام اولیه");
  await expect(page.getByText(/private-error-must-stay-hidden/)).toHaveCount(0);
  await page.getByRole("button", { name: "ذخیره تغییرات", exact: true }).click();
  await expect(page.getByText("اطلاعات شخصی ذخیره شد.", { exact: true })).toBeVisible();
  await expect(first).toHaveValue("نام ذخیره‌شده"); await expect(last).toHaveValue("خانوادگی ذخیره‌شده");
  await expect(page.locator("[data-profile-account-name]")).toHaveText("نام ذخیره‌شده خانوادگی ذخیره‌شده");
  expect(writes).toBe(2);
  await first.fill("تغییر دوم"); await page.getByRole("button", { name: "بازنشانی نام‌ها", exact: true }).click();
  await expect(first).toHaveValue("نام ذخیره‌شده");
});

for (const status of [422, 403]) test(`server ${status} retains inputs without showing raw error or changing account`, async ({ page }) => {
  await page.route("**/api/auth/**", async route => {
    const request = route.request(); const csrf = new URL(request.url()).pathname.endsWith("/csrf");
    await route.fulfill({ status: request.method() === "PATCH" ? status : 200, json: {
      success: request.method() !== "PATCH", message: "private-error", payload: csrf ? { csrf_token: "c".repeat(43) } : initial } });
  });
  await page.goto("/profile");
  await page.getByLabel("نام", { exact: true }).fill("پیش‌نویس");
  await page.getByRole("button", { name: "ذخیره تغییرات", exact: true }).click();
  await expect(page.getByText(status === 422 ? "نام و نام خانوادگی را بررسی کنید و دوباره تلاش کنید." : "درخواست ذخیره تأیید نشد. دوباره تلاش کنید.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("نام", { exact: true })).toHaveValue("پیش‌نویس");
  await expect(page.locator("[data-profile-account-name]")).toHaveText("نام اولیه");
  await expect(page.getByText(/private-error/)).toHaveCount(0);
});

test("invalid names do not submit, cancel resets to server names and email remains unavailable", async ({ page }) => {
  let writes = 0;
  await page.route("**/api/auth/**", async route => {
    const csrf = new URL(route.request().url()).pathname.endsWith("/csrf");
    if (route.request().method() === "PATCH") writes++;
    await route.fulfill({ json: { success: true, message: "OK", payload: csrf ? { csrf_token: "c".repeat(43) } : initial } });
  });
  await page.goto("/profile");
  await page.getByLabel("نام", { exact: true }).fill("   ");
  await page.getByRole("button", { name: "ذخیره تغییرات", exact: true }).click();
  await expect(page.getByText("نام خود را وارد کنید.", { exact: true })).toBeVisible(); expect(writes).toBe(0);
  await page.getByRole("button", { name: "بازنشانی نام‌ها", exact: true }).click();
  await expect(page.getByLabel("نام", { exact: true })).toHaveValue(initial.first_name);
  await page.getByLabel("ایمیل جدید", { exact: true }).fill("new@example.test");
  await page.getByRole("button", { name: "ادامه برای تأیید", exact: true }).click();
  await expect(page.getByText("تغییر ایمیل در حال حاضر در دسترس نیست.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-profile-current-email]")).toHaveText(initial.email);
});

test("expired cookie during save removes the private profile and returns to login", async ({ page }) => {
  let live = true;
  await page.route("**/api/auth/**", async route => {
    const request = route.request(); const csrf = new URL(request.url()).pathname.endsWith("/csrf");
    if (request.method() === "PATCH") live = false;
    await route.fulfill({ status: live || csrf ? 200 : 401, json: { success: live || csrf, message: "OK", payload: csrf ? { csrf_token: "c".repeat(43) } : live ? initial : null } });
  });
  await page.goto("/profile"); await page.getByLabel("نام", { exact: true }).fill("پیش‌نویس");
  await page.getByRole("button", { name: "ذخیره تغییرات", exact: true }).click();
  await expect(page).toHaveURL("/login?returnTo=%2Fprofile"); await expect(page.locator("[data-profile-account-name]")).toHaveCount(0);
});
