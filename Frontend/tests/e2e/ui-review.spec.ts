import { test, expect, reviewSample } from "./fixtures/ui-review";

test("renders Persian RTL without reversing sample email or URLs", async ({
  reviewPage: page,
}) => {
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("body")).toHaveCSS("direction", "rtl");
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("contentinfo")).toHaveCount(1);

  const menu = page.getByRole("button", { name: "منوی اصلی", exact: true });
  if (await menu.isVisible()) await menu.click();
  const navigation = page.getByRole("navigation", { name: "ناوبری اصلی" });
  await expect(navigation).toHaveCSS("direction", "rtl");
  await expect(navigation.getByRole("link")).toHaveText([
    "سرویس‌ها",
    "درباره ما",
    "حساب کاربری",
    "ورود",
  ]);
  for (const link of await navigation.getByRole("link").all()) {
    await expect(link).toBeInViewport();
  }

  if (await menu.isVisible()) await menu.press("Escape");
  const email = page.getByLabel("ایمیل نمونه", { exact: true });
  await expect(email).toHaveValue(reviewSample.email);
  await expect(email).toHaveCSS("direction", "ltr");
  const rows = page.getByRole("table").locator("tbody tr");
  await expect(rows).toHaveCount(2);
  for (const [index, url] of reviewSample.urls.entries()) {
    const value = rows.nth(index).getByText(url, { exact: true });
    await expect(value).toHaveText(url);
    await expect(value).toHaveAttribute("dir", "ltr");
    await expect(value).toHaveCSS("unicode-bidi", "isolate");
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("keyboard skip link and home navigation preserve the product and review boundary", async ({
  reviewPage: page,
}) => {
  // The fixture's fresh document and linked field are ready for the first Tab.
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "رفتن به محتوای اصلی" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();

  await page
    .getByRole("navigation", { name: "دسترسی سریع" })
    .getByRole("link", { name: "صفحه اصلی", exact: true })
    .click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "داده‌های پراکنده، تصمیم‌های روشن.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "بررسی خصوصی رابط کاربری", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  await page.goBack();
  await expect(page).toHaveURL(
    /\/ui-review\?scope=public&state=ready&persona=guest/,
  );
  await expect(page.getByLabel("ایمیل نمونه", { exact: true })).toHaveValue(
    reviewSample.email,
  );
});

test("sample states reload deterministically and reset edits without creating a session", async ({
  reviewPage: page,
  context,
}) => {
  await expect(context.cookies()).resolves.toEqual([]);
  const initialStorage = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }));
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiRequests.push(request.url());
  });

  await page.getByLabel("نقش نمونه").selectOption("admin");
  await expect(
    page.getByText("نقش نمایشی: مدیر نمونه", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("وضعیت نمایشی").selectOption("empty");
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(
    page.getByText("حالت خالی نمونه", { exact: true }).first(),
  ).toBeVisible();
  await page.getByLabel("وضعیت نمایشی").selectOption("error");
  await expect(page.getByRole("alert")).toBeVisible();
  const ready = page.getByRole("button", {
    name: "نمایش حالت آماده",
    exact: true,
  });
  await ready.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(2);
  await expect(page.locator("#review-preview")).toBeFocused();
  const rows = await page
    .getByRole("table")
    .locator("tbody tr")
    .allTextContents();
  await page.reload();
  await expect(page.getByRole("table").locator("tbody tr")).toHaveText(rows);

  await page
    .getByLabel("ایمیل نمونه", { exact: true })
    .fill("edited@example.test");
  await page
    .getByRole("checkbox", { name: "گزینهٔ نمونه", exact: true })
    .uncheck();
  await page
    .getByRole("button", { name: "بازنشانی نمونه‌ها", exact: true })
    .click();
  await expect(page).toHaveURL("/ui-review");
  await expect(page.getByLabel("ایمیل نمونه", { exact: true })).toHaveValue(
    reviewSample.email,
  );
  await expect(
    page.getByRole("checkbox", { name: "گزینهٔ نمونه", exact: true }),
  ).toBeChecked();
  await expect(context.cookies()).resolves.toEqual([]);
  expect(
    await page.evaluate(() => ({
      local: { ...localStorage },
      session: { ...sessionStorage },
    })),
  ).toEqual(initialStorage);
  expect(apiRequests).toEqual([]);
});

test("shared header navigation remains usable in public, account and site shells", async ({
  reviewPage: page,
}) => {
  for (const scope of ["public", "account", "site"]) {
    await page.getByLabel("فضای نمایشی").selectOption(scope);
    await expect(page).toHaveURL(new RegExp(`scope=${scope}`));
    await expect(page.getByLabel("فضای نمایشی")).toHaveValue(scope);
    await expect(page.getByLabel("ایمیل نمونه", { exact: true })).toHaveValue(
      reviewSample.email,
    );
    const menu = page.getByRole("button", { name: "منوی اصلی", exact: true });
    if (await menu.isVisible()) await menu.click();
    const navigation = page.getByRole("navigation", { name: "ناوبری اصلی" });
    const links = navigation.getByRole("link");
    await expect(links).toHaveCount(4);
    for (const [index, href] of [
      "/services",
      "/about",
      "/account",
      "/login",
    ].entries()) {
      await expect(links.nth(index)).toHaveAttribute("href", href);
      await expect(links.nth(index)).toBeInViewport();
    }
    if (await menu.isVisible()) await menu.press("Escape");
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toHaveCount(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

for (const javaScriptEnabled of [false, true]) {
  test.describe(`account navigation with JavaScript ${javaScriptEnabled ? "enabled" : "disabled"}`, () => {
    test.use({ javaScriptEnabled });

    test("account link resolves trusted identity, while no-JS stays pending", async ({ page }) => {
      await page.route("**/api/auth/me", route => route.fulfill({ status: 401, json: { detail: "Unauthorized" } }));
      await page.goto("/");
      const menu = page.getByRole("button", { name: "منوی اصلی", exact: true });
      if (await menu.isVisible()) await menu.click();

      await page.getByRole("navigation", { name: "ناوبری اصلی" })
        .getByRole("link", { name: "حساب کاربری", exact: true }).click();

      await expect(page).toHaveURL(javaScriptEnabled ? "/login" : "/account");
      const main = page.getByRole("main");
      if (javaScriptEnabled) await expect(main.getByLabel("ایمیل", { exact: true })).toBeEnabled();
      else {
        await expect(main.getByText("در حال بررسی نشست…", { exact: true })).toBeVisible();
        await expect(main.getByRole("link", { name: "ورود به حساب", exact: true })).toHaveAttribute("href", "/login");
        await expect(main.locator("input")).toHaveCount(0);
      }
    });
  });
}
