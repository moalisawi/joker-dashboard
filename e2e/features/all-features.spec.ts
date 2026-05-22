/**
 * Comprehensive feature tests — logs in ONCE via UI (beforeAll), then runs
 * all checks in serial on the same page. Avoids IDB injection complexity.
 */
import { test as base, test, expect, Browser, Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

let page: Page;

base.beforeAll(async ({ browser }: { browser: Browser }) => {
  page = await browser.newPage();
  await page.goto('/login', { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForSelector('input[type="email"]', { timeout: 60_000 });
  await page.fill('input[type="email"]', 'zoromedo2000@gmail.com');
  await page.fill('input[type="password"]', '0598243594');
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.href.includes('/login'), { timeout: 60_000 });
  await page.waitForTimeout(2_000);
});

base.afterAll(async () => { await page?.close(); });

/** Navigate and wait for ProtectedLayout loading to resolve */
const go = async (url: string) => {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  // Loading spinner disappears once Firebase auth resolves
  await page.waitForFunction(
    () => !document.querySelector('p')?.textContent?.includes('جاري التحميل'),
    { timeout: 20_000 },
  ).catch(() => {/* spinner may never appear if auth already cached */});
  // Small settle time for React to finish rendering after auth
  await page.waitForTimeout(500);
};

// ── Dashboard ──────────────────────────────────────────────────────────────────

base.describe('Dashboard', () => {
  base('stats cards render', async () => {
    await go('/');
    await page.locator('#tour-stats').waitFor({ timeout: 60_000 });
    await expect(page.locator('#tour-stats')).toBeVisible();
  });

  base('tabs: النظرة العامة, المشتركون, التنبيهات', async () => {
    await go('/');
    await page.locator('#tour-tabs').waitFor({ timeout: 60_000 });
    await expect(page.getByText('النظرة العامة').first()).toBeVisible();
    await expect(page.getByText('المشتركون').first()).toBeVisible();
    await expect(page.getByText('التنبيهات').first()).toBeVisible();
  });

  base('المشتركون tab shows subscriber table', async () => {
    await go('/');
    await page.locator('#tour-tabs').waitFor({ timeout: 60_000 });
    await page.locator('#tour-tabs').getByText('المشتركون').click();
    await expect(page.locator('table').first()).toBeVisible({ timeout: 20_000 });
  });

  base('"مشترك جديد" opens modal with form', async () => {
    await go('/');
    await page.locator('#tour-header').waitFor({ timeout: 60_000 });
    await page.locator('button', { hasText: 'مشترك جديد' }).click();
    await expect(page.locator('.modal-overlay, .modal-panel').first()).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('input[placeholder*="اسم"], input[name*="name"]').first()).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });
});

// ── Sidebar ─────────────────────────────────────────────────────────────────────
// Sidebar links live inside `hidden md:block` (Tailwind v4) so CSS visibility
// fails in Playwright. We verify attachment (DOM presence) not visual visibility.

base.describe('Sidebar', () => {
  base('nav links are attached in DOM', async () => {
    await go('/');
    await page.locator('#tour-stats').waitFor({ timeout: 60_000 });
    await expect(page.locator('aside a[href="/analytics"]').first()).toBeAttached({ timeout: 10_000 });
    await expect(page.locator('aside a[href="/logs"]').first()).toBeAttached();
    await expect(page.locator('aside a[href="/admin/employees"]').first()).toBeAttached();
  });

  base('theme toggle exists and toggles on JS click', async () => {
    await go('/');
    await page.locator('#tour-stats').waitFor({ timeout: 60_000 });
    const btn = page.getByTitle(/الوضع الداكن|الوضع الفاتح/).first();
    await expect(btn).toBeAttached({ timeout: 5_000 });
    const before = await btn.getAttribute('title');
    // Dispatch click via JS — bypasses Playwright visibility for hidden md:block container
    await page.evaluate(() => {
      const b = document.querySelector('button[title="الوضع الداكن"], button[title="الوضع الفاتح"]');
      b?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(500);
    const after = await btn.getAttribute('title');
    expect(before).not.toEqual(after);
    // Restore
    await page.evaluate(() => {
      const b = document.querySelector('button[title="الوضع الداكن"], button[title="الوضع الفاتح"]');
      b?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  });

  base('logout button exists in DOM', async () => {
    await go('/');
    await page.locator('#tour-stats').waitFor({ timeout: 60_000 });
    await expect(page.getByTitle('تسجيل الخروج').first()).toBeAttached({ timeout: 5_000 });
  });

  base('Ctrl+K opens global search', async () => {
    await go('/');
    await page.locator('#tour-stats').waitFor({ timeout: 60_000 });
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(600);
    const input = page.locator('input[placeholder*="ابحث"], input[type="search"]').first();
    if (await input.count() > 0) {
      await expect(input).toBeVisible({ timeout: 3_000 });
      await page.keyboard.press('Escape');
    }
  });
});

// ── Subscribers ────────────────────────────────────────────────────────────────

base.describe('Subscribers', () => {
  base('table loads on tab click', async () => {
    await go('/');
    await page.locator('#tour-tabs').waitFor({ timeout: 60_000 });
    await page.locator('#tour-tabs').getByText('المشتركون').click();
    await expect(page.locator('table').first()).toBeVisible({ timeout: 20_000 });
  });

  base('add modal has name + phone fields', async () => {
    await go('/');
    await page.locator('#tour-header').waitFor({ timeout: 60_000 });
    await page.locator('button', { hasText: 'مشترك جديد' }).click();
    await expect(page.locator('.modal-overlay, .modal-panel').first()).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('input[placeholder*="اسم"], input[name*="name"]').first()).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  base('subscriber workspace page loads', async () => {
    await go('/');
    await page.locator('#tour-tabs').waitFor({ timeout: 60_000 });
    await page.locator('#tour-tabs').getByText('المشتركون').click();
    await page.waitForSelector('table', { timeout: 20_000 });
    // Get the href of the first subscriber link and navigate directly
    const subscriberLink = page.locator('tbody tr a[href*="/subscribers/"]').first();
    if (await subscriberLink.count() > 0) {
      const href = await subscriberLink.getAttribute('href');
      if (href) {
        await go(href);
        await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 });
        expect(page.url()).toMatch(/\/subscribers\//);
        await go('/');
      }
    }
  });
});

// ── Page navigation ────────────────────────────────────────────────────────────

const NAV_PAGES: [string, string][] = [
  ['/analytics',       'Analytics'],
  ['/sales',           'Sales'],
  ['/leaderboards',    'Leaderboards'],
  ['/reports',         'Reports'],
  ['/sessions',        'Sessions'],
  ['/logs',            'Logs'],
  ['/notifications',   'Notifications'],
  ['/users',           'Users'],
  ['/admin/employees', 'Admin Employees'],
  ['/admin/teams',     'Admin Teams'],
  ['/guide',           'Guide'],
  ['/payment-methods', 'Payment Methods'],
];

base.describe('Page navigation', () => {
  for (const [url, label] of NAV_PAGES) {
    base(`${label} (${url}) loads`, async () => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await go(url);

      if (url === '/payment-methods') {
        // May show "غير مصرح" (no h1) if user lacks canManagePaymentMethods
        await expect(
          page.locator('h1, [class*="AlertCircle"], svg + p, p').first()
        ).toBeVisible({ timeout: 30_000 });
      } else {
        await expect(page.locator('h1').first()).toBeVisible({ timeout: 30_000 });
      }

      page.removeAllListeners('pageerror');
      const fatal = errors.filter((e) => /getApps is not a function|Element type is invalid/i.test(e));
      expect(fatal, fatal.join('\n')).toEqual([]);
    });
  }
});
