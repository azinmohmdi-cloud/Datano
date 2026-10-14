import { test, expect } from "@playwright/test";

test("add-site navigation works for empty, single and multiple accounts", async ({ page }) => {
  for (const account of ["empty", "single", "multiple"]) {
    await page.goto(`/ui-review/websites?account=${account}`);
    await page.getByRole("button", { name: "افزودن سایت", exact: true }).click();
    await expect(page).toHaveURL("/ui-review/websites/new");
    await expect(page.getByRole("textbox", { name: "آدرس سایت", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "بازگشت به سایت‌های من", exact: true }).click();
    await expect(page).toHaveURL("/ui-review/websites");
    await page.getByRole("link", { name: "بازگشت به پروفایل", exact: true }).click();
    await expect(page).toHaveURL("/ui-review/profile");
  }
});

test("URL feedback canonicalizes hostname while keeping registration separate from ownership", async ({ page }) => {
  await page.goto("/ui-review/websites/new");
  const input = page.getByRole("textbox", { name: "آدرس سایت", exact: true });
  await input.fill("HTTPS://ExAmPle.COM./");
  await input.blur();
  await expect(page.locator("[data-canonical-hostname]")).toHaveText("example.com");
  await expect(page.getByText("ساختار آدرس معتبر است.", { exact: true })).toBeVisible();
  await expect(page.getByText("ثبت سایت به‌معنای تأیید مالکیت نیست.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ادامه", exact: true }).click();
  await expect(page.locator("[data-add-website]").getByRole("alert")).toContainText("ثبت سایت فعلاً در دسترس نیست");
  await expect(input).toHaveValue("HTTPS://ExAmPle.COM./");
  await expect(page.locator("[data-registration-result]")).toHaveCount(0);
});

test("invalid inputs focus the URL and expose associated errors", async ({ page }) => {
  await page.goto("/ui-review/websites/new");
  const input = page.getByRole("textbox", { name: "آدرس سایت", exact: true });
  await page.getByRole("button", { name: "ادامه", exact: true }).click();
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("[data-add-website]").getByRole("alert")).toContainText("آدرس سایت را وارد کنید");
  await input.fill("https://example.com/path");
  await input.blur();
  await expect(page.locator("[data-add-website]").getByRole("alert")).toContainText("مسیر، پارامتر یا بخش نشانی");
});

test("approved URL restrictions reject credentials, custom ports, paths, IPs and local hosts", async ({ page }) => {
  await page.goto("/ui-review/websites/new");
  const input = page.getByRole("textbox", { name: "آدرس سایت", exact: true });
  const cases = [
    ["example.com", "یک آدرس کامل"], ["ftp://example.com", "http:// یا https://"],
    ["https://user:secret@example.com", "نام کاربری یا رمز عبور"], ["https://example.com:8443", "پورت سفارشی"],
    ["https://example.com/path", "بدون مسیر"], ["https://example.com/a/..", "بدون مسیر"],
    ["https://example.com/?", "بدون مسیر"], ["https://example.com/#", "بدون مسیر"],
    ["https://example.com?utm=x", "بدون مسیر"], ["https://example.com#section", "بدون مسیر"],
    ["http://127.0.0.1", "نام دامنه عمومی"], ["http://127.1", "نام دامنه عمومی"],
    ["http://2130706433", "نام دامنه عمومی"], ["http://0x7f000001", "نام دامنه عمومی"],
    ["http://10.1.2.3", "نام دامنه عمومی"], ["http://192.168.1.1", "نام دامنه عمومی"],
    ["http://[::1]", "نام دامنه عمومی"], ["http://[2001:4860:4860::8888]", "نام دامنه عمومی"],
    ["https://localhost", "نام دامنه عمومی"], ["https://shop.localhost", "نام دامنه عمومی"],
    ["https://printer.local", "نام دامنه عمومی"], ["https://intranet", "نام دامنه عمومی"],
    ["https://exa_mple.com", "نام دامنه معتبر نیست"], ["https://-example.com", "نام دامنه معتبر نیست"],
    ["https://example..com", "نام دامنه معتبر نیست"], ["https://%65xample.com", "نام دامنه معتبر نیست"],
    [`https://${"a".repeat(64)}.com`, "نام دامنه معتبر نیست"],
    [`https://${Array(4).fill("a".repeat(63)).join(".")}`, "نام دامنه معتبر نیست"],
    ["https://example.com\\", "یک آدرس کامل"], ["https://exa mple.com", "یک آدرس کامل"],
  ];
  for (const [value, message] of cases) {
    await input.fill(value);
    await input.blur();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("[data-add-website]").getByRole("alert")).toContainText(message);
    await expect(page.locator("[data-canonical-hostname]")).toHaveCount(0);
  }
});

