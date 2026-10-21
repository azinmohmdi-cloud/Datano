import { test, expect } from "@playwright/test";

test("three Google sources are independent and optional and product actions never fake OAuth", async ({ page, context }) => {
  const requests: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  await page.goto("/ui-review/websites/connect");
  await expect(page.getByRole("heading", { name: "اتصال منابع گوگل", exact: true })).toBeVisible();
  await expect(page.locator("[data-google-source]")).toHaveCount(3);
  await expect(page.getByText("اختیاری", { exact: true })).toHaveCount(3);
  const ga4 = page.locator('[data-google-source="ga4"]');
  await ga4.getByRole("button", { name: "اتصال حساب گوگل", exact: true }).click();
  await expect(ga4.getByRole("alert")).toContainText("اتصال حساب گوگل فعلاً در دسترس نیست");
  for (const source of ["gsc", "ads"]) await expect(page.locator(`[data-google-source="${source}"]`).getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ادامه برای دریافت داده", exact: true })).toBeDisabled();
  await expect(context.cookies()).resolves.toEqual([]);
  expect(requests).toEqual([]);
});

test("each source alone permits the receipt step while failures or pending in others remain independent", async ({ page }) => {
  for (const source of ["ga4", "gsc", "ads"]) {
    const states = { ga4: "revoked", gsc: "no-access", ads: "authorizing", [source]: "connected" };
    await page.goto(`/ui-review/websites/connect?ga4=${states.ga4}&gsc=${states.gsc}&ads=${states.ads}`);
    const connected = page.locator(`[data-google-source="${source}"]`);
    await expect(connected).toHaveAttribute("data-source-state", "connected");
    await expect(connected.locator("[data-connected-resource]")).toHaveCount(1);
    await page.getByRole("button", { name: "ادامه برای دریافت داده", exact: true }).click();
    await expect(page).toHaveURL(/\/ui-review\/websites\/receive\?/);
    await expect(page.locator("[data-report-readiness]")).toHaveAttribute("data-report-readiness", "waiting");
    for (const id of ["ga4", "gsc", "ads"]) await expect(page.locator(`[data-receipt-source="${id}"]`)).toHaveAttribute("data-receipt-state", id === source ? "queued" : "disconnected");
    await expect(page.getByRole("button", { name: "مشاهده گزارش", exact: true })).toBeDisabled();
  }
});

test("property and account selection is single, eligible, keyboard accessible and retained on registration error", async ({ page }) => {
  await page.goto("/ui-review/websites/connect?ga4=select&gsc=select&ads=select");
  const ga4 = page.locator('[data-google-source="ga4"]');
  await ga4.getByRole("button", { name: "ثبت اتصال", exact: true }).click();
  await expect(ga4.getByRole("alert")).toHaveText("یک منبع مجاز و مرتبط با سایت انتخاب کنید.");
  await expect(ga4.getByRole("radio").first()).toBeFocused();
  await expect(ga4.getByRole("group", { name: "انتخاب پراپرتی GA4", exact: true })).toHaveAttribute("aria-invalid", "true");
  await page.keyboard.press("Space");
  await expect(ga4.getByRole("radio").first()).toBeChecked();
  await expect(ga4.getByRole("alert")).toHaveCount(0);
  for (const source of ["ga4", "gsc", "ads"]) {
    const card = page.locator(`[data-google-source="${source}"]`);
    const radios = card.getByRole("radio");
    await expect(radios).toHaveCount(3);
    await expect(radios.nth(2)).toBeDisabled();
    await radios.nth(0).check(); await radios.nth(1).check();
    await expect(radios.nth(0)).not.toBeChecked(); await expect(radios.nth(1)).toBeChecked();
    await card.getByRole("button", { name: "ثبت اتصال", exact: true }).click();
    await expect(card.getByRole("alert")).toHaveText("ثبت اتصال فعلاً در دسترس نیست. انتخاب شما حفظ شده است.");
    await expect(radios.nth(1)).toBeChecked();
    await expect(card.locator("[data-connected-resource]")).toHaveCount(0);
  }
  await expect(page.locator('[data-google-source="ga4"] input:checked')).toHaveCount(1);
  await expect(page.locator('[data-google-source="gsc"] input:checked')).toHaveCount(1);
  await expect(page.locator('[data-google-source="ads"] input:checked')).toHaveCount(1);
  await expect(page.getByRole("button", { name: "ادامه برای دریافت داده", exact: true })).toBeDisabled();
});

test("local cancellation changes only the authorizing source and has no OAuth callback or popup", async ({ page, context }) => {
  await page.goto("/ui-review/websites/connect?ga4=authorizing&gsc=connected&ads=select");
  const ga4 = page.locator('[data-google-source="ga4"]');
  await expect(ga4.getByRole("button", { name: "در انتظار مجوز گوگل…", exact: true })).toBeDisabled();
  await page.locator('[data-google-source="ads"]').getByRole("radio").nth(1).check();
  await ga4.getByRole("button", { name: "لغو مجوزدهی", exact: true }).click();
  await expect(ga4).toHaveAttribute("data-source-state", "cancelled");
  await expect(ga4).toContainText("مجوزدهی گوگل لغو شد و اتصال تازه‌ای ایجاد نشد.");
  await expect(page.locator('[data-google-source="gsc"]')).toHaveAttribute("data-source-state", "connected");
  await expect(page.locator('[data-google-source="ads"]').getByRole("radio").nth(1)).toBeChecked();
  await ga4.getByRole("button", { name: "اتصال حساب گوگل", exact: true }).click();
  await expect(ga4.getByRole("alert")).toContainText("اتصال تازه‌ای ایجاد نشده است");
  expect(context.pages()).toHaveLength(1);
});

test("missing access, empty discovery and revoked permission are distinct from a connected source", async ({ page }) => {
  await page.goto("/ui-review/websites/connect?ga4=no-access&gsc=no-resources&ads=revoked");
  await expect(page.locator('[data-google-source="ga4"]')).toContainText("دسترسی کافی نیست");
  await expect(page.locator('[data-google-source="gsc"]')).toContainText("منبع مجاز پیدا نشد");
  const ads = page.locator('[data-google-source="ads"]');
  await expect(ads).toContainText("مجوز لغو شده");
  await expect(ads).toContainText("منبع منتخب قبلی؛ مجوز معتبر نیست");
  await expect(page.getByRole("button", { name: "ادامه برای دریافت داده", exact: true })).toBeDisabled();
  await ads.getByRole("button", { name: "اتصال دوباره", exact: true }).click();
  await expect(ads.getByRole("alert")).toContainText("اتصال حساب گوگل فعلاً در دسترس نیست");
  await expect(ads).toHaveAttribute("data-source-state", "revoked");
});

test("disconnect confirms the correct source, restores focus on cancel and preserves all connections on error", async ({ page }) => {
  await page.goto("/ui-review/websites/connect?ga4=connected&gsc=connected&ads=revoked");
  const ga4 = page.locator('[data-google-source="ga4"]');
  const trigger = ga4.getByRole("button", { name: "قطع اتصال", exact: true });
  await expect(trigger).toBeEnabled(); await trigger.focus(); await expect(trigger).toBeFocused(); await page.keyboard.press("Enter");
  const group = ga4.getByRole("group", { name: "اتصال این منبع قطع شود؟", exact: true });
  await expect(group).toContainText("Google Analytics 4");
  await expect(group).toContainText("این عملیات فقط اتصال همین منبع و دریافت‌های وابسته به آن را متوقف می‌کند.");
  await expect(group.getByRole("button", { name: "تأیید قطع اتصال", exact: true })).toBeFocused();
  await group.getByRole("button", { name: "انصراف", exact: true }).click();
  await expect(trigger).toBeFocused(); await expect(group).toHaveCount(0);
  await trigger.click(); await group.getByRole("button", { name: "تأیید قطع اتصال", exact: true }).click();
  await expect(ga4.getByRole("alert")).toHaveText("قطع اتصال فعلاً در دسترس نیست. منبع منتخب و اتصال آن حفظ شده‌اند.");
  await expect(ga4.locator("[data-connected-resource]")).toHaveText("UI-REVIEW-GA4-01");
  await expect(page.locator('[data-google-source="gsc"]')).toHaveAttribute("data-source-state", "connected");
  await expect(page.locator('[data-google-source="ads"]')).toHaveAttribute("data-source-state", "revoked");
});

test("disconnect waiting freezes only its source and a second connected source can continue", async ({ page }) => {
  await page.goto("/ui-review/websites/connect?ga4=disconnect-pending&gsc=connected&ads=select");
  const ga4 = page.locator('[data-google-source="ga4"]');
  await expect(ga4.locator('[aria-busy="true"]')).toHaveCount(1);
  await expect(ga4.getByRole("button", { name: "در حال قطع اتصال…", exact: true })).toBeDisabled();
  await expect(ga4.getByRole("button", { name: "انصراف", exact: true })).toBeDisabled();
  await page.locator('[data-google-source="ads"]').getByRole("radio").first().check();
  await expect(page.getByRole("button", { name: "ادامه برای دریافت داده", exact: true })).toBeEnabled();
  await page.getByLabel("سناریوی GA4", { exact: true }).selectOption("disconnected");
  await expect(ga4.locator("[data-connected-resource]")).toHaveCount(0);
  await expect(page.locator('[data-google-source="gsc"]')).toHaveAttribute("data-source-state", "connected");
});

test("unverified ownership blocks every source and URL parameters cannot supply a property or permission", async ({ page }) => {
  await page.goto("/ui-review/websites/connect?site=unverified&ga4=connected&gsc=select&ads=connected&verified=1&property=arbitrary");
  await expect(page.getByText("مالکیت: تأیید نشده", { exact: true })).toBeVisible();
  await expect(page.locator("[data-google-source][data-source-state=disconnected]")).toHaveCount(3);
  await expect(page.locator("[data-connected-resource]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "اتصال حساب گوگل", exact: true })).toHaveCount(3);
  for (const button of await page.getByRole("button", { name: "اتصال حساب گوگل", exact: true }).all()) await expect(button).toBeDisabled();
  await page.getByRole("link", { name: "تأیید مالکیت سایت", exact: true }).click();
  await expect(page).toHaveURL("/ui-review/websites/verify?site=unverified");
  await page.goto("/ui-review/websites/connect?site=arbitrary&ga4=connected&ga4=revoked&gsc=unknown");
  await expect(page.locator('[data-google-source="ga4"]')).toHaveAttribute("data-source-state", "disconnected");
  await expect(page.locator('[data-google-source="gsc"]')).toHaveAttribute("data-source-state", "disconnected");
  await expect(page.locator("[data-google-connections]")).toContainText("www.example.test");
});

test("public site source management preserves guest access and ignores all sample or OAuth flags", async ({ page, context }) => {
  const requests: { method: string; path: string }[] = []; const errors: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push({ method: request.method(), path: new URL(request.url()).pathname }); });
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto("/websites/arbitrary/connect?ga4=connected&gsc=connected&ads=connected&role=admin&code=sample&state=success");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("اتصال منابع گوگل | دیتانو");
  await expect(page.getByText("برای مدیریت منابع سایت، وارد شوید.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-google-source], [data-connected-resource], input[type=radio]")).toHaveCount(0);
  await expect(page.locator('a[href^="/ui-review"]')).toHaveCount(0);
  await page.getByRole("link", { name: "بازگشت به سایت‌های من", exact: true }).click(); await expect(page).toHaveURL("/websites");
  await page.goto("/websites/arbitrary/connect");
  expect(requests).toEqual([]);
  await page.route("**/api/auth/me", route => route.fulfill({ status: 401,
    json: { success: false, message: "Unauthorized", payload: null } }));
  const sessionChecked = page.waitForResponse(response => new URL(response.url()).pathname === "/api/auth/me" && response.status() === 401);
  await page.getByRole("main").getByRole("link", { name: "ورود به حساب", exact: true }).click();
  await sessionChecked;
  await expect(page).toHaveURL("/login");
  await expect(page.getByRole("textbox", { name: "ایمیل", exact: true })).toBeVisible();
  await expect(context.cookies()).resolves.toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every(request => request.method === "GET" && request.path === "/api/auth/me")).toBe(true);
  expect(errors).toEqual([]);
});

