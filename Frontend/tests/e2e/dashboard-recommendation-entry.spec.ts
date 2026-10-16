import { test, expect } from "@playwright/test";

const entrySelector = '[data-dashboard-recommendations-entry]';
const actionName = 'مشاهده پیشنهادهای تحلیلی';

test('one compact entry follows Ads ROAS and precedes source coverage without inline recommendations', async ({ page }) => {
  await page.goto('/ui-review/websites/dashboard');
  const entry = page.locator(entrySelector);
  await expect(entry).toHaveCount(1);
  await expect(entry.getByRole('heading', { name: 'از تحلیل تا تصمیم بهتر', exact: true })).toBeVisible();
  await expect(entry).toContainText('حالا که عملکرد سایتت رو بررسی کردی، پیشنهادهای تحلیلی دیتانو رو هم ببین تا فرصت‌های بهبود رو بهتر بشناسی.');
  await expect(entry.getByRole('link', { name: actionName, exact: true })).toHaveAttribute('href', '/ui-review/websites/recommendations?site=report-ready');
  expect(await entry.evaluate(node => {
    const ads = document.querySelector('[data-ads-performance]');
    const coverage = document.querySelector('[data-dashboard-source]')?.closest('section');
    return node.previousElementSibling === ads && ads?.lastElementChild?.tagName === 'DETAILS' && ads.lastElementChild.textContent?.includes('ROAS') && Boolean(coverage && (node.compareDocumentPosition(coverage) & Node.DOCUMENT_POSITION_FOLLOWING));
  })).toBe(true);
  await expect(page.locator('[data-traffic-plot]')).toHaveCount(3);
  await expect(page.locator('[data-kpi-card]')).toHaveCount(3);
  await expect(page.locator('[data-search-metric]')).toHaveCount(4);
  await expect(page.locator('[data-ads-metric]')).toHaveCount(5);
  await expect(page.locator('[data-recommendation-row], [data-recommendations]')).toHaveCount(0);
});

test('actual entry and return clicks keep either selected site and inline details stay on the list', async ({ page }) => {
  await page.goto('/ui-review/websites/dashboard');
  for (const [site, domain] of [['report-ready', 'marketing-performance-team.reports.example.test'], ['report-empty', 'empty.example.test']]) {
    await page.getByLabel('انتخاب سایت', { exact: true }).selectOption(site);
    const link = page.locator(entrySelector).getByRole('link', { name: actionName, exact: true });
    await expect(link).toHaveAttribute('href', `/ui-review/websites/recommendations?site=${site}`);
    await link.click();
    await expect(page).toHaveURL(`/ui-review/websites/recommendations?site=${site}`);
    await expect(page.locator('[data-recommendation-site]')).toContainText(domain);
    const row = page.locator('[data-recommendation-row]').first();
    await row.getByRole('button', { name: 'مشاهده دلیل و شواهد', exact: true }).click();
    await expect(row.getByRole('heading', { name: 'دلیل ایجاد پیشنهاد', exact: true })).toBeVisible();
    await expect(page).toHaveURL(`/ui-review/websites/recommendations?site=${site}`);
    await page.getByRole('link', { name: 'داشبورد سایت', exact: true }).click();
    await expect(page).toHaveURL(`/ui-review/websites/dashboard?site=${site}`);
    await expect(page.getByLabel('انتخاب سایت', { exact: true })).toHaveValue(site);
  }
  await page.locator(entrySelector).getByRole('link', { name: actionName, exact: true }).click();
  await page.locator('[data-review-tools] > summary').click();
  await page.getByLabel('سناریوی پیشنهادها', { exact: true }).selectOption('none');
  await expect(page.getByText('پیشنهادی برای بررسی وجود ندارد.', { exact: true })).toBeVisible();
  await expect(page.locator('[data-recommendation-row]')).toHaveCount(0);
  await page.getByRole('link', { name: 'داشبورد سایت', exact: true }).click();
  await expect(page.getByLabel('انتخاب سایت', { exact: true })).toHaveValue('report-empty');
});

test('entry fits mobile desktop dark mode and enlarged Persian text without changing dashboard gates', async ({ page }) => {
  await page.goto('/ui-review/websites/dashboard');
  const entry = page.locator(entrySelector);
  for (const width of [320, 390, 1440]) for (const dark of [false, true]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
    await expect(entry).toBeVisible();
    await expect(entry).toHaveCSS('font-family', /Vazirmatn/);
    await expect(entry.locator('.lucide-lightbulb')).toBeVisible();
    expect(await entry.evaluate(node => { const r = node.getBoundingClientRect(); return r.left >= 0 && r.right <= document.documentElement.clientWidth; })).toBe(true);
    if (width === 1440) expect((await entry.boundingBox())?.height).toBeLessThan(190);
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.evaluate(() => document.documentElement.style.fontSize = '200%');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const link = entry.getByRole('link', { name: actionName, exact: true });
  await link.focus(); await expect(link).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/ui-review/websites/recommendations?site=report-ready');
  for (const query of ['site=unverified', 'site=waiting', 'view=loading', 'view=error']) {
    await page.goto(`/ui-review/websites/dashboard?${query}`);
    await expect(page.locator(entrySelector)).toHaveCount(0);
  }
});
