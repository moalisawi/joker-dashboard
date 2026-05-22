import { test, expect } from '../helpers/authFixture';

// Pages — waitFor is the first meaningful selector that appears after auth
const PAGES = [
  { url: '/',                label: 'Dashboard',          waitFor: 'aside, [class*="sidebar"]' },
  { url: '/analytics',       label: 'Analytics',          waitFor: 'h1'                        },
  { url: '/sales',           label: 'Sales',              waitFor: 'h1'                        },
  { url: '/leaderboards',    label: 'Leaderboards',       waitFor: 'h1'                        },
  { url: '/reports',         label: 'Reports',            waitFor: 'h1'                        },
  { url: '/sessions',        label: 'Sessions',           waitFor: 'h1'                        },
  { url: '/logs',            label: 'Logs',               waitFor: 'h1'                        },
  { url: '/notifications',   label: 'Notifications',      waitFor: 'h1'                        },
  { url: '/users',           label: 'Users',              waitFor: 'h1'                        },
  { url: '/admin/employees', label: 'Admin Employees',    waitFor: 'h1'                        },
  { url: '/admin/teams',     label: 'Admin Teams',        waitFor: 'h1'                        },
  { url: '/guide',           label: 'Guide',              waitFor: 'h1'                        },
  { url: '/payment-methods', label: 'Payment Methods',    waitFor: 'h1'                        },
];

test.describe('Page navigation', () => {
  test.setTimeout(120_000);

  for (const { url, label, waitFor } of PAGES) {
    test(`${label} (${url}) loads without crash`, async ({ authedPage: page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));

      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // Must not bounce back to /login
      await page.waitForURL((u) => !u.href.includes('/login'), { timeout: 30_000 });

      // Key element visible (sidebar or h1 from PageHeader)
      await expect(page.locator(waitFor).first()).toBeVisible({ timeout: 60_000 });

      const fatal = errors.filter((e) =>
        /getApps is not a function|Element type is invalid|Cannot read prop/i.test(e),
      );
      expect(fatal, `Fatal errors on ${url}:\n${errors.join('\n')}`).toEqual([]);
    });
  }
});
