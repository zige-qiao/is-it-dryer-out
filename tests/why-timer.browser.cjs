// Local browser regression: NODE_PATH must include Playwright.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const preview = process.argv[2] || 'http://127.0.0.1:8783/';
const artifacts = path.resolve('work/page-layout/why-timers');
fs.mkdirSync(artifacts, { recursive: true });
const cases = [
  { status: 'good', minutes: 8, horizon: 58 },
  { status: 'good', minutes: 80, horizon: 120 },
  { status: 'good', minutes: 8, horizon: 180, capped: true },
  { status: 'forecast-limit', minutes: 90 },
  { status: 'settling', minutes: 20 },
  { status: 'too-cold', minutes: 60 },
  { status: 'condensation', minutes: 20 },
  { status: 'slow', minutes: 180 },
  { status: 'too-cold', minutes: 1, reversal: true },
  ...['too-cold', 'condensation', 'forecast-limit', 'settling'].map(status => ({ status, minutes: 0 })),
  { status: 'good', minutes: 181, horizon: 181 },
  { status: 'good', minutes: 1.5, horizon: 1.5 },
];
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  let checks = 0;
  try {
    for (const supported of [true, false]) {
      const context = await browser.newContext({ serviceWorkers: 'block', hasTouch: supported,
        ...(supported ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' } : {}),
        viewport: { width: 390, height: 900 } });
      await context.addInitScript(() => localStorage.setItem('is-it-dryer-out-ui-preferences', JSON.stringify({ openIndoorOnLaunch: false })));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api.open-meteo.com/**', route => {
        const start = Math.floor(Date.now() / 3600000) * 3600;
        const time = Array.from({ length: 50 }, (_, i) => start + i * 3600);
        const repeat = value => time.map(() => value);
        return route.fulfill({ json: { timezone: 'Europe/London', current: { time: start, temperature_2m: 12,
          relative_humidity_2m: 75, dew_point_2m: 7.7, surface_pressure: 1013.25, wind_speed_10m: 12, wind_direction_10m: 225 },
          hourly: { time, temperature_2m: repeat(12), relative_humidity_2m: repeat(75), dew_point_2m: repeat(7.7),
            surface_pressure: repeat(1013.25), wind_speed_10m: repeat(12), wind_direction_10m: repeat(225),
            rain: repeat(1), showers: repeat(0), precipitation_probability: repeat(60) } } });
      });
      await page.goto(preview);
      await page.waitForFunction(() => document.querySelector('.recommendation').dataset.weatherState === 'ready');
      await page.locator('[data-page-link="why"]').click();
      await page.evaluate(async () => {
        const [{ createExplanationView }, { createRecommendationView }, { createFormatters }, { compareMoisture }, { isAppleMobile }] = await Promise.all([
          import('./src/ui/explanation.js'), import('./src/ui/recommendation.js'), import('./src/ui/format.js'), import('./src/domain/humidity.js'), import('./src/ui/timer.js')]);
        const state = { indoorTemp: 24, indoorRh: 58, targetRh: 55, minTemp: 18, outdoorTemp: 12, outdoorRh: 75,
          outdoorWind: 12, outdoorWindAvailable: true, outdoorWindDirection: 225, outdoorPressure: 1013.25,
          roomPreset: 'medium', openingSetup: 'single', location: { name: 'Sale' }, timezone: 'Europe/London' };
        const names = ['explanationStatus', 'explanationOverview', 'explanationDetails', 'explanationDetailsSummary', 'explanationToggle',
          'explanationText', 'explanationHorizon', 'explanationRain', 'explanationWind', 'explanationModel', 'decisionLabel', 'decisionPrimary', 'decisionSecondary'];
        const elements = Object.fromEntries(names.map(name => [name, document.getElementById(name)]));
        elements.recommendation = document.querySelector('.recommendation');
        const formatters = createFormatters({ state });
        const recommendation = createRecommendationView({ state, elements, ...formatters, timerSupported: isAppleMobile() });
        const explanation = createExplanationView({ state, elements, ...formatters, ...recommendation,
          timerSupported: isAppleMobile(), formatVentilationSummary: () => '50 m³ · One window open' });
        window.whyTimerTest = item => {
          Object.assign(state, { indoorTemp: item.reversal ? 16 : 24, outdoorTemp: item.reversal ? 22 : 12,
            outdoorRh: item.reversal ? 5 : 75, targetRh: item.targetRh || 55,
            weatherRequestPending: !!item.pending, weatherLoadFailed: !!item.failed,
            forecast: [1, 2, 3, 4].map(i => ({ time: new Date(Date.now() + i * 3600000), rainfall: 1, precipitationProbability: 60 })) });
          const plan = { status: item.status, minutes: item.minutes, limitMinutes: item.minutes,
            projectedTemp: item.reversal ? 16.01 : 23.2, projectedRh: 55,
            dryAirHorizon: { minutes: item.horizon, capped: !!item.capped },
            nextUsefulOpeningTime: new Date(Date.now() + 3600000) };
          recommendation.renderRecommendation(plan);
          explanation.render(plan, compareMoisture(state.indoorTemp, state.indoorRh, state.outdoorTemp, state.outdoorRh), 37, false);
        };
      });
      for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        for (const item of cases) {
          await page.evaluate(item => window.whyTimerTest(item), item);
          await page.locator('#explanationDetails').evaluate(node => { node.open = true; });
          const controls = page.locator('#whyPage [data-timer-minutes]');
          const eligible = supported && Number.isInteger(item.minutes) && item.minutes >= 1 && item.minutes <= 180;
          assert.equal(await controls.count() > 0, eligible);
          assert.equal(await page.locator('#explanationWind [data-timer-minutes], #explanationModel [data-timer-minutes]').count(), 0);
          for (let i = 0; i < await controls.count(); i++) {
            const control = controls.nth(i);
            const minutes = Number(await control.getAttribute('data-timer-minutes'));
            const geometry = await control.evaluate(node => {
              const style = getComputedStyle(node), icon = node.querySelector('.duration-alarm');
              return { dotted: style.textDecorationStyle, colour: style.color, underline: style.textDecorationColor,
                alarm: !!icon?.querySelector('svg'), hidden: icon?.getAttribute('aria-hidden'),
                lineHeight: parseFloat(style.lineHeight), height: node.getBoundingClientRect().height };
            });
            assert.equal(geometry.dotted, 'dotted');
            assert.equal(geometry.colour, geometry.underline);
            assert.equal(geometry.alarm, false);
            assert.ok(geometry.height <= geometry.lineHeight + 1);
            await control.click();
            assert.equal(await page.locator('#timerDialog').evaluate(node => node.open), true);
            assert.equal(await page.locator('#timerMinutesInput').inputValue(), String(minutes));
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => !document.querySelector('#timerDialog').open);
            await page.waitForFunction(() => !document.querySelector('#whyPage [data-timer-minutes][aria-expanded="true"]'));
            assert.equal(await control.evaluate(node => document.activeElement === node), true);
            assert.equal(await control.getAttribute('aria-expanded'), 'false');
          }
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
          if (supported && item.status === 'good' && item.horizon === 180 && width !== 320) {
            await page.screenshot({ path: path.join(artifacts, `why-capped-${width}.png`), fullPage: true });
          }
          checks++;
        }
        if (supported) {
          await page.evaluate(() => window.whyTimerTest({ status: 'forecast-limit', minutes: 90 }));
          const control = page.locator('#explanationOverview [data-timer-minutes]');
          await control.focus(); await page.keyboard.press('Enter');
          assert.equal(await page.locator('#timerMinutesInput').inputValue(), '90');
          if (width === 390) await page.screenshot({ path: path.join(artifacts, 'why-timer-open-390.png'), fullPage: true });
          await page.keyboard.press('Escape');
          await page.waitForFunction(() => !document.querySelector('#timerDialog').open);
          assert.equal(await control.evaluate(node => node.matches(':focus-visible')), true);
          assert.equal(await control.evaluate(node => getComputedStyle(node).outlineColor), 'rgb(64, 60, 55)');
          await page.screenshot({ path: path.join(artifacts, `why-focused-${width}.png`), fullPage: true });
          await page.keyboard.press('Space');
          assert.equal(await page.locator('#timerDialog').evaluate(node => node.open), true);
          await page.evaluate(() => window.whyTimerTest({ status: 'good', minutes: 8, horizon: 58, pending: true }));
          await page.keyboard.press('Escape');
          await page.waitForFunction(() => !document.querySelector('#timerDialog').open);
          assert.equal(await page.evaluate(() => document.activeElement.id), 'explanationToggle');
          assert.equal(await page.locator('#whyPage [data-timer-minutes]').count(), 0);
          for (const failed of [false, true]) {
            await page.evaluate(failed => window.whyTimerTest({ status: 'good', minutes: 8, horizon: 58, failed, targetRh: 50 }), failed);
            assert.equal(await page.locator('#whyPage [data-timer-minutes]').count(), failed ? 0 : 4);
          }
          await page.evaluate(() => window.whyTimerTest({ status: 'good', minutes: 80, horizon: 120 }));
          assert.equal(await page.locator('#explanationText [data-timer-minutes]').getAttribute('data-timer-minutes'), '80');
          assert.equal(await page.locator('#explanationOverview [data-timer-minutes]').getAttribute('data-timer-minutes'), '120');
          await page.locator('[data-page-link="overview"]').click();
          const overview = page.locator('#decisionPrimary [data-timer-minutes]');
          assert.equal(await overview.locator('.duration-alarm svg').count(), 0);
          await overview.click();
          assert.equal(await page.locator('#timerMinutesInput').inputValue(), '80');
          await page.keyboard.press('Escape');
          await page.waitForFunction(() => !document.querySelector('#timerDialog').open);
          await page.locator('[data-page-link="why"]').click();
        } else if (width === 390) {
          await page.evaluate(() => window.whyTimerTest({ status: 'good', minutes: 80, horizon: 120 }));
          await page.screenshot({ path: path.join(artifacts, 'why-unsupported-390.png'), fullPage: true });
        }
      }
      await page.evaluate(() => document.documentElement.style.fontSize = '200%');
      await page.setViewportSize({ width: 320, height: 900 });
      await page.evaluate(() => window.whyTimerTest({ status: 'good', minutes: 80, horizon: 120 }));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: path.join(artifacts, `why-enlarged-${supported ? 'supported' : 'unsupported'}.png`), fullPage: true });
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log(`PASS ${checks} supported/unsupported Why timing states, all controls, timer values, icons, keyboard focus, fallback focus, updates and weather clearing.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
