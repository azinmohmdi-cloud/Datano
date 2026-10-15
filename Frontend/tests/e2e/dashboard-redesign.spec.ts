import { test, expect } from "@playwright/test";

test('separate controls lead into three source sections with equal plot dimensions', async ({ page }) => {
  await page.goto('/ui-review/websites/dashboard?traffic=comparison&search=comparison&adsMetric=comparison');
  const site = page.locator('[data-dashboard-site-controls]'), period = page.locator('[data-dashboard-period-controls]');
  await expect(site.getByRole('heading', { name: 'انتخاب سایت', exact: true })).toBeVisible();
  await expect(site.getByLabel('انتخاب سایت', { exact: true })).toBeEnabled();
  await expect(site).toContainText('مالکیت تأیید شده');
  await expect(period.getByLabel('نوع بازه', { exact: true })).toBeEnabled();
  await expect(period.locator('[data-active-range]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'نمای کلی عملکرد', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-source-freshness], [data-kpi-card="ctr"]')).toHaveCount(0);
  const ga4 = page.locator('[data-ga4-performance]');
  await expect(ga4.getByRole('heading', { name: 'Google Analytics 4', exact: true })).toBeVisible();
  await expect(ga4.locator('[data-kpi-card]')).toHaveCount(3);
  await expect(ga4.locator('[data-traffic-overview]')).toBeVisible();
  expect(await page.locator('[data-ga4-performance], [data-search-performance], [data-ads-performance]').evaluateAll(sections => sections.map(section => section.hasAttribute('data-ga4-performance') ? 'ga4' : section.hasAttribute('data-search-performance') ? 'gsc' : 'ads'))).toEqual(['ga4', 'gsc', 'ads']);
  for (const width of [320, 390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const siteBox = await site.boundingBox(), periodBox = await period.boundingBox();
    expect(siteBox).not.toBeNull(); expect(periodBox).not.toBeNull();
    if (!siteBox || !periodBox) throw new Error('Missing control cards');
    if (width >= 1024) {
      expect(siteBox.x).toBeGreaterThan(periodBox.x);
      expect(Math.abs(siteBox.y - periodBox.y)).toBeLessThan(1);
      expect(Math.abs(siteBox.width - periodBox.width)).toBeLessThan(1);
    } else expect(periodBox.y).toBeGreaterThanOrEqual(siteBox.y + siteBox.height);
    const card = await ga4.locator('[data-kpi-card="keyEvents"]').boundingBox(), section = await ga4.boundingBox();
    if (!card || !section) throw new Error('Missing GA4 cards');
    if (width >= 380 && width < 1024) expect(Math.abs(card.width - section.width)).toBeLessThan(1);
    await expect.poll(async () => page.locator('[data-traffic-plot] .recharts-wrapper').evaluateAll(plots => {
      const boxes = plots.map(plot => plot.getBoundingClientRect());
      return boxes.length === 3 && boxes.every(box => box.width > 0 && Math.abs(box.width - boxes[0].width) < 1 && Math.abs(box.height - 320) < 1);
    })).toBe(true);
    const plot = await page.locator('[data-source-trend="gsc"]').boundingBox(), table = await page.locator('[data-search-top-rows]').boundingBox();
    if (!plot || !table) throw new Error('Missing search content');
    expect(table.y).toBeGreaterThanOrEqual(plot.y + plot.height);
    expect(table.y - plot.y - plot.height).toBeLessThanOrEqual(20);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});

test("three independent charts and compact expandable KPIs retain values", async ({ page }) => {
  await page.goto('/ui-review/websites/dashboard');
  await expect(page.locator('[data-source-trend="gsc"] .recharts-surface').first()).toBeVisible();
  await expect(page.locator('[data-source-trend="ads"] .recharts-surface').first()).toBeVisible();
  await expect(page.locator('[data-traffic-plot] .recharts-surface').first()).toBeVisible();
  const users = page.locator('[data-kpi-card="users"]');
  await expect(users.locator('[data-kpi-value]')).toHaveText('۱٬۲۳۴');
  const details = users.locator('details');
  await expect(details).not.toHaveAttribute('open');
  await details.locator('summary').click();
  await expect(details).toHaveAttribute('open', '');
  await expect(details).toContainText('کل بازه');
  await details.locator('summary').click();
  await expect(users.locator('[data-kpi-value]')).toHaveText('۱٬۲۳۴');
});

test('metric switches preserve units, aggregate KPIs and independent source charts', async ({ page }) => {
  await page.goto('/ui-review/websites/dashboard?adsMetric=kwd');
  const ga4 = page.locator('[data-traffic-overview]'), gsc = page.locator('[data-source-trend="gsc"]'), ads = page.locator('[data-source-trend="ads"]');
  await ga4.getByRole('combobox').selectOption('totalUsers');
  await expect(ga4).toContainText('جمع روزها تعداد کاربران یکتای کل بازه نیست');
  await expect(page.locator('[data-kpi-card="users"] [data-kpi-value]')).toHaveText('۱٬۲۳۴');
  await gsc.getByRole('combobox').selectOption('impressions');
  await expect(gsc).toContainText('نمایش‌ها · نمایش');
  await expect(ads).toContainText('هزینه · KWD');
  await ads.getByRole('combobox').selectOption('conversions');
  await expect(ads).toContainText('تبدیل‌ها · تبدیل');
  await expect(page.locator('[data-ads-metric="cost"] [data-ads-value]')).toHaveText('۱٬۰۰۰');
  await expect(gsc.getByRole('combobox')).toHaveValue('impressions');
});

test('daily empty, partial, loading and error states do not replace independent aggregates', async ({ page }) => {
  for (const scenario of ['empty', 'gaps', 'loading', 'error']) {
    await page.goto(`/ui-review/websites/dashboard?trend=${scenario}`);
    for (const source of ['gsc', 'ads']) {
      const chart = page.locator(`[data-source-trend="${source}"]`);
      if (scenario === 'gaps') {
        await expect(chart).toContainText('داده ناقص');
        await chart.getByText(source === 'gsc' ? 'جدول روزانهٔ کلیک‌ها' : 'جدول روزانهٔ هزینه', { exact: true }).click();
        await expect(chart.locator('[data-daily-current]').first()).toContainText('۰ صفر ثبت‌شده');
        await expect(chart.locator('[data-daily-current]').nth(3)).toContainText('— مقدار موجود نیست');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      } else {
        await expect(chart.locator('.recharts-wrapper')).toHaveCount(0);
        await expect(chart).toContainText(scenario === 'empty' ? 'دادهٔ روزانه‌ای برای این بازه موجود نیست' : scenario === 'loading' ? 'در حال دریافت روند' : 'دریافت روند ناموفق بود');
      }
    }
    await expect(page.locator('[data-search-metric="clicks"] [data-search-value]')).toHaveText('۱۲۰');
    await expect(page.locator('[data-ads-metric="cost"] [data-ads-value]')).toHaveText('۱٬۰۰۰');
  }
});

test('new charts compare actual dates chronologically and expose Persian keyboard tooltips', async ({ page }) => {
  await page.goto('/ui-review/websites/dashboard?search=comparison&adsMetric=comparison');
  for (const source of ['gsc', 'ads']) {
    const chart = page.locator(`[data-source-trend="${source}"]`);
    await expect(chart.locator('[data-traffic-plot]')).toHaveCSS('direction', 'ltr');
    await chart.locator('.recharts-surface').focus();
    await page.keyboard.press('ArrowRight');
    const tooltip = chart.locator('[data-traffic-tooltip]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(source === 'gsc' ? '۱۴۰۵/۰۶/۲۳' : '۱۴۰۵/۰۶/۲۵');
    await expect(tooltip).toContainText(source === 'gsc' ? '۱۴۰۵/۰۵/۲۶' : '۱۴۰۵/۰۵/۲۸');
    if (source === 'ads') await expect(tooltip).toContainText('USD');
    await page.keyboard.press('Escape');
    await expect(tooltip).not.toBeVisible();
    await chart.getByText(source === 'gsc' ? 'جدول روزانهٔ کلیک‌ها' : 'جدول روزانهٔ هزینه', { exact: true }).click();
    const days = await chart.locator('[data-traffic-day]').evaluateAll(rows => rows.map(row => row.getAttribute('data-traffic-day')));
    expect(days).toHaveLength(28); expect(days).toEqual([...days].sort());
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
  await page.getByRole('checkbox', { name: 'مقایسه با بازهٔ قبلی هم‌اندازه', exact: true }).click();
  await expect(page.locator('[data-source-trend] [data-daily-previous]')).toHaveCount(0);
});

test('new chart exact queries follow Apply and cannot reuse top rows or another account', async ({ page }) => {
  await page.goto('/ui-review/websites/dashboard?search=no-totals&ads=permission-error');
  await expect(page.locator('[data-source-trend] .recharts-wrapper')).toHaveCount(0);
  await expect(page.locator('[data-search-row]')).toHaveCount(2);
  await page.goto('/ui-review/websites/dashboard');
  await page.getByLabel('نوع بازه', { exact: true }).selectOption('custom');
  await page.getByRole('textbox', { name: 'از تاریخ شمسی', exact: true }).fill('۱۴۰۵/۰۷/۰۱');
  await page.getByRole('textbox', { name: 'تا تاریخ شمسی', exact: true }).fill('۱۴۰۵/۰۷/۱۸');
  await expect(page.locator('[data-source-trend="gsc"] [data-traffic-series="current"]')).toContainText('۱۴۰۵/۰۶/۲۲');
  await page.getByRole('button', { name: 'اعمال بازه', exact: true }).click();
  for (const source of ['gsc', 'ads']) await expect(page.locator(`[data-source-trend="${source}"] [data-traffic-series="current"]`)).toContainText('۱۴۰۵/۰۷/۰۱ تا ۱۴۰۵/۰۷/۱۸');
  await page.getByRole('textbox', { name: 'تا تاریخ شمسی', exact: true }).fill('۱۴۰۵/۰۷/۱۷');
  await page.getByRole('button', { name: 'اعمال بازه', exact: true }).click();
  await expect(page.locator('[data-source-trend] .recharts-wrapper')).toHaveCount(0);
});

test('compact layout, disclosures and three charts fit themes, zoom and small screens', async ({ page }, testInfo) => {
  await page.goto('/ui-review/websites/dashboard?traffic=comparison&search=comparison&adsMetric=comparison');
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await expect(page.locator('[data-review-tools]')).not.toHaveAttribute('open');
  for (const width of [320, 390, 768, 1440]) for (const dark of [false, true]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    for (const key of ['gsc', 'ads']) {
      const chart = page.locator(`[data-source-trend="${key}"]`);
      await expect(chart.locator('.recharts-surface')).toBeVisible();
      await expect(chart.locator('.recharts-surface')).toHaveCSS('font-family', /Vazirmatn/);
    }
  }
  if (testInfo.project.name === 'desktop') {
    await page.screenshot({ path: '/private/tmp/datano-redesign-final-desktop-dark.png', fullPage: true });
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    await page.screenshot({ path: '/private/tmp/datano-redesign-final-desktop.png', fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.documentElement.style.fontSize = '200%');
  const detail = page.locator('[data-ads-metric="cost"] summary');
  await detail.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-ads-metric="cost"] details')).toHaveAttribute('open', '');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await detail.press('Enter');
  await page.evaluate(() => document.documentElement.style.fontSize = '');
  await page.screenshot({ path: `/private/tmp/datano-redesign-final-${testInfo.project.name}-390.png`, fullPage: true });
  expect(errors).toEqual([]);
});
