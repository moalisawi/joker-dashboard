/**
 * Custom Playwright fixture that restores Firebase auth (IDB + localStorage)
 * from the file saved by global.setup.ts — so every test starts logged-in
 * without repeating the UI login flow.
 */
import { test as base, Browser, Page, BrowserContext } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '../../playwright/.auth/state.json');

type AuthFixtures = { authedPage: Page };

export const test = base.extend<AuthFixtures>({
  authedPage: async ({ browser }: { browser: Browser }, use: (page: Page) => Promise<void>) => {
    const { cookies, localStorage: ls, idbEntries } = JSON.parse(
      fs.readFileSync(AUTH_FILE, 'utf-8'),
    );

    // Build storageState from saved data
    const origins = ls.length
      ? [{ origin: 'http://localhost:3000', localStorage: ls }]
      : [];

    const ctx: BrowserContext = await browser.newContext({
      storageState: { cookies, origins },
    });

    // Inject Firebase IndexedDB entries before any page script runs
    if (idbEntries?.length) {
      await ctx.addInitScript((entries: { fbase_key: string; value: unknown }[]) => {
        const inject = () => {
          const req = indexedDB.open('firebaseLocalStorageDb', 1);
          req.onupgradeneeded = (e: any) => {
            const db: IDBDatabase = e.target.result;
            if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
              db.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' });
            }
          };
          req.onsuccess = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('firebaseLocalStorage')) return;
            const tx    = db.transaction('firebaseLocalStorage', 'readwrite');
            const store = tx.objectStore('firebaseLocalStorage');
            for (const entry of entries) store.put(entry);
          };
        };
        // Run immediately and also after DOMContentLoaded to be safe
        inject();
        window.addEventListener('DOMContentLoaded', inject, { once: true });
      }, idbEntries);
    }

    const page: Page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
});

export { expect } from '@playwright/test';
