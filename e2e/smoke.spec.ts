import { test, expect } from '@playwright/test';

/**
 * Smoke tests — verify the app boots, key routes respond, and there are no
 * runtime errors in the browser console. These intentionally avoid anything
 * that requires authentication (use auth-state setup for those).
 */

test.describe('App smoke', () => {
  test.setTimeout(90_000);

  test('protected root redirects unauthenticated users to /login', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Use domcontentloaded — the app polls session heartbeat, so networkidle
    // never settles. The redirect happens client-side once auth resolves.
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    await page.waitForURL(/\/login$/, { timeout: 30_000 });
    expect(page.url()).toMatch(/\/login$/);

    const fatal = consoleErrors.filter((e) =>
      /getApps is not a function|Element type is invalid|Cannot read prop/i.test(e),
    );
    expect(fatal, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });

  test('login page renders form controls', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitButton = page
      .locator('button[type="submit"], button:has-text("دخول"), button:has-text("تسجيل")')
      .first();

    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test('login form rejects empty submission', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const submitButton = page
      .locator('button[type="submit"], button:has-text("دخول"), button:has-text("تسجيل")')
      .first();

    await submitButton.click();

    // Should NOT navigate away from /login on empty/invalid submit.
    await page.waitForTimeout(1000);
    expect(page.url()).toMatch(/\/login/);
  });

  test('login page loads without fatal client-side errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('load', { timeout: 30_000 });

    const fatal = errors.filter((e) =>
      /getApps is not a function|Element type is invalid|Lazy element type/i.test(e),
    );
    expect(fatal, `unexpected fatal errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('static document is rendered with arabic RTL direction', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const dir = await page.locator('html').getAttribute('dir');
    const lang = await page.locator('html').getAttribute('lang');
    expect(dir).toBe('rtl');
    expect(lang).toBe('ar');
  });
});