test("canonical identity uses IDNA, preserves www and subdomains, and allows HTTP and root slash", async ({ page }) => {
  await page.goto("/ui-review/websites/new");
  const input = page.getByRole("textbox", { name: "آدرس سایت", exact: true });
  for (const [value, hostname] of [
    [" https://EXAMPLE.COM./ ", "example.com"], ["http://example.com", "example.com"],
    ["https://example.com:443/", "example.com"], ["http://example.com:80", "example.com"],
    ["https://bücher.de", "xn--bcher-kva.de"], ["https://مثال.ایران", "xn--mgbh0fb.xn--mgba3a4f16a"],
    ["https://www.example.com", "www.example.com"], ["https://shop.example.com", "shop.example.com"],
  ]) {
    await input.fill(value); await input.blur();
    await expect(page.locator("[data-canonical-hostname]")).toHaveText(hostname);
    await expect(page.getByText("ساختار آدرس معتبر است.", { exact: true })).toBeVisible();
    await expect(input).not.toHaveAttribute("aria-invalid", "true");
  }
});

test("same-account duplicates reuse the list and a sibling subdomain remains independent", async ({ page }) => {
  await page.goto("/ui-review/websites/new");
  const input = page.getByRole("textbox", { name: "آدرس سایت", exact: true });
  await input.fill("HTTP://EXAMPLE.TEST./"); await input.press("Enter");
  await expect(page.locator("[data-add-website]").getByRole("alert")).toHaveText("این سایت قبلاً در سایت‌های شما ثبت شده است.");
  await expect(page.locator("[data-canonical-hostname]")).toHaveText("example.test");
  await expect(page.getByRole("link", { name: "مشاهده سایت‌های من", exact: true })).toHaveAttribute("href", "/ui-review/websites");
  await expect(page.getByRole("button", { name: "ادامه", exact: true })).toHaveCount(0);
  await input.fill("https://new.example.test"); await input.blur();
  await expect(page.locator("[data-add-website]").getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("ساختار آدرس معتبر است.", { exact: true })).toBeVisible();
  await input.fill("https://www.example.test"); await input.blur();
  await page.getByRole("link", { name: "مشاهده سایت‌های من", exact: true }).click();
  await expect(page).toHaveURL("/ui-review/websites");
  await expect(page.locator("[data-website-row]")).toHaveCount(6);
});

