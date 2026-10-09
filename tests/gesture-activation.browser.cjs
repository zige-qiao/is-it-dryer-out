const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const preview = process.argv[2] || 'http://127.0.0.1:8780/';
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', hasTouch: true, reducedMotion: 'reduce', viewport: { width: 390, height: 568 } });
    await context.addInitScript(() => localStorage.setItem('is-it-dryer-out-ui-preferences', JSON.stringify({ openIndoorOnLaunch: false })));
    await context.route('**/api.open-meteo.com/**', route => {
      const start = Math.floor(Date.now() / 3600000) * 3600, time = Array.from({ length: 50 }, (_, i) => start + i * 3600), repeat = n => time.map(() => n);
      return route.fulfill({ json: { timezone: 'Europe/London', current: { time: start, temperature_2m: 12, relative_humidity_2m: 70, surface_pressure: 1013, wind_speed_10m: 9 }, hourly: { time, temperature_2m: repeat(12), relative_humidity_2m: repeat(70), surface_pressure: repeat(1013), wind_speed_10m: repeat(9), wind_direction_10m: repeat(90), rain: repeat(0), showers: repeat(0), precipitation_probability: repeat(0) } } });
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(preview); await page.waitForFunction(() => !document.documentElement.classList.contains('layout-pending') && document.querySelector('#decisionLabel').textContent !== 'CHECKING');
    let checks = 0;
    const suppressed = async selector => {
      for (const [dx, dy] of [[0, -30], [0, 30], [-30, 0], [30, 0]]) {
        const result = await page.evaluate(({ selector, dx, dy }) => {
          const target = document.querySelector(selector); let activated = false;
          const record = () => { activated = true; }; target.addEventListener('click', record);
          const pointer = (name, x, y) => document.dispatchEvent(new PointerEvent(name, { bubbles: true, pointerType: 'touch', pointerId: 71, isPrimary: true, button: 0, clientX: x, clientY: y }));
          pointer('pointerdown', 100, 100); pointer('pointermove', 100 + dx, 100 + dy); pointer('pointerup', 100 + dx, 100 + dy);
          // Simulate even a browser delivering a compatibility click after a swipe.
          const allowed = target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
          target.removeEventListener('click', record); return { allowed, activated };
        }, { selector, dx, dy });
        assert.deepEqual(result, { allowed: false, activated: false }, `${selector} ${dx}/${dy}`); checks++;
      }
    };
    for (const selector of ['#settingsButton', '#locationButton', '#editIndoorButton', '#planSummaryButton', '[data-chart-hours="24"]', '#explanationToggle', '#explanationDetailsSummary', '#refreshWeather']) await suppressed(selector);
    await page.locator('#settingsButton').click();
    for (const selector of ['#showIndoorSummary', '#showMoistureComparison', '#showCameraButton', '#useStillPhotos', '#autoFlash', '#resetPageLayout', '#settingsDoneButton', ...['indoor-summary', 'moisture-comparison', 'supporting-details'].map(id => `[data-layout-row="${id}"] [data-drag-handle]`)]) await suppressed(selector);
    const cdp = await context.newCDPSession(page);
    const initialOrder = await page.locator('#pageLayoutList > li').evaluateAll(nodes => nodes.map(n => n.dataset.layoutRow));
    // Start real native swipes directly on each handle, in both scroll directions.
    for (const id of ['indoor-summary', 'moisture-comparison', 'supporting-details']) for (const dy of [-60, 60]) {
      await page.locator('.settings-dialog-content').evaluate((n, offset) => { n.scrollTop = offset; }, dy < 0 ? 0 : 80);
      await page.waitForTimeout(300);
      const selector = `[data-layout-row="${id}"] [data-drag-handle]`, b = await page.locator(selector).boundingBox();
      const before = await page.locator('.settings-dialog-content').evaluate(n => n.scrollTop);
      const point = offset => [{ x: b.x + 22, y: b.y + 22 + offset, id: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(0) });
      for (const fraction of [.2, .4, .7, 1]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(dy * fraction) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(300);
      const after = await page.locator('.settings-dialog-content').evaluate(n => n.scrollTop);
      assert.ok(dy < 0 ? after > before : after < before, `handle ${id} ${dy} must scroll natively: ${before} -> ${after}`);
      assert.deepEqual(await page.locator('#pageLayoutList > li').evaluateAll(nodes => nodes.map(n => n.dataset.layoutRow)), initialOrder);
      assert.equal(await page.locator('#pageLayoutMenu').isVisible(), false);
      assert.equal(await page.locator('.is-reorder-ready,.is-dragging,[data-insert]').count(), 0);
    }
    // A stationary long press must not open the menu; a fresh quick tap must.
    await page.locator('.settings-dialog-content').evaluate(n => { n.scrollTop = 0; }); await page.waitForTimeout(300);
    const handle = page.locator('[data-layout-row="indoor-summary"] [data-drag-handle]'), hb = await handle.boundingBox();
    const heldPoint = [{ x: hb.x + 22, y: hb.y + 22, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: heldPoint }); await page.waitForTimeout(350);
    assert.equal(await handle.evaluate(n => n.classList.contains('is-reorder-ready')), true);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await page.locator('#pageLayoutMenu').isVisible(), false);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: heldPoint });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await page.locator('#pageLayoutMenu').isVisible(), true); await page.keyboard.press('Escape');
    // Exercise the shared guard through actual handle wiring after native-style scroll cancellation.
    await page.evaluate(() => {
      const pointer = name => document.dispatchEvent(new PointerEvent(name, { bubbles: true, pointerType: 'touch', pointerId: 71, isPrimary: true, button: 0, clientX: 100, clientY: 100 }));
      pointer('pointerdown'); pointer('pointercancel');
      document.querySelector('.settings-dialog-content').dispatchEvent(new Event('scroll'));
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: heldPoint }); await page.waitForTimeout(350);
    assert.equal(await handle.evaluate(n => n.classList.contains('is-reorder-ready')), false, 'momentum-stopping touch cannot arm');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await page.locator('#pageLayoutMenu').isVisible(), false);
    await page.waitForTimeout(200);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: heldPoint }); await page.waitForTimeout(350);
    assert.equal(await handle.evaluate(n => n.classList.contains('is-reorder-ready')), true);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    assert.equal(await handle.evaluate(n => n.classList.contains('is-reorder-ready')), false);
    assert.deepEqual(await page.locator('#pageLayoutList > li').evaluateAll(nodes => nodes.map(n => n.dataset.layoutRow)), initialOrder);
    // Actual native scrolling that starts over a switch label must not toggle it.
    for (const dy of [-90, 90]) {
      await page.locator('#showCameraButton').scrollIntoViewIfNeeded();
      const b = await page.locator('#showCameraButton').locator('..').boundingBox();
      const x = b.x + 45, y = b.y + b.height / 2;
      const point = offset => [{ x, y: y + offset, id: 1 }];
      const before = await page.locator('#showCameraButton').isChecked();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(0) });
      for (const fraction of [.1, .4, .7, 1]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(dy * fraction) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      assert.equal(await page.locator('#showCameraButton').isChecked(), before);
      assert.equal(await page.locator('#settingsDialog').evaluate(n => n.open), true);
    }
    for (const dy of [-60, 20]) {
      const b = await page.locator('#settingsDoneButton').boundingBox();
      const point = offset => [{ x: b.x + b.width / 2, y: b.y + 5 + offset, id: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(0) });
      for (const fraction of [.2, .5, 1]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(dy * fraction) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      assert.equal(await page.locator('#settingsDialog').evaluate(n => n.open), true, `swiping ${dy} over sticky Done cannot close Settings`);
    }
    // Mouse and keyboard still work immediately after a swipe/cancellation.
    await page.locator('#showCameraButton').click(); assert.equal(await page.locator('#showCameraButton').isChecked(), false);
    await page.locator('#showCameraButton').focus(); await page.keyboard.press('Space'); assert.equal(await page.locator('#showCameraButton').isChecked(), true);
    await page.locator('#settingsDoneButton').click(); assert.equal(await page.locator('#settingsDialog').evaluate(n => n.open), false);
    for (const [opener, selectors, close] of [
      ['#editIndoorButton', ['#cameraInputButton', '#indoorDoneButton'], '#indoorDoneButton'],
      ['#planSummaryButton', ['#planDoneButton', '[data-room-volume]'], '#planDoneButton'],
      ['#locationButton', ['#locationUpdateButton', '#locationClearButton'], '#locationDialog [data-close-dialog]'],
    ]) {
      await page.locator(opener).click();
      for (const selector of selectors) if (await page.locator(selector).count()) await suppressed(selector);
      if (await page.locator(close).isVisible()) await page.locator(close).click(); else await page.keyboard.press('Escape');
    }
    // Native disclosures, including timer help, use the same guard.
    await page.evaluate(() => document.querySelector('#timerDialog').showModal());
    for (const selector of ['#timerHelp > summary', '#timerStartButton']) await suppressed(selector);
    await page.locator('#timerHelp > summary').click(); assert.equal(await page.locator('#timerHelp').evaluate(n => n.open), true);
    await page.keyboard.press('Escape');
    if (await page.locator('#timerDialog').evaluate(n => n.open)) await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    await page.locator('#settingsButton').click();
    fs.mkdirSync('work/page-layout/gestures', { recursive: true });
    await page.screenshot({ path: 'work/page-layout/gestures/settings-swipe-guard.png' });
    console.log(`PASS ${checks} up/down/left/right compatibility-click protections, six native handle swipes, stationary holds and quick taps, native Settings swipes, keyboard/mouse recovery and disclosure activation.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
