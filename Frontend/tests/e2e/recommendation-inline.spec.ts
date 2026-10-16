import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const list = "/ui-review/websites/recommendations?site=report-ready&scenario=all-sources";
const path = "tests/e2e/fixtures/recommendation-list-closed-baseline.json";

test("approved closed card content and styling are preserved around the additive disclosure", async ({ page }) => {
  const baseline = JSON.parse(await readFile(path, "utf8"));
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(list);
    await expect(page.getByLabel("منبع پیشنهادها", { exact: true })).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);
    const result = await page.locator('[data-recommendation-row]').evaluateAll((rows) => rows.map((row) => {
      const article = row.querySelector('article');
      if (!article) throw new Error('Missing original card article');
      const box = article.getBoundingClientRect();
      const style = getComputedStyle(row);
      return {
        classes: row.className, articleClasses: article.className, text: article.textContent,
        width: box.width, height: box.height, padding: style.padding, color: style.color, background: style.backgroundColor, radius: style.borderRadius,
        children: Array.from(article.children).map((el) => ({ tag: el.tagName, classes: el.className, text: el.textContent, height: el.getBoundingClientRect().height })),
        icons: Array.from(article.querySelectorAll('svg')).map((svg) => svg.outerHTML),
      };
    }));
    expect(result).toEqual(baseline[String(width)]);
    await page.screenshot({ path: `/private/tmp/datano-inline-closed-${width}.png`, fullPage: true });
  }
});

test("each existing card opens and closes reason and evidence in place independently", async ({ page }) => {
  await page.goto(list);
  const rows = page.locator('[data-recommendation-row]');
  const originalUrl = page.url();
  const first = rows.nth(0), second = rows.nth(1);
  const toggle = first.getByRole('button', { name: 'مشاهده دلیل و شواهد', exact: true });
  await expect(toggle).toBeEnabled();
  await expect(toggle).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const initialHeight = (await first.boundingBox())?.height;
  await toggle.focus(); await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(first.getByRole('heading', { name: 'دلیل ایجاد پیشنهاد', exact: true })).toBeVisible();
  await expect(first.locator('[data-evidence]')).toContainText('۱٬۰۵۰');
  await expect(first.locator('[data-evidence]')).toContainText('۱٬۵۰۰');
  expect(await first.locator('[data-recommendation-detail] h2').allTextContents()).toEqual(['دلیل ایجاد پیشنهاد', 'شواهد تحلیلی', 'قاعدهٔ تحلیلی', 'پیش‌نمایش پیگیری', 'تاریخچه و پیگیری']);
  await first.screenshot({ path: `/private/tmp/datano-inline-open-${test.info().project.name}.png` });
  await expect(second.getByRole('button', { name: 'مشاهده دلیل و شواهد', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await second.getByRole('button', { name: 'مشاهده دلیل و شواهد', exact: true }).click();
  await expect(second.locator('[data-evidence]')).toContainText('۱٪');
  await second.getByLabel('وضعیت نمایشی', { exact: true }).selectOption('reviewed');
  await second.getByRole('button', { name: 'اعمال نمایشی وضعیت', exact: true }).click();
  await expect(first.locator('[data-evidence]')).toBeVisible();
  await toggle.focus(); await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(first.locator('[data-evidence]')).toHaveCount(0);
  await expect(second.locator('[data-evidence]')).toBeVisible();
  expect((await first.boundingBox())?.height).toBe(initialHeight);
  await expect(second.locator('[data-tracking-preview-result]')).toContainText('بررسی شده');
  await expect(second.locator('[data-recorded-summary]')).toContainText('در حال بررسی');
  expect(page.url()).toBe(originalUrl);
});

test("legacy and direct links open the correct card and cannot hide it behind a source filter", async ({ page }) => {
  await page.goto('/ui-review/websites/recommendations/UI_REVIEW_RECOMMENDATION_ADS?site=report-ready&scenario=all-sources&source=gsc');
  await expect(page).toHaveURL(/\/ui-review\/websites\/recommendations\?/);
  expect(new URL(page.url()).searchParams.get('recommendation')).toBe('UI_REVIEW_RECOMMENDATION_ADS');
  await expect(page.getByLabel('منبع پیشنهادها', { exact: true })).toHaveValue('all');
  const rows = page.locator('[data-recommendation-row]');
  await expect(rows.nth(2).getByRole('button', { name: 'مشاهده دلیل و شواهد', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect(rows.nth(2).getByRole('button', { name: 'مشاهده دلیل و شواهد', exact: true })).toBeInViewport();
  await expect(rows.nth(0).getByRole('button', { name: 'مشاهده دلیل و شواهد', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(rows.nth(2).locator('[data-evidence]')).toContainText('USD');
  await page.goto('/ui-review/websites/recommendations?site=report-empty&scenario=single&source=gsc&recommendation=UI_REVIEW_RECOMMENDATION_GSC');
  await expect(page.getByLabel('منبع پیشنهادها', { exact: true })).toHaveValue('gsc');
  await expect(rows).toHaveCount(1);
  await expect(rows.locator('[data-recorded-summary]')).toContainText('empty.example.test');
  await expect(rows.locator('[data-evidence]')).toContainText('۱٪');
});

test("filtering and site selection retain all existing behaviors while details are open", async ({ page }) => {
  await page.goto(list);
  const rows = page.locator('[data-recommendation-row]');
  await rows.first().getByRole('button', { name: 'مشاهده دلیل و شواهد', exact: true }).click();
  await page.getByLabel('منبع پیشنهادها', { exact: true }).selectOption('gsc');
  await expect(rows).toHaveCount(1);
  await expect(rows.locator('[data-evidence]')).toHaveCount(0);
  await expect(rows).toContainText('Search Console');
  await page.getByLabel('منبع پیشنهادها', { exact: true }).selectOption('all');
  await expect(rows).toHaveCount(3);
  await expect(rows.first().getByRole('button', { name: 'مشاهده دلیل و شواهد', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await page.locator('[data-review-tools] > summary').click();
  await page.getByLabel('سایت نمونه', { exact: true }).selectOption('report-empty');
  await expect(page.getByLabel('منبع پیشنهادها', { exact: true })).toHaveValue('all');
  await expect(rows).toHaveCount(3);
  await expect(page.locator('[data-recommendation-detail]')).toHaveCount(0);
  await expect(page.locator('[data-recommendation-site]')).toContainText('empty.example.test');
});
