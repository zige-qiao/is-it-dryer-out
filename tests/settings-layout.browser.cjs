// Local Settings regression; Playwright must be available on NODE_PATH.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const preview = process.argv[2] || 'http://127.0.0.1:8780/';
const artifacts = path.resolve('work/page-layout/settings');
fs.mkdirSync(artifacts, { recursive: true });
const defaults = ['indoor-summary', 'recommendation', 'moisture-comparison', 'supporting-details'];
const key = 'is-it-dryer-out-ui-preferences';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'], ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', hasTouch: true });
    await context.addInitScript(() => localStorage.setItem('is-it-dryer-out-ui-preferences', localStorage.getItem('is-it-dryer-out-ui-preferences') || JSON.stringify({ openIndoorOnLaunch: false })));
    await context.route('**/api.open-meteo.com/**', route => {
      const start = Math.floor(Date.now() / 3600000) * 3600;
      const time = Array.from({ length: 50 }, (_, i) => start + i * 3600), repeat = value => time.map(() => value);
      return route.fulfill({ json: { timezone: 'Europe/London',
        current: { time: start, temperature_2m: 12, relative_humidity_2m: 70, surface_pressure: 1013, wind_speed_10m: 9 },
        hourly: { time, temperature_2m: repeat(12), relative_humidity_2m: repeat(70), surface_pressure: repeat(1013),
          wind_speed_10m: repeat(9), wind_direction_10m: repeat(90), rain: repeat(0), showers: repeat(0), precipitation_probability: repeat(0) } } });
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const row = id => page.locator(`[data-layout-row="${id}"]`);
    const handle = id => row(id).locator('[data-drag-handle]');
    const order = () => page.locator('#pageLayoutList > li').evaluateAll(nodes => nodes.map(node => node.dataset.layoutRow));
    const menu = page.locator('#pageLayoutMenu');
    const up = menu.getByRole('menuitem', { name: 'Move up', exact: true });
    const down = menu.getByRole('menuitem', { name: 'Move down', exact: true });
    await page.goto(preview);
    await page.waitForFunction(() => !document.documentElement.classList.contains('layout-pending'));
    assert.deepEqual(await page.locator('.app-shell > [data-page-box]').evaluateAll(nodes => nodes.map(node => [node.dataset.pageBox, node.hidden])),
      defaults.map(id => [id, id === 'indoor-summary']));
    await page.locator('#settingsButton').click();
    assert.equal(await page.locator('#settingsDialog .settings-group').count(), 2);
    assert.equal(await page.locator('.layout-move-actions').count(), 0);
    await handle('indoor-summary').focus(); await page.keyboard.press('Enter');
    assert.equal(await menu.isVisible(), true); assert.equal(await up.isDisabled(), true);
    assert.equal(await down.evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('Enter');
    assert.deepEqual(await order(), ['recommendation', 'indoor-summary', 'moisture-comparison', 'supporting-details']);
    assert.equal(await handle('indoor-summary').evaluate(node => node === document.activeElement), true);
    assert.match(await page.locator('#pageLayoutStatus').textContent(), /position 2 of 4/);
    assert.equal(await page.locator('[data-page-box="indoor-summary"]').evaluate(node => node.hidden), true);
    await page.keyboard.press('Space'); assert.equal(await menu.isVisible(), true);
    await page.keyboard.press('End'); assert.equal(await down.evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('Home'); assert.equal(await up.evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('ArrowDown'); assert.equal(await down.evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('Escape'); assert.equal(await menu.isVisible(), false);
    assert.equal(await page.locator('#settingsDialog').evaluate(node => node.open), true);
    await handle('indoor-summary').tap(); assert.equal(await menu.isVisible(), true);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('#showIndoorSummary').evaluate(node => node === document.activeElement), true);
    await handle('indoor-summary').tap(); await page.locator('#openIndoorOnLaunch').check();
    assert.equal(await menu.isVisible(), false);
    await page.locator('#useStillPhotos').check(); await page.locator('#autoFlash').uncheck();
    await page.locator('#showCameraButton').uncheck();
    assert.equal(await page.locator('#settingsCameraOptions').isVisible(), false);
    assert.equal(await page.locator('#useStillPhotos').isVisible(), false);
    assert.equal(await page.locator('#autoFlash').isVisible(), false);
    const accessibility = await context.newCDPSession(page);
    const hiddenTree = await accessibility.send('Accessibility.getFullAXTree');
    assert.ok(!hiddenTree.nodes.some(node => !node.ignored && ['Camera options', 'Still photos', 'Auto flash'].includes(node.name?.value)));
    await page.locator('#showCameraButton').focus(); await page.keyboard.press('Tab');
    assert.equal(await page.locator('#showVoiceButton').evaluate(node => node === document.activeElement), true);
    await page.locator('#resetPageLayout').click();
    assert.deepEqual(await order(), defaults);
    assert.equal(await page.locator('#showIndoorSummary').isChecked(), false);
    assert.equal(await page.locator('#showMoistureComparison').isChecked(), true);
    assert.equal(await page.locator('#showCameraButton').isChecked(), false);
    assert.equal(await page.locator('#useStillPhotos').isChecked(), true);
    assert.equal(await page.locator('#autoFlash').isChecked(), false);
    assert.equal(await page.locator('#openIndoorOnLaunch').isChecked(), true);
    assert.equal(await page.locator('#settingsCameraOptions').isVisible(), false);
    await page.locator('#openIndoorOnLaunch').uncheck();
    await page.locator('#settingsDoneButton').click(); await page.reload();
    await page.waitForFunction(() => !document.documentElement.classList.contains('layout-pending'));
    await page.locator('#settingsButton').click();
    assert.equal(await page.locator('#settingsCameraOptions').isVisible(), false);
    assert.equal(await page.locator('#useStillPhotos').isChecked(), true);
    assert.equal(await page.locator('#autoFlash').isChecked(), false);
    await page.locator('#showCameraButton').check();
    assert.equal(await page.locator('#settingsCameraOptions').isVisible(), true);
    assert.equal(await page.locator('#useStillPhotos').isChecked(), true);
    assert.equal(await page.locator('#autoFlash').isChecked(), false);
    await page.locator('#showCameraButton').check(); await page.locator('#useStillPhotos').uncheck(); await page.locator('#autoFlash').check();
    await page.locator('#showIndoorSummary').check();
    assert.deepEqual(await page.locator('.app-shell > [data-page-box]').evaluateAll(nodes => nodes.map(node => node.dataset.pageBox)), defaults);
    await page.locator('#showIndoorSummary').uncheck(); await page.locator('#showMoistureComparison').uncheck();
    await page.locator('#settingsEditIndoor').click(); assert.equal(await page.locator('#indoorDialog').evaluate(node => node.open), true);
    await page.locator('#indoorDoneButton').click();
    assert.equal(await page.locator('#settingsButton').evaluate(node => node === document.activeElement), true);
    await page.locator('#settingsButton').click(); await page.locator('#resetPageLayout').click();

    let views = 0;
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const scale of [100, 200]) {
        await page.evaluate(scale => { document.documentElement.style.fontSize = scale + '%'; document.querySelector('#settingsDialog').scrollTop = 0; }, scale);
        const measured = await page.locator('#settingsDialog').evaluate(node => ({ overflow: node.scrollWidth > node.clientWidth + 1,
          targets: [...node.querySelectorAll('[data-drag-handle],#resetPageLayout,#settingsDoneButton')].map(control => {
            const box = control.getBoundingClientRect(); return { name: control.id || control.getAttribute('aria-label'), width: box.width, height: box.height };
          }), rows: [...node.querySelectorAll('.settings-toggle')].map(control => control.getBoundingClientRect().height),
          gaps: [...node.querySelectorAll('.settings-toggle')].map(control => getComputedStyle(control).gap) }));
        assert.equal(measured.overflow, false, `${width}/${scale}`); assert.ok(measured.targets.every(target => target.width >= 44 && target.height >= 44), JSON.stringify({width, scale, targets: measured.targets}));
        assert.ok(measured.rows.every(height => height >= 56));
        assert.ok(measured.gaps.every(gap => gap === '8px'));
        await page.screenshot({ path: path.join(artifacts, `settings-${width}-${scale}-top.png`) });
        for (const id of ['indoor-summary', 'moisture-comparison', 'supporting-details']) {
          await handle(id).tap(); assert.equal(await menu.isVisible(), true, `tap ${id} ${width}/${scale}`);
          const placed = await menu.evaluate(node => {
            const rect = node.getBoundingClientRect(), dialog = document.querySelector('#settingsDialog').getBoundingClientRect();
            return rect.left >= Math.max(0, dialog.left) && rect.right <= Math.min(innerWidth, dialog.right) + .1
              && rect.top >= Math.max(0, dialog.top) && rect.bottom <= Math.min(innerHeight, dialog.bottom) + .1;
          });
          assert.equal(placed, true, `${id}: menu placement ${width}/${scale}`);
          await page.screenshot({ path: path.join(artifacts, `menu-${id}-${width}-${scale}.png`) });
          await page.keyboard.press('Escape');
        }
        await page.locator('#showVoiceButton').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(artifacts, `settings-${width}-${scale}-camera.png`) });
        const shownHeight = await page.locator('#settingsIndoorTitle').evaluate(node => node.closest('.settings-group').getBoundingClientRect().height);
        await page.locator('#showCameraButton').uncheck();
        assert.equal(await page.locator('#settingsCameraOptions').evaluate(node => node.hidden && node.getBoundingClientRect().height === 0), true);
        const hiddenLayout = await page.locator('#settingsDialog').evaluate(node => ({ overflow: node.scrollWidth > node.clientWidth + 1,
          height: node.querySelector('#settingsIndoorTitle').closest('.settings-group').getBoundingClientRect().height,
          rows: [...node.querySelectorAll('.settings-toggle')].filter(control => control.getClientRects().length).map(control => control.getBoundingClientRect().height) }));
        assert.equal(hiddenLayout.overflow, false); assert.ok(hiddenLayout.height < shownHeight); assert.ok(hiddenLayout.rows.every(height => height >= 56));
        await page.locator('#showVoiceButton').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(artifacts, `settings-${width}-${scale}-camera-hidden.png`) });
        if (width === 390 && scale === 100) await page.locator('#settingsIndoorTitle').locator('..').screenshot({ path: path.join(artifacts, 'settings-camera-hidden.png') });
        await page.locator('#showCameraButton').check();
        await page.locator('#settingsDoneButton').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(artifacts, `settings-${width}-${scale}-bottom.png`) });
        views++;
      }
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; document.querySelector('#settingsDialog').scrollTop = 0; });
    const touch = await context.newCDPSession(page);
    const touchHandle = await handle('indoor-summary').boundingBox(), touchLast = await row('supporting-details').boundingBox();
    const touchPoint = y => ({ x: touchHandle.x + 22, y, id: 1 });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint(touchHandle.y + 22)] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touchPoint(touchHandle.y + 30)] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touchPoint(touchLast.y + touchLast.height - 2)] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.deepEqual(await order(), ['recommendation', 'moisture-comparison', 'supporting-details', 'indoor-summary']);
    assert.equal(await menu.isVisible(), false);
    await page.locator('#resetPageLayout').click();
    const cancelled = await handle('indoor-summary').boundingBox();
    await page.mouse.move(cancelled.x + 22, cancelled.y + 22); await page.mouse.down();
    await page.mouse.move(cancelled.x + 22, cancelled.y + 70, { steps: 4 });
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await order(), defaults); assert.equal(await menu.isVisible(), false);
    assert.equal(await page.locator('#settingsDialog').evaluate(node => node.open), true);
    const pointer = await handle('indoor-summary').boundingBox(), last = await row('supporting-details').boundingBox();
    await page.mouse.move(pointer.x + 22, pointer.y + 22); await page.mouse.down();
    await page.mouse.move(pointer.x + 22, last.y + last.height - 2, { steps: 10 });
    assert.equal(await page.locator('[data-insert="after"]').count(), 1);
    await page.mouse.up(); assert.equal(await menu.isVisible(), false);
    assert.deepEqual(await order(), ['recommendation', 'moisture-comparison', 'supporting-details', 'indoor-summary']);
    await page.locator('#settingsDoneButton').click(); await page.reload();
    await page.waitForFunction(() => !document.documentElement.classList.contains('layout-pending'));
    assert.deepEqual(await order(), ['recommendation', 'moisture-comparison', 'supporting-details', 'indoor-summary']);
    await page.locator('#settingsButton').click(); await page.locator('#resetPageLayout').click();
    await page.locator('#settingsDoneButton').click();
    assert.equal(await page.locator('#settingsButton').evaluate(node => node === document.activeElement), true);
    // Exercise the real camera help link with a synthetic browser camera, without capturing readings.
    await page.locator('#editIndoorButton').click(); await page.locator('#cameraInputButton').click();
    await page.waitForFunction(() => !document.querySelector('#cameraPanel').hidden && !document.querySelector('#cameraHelpButton').hidden);
    await page.locator('#cameraHelpButton').click(); await page.locator('#cameraAutoFlashSettings').click();
    assert.equal(await page.locator('#autoFlash').evaluate(node => node === document.activeElement), true);
    await page.locator('#showCameraButton').uncheck();
    assert.equal(await page.locator('#cameraPanel').evaluate(node => node.hidden), false);
    await page.locator('#settingsDoneButton').click();
    await page.locator('#cameraHelpButton').click(); await page.locator('#cameraAutoFlashSettings').click();
    assert.equal(await page.locator('#showCameraButton').evaluate(node => node === document.activeElement), true);
    assert.equal(await page.locator('#settingsCameraOptions').isVisible(), false);
    assert.equal(await page.locator('#showCameraButton').isChecked(), false);
    await page.locator('#showCameraButton').check(); await page.locator('#settingsDoneButton').click();
    await page.locator('#cameraBackButton').click(); await page.locator('#indoorDoneButton').click();
    assert.deepEqual(errors, []);
    const board = await context.newPage(); await board.goto(`${preview}docs/design-system.html#settings-pattern`);
    await board.locator('#settings-pattern').screenshot({ path: path.join(artifacts, 'design-system-settings.png') });
    await context.close();

    const blocked = await browser.newContext({ serviceWorkers: 'block' });
    await blocked.addInitScript(() => { Storage.prototype.getItem = Storage.prototype.setItem = () => { throw Error('blocked'); }; });
    const blockedPage = await blocked.newPage(); await blockedPage.goto(preview);
    await blockedPage.locator('#indoorDoneButton').click(); await blockedPage.locator('#settingsButton').click();
    await blockedPage.locator('#useStillPhotos').check(); await blockedPage.locator('#autoFlash').uncheck();
    await blockedPage.locator('#showCameraButton').uncheck();
    assert.equal(await blockedPage.locator('#settingsCameraOptions').isVisible(), false);
    await blockedPage.locator('#showCameraButton').check();
    assert.equal(await blockedPage.locator('#useStillPhotos').isChecked(), true);
    assert.equal(await blockedPage.locator('#autoFlash').isChecked(), false);
    await blockedPage.locator('[data-layout-row="indoor-summary"] [data-drag-handle]').click();
    await blockedPage.getByRole('menuitem', { name: 'Move down' }).click();
    assert.deepEqual(await blockedPage.locator('#pageLayoutList > li').evaluateAll(nodes => nodes.map(node => node.dataset.layoutRow)),
      ['recommendation', 'indoor-summary', 'moisture-comparison', 'supporting-details']);
    await blockedPage.locator('#resetPageLayout').click(); assert.equal(await blockedPage.locator('#showIndoorSummary').isChecked(), false);
    assert.equal(await blockedPage.locator('#showMoistureComparison').isChecked(), true);
    console.log(`PASS ${views} responsive Settings views in both camera visibility states, 24 menu placements, keyboard/touch moves, drag/drop, saved/default layouts, camera-help focus routes, retained camera values and blocked storage.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
