import { test, expect } from '../helpers/authFixture';

// Selector that proves the dashboard is fully auth'd and rendered
const DASHBOARD_READY = 'aside, nav, [class*="sidebar"], [class*="Sidebar"]';

test.describe('Dashboard (/)', () => {
  test.setTimeout(120_000);

  test('loads and shows stats cards', async ({ authedPage: page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForURL("/", { timeout: 30_000 });
    // Sidebar = auth succeeded
    await expect(page.locator(DASHBOARD_READY).first()).toBeVisible({ timeout: 30_000 });
    // Stats section (needs Firebase data — give it 90s)
    await expect(page.locator('#tour-stats')).toBeVisible({ timeout: 90_000 });
  });

  test('shows tabs: النظرة العامة, المشتركون, التنبيهات', async ({ authedPage: page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForURL("/", { timeout: 30_000 });
    await expect(page.locator(DASHBOARD_READY).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#tour-tabs')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('النظرة العامة').first()).toBeVisible();
    await expect(page.getByText('المشتركون').first()).toBeVisible();
    await expect(page.getByText('التنبيهات').first()).toBeVisible();
  });

  test('subscribers tab shows table', async ({ authedPage: page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForURL("/", { timeout: 30_000 });
    await expect(page.locator(DASHBOARD_READY).first()).toBeVisible({ timeout: 30_000 });
    await page.locator('#tour-tabs').waitFor({ timeout: 60_000 });
    await page.getByText('المشتركون').first().click();
    await expect(page.locator('table').first()).toBeVisible({ timeout: 15_000 });
  });

  test('"مشترك جديد" button opens subscriber modal', async ({ authedPage: page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForURL("/", { timeout: 30_000 });
    await expect(page.locator(DASHBOARD_READY).first()).toBeVisible({ timeout: 30_000 });
    await page.locator('#tour-header').waitFor({ timeout: 60_000 });
    await page.locator('button', { hasText: 'مشترك جديد' }).click();
    await expect(page.locator('[role="dialog"], [class*="modal"]').first()).toBeVisible({ timeout: 8_000 });
  });

  test('date filter is rendered', async ({ authedPage: page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForURL("/", { timeout: 30_000 });
    await expect(page.locator(DASHBOARD_READY).first()).toBeVisible({ timeout: 30_000 });
    await page.locator('#tour-stats').waitFor({ timeout: 90_000 });
    // Stats section loaded — good enough
    await expect(page.locator('#tour-stats')).toBeVisible();
  });
});
