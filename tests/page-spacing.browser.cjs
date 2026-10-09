// Run against a local preview with Playwright available on NODE_PATH:
// node tests/page-spacing.browser.cjs http://127.0.0.1:8780/
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const preview = process.argv[2] || 'http://127.0.0.1:8766/';
const artifacts = path.resolve('work/page-layout/spacing');
fs.mkdirSync(artifacts, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.addInitScript(() => localStorage.setItem('is-it-dryer-out-ui-preferences', JSON.stringify({ openIndoorOnLaunch: false })));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let weather = 'success';
    await page.route('**/api.open-meteo.com/**', async route => {
      if (weather === 'failed') return route.fulfill({ status: 500, body: 'failed' });
      if (weather === 'loading') await new Promise(resolve => setTimeout(resolve, 400));
      const start = Math.floor(Date.now() / 3600000) * 3600;
      const time = Array.from({ length: 50 }, (_, i) => start + i * 3600);
      const repeat = value => time.map(() => value);
      await route.fulfill({ json: { timezone: 'Europe/London',
        current: { time: start, temperature_2m: 12, relative_humidity_2m: 70, dew_point_2m: 7, surface_pressure: 1013, wind_speed_10m: 9 },
        hourly: { time, temperature_2m: repeat(12), relative_humidity_2m: repeat(70), dew_point_2m: repeat(7), surface_pressure: repeat(1013),
          wind_speed_10m: repeat(9), wind_direction_10m: repeat(90), rain: repeat(0), showers: repeat(0), precipitation_probability: repeat(0) },
      } });
    });
    await page.goto(preview);
    await page.waitForFunction(() => !document.documentElement.classList.contains('layout-pending') && !document.querySelector('#refreshWeather').disabled);
    await page.evaluate(async () => {
      const { createPageLayout, PAGE_BOXES, pageLayoutDefaults } = await import('./src/ui/page-layout.js');
      const preferences = pageLayoutDefaults();
      const controller = createPageLayout({ preferences, save() {} });
      const permutations = values => values.length === 0 ? [[]] : values.flatMap((value, index) =>
        permutations(values.filter((_, i) => i !== index)).map(rest => [value, ...rest]));
      const orders = permutations(PAGE_BOXES.map(box => box.id));
      const measure = () => {
        const shell = document.querySelector('.app-shell');
        const visible = [...shell.children].filter(node => !node.hidden);
        const gaps = visible.slice(1).map((node, index) => node.getBoundingClientRect().top - visible[index].getBoundingClientRect().bottom);
        const badMargin = visible.some(node => ['marginTop', 'marginBottom'].some(key => parseFloat(getComputedStyle(node)[key]) !== 0));
        const footer = document.querySelector('.project-credit-row');
        const loneFooter = visible.length !== 1 || Math.abs(footer.getBoundingClientRect().top - shell.getBoundingClientRect().top - parseFloat(getComputedStyle(shell).paddingTop)) < .1;
        const internalGap = document.querySelector('.forecast-panel').getBoundingClientRect().top - document.querySelector('.verdict-panel').getBoundingClientRect().bottom;
        return { gaps, badMargin, loneFooter, footerLast: visible.at(-1) === footer,
          // The existing footer overlaps the rounded verdict edge by 12px.
          integrated: document.querySelector('[data-page-box="recommendation"]').hidden || (internalGap <= .1 &&
            document.querySelector('#ahChart').closest('[data-page-box]') === document.querySelector('.forecast-panel').closest('[data-page-box]')) };
      };
      const apply = (order, mask) => {
        preferences.pageOrder = [...order];
        PAGE_BOXES.forEach((box, index) => { preferences[box.preference] = Boolean(mask & (1 << index)); });
        controller.apply();
      };
      window.spacingTest = { orders, apply, measure };
    });

    let total = 0;
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const scale of [100, 200]) {
        const result = await page.evaluate(scale => {
          document.documentElement.style.fontSize = `${scale}%`;
          const failures = [];
          for (const order of window.spacingTest.orders) for (let mask = 0; mask < 16; mask++) {
            window.spacingTest.apply(order, mask);
            const measured = window.spacingTest.measure();
            if (measured.gaps.some(gap => Math.abs(gap - 16) > .1) || measured.badMargin || !measured.footerLast || !measured.loneFooter || !measured.integrated)
              failures.push({ order, mask, ...measured });
          }
          return { cases: window.spacingTest.orders.length * 16, failures };
        }, scale);
        assert.deepEqual(result.failures, [], `${width}px at ${scale}%`);
        total += result.cases;
        console.log(`PASS ${result.cases} configurations: ${width}px, ${scale}% text`);
      }
    }

    const cases = [
      ['reported-order', ['indoor-summary', 'moisture-comparison', 'recommendation', 'supporting-details'], 15],
      ['default', ['indoor-summary', 'recommendation', 'moisture-comparison', 'supporting-details'], 14],
      ['supporting-first', ['supporting-details', 'moisture-comparison', 'indoor-summary', 'recommendation'], 15],
      ['single-section', ['recommendation', 'indoor-summary', 'moisture-comparison', 'supporting-details'], 2],
      ['footer-only', ['recommendation', 'indoor-summary', 'moisture-comparison', 'supporting-details'], 0],
    ];
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [name, order, mask] of cases) {
        await page.evaluate(({ order, mask }) => { document.documentElement.style.fontSize = '100%'; window.spacingTest.apply(order, mask); }, { order, mask });
        await page.screenshot({ path: path.join(artifacts, `${name}-${width}.png`), fullPage: true });
      }
    }

    await page.evaluate(() => window.spacingTest.apply(['recommendation', 'indoor-summary', 'moisture-comparison', 'supporting-details'], 15));
    for (const expanded of [false, true]) for (const shortcuts of [false, true]) for (const hours of ['24', '48']) {
      await page.evaluate(({ expanded, shortcuts }) => {
        document.querySelectorAll('.details-footnotes details').forEach(detail => { detail.open = expanded; });
        for (const id of ['indoorSummaryCamera', 'indoorSummaryVoice']) document.getElementById(id).hidden = !shortcuts;
      }, { expanded, shortcuts });
      await page.locator(`[data-chart-hours="${hours}"]`).click();
      const measured = await page.evaluate(() => window.spacingTest.measure());
      assert.ok(measured.gaps.every(gap => Math.abs(gap - 16) < .1));
    }
    for (const mode of ['loading', 'failed', 'success']) {
      weather = mode;
      await page.locator('#refreshWeather').click();
      if (mode === 'loading') assert.equal(await page.locator('.recommendation').getAttribute('data-weather-state'), 'loading');
      assert.ok((await page.evaluate(() => window.spacingTest.measure())).gaps.every(gap => Math.abs(gap - 16) < .1));
      await page.waitForFunction(() => !document.querySelector('#refreshWeather').disabled);
      assert.ok((await page.evaluate(() => window.spacingTest.measure())).gaps.every(gap => Math.abs(gap - 16) < .1));
    }

    // Exercise touch refresh and cancellation, then check the settled geometry.
    await page.setViewportSize({ width: 390, height: 900 });
    const session = await context.newCDPSession(page);
    for (const finish of ['touchEnd', 'touchCancel']) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 140 }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: 600 }] });
      assert.equal(await page.locator('body').evaluate(body => body.classList.contains('pull-active')), true);
      await session.send('Input.dispatchTouchEvent', { type: finish, touchPoints: [] });
      await page.waitForFunction(() => !['pull-active', 'pull-refreshing', 'pull-result'].some(name => document.body.classList.contains(name)) &&
        !document.body.style.getPropertyValue('--pull-distance'));
      assert.ok((await page.evaluate(() => window.spacingTest.measure())).gaps.every(gap => Math.abs(gap - 16) < .1));
    }
    assert.deepEqual(errors, []);
    console.log(`PASS ${total} layout measurements plus content, weather and settled touch-refresh checks.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
