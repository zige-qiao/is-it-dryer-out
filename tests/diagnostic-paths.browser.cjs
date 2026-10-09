// Standalone diagnostics and legacy URL compatibility, including subdirectory hosting.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    let checks = 0;
    for (const prefix of ['/', '/project/']) {
      const context = await browser.newContext({ serviceWorkers: 'block' });
      await context.route('http://diagnostics.test/**', async route => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname === prefix + 'before') return route.fulfill({ contentType: 'text/html', body: '<title>Before</title>' });
        const relative = pathname.slice(prefix.length);
        const file = path.resolve(relative);
        if (!file.startsWith(process.cwd() + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: 'Not found' });
        await route.fulfill({ contentType: file.endsWith('.js') ? 'text/javascript' : 'text/html', body: fs.readFileSync(file) });
      });
      for (const name of ['voice-test', 'camera-flash-test']) {
        const page = await context.newPage();
        const errors = [], assets = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('response', response => { if (response.url().includes(name + '.js')) assets.push(response.status()); });
        const base = 'http://diagnostics.test' + prefix;
        const suffix = '?mode=track-pause&staged=1&stopTrack=enabled#probe';
        await page.goto(base + 'before');
        await page.goto(base + name + '.html' + suffix);
        await page.waitForURL(base + 'diagnostics/' + name + '.html' + suffix);
        await page.waitForLoadState('load');
        assert.deepEqual(assets, [200]);
        assert.deepEqual(errors, []);
        if (name === 'voice-test') assert.equal(await page.locator('a[href="../?voice-debug=1"]').evaluate(link => link.href), base + '?voice-debug=1');
        await page.goBack();
        assert.equal(page.url(), base + 'before');
        await page.goto(base + 'diagnostics/' + name + '.html');
        assert.deepEqual(errors, []);
        assert.deepEqual(assets, [200, 200]);
        await page.close();
        checks++;
      }
      await context.close();
    }
    const context = await browser.newContext({ javaScriptEnabled: false });
    await context.route('http://diagnostics.test/**', route => route.fulfill({ contentType: 'text/html', body: fs.readFileSync(new URL(route.request().url()).pathname.slice(1)) }));
    const page = await context.newPage();
    for (const name of ['voice-test', 'camera-flash-test']) {
      await page.goto('http://diagnostics.test/' + name + '.html');
      assert.equal(await page.locator('#destination').getAttribute('href'), 'diagnostics/' + name + '.html');
    }
    await context.close();
    console.log(`PASS ${checks} root/subdirectory diagnostic checks, assets, query/hash preservation, Back history and no-JavaScript fallback links.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
