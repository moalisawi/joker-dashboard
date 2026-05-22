/**
 * Runs ONCE before all test projects.
 * Logs in via UI, saves IDB (Firebase) + cookies + localStorage to disk.
 */
import { test as setup } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '../playwright/.auth/state.json');

setup('save auth state', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'networkidle', timeout: 60_000 });

  // Wait for the login form to actually render (first compile can be slow)
  await page.waitForSelector('input[type="email"]', { timeout: 60_000 });

  await page.fill('input[type="email"]', 'zoromedo2000@gmail.com');
  await page.fill('input[type="password"]', '0598243594');
  await page.click('button[type="submit"]');

  // Wait for successful redirect
  await page.waitForURL(/^http:\/\/localhost:3000\/?$/, { timeout: 30_000 });

  // Give Firebase SDK time to write to IndexedDB
  await page.waitForTimeout(3000);

  // Dump Firebase IndexedDB entries
  const idbEntries = await page.evaluate((): Promise<{ fbase_key: string; value: unknown }[]> => {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open('firebaseLocalStorageDb');
        req.onerror = () => resolve([]);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('firebaseLocalStorage')) { resolve([]); return; }
          const tx  = db.transaction('firebaseLocalStorage', 'readonly');
          const all = tx.objectStore('firebaseLocalStorage').getAll();
          all.onsuccess = () => resolve(all.result ?? []);
          all.onerror  = () => resolve([]);
        };
      } catch { resolve([]); }
    });
  });

  const cookies = await page.context().cookies();
  const ls = await page.evaluate(() => Object.entries(localStorage).map(([k, v]) => ({ name: k, value: v })));

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies, localStorage: ls, idbEntries }));

  console.log(`Auth saved — IDB entries: ${idbEntries.length}, LS keys: ${ls.length}`);
});