test("verification success and the no-connection site navigate to the correct private connection page", async ({ page }) => {
  for (const site of ["unverified", "new"]) {
    await page.goto(`/ui-review/websites/verify?site=${site}&state=success`);
    await page.getByRole("button", { name: "ورود به داشبورد", exact: true }).click();
    await expect(page).toHaveURL(`/ui-review/websites/connect?site=${site === "unverified" ? "proof-example" : "new"}`);
    await expect(page.locator("[data-google-connections]")).toContainText(site === "unverified" ? "example.test" : "new.example.test");
    await expect(page.locator("[data-connected-resource]")).toHaveCount(0);
    await page.getByRole("link", { name: "بازگشت به سایت‌های من", exact: true }).click(); await expect(page).toHaveURL("/ui-review/websites");
  }
  await page.getByRole("button", { name: "انتخاب www.example.test", exact: true }).click();
  await page.getByRole("button", { name: "مشاهده اطلاعات سایت من", exact: true }).click();
  await expect(page).toHaveURL("/ui-review/websites/connect?site=no-connection");
});

test("source selection and operations have no API, OAuth, credential or storage side effects", async ({ page, context }) => {
  const requests: string[] = []; const errors: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/ui-review/websites/connect?ga4=authorizing&gsc=select&ads=connected");
  await page.locator('[data-google-source="ga4"]').getByRole("button", { name: "لغو مجوزدهی", exact: true }).click();
  await page.locator('[data-google-source="gsc"]').getByRole("radio").first().check();
  await page.locator('[data-google-source="gsc"]').getByRole("button", { name: "ثبت اتصال", exact: true }).click();
  const ads = page.locator('[data-google-source="ads"]');
  await ads.getByRole("button", { name: "قطع اتصال", exact: true }).click();
  await ads.getByRole("button", { name: "تأیید قطع اتصال", exact: true }).click();
  await expect(ads.locator("[data-connected-resource]")).toHaveText("UI-REVIEW-ADS-01");
  await expect(context.cookies()).resolves.toEqual([]);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
  expect(context.pages()).toHaveLength(1); expect(requests).toEqual([]); expect(errors).toEqual([]);
});

