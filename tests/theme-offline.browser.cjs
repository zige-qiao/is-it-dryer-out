// Real service-worker coverage, separate from the isolated visual regressions.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const preview = process.argv[2] || 'http://127.0.0.1:8776/';

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const context = await browser.newContext({ colorScheme: 'light', serviceWorkers: 'allow' });
    await context.addInitScript(() => {
      const key = 'is-it-dryer-out-ui-preferences';
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ theme: 'dark', openIndoorOnLaunch: false }));
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(preview);
    await page.waitForFunction(() => !document.documentElement.classList.contains('layout-pending'));
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    });
    assert.equal(await page.evaluate(async () => Boolean(await caches.match(new URL('src/ui/theme.js', location.href)))), true, 'theme controller is cached for offline startup');
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.documentElement.classList.contains('layout-pending'));
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await page.locator('body').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(23, 22, 20)');
    await page.locator('[data-page-link="why"]').click();
    await page.locator('#settingsButton').click();
    await page.locator('[data-theme-preference][value="light"]').check();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.documentElement.classList.contains('layout-pending'));
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light', 'manual choice survives an offline reload');
    await page.locator('#settingsButton').click();
    await page.locator('[data-theme-preference][value="system"]').check();
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('is-it-dryer-out-ui-preferences')).theme), 'system', 'device change does not overwrite System preference');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.documentElement.classList.contains('layout-pending'));
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await page.evaluate(async () => {
      try { await fetch('src/ui/missing-theme-resource.js'); return false; } catch { return true; }
    }), true, 'missing offline modules do not receive the navigation fallback');
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS offline cached theme module, explicit choices, System changes and navigation reloads.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
