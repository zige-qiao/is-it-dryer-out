// Local preview regression; Playwright must be available on NODE_PATH.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const preview = process.argv[2] || 'http://127.0.0.1:8766/';
const artifacts = path.resolve('work/page-layout/explanation');
fs.mkdirSync(artifacts, { recursive: true });
const cases = [
  { name: 'target-met', status: 'target-met' },
  { name: 'below-minimum', status: 'below-minimum', state: { indoorTemp: 16, outdoorTemp: 0 } },
  { name: 'wetter', status: 'wetter', state: { outdoorTemp: 24, outdoorRh: 90 } },
  { name: 'uncertain', status: 'uncertain', state: { outdoorTemp: 24, outdoorRh: 58 } },
  { name: 'good', status: 'good', plan: { minutes: 8, dryAirHorizon: { minutes: 58, capped: false } } },
  { name: 'capped', status: 'good', plan: { minutes: 8, dryAirHorizon: { minutes: 180, capped: true } } },
  { name: 'forecast-limit', status: 'forecast-limit', plan: { limitMinutes: 20 } },
  { name: 'forecast-immediate', status: 'forecast-limit' },
  { name: 'settling', status: 'settling', plan: { minutes: 20, limitMinutes: 20 } },
  { name: 'settling-immediate', status: 'settling' },
  { name: 'too-cold', status: 'too-cold', plan: { limitMinutes: 20, projectedTemp: 18.1 } },
  { name: 'too-cold-immediate', status: 'too-cold' },
  { name: 'cold-room-reversal', status: 'too-cold', state: { indoorTemp: 16, outdoorTemp: 22, outdoorRh: 5 }, plan: { limitMinutes: 1, projectedTemp: 16.01 } },
  { name: 'condensation', status: 'condensation', plan: { limitMinutes: 20 } },
  { name: 'condensation-immediate', status: 'condensation' },
  { name: 'slow', status: 'slow', plan: { limitMinutes: 180 } },
  { name: 'minimal-impact', status: 'minimal-impact' },
  { name: 'cooling-hidden', status: 'minimal-impact', plan: { projectedTemp: 20.8, projectedRh: 59 } },
  { name: 'warming', status: 'good', plan: { minutes: 8, projectedTemp: 24.8, dryAirHorizon: { minutes: 58, capped: false } } },
  { name: 'unknown', status: 'unknown' },
  { name: 'loading', status: 'good', state: { weatherRequestPending: true } },
  { name: 'failed', status: 'good', state: { weatherLoadFailed: true } },
  { name: 'missing-current', status: 'good', state: { outdoorTemp: null } },
];

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', hasTouch: true, viewport: { width: 390, height: 900 } });
    await context.addInitScript(() => localStorage.setItem('is-it-dryer-out-ui-preferences', JSON.stringify({ openIndoorOnLaunch: false })));
    const page = await context.newPage();
    const checkedIconPaths = new Set();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api.open-meteo.com/**', async route => {
      const start = Math.floor(Date.now() / 3600000) * 3600;
      const time = Array.from({ length: 50 }, (_, i) => start + i * 3600);
      const repeated = value => time.map(() => value);
      await route.fulfill({ json: { timezone: 'Europe/London',
        current: { time: start, temperature_2m: 12, relative_humidity_2m: 75, dew_point_2m: 7.7,
          surface_pressure: 1013.25, wind_speed_10m: 12, wind_direction_10m: 225 },
        hourly: { time, temperature_2m: repeated(12), relative_humidity_2m: repeated(75), dew_point_2m: repeated(7.7),
          surface_pressure: repeated(1013.25), wind_speed_10m: repeated(12), wind_direction_10m: repeated(225),
          rain: repeated(1), showers: repeated(0), precipitation_probability: repeated(60) } } });
    });
    await page.goto(preview);
    await page.waitForFunction(() => document.querySelector('.recommendation').dataset.weatherState === 'ready');
    assert.equal(await page.locator('#explanationDetails').evaluate(node => node.open), false);
    assert.equal(await page.locator('#explanationDetailsSummary').isVisible(), true);
    const closedChevron = await page.locator('#explanationDetailsSummary').evaluate(node => getComputedStyle(node, '::after').transform);
    const outerChevron = await page.locator('#explanationToggle').evaluate(node => getComputedStyle(node, '::after').transform);
    assert.notEqual(closedChevron, outerChevron);
    await page.locator('#explanationDetailsSummary').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#explanationDetails').evaluate(node => node.open), true);
    assert.equal(await page.locator('#explanationDetailsSummary').evaluate(node => node.matches(':focus-visible')), true);
    assert.ok(await page.locator('#explanationDetailsSummary').evaluate(node => {
      const ring = getComputedStyle(node);
      return parseFloat(ring.outlineWidth) === 2 && ring.outlineStyle === 'solid' && parseFloat(ring.outlineOffset) === 2;
    }));
    await page.locator('[data-chart-hours="24"]').click();
    assert.equal(await page.locator('#explanationDetails').evaluate(node => node.open), true);
    await page.locator('#explanationDetailsSummary').focus();
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#explanationDetails').evaluate(node => node.open), false);
    await page.locator('#explanationDetailsSummary').tap();
    assert.equal(await page.locator('#explanationDetails').evaluate(node => node.open), true);
    await page.locator('#explanationDetailsSummary').tap();
    assert.equal(await page.locator('#explanationDetails').evaluate(node => node.open), false);

    await page.evaluate(async () => {
      const [{ createExplanationView, explanationFacts }, { createRecommendationView }, { createFormatters }, humidity] = await Promise.all([
        import('./src/ui/explanation.js'), import('./src/ui/recommendation.js'), import('./src/ui/format.js'), import('./src/domain/humidity.js')]);
      const initial = { indoorTemp: 24, indoorRh: 58, targetRh: 55, minTemp: 18, outdoorTemp: 12, outdoorRh: 75,
        outdoorWind: 12, outdoorWindAvailable: true, outdoorWindDirection: 225, outdoorPressure: 1013.25,
        roomPreset: 'medium', openingSetup: 'single', location: { name: 'Sale' }, timezone: 'Europe/London',
        weatherRequestPending: false, weatherLoadFailed: false };
      const state = { ...initial };
      const ids = ['explanationStatus', 'explanationOverview', 'explanationDetails', 'explanationDetailsSummary', 'explanationToggle',
        'explanationText', 'explanationHorizon', 'explanationRain', 'explanationWind', 'explanationModel', 'decisionLabel', 'decisionPrimary', 'decisionSecondary'];
      const elements = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
      elements.recommendation = document.querySelector('.recommendation');
      const formats = createFormatters({ state });
      const verdict = createRecommendationView({ state, elements, ...formats });
      const view = createExplanationView({ state, elements, ...formats, ...verdict,
        formatVentilationSummary: () => '50 m³ · One window open' });
      window.explanationTest = {
        run(item) {
          Object.assign(state, initial, { forecast: [1, 2, 3, 4].map(i => ({ time: new Date(Date.now() + i * 3600000), rainfall: 1, precipitationProbability: 60 })) }, item.state);
          const plan = { status: item.status, minutes: null, limitMinutes: 0, projectedTemp: 23.2, projectedRh: 55, ...item.plan };
          const comparison = humidity.compareMoisture(state.indoorTemp, state.indoorRh, state.outdoorTemp, state.outdoorRh);
          const facts = explanationFacts(state, plan, comparison);
          verdict.renderRecommendation(facts.known ? plan : { status: 'unknown' });
          view.render(plan, comparison, humidity.relativeHumidityAtTemperature(humidity.vaporPressure(state.outdoorTemp, state.outdoorRh), state.indoorTemp), false);
          return { unavailable: facts.unavailable, known: facts.known };
        },
      };
    });
    let checks = 0;
    const contact = [];
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const scale of [100, 200]) {
        await page.evaluate(scale => { document.documentElement.style.fontSize = scale + '%'; }, scale);
        for (const item of cases) {
          const facts = await page.evaluate(item => window.explanationTest.run(item), item);
          const measured = await page.evaluate(() => {
            const paragraphs = [...document.querySelectorAll('#explanationOverview > p')].filter(node => !node.hidden);
            return { overflow: document.documentElement.scrollWidth > innerWidth + 1,
              overflowNodes: [...document.querySelectorAll('.app-shell *')].filter(node => node.getBoundingClientRect().right > innerWidth + 1).map(node => `${node.tagName}.${node.className}#${node.id}`).slice(0, 12),
              rows: paragraphs.length, text: document.querySelector('#explanationOverview').textContent,
              detailEntries: [...document.querySelectorAll('.explanation-detail')].map(node => ({hidden:node.hidden,paragraphHidden:node.querySelector('p').hidden})),
              icons: paragraphs.map(node => {
                const icon = node.querySelector('svg'), content = node.querySelector('span');
                const box = icon.getBoundingClientRect(), textBox = content.getBoundingClientRect();
                const shape = icon.querySelector("path"), bounds = shape.getBBox();
                const radius = parseFloat(getComputedStyle(icon).strokeWidth) / 2;
                const style = getComputedStyle(node);
                return { path: shape.getAttribute("d"), bounds: {left:bounds.x-radius,top:bounds.y-radius,right:bounds.x+bounds.width+radius,bottom:bounds.y+bounds.height+radius}, width: box.width, height: box.height, gap: textBox.left - box.right,
                  top: box.top - textBox.top, lineHeight: parseFloat(style.lineHeight),
                  hidden: icon.getAttribute('aria-hidden'), focusable: icon.getAttribute('focusable') };
              }),
              gaps: paragraphs.slice(1).map((node, i) => node.getBoundingClientRect().top - paragraphs[i].getBoundingClientRect().bottom) };
          });
          assert.equal(measured.overflow, false, `${item.name}: overflow at ${width}/${scale}: ${measured.overflowNodes.join(', ')}`);
          assert.doesNotMatch(measured.text, /NaN|undefined/);
          assert.equal(measured.detailEntries.length, 5);
          assert.ok(measured.detailEntries.every(entry => entry.hidden === entry.paragraphHidden));
          assert.equal(measured.detailEntries.filter(entry => !entry.hidden).length, facts.known && !facts.unavailable ? (item.status === "good" ? 5 : 4) : 0);
          assert.equal(await page.locator('#explanationDetails').isVisible(), facts.known && !facts.unavailable);
          if (!facts.unavailable) {
            assert.ok(measured.rows <= 5);
            for (const icon of measured.icons) {
              checkedIconPaths.add(icon.path);
              assert.ok(icon.bounds.left >= .5 && icon.bounds.top >= .5 && icon.bounds.right <= 19.5 && icon.bounds.bottom <= 19.5, `Clipped icon: ${JSON.stringify(icon.bounds)}`);
              assert.equal(icon.width, 20);
              assert.equal(icon.height, 20);
              assert.equal(icon.gap, 8);
              assert.ok(Math.abs(icon.top - Math.max(0, (icon.lineHeight - 20) / 2)) < .1);
              assert.equal(icon.hidden, 'true');
              assert.equal(icon.focusable, 'false');
            }
            assert.ok(measured.gaps.every(gap => Math.abs(gap - 16) < .1), `${item.name}: paragraph spacing ${measured.gaps}`);
          } else {
            assert.equal(measured.rows, 0);
          }
          if (item.name === 'good') {
            const summary = page.locator('#explanationDetailsSummary');
            await page.waitForFunction(expected => getComputedStyle(document.querySelector('#explanationDetailsSummary'), '::after').transform === expected, closedChevron);
            const geometry = await summary.evaluate(node => {
              const box = node.getBoundingClientRect(), container = node.parentElement.getBoundingClientRect();
              const style = getComputedStyle(node), arrow = getComputedStyle(node, '::after');
              return { height: box.height, width: box.width, containerWidth: container.width, left: box.left - container.left,
                weight: style.fontWeight, decoration: style.textDecorationLine, gap: parseFloat(style.columnGap),
                size: style.fontSize, bodySize: getComputedStyle(document.querySelector('#explanationOverview > p')).fontSize,
                arrowMargin: parseFloat(arrow.marginLeft) + parseFloat(arrow.marginRight),
                topWeight: getComputedStyle(document.querySelector('#explanationToggle')).fontWeight };
            });
            assert.ok(geometry.height >= 44 && geometry.width >= 44 && geometry.width < geometry.containerWidth, JSON.stringify(geometry));
            assert.ok(Math.abs(geometry.left) < .1);
            assert.equal(geometry.weight, '400');
            assert.equal(geometry.topWeight, '700');
            assert.equal(geometry.decoration, 'underline');
            assert.equal(geometry.gap, 8);
            assert.equal(geometry.arrowMargin, 0);
            assert.equal(geometry.size, geometry.bodySize);
            await page.locator('.recommendation-explainer').screenshot({ animations: 'disabled', path: path.join(artifacts, `secondary-${width}-${scale}-closed.png`) });
            await summary.screenshot({ animations: 'disabled', path: path.join(artifacts, `control-${width}-${scale}-closed.png`) });
            await summary.focus();
            await page.keyboard.press('Enter');
            assert.equal(await page.locator('#explanationDetails').evaluate(node => node.open), true);
            await page.waitForFunction(expected => getComputedStyle(document.querySelector('#explanationDetailsSummary'), '::after').transform === expected, outerChevron);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
            await page.locator('.recommendation-explainer').screenshot({ animations: 'disabled', path: path.join(artifacts, `secondary-${width}-${scale}-open.png`) });
            await summary.screenshot({ animations: 'disabled', path: path.join(artifacts, `control-${width}-${scale}-open.png`) });
            assert.equal(await summary.evaluate(node => getComputedStyle(node, '::after').transform),
              await page.locator('#explanationToggle').evaluate(node => getComputedStyle(node, '::after').transform));
            await page.keyboard.press('Space');
            assert.equal(await page.locator('#explanationDetails').evaluate(node => node.open), false);
            await page.waitForFunction(expected => getComputedStyle(document.querySelector('#explanationDetailsSummary'), '::after').transform === expected, closedChevron);
          }
          if (width === 320 && scale === 100 && !facts.unavailable) {
            await page.locator('.recommendation-explainer').screenshot({ path: path.join(artifacts, `${item.name}-320.png`) });
            contact.push({ name: item.name, html: await page.locator('.recommendation-explainer').evaluate(node => {
              const clone = node.cloneNode(true);
              clone.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
              return clone.outerHTML;
            }) });
          }
          if (item.name === 'good' && width === 390 && scale === 100) await page.screenshot({ path: path.join(artifacts, 'overview-390.png'), fullPage: true });
          if (item.name === 'good' && width === 320 && scale === 200) await page.locator('.recommendation-explainer').screenshot({ path: path.join(artifacts, 'enlarged-320.png') });
          checks++;
        }
      }
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; window.explanationTest.run({ status: 'good', plan: { minutes: 8, dryAirHorizon: { minutes: 58, capped: false } } }); });
    await page.locator('#explanationDetailsSummary').focus();
    await page.keyboard.press('Enter');
    await page.locator('.recommendation-explainer').screenshot({ path: path.join(artifacts, 'expanded-390.png') });
    await page.evaluate(() => window.explanationTest.run({ status: 'good', state: { weatherRequestPending: true } }));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'explanationToggle');
    assert.equal(await page.locator('#explanationDetails').evaluate(node => node.open), true);
    await page.evaluate(() => window.explanationTest.run({ status: 'good', plan: { minutes: 8, dryAirHorizon: { minutes: 58, capped: false } } }));
    assert.equal(await page.locator('#explanationDetails').isVisible(), true);
    assert.equal(await page.locator('#explanationDetails').evaluate(node => node.open), true);
    assert.equal(checkedIconPaths.size, 7, "All seven icon categories checked for stroke clearance");
    assert.deepEqual(errors, []);

    const board = await context.newPage();
    await board.setViewportSize({ width: 980, height: 900 });
    for (let i = 0; i < contact.length; i += 6) {
      await board.setContent(`<html><head><link rel="stylesheet" href="${preview}styles.css"><style>body{padding:16px}.cases{display:grid;grid-template-columns:repeat(3,300px);gap:24px 16px}.case h2{font-size:16px;margin:0 0 12px}.details-footnotes{padding:0;margin:0}</style></head><body><div class="cases">${contact.slice(i, i + 6).map(item => `<div class="case"><h2>${item.name}</h2><div class="details-footnotes">${item.html}</div></div>`).join('')}</div></body></html>`);
      await board.screenshot({ path: path.join(artifacts, `outcomes-${i / 6 + 1}.png`), fullPage: true });
    }
    await board.goto(`${preview}docs/design-system.html#foundations`);
    await board.locator('.board-explanation').first().screenshot({ path: path.join(artifacts, 'design-system-board.png') });
    console.log(`PASS ${checks} responsive status checks, keyboard disclosure, focus return, open-state retention, and visual-board rendering.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