test("source cards, options and confirmation remain readable in Persian RTL and both themes", async ({ page }, testInfo) => {
  for (const state of ["disconnected", "authorizing", "select", "connected", "cancelled", "no-access", "no-resources", "revoked", "disconnect-confirm", "disconnect-pending", "error"]) {
    await page.goto(`/ui-review/websites/connect?ga4=${state}&gsc=connected&ads=select`);
    await expect(page.locator("html")).toHaveAttribute("lang", "fa"); await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("main")).toHaveCount(1); await expect(page.getByRole("banner")).toHaveCount(1); await expect(page.getByRole("contentinfo")).toHaveCount(1);
    const root = page.locator("[data-google-connections]");
    expect(await root.evaluate((element) => getComputedStyle(element).fontFamily)).toContain("Vazirmatn");
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const dark of [false, true]) {
        await page.evaluate((enabled) => document.documentElement.classList.toggle("dark", enabled), dark);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const clipped = await root.locator("h1, h2, h3, p, a, button, label, dt, dd, legend").evaluateAll((elements) => elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.textContent));
        expect(clipped).toEqual([]);
        if (testInfo.project.name === "desktop" && [390, 1440].includes(width) && ["disconnected", "select", "disconnect-confirm"].includes(state)) await page.screenshot({ path: testInfo.outputPath(`connections-${state}-${width}-${dark ? "dark" : "light"}.png`), fullPage: true, animations: "disabled" });
      }
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.evaluate(() => { document.documentElement.classList.remove("dark"); document.documentElement.style.fontSize = "200%"; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  }
});

test("without JavaScript review actions are inaccessible and public login still works", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage(); await page.goto("/ui-review/websites/connect?ga4=connected");
    await expect(page.getByRole("region", { name: "اتصال منابع گوگل", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "قطع اتصال", exact: true })).toHaveCount(0);
    await page.goto("/websites/arbitrary/connect");
    await page.getByRole("main").getByRole("link", { name: "ورود به حساب", exact: true }).click(); await expect(page).toHaveURL("/login");
  } finally { await context.close(); }
});