test("private scenarios show pending, generic conflict, recoverable error and unverified result without side effects", async ({ page, context }) => {
  const requests: string[] = []; const errors: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/ui-review/websites/new?state=pending");
  await expect(page.getByRole("textbox", { name: "آدرس سایت", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "در حال ثبت سایت…", exact: true })).toBeDisabled();
  await expect(page.locator("[data-add-website] form")).toHaveAttribute("aria-busy", "true");
  await page.getByLabel("سناریوی افزودن سایت", { exact: true }).selectOption("unavailable");
  await expect(page.locator("[data-add-website]").getByRole("alert")).toHaveText("این دامنه در دسترس نیست. آدرس دیگری وارد کنید.");
  await expect(page.locator("[data-add-website]")).not.toContainText(/مالک قبلی|ایمیل مالک/);
  await page.getByLabel("سناریوی افزودن سایت", { exact: true }).selectOption("error");
  const input = page.getByRole("textbox", { name: "آدرس سایت", exact: true });
  await expect(input).toHaveValue("https://new.example.test");
  await input.fill("https://another.example.test"); await input.blur();
  await expect(page.locator("[data-add-website]").getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "ادامه", exact: true }).click();
  await expect(page.locator("[data-add-website]").getByRole("alert")).toContainText("ثبت سایت فعلاً در دسترس نیست");
  await page.getByLabel("سناریوی افزودن سایت", { exact: true }).selectOption("registered");
  await expect(page.locator("[data-registration-result]")).toContainText("مالکیت: تأیید نشده");
  await expect(page.locator("[data-registration-result]")).toContainText("هنوز اتصال منبع یا گزارش آماده‌ای وجود ندارد");
  await expect(page.locator('meta[name="datano-verification"]')).toHaveCount(0);
  await expect(page.locator("[data-add-website] input")).toHaveCount(0);
  await page.goto("/ui-review/websites/new?state=invalid&state=registered");
  await expect(page.getByRole("textbox", { name: "آدرس سایت", exact: true })).toHaveValue("");
  await expect(page.locator("[data-registration-result]")).toHaveCount(0);
  await expect(context.cookies()).resolves.toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
  expect(requests).toEqual([]); expect(errors).toEqual([]);
});

test("public add-site access ignores review flags and displays no invented account or registration", async ({ page }) => {
  const response = await page.goto("/websites/new?state=registered&role=admin&account=single");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("افزودن سایت | دیتانو");
  await expect(page.getByText("برای افزودن سایت، وارد شوید.", { exact: true })).toBeVisible();
  await expect(page.locator("input, [data-registration-result], [data-canonical-hostname]")).toHaveCount(0);
  await expect(page.locator('a[href^="/ui-review"]')).toHaveCount(0);
  await page.getByRole("link", { name: "بازگشت به سایت‌های من", exact: true }).click();
  await expect(page).toHaveURL("/websites");
  await page.goto("/websites/new");
  await page.getByRole("main").getByRole("link", { name: "ورود به حساب", exact: true }).click();
  await expect(page).toHaveURL("/login");
});

test("form stays readable in Persian RTL, both themes and enlarged text", async ({ page }, testInfo) => {
  const states = ["ready", "valid", "invalid", "duplicate", "unavailable", "pending", "error", "registered"];
  for (const state of states) {
    await page.goto(`/ui-review/websites/new?state=${state}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "fa");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toHaveCount(1);
    expect(await page.locator("[data-add-website]").evaluate((element) => getComputedStyle(element).fontFamily)).toContain("Vazirmatn");
    const input = page.getByRole("textbox", { name: "آدرس سایت", exact: true });
    if (state !== "registered") await expect(input).toHaveCSS("direction", "ltr");
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const dark of [false, true]) {
        await page.evaluate((enabled) => document.documentElement.classList.toggle("dark", enabled), dark);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const clipped = await page.locator("[data-add-website]").locator("h1, h2, p, a, button, label, dd").evaluateAll((elements) => elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.textContent));
        expect(clipped).toEqual([]);
        if (testInfo.project.name === "desktop" && [390, 1440].includes(width) && ["ready", "invalid", "registered"].includes(state)) await page.screenshot({ path: testInfo.outputPath(`add-${state}-${width}-${dark ? "dark" : "light"}.png`), fullPage: true, animations: "disabled" });
      }
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.evaluate(() => { document.documentElement.classList.remove("dark"); document.documentElement.style.fontSize = "200%"; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  }
});

test("without JavaScript no private form is exposed and public login remains usable", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    await page.goto("/ui-review/websites/new?state=registered");
    await expect(page.getByRole("textbox", { name: "آدرس سایت", exact: true })).toHaveCount(0);
    await page.goto("/websites/new");
    await page.getByRole("main").getByRole("link", { name: "ورود به حساب", exact: true }).click();
    await expect(page).toHaveURL("/login");
  } finally { await context.close(); }
});
