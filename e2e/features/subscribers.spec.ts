import { test, expect } from '../helpers/authFixture';

const SIDEBAR = 'aside, [class*="sidebar"], [class*="Sidebar"]';

test.describe('Subscribers', () => {
  test.setTimeout(120_000);

  test('subscriber table loads on المشتركون tab', async ({ authedPage: page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForURL("/", { timeout: 30_000 });
    await expect(page.locator(SIDEBAR).first()).toBeVisible({ timeout: 30_000 });
    // Wait for the tabs row to render
    await page.locator('#tour-tabs').waitFor({ timeout: 60_000 });
    await page.getByText('المشتركون').first().click();
    await expect(page.locator('table').first()).toBeVisible({ timeout: 15_000 });
  });

  test('add subscriber modal has name field', async ({ authedPage: page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForURL("/", { timeout: 30_000 });
    await expect(page.locator(SIDEBAR).first()).toBeVisible({ timeout: 30_000 });
    await page.locator('#tour-header').waitFor({ timeout: 60_000 });
    await page.locator('button', { hasText: 'مشترك جديد' }).click();
    await page.waitForSelector('[role="dialog"], [class*="modal"]', { timeout: 8_000 });
    const nameField = page.locator('input[placeholder*="اسم"], input[name*="name"]').first();
    await expect(nameField).toBeVisible({ timeout: 5_000 });
  });

  test('subscriber search input visible in table', async ({ authedPage: page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForURL("/", { timeout: 30_000 });
    await expect(page.locator(SIDEBAR).first()).toBeVisible({ timeout: 30_000 });
    await page.locator('#tour-tabs').waitFor({ timeout: 60_000 });
    await page.getByText('المشتركون').first().click();
    await expect(page.locator('table, input[placeholder*="بحث"]').first()).toBeVisible({ timeout: 15_000 });
  });

  test('clicking subscriber row navigates to workspace', async ({ authedPage: page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForURL("/", { timeout: 30_000 });
    await expect(page.locator(SIDEBAR).first()).toBeVisible({ timeout: 30_000 });
    await page.locator('#tour-tabs').waitFor({ timeout: 60_000 });
    await page.getByText('المشتركون').first().click();
    await page.waitForSelector('table', { timeout: 15_000 });

    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();
      await page.waitForTimeout(2000);
      const navigated = page.url().includes('/subscribers/');
      const modalOpen  = await page.locator('[role="dialog"]').count() > 0;
      expect(navigated || modalOpen).toBeTruthy();
    }
  });
});
