// Independent browser acceptance: NODE_PATH must include Playwright.
// node tests/dark-mode.browser.cjs http://127.0.0.1:8776/
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { dewPoint } = require('../src/domain/humidity.js');
const preview = process.argv[2] || 'http://127.0.0.1:8776/';
const artifacts = path.resolve('work/page-layout/dark-mode');
const key = 'is-it-dryer-out-ui-preferences';
const radio = value => `[data-theme-preference][value="${value}"]`;
const palette = {
  light: { page: 'rgb(242, 240, 237)', panel: 'rgb(255, 255, 255)', ink: 'rgb(64, 60, 55)', primary: 'rgb(32, 39, 37)', onPrimary: 'rgb(255, 255, 255)' },
  dark: { page: 'rgb(23, 22, 20)', panel: 'rgb(36, 34, 31)', ink: 'rgb(241, 237, 230)', primary: 'rgb(217, 214, 207)', onPrimary: 'rgb(36, 34, 31)' },
};
fs.mkdirSync(artifacts, { recursive: true });

function contrast(a, b) {
  const luminance = colour => {
    const channels = colour.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
      value /= 255;
      return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    });
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  const values = [luminance(a), luminance(b)].sort((a, b) => a - b);
  return (values[1] + .05) / (values[0] + .05);
}

function composite(foreground, background) {
  const numbers = value => value.match(/[\d.]+/g).map(Number), fg = numbers(foreground), bg = numbers(background), alpha = fg[3] ?? 1;
  return `rgb(${fg.slice(0, 3).map((value, i) => Math.round(value * alpha + bg[i] * (1 - alpha))).join(', ')})`;
}

async function renderedPairs(page, selectors) {
  return page.evaluate(selectors => {
    const components = colour => colour.match(/[\d.]+/g).map(Number);
    const effectiveSurface = node => {
      const ancestors = []; for (let n = node; n; n = n.parentElement) ancestors.unshift(n);
      let result = [255, 255, 255];
      for (const n of ancestors) { const colour = components(getComputedStyle(n).backgroundColor), alpha = colour[3] ?? 1; result = result.map((value, i) => colour[i] * alpha + value * (1 - alpha)); }
      return `rgb(${result.map(Math.round).join(', ')})`;
    };
    return selectors.map(selector => { const node = document.querySelector(selector), style = getComputedStyle(node); return { selector, foreground: style.color, background: effectiveSurface(node), ownBackground: style.backgroundColor }; });
  }, selectors);
}

function weatherResponse() {
  const start = Math.floor(Date.now() / 3600000) * 3600;
  const time = Array.from({ length: 50 }, (_, i) => start + i * 3600), repeat = value => time.map(() => value);
  const temperatures = time.map((_, i) => i < 12 ? 12 : 24), humidities = time.map((_, i) => i < 12 ? 70 : i < 30 ? 58 : 80);
  return { timezone: 'Europe/London',
    current: { time: start, temperature_2m: 12, relative_humidity_2m: 70, dew_point_2m: 7, surface_pressure: 1013, wind_speed_10m: 9 },
    hourly: { time, temperature_2m: temperatures, relative_humidity_2m: humidities, dew_point_2m: temperatures.map((temp, i) => dewPoint(temp, humidities[i])), surface_pressure: repeat(1013),
      wind_speed_10m: repeat(9), wind_direction_10m: repeat(90), rain: repeat(.2), showers: repeat(0), precipitation_probability: repeat(40) } };
}

async function makeContext(browser, preferences, colourScheme = 'light', extra = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block', colorScheme: colourScheme, reducedMotion: 'reduce',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1', ...extra });
  await context.addInitScript(({ key, preferences }) => {
    if (preferences && localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(preferences));
    localStorage.setItem('is-it-dryer-out-location', JSON.stringify({ location: { name: 'Sale', latitude: 53.4252, longitude: -2.3244 }, mode: 'manual' }));
    // Share the native query so foreground tests can simulate an event missed while suspended.
    const native = window.matchMedia.bind(window), system = native('(prefers-color-scheme: dark)');
    window.themeTestMedia = system;
    window.matchMedia = query => query.replace(/\s/g, '') === '(prefers-color-scheme:dark)' ? system : native(query);
    const sessions = window.themeTestVoiceSessions = [];
    window.SpeechRecognition = class extends EventTarget {
      constructor() { super(); sessions.push(this); }
      start() { this.dispatchEvent(new Event('start')); this.dispatchEvent(new Event('audiostart')); }
      stop() { this.dispatchEvent(new Event('end')); }
      abort() { this.dispatchEvent(new Event('end')); }
      result(text) { const row = [{ transcript: text }]; row.isFinal = true; const event = new Event('result'); event.results = [row]; this.dispatchEvent(event); }
    };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => Promise.reject(new Error('Mock camera or meter unavailable')) } });
  }, { key, preferences });
  await context.route('**/api.open-meteo.com/**', route => route.fulfill({ json: weatherResponse() }));
  return context;
}

async function ready(page) {
  await page.waitForFunction(() => !document.documentElement.classList.contains('layout-pending') && document.querySelector('.recommendation').dataset.weatherState === 'ready');
}
async function themeIs(page, value) {
  await page.waitForFunction(value => document.documentElement.dataset.theme === value && getComputedStyle(document.documentElement).colorScheme === value, value);
}
async function openSettings(page) {
  await page.locator('[data-page-link="why"]').click();
  await page.locator('#settingsButton').click();
}
async function closeSheet(page, id) {
  await page.locator(`#${id} .sheet-close-button`).click();
  await page.waitForFunction(id => !document.getElementById(id).open, id);
}
async function noOverflow(page, selector, label) {
  const result = await page.locator(selector).evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth,
    overflow: getComputedStyle(node).overflowX,
    outside: [...node.querySelectorAll('*')].filter(n => n.getClientRects().length && n.getBoundingClientRect().right > node.getBoundingClientRect().right + 1).slice(0, 8).map(n => [n.id || n.className, n.getBoundingClientRect().right]),
    local: [...node.querySelectorAll('*')].filter(n => n.getClientRects().length && n.scrollWidth > n.clientWidth + 1).slice(0, 8).map(n => [n.id || n.className, n.clientWidth, n.scrollWidth, getComputedStyle(n).overflowX]) }));
  assert.ok(result.scroll <= result.width + 1, `${label} horizontal overflow: ${JSON.stringify(result)}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  let checks = 0;
  try {
    // Block the entry module: the head bootstrap must already establish the visible surface.
    for (const [name, preferences, system, expected] of [
      ['fresh-system-dark', null, 'dark', 'dark'],
      ['saved-light', { theme: 'light' }, 'dark', 'light'],
      ['saved-dark', { theme: 'dark' }, 'light', 'dark'],
      ['invalid-system-dark', { theme: 'invalid' }, 'dark', 'dark'],
    ]) {
      const context = await makeContext(browser, preferences, system), page = await context.newPage();
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      await context.route('**/app.js*', async route => { await gate; await route.continue(); });
      try {
        await page.goto(preview, { waitUntil: 'commit' });
        await themeIs(page, expected);
        await page.waitForFunction(() => document.body && [...document.styleSheets].some(sheet => sheet.href?.includes('styles.css')));
        assert.equal(await page.locator('body').evaluate(node => getComputedStyle(node).backgroundColor), palette[expected].page, `${name} first painted page`);
        assert.equal(await page.locator('.app-shell').evaluate(node => getComputedStyle(node).visibility), 'hidden', 'app initialisation remains delayed');
        assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'), '#10231f', 'browser chrome remains static');
        await page.screenshot({ path: path.join(artifacts, `${name}-bootstrap.png`) });
      } finally { release(); }
      await ready(page);
      if (name === 'fresh-system-dark') assert.equal(await page.locator(radio('system')).isChecked(), true);
      await context.close(); checks++;
    }

    const context = await makeContext(browser, { openIndoorOnLaunch: false, showVoiceButton: true, theme: 'system',
      showIndoorSummary: true, showMoistureComparison: true, pageOrder: ['recommendation', 'moisture-comparison', 'indoor-summary', 'supporting-details'] });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(preview); await ready(page);
    await openSettings(page);
    assert.deepEqual(await page.locator('#settingsDialog .settings-group > h3, #settingsDialog .settings-group-heading > h3').allTextContents(), ['Overview layout', 'Indoor readings', 'Appearance']);
    assert.equal(await page.locator('fieldset.theme-options').getAttribute('aria-labelledby'), 'settingsAppearanceTitle');
    assert.deepEqual(await page.locator('[data-theme-preference]').evaluateAll(nodes => nodes.map(node => [node.type, node.name, node.value])),
      ['system', 'light', 'dark'].map(value => ['radio', 'theme', value]));
    await page.locator(radio('system')).focus();
    await page.keyboard.press('ArrowRight'); await themeIs(page, 'light');
    assert.equal(await page.locator(radio('light')).isChecked(), true);
    await page.keyboard.press('ArrowRight'); await themeIs(page, 'dark');
    const focus = await page.locator(radio('dark')).evaluate(node => ({ focused: node === document.activeElement,
      labelOutline: getComputedStyle(node.closest('label')).outlineStyle, spanOutline: getComputedStyle(node.nextElementSibling).outlineStyle }));
    assert.equal(focus.focused, true);
    assert.ok([focus.labelOutline, focus.spanOutline].some(style => style !== 'none'), 'native radio has a visible keyboard focus indicator');
    await page.emulateMedia({ colorScheme: 'light' }); await themeIs(page, 'dark');
    await page.locator(radio('system')).check(); await themeIs(page, 'light');
    await page.emulateMedia({ colorScheme: 'dark' }); await themeIs(page, 'dark');
    await page.emulateMedia({ colorScheme: 'light' }); await themeIs(page, 'light');
    for (const event of ['pageshow', 'visibilitychange']) {
      await page.evaluate(event => {
        Object.defineProperty(window.themeTestMedia, 'matches', { configurable: true, get: () => true });
        (event === 'pageshow' ? window : document).dispatchEvent(new Event(event));
      }, event);
      await themeIs(page, 'dark');
      await page.evaluate(() => { delete window.themeTestMedia.matches; window.dispatchEvent(new Event('pageshow')); });
      await themeIs(page, 'light');
    }
    await page.locator(radio('dark')).check();
    await page.locator('#resetPageLayout').click();
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    assert.equal(saved.theme, 'dark'); assert.equal(saved.showVoiceButton, true); assert.equal(saved.openIndoorOnLaunch, false);
    assert.equal(saved.showIndoorSummary, false); assert.equal(saved.showMoistureComparison, false);
    await closeSheet(page, 'settingsDialog');
    assert.equal(await page.locator('#settingsButton').evaluate(node => node === document.activeElement), true);
    // Compare time-dependent chart interpolation at the same instant in both themes.
    await page.clock.setFixedTime(Date.now());
    await page.reload(); await ready(page); await themeIs(page, 'dark');
    await openSettings(page); assert.equal(await page.locator(radio('dark')).isChecked(), true);
    await closeSheet(page, 'settingsDialog'); checks++;

    const verdictSurfaces = new Map();
    for (const theme of ['light', 'dark']) {
      await openSettings(page); await page.locator(radio(theme)).check();
      const selectedOption = page.locator(radio(theme)).locator('..');
      await selectedOption.hover();
      assert.equal(await selectedOption.locator('span').evaluate(node => getComputedStyle(node).backgroundColor), theme === 'dark' ? 'rgb(59, 55, 49)' : 'rgb(230, 226, 221)', `${theme} Appearance hover`);
      await page.mouse.down();
      try {
        assert.equal(await selectedOption.locator('span').evaluate(node => getComputedStyle(node).backgroundColor), theme === 'dark' ? 'rgb(73, 67, 59)' : 'rgb(217, 211, 204)', `${theme} Appearance press takes precedence over hover`);
      } finally { await page.mouse.up(); }
      await page.mouse.move(0, 0);
      await page.locator('#showMoistureComparison').check(); await page.locator('#showIndoorSummary').check();
      await closeSheet(page, 'settingsDialog'); await themeIs(page, theme);
      for (const width of [320, 390, 640, 1280]) for (const scale of [100, 200]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(scale => { document.documentElement.style.fontSize = scale + '%'; }, scale);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        for (const view of ['overview', 'why']) {
          await page.locator(`[data-page-link="${view}"]`).click();
          await noOverflow(page, 'body', `${theme}/${width}/${scale}/${view}`);
          await noOverflow(page, view === 'overview' ? '#overviewPage' : '#whyPage', `${theme}/${width}/${scale}/${view}`);
        }
        for (const [id, opener] of [['settingsDialog', '#settingsButton'], ['indoorDialog', '#indoorDockButton'], ['planDialog', '#planSummaryButton'], ['locationDialog', '#locationButton'], ['timerDialog', '.verdict-time']]) {
          await page.locator('[data-page-link="' + (id === 'settingsDialog' ? 'why' : 'overview') + '"]').click();
          await page.locator(opener).first().click();
          await page.waitForFunction(id => document.getElementById(id).classList.contains('has-frosted-header'), id);
          await noOverflow(page, '#' + id, `${theme}/${width}/${scale}/${id}`);
          await noOverflow(page, '#' + id + ' .sheet-body', `${theme}/${width}/${scale}/${id}/body`);
          const style = await page.locator('#' + id).evaluate(node => ({ background: getComputedStyle(node).backgroundColor, glass: getComputedStyle(node, '::before').backgroundColor, blur: getComputedStyle(node, '::before').backdropFilter, color: getComputedStyle(node).color,
            actions: [...node.querySelectorAll('.sheet-title-row button, .sheet-title-row summary')].filter(n => n.getClientRects().length).map(n => { const r = n.getBoundingClientRect(); return [r.width, r.height]; }) }));
          assert.equal(style.background, 'rgba(0, 0, 0, 0)', `${theme}/${id} avoids a second tint`);
          assert.equal(style.glass, theme === 'dark' ? 'rgba(36, 34, 31, 0.55)' : 'rgba(255, 255, 255, 0.95)', `${theme}/${id} sheet tint`);
          assert.equal(style.blur, 'blur(4px)');
          assert.equal(style.color, palette[theme].ink, `${theme}/${id} ink`);
          assert.ok(style.actions.every(([w, h]) => w >= 44 && h >= 44), `${id} header targets`);
          if (id === 'settingsDialog') {
            const options = await page.locator('.theme-option').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { width: r.width, height: r.height, overflow: node.scrollWidth > node.clientWidth + 1 }; }));
            assert.ok(options.every(option => option.width >= 44 && option.height >= 44 && !option.overflow), `${width}/${scale} appearance targets/reflow`);
            await page.locator(radio(theme)).scrollIntoViewIfNeeded();
          }
          if ([320, 1280].includes(width) && scale === 100) await page.locator('#' + id).screenshot({ path: path.join(artifacts, `${theme}-${id}-${width}.png`) });
          await closeSheet(page, id); checks++;
        }
      }
      await page.setViewportSize({ width: 390, height: 900 });
      await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; });
      await page.locator('[data-page-link="overview"]').click();
      const rendered = await renderedPairs(page, ['[data-page-box="moisture-comparison"]', '.indoor-card', '.outdoor-card', '#chartKey', '.chart-key-note', '.chart-key-caption']);
      for (const pair of rendered) assert.ok(contrast(pair.foreground, pair.background) >= 4.5, `${theme}/${pair.selector} actual composite text contrast ${contrast(pair.foreground, pair.background).toFixed(2)}`);
      for (const pair of rendered.filter(pair => ['[data-page-box="moisture-comparison"]', '#chartKey'].includes(pair.selector))) {
        assert.equal(pair.ownBackground, theme === 'dark' ? 'rgba(36, 34, 31, 0.9)' : 'rgba(255, 255, 255, 0.9)', `${theme}/${pair.selector} actual translucent panel surface`);
      }
      const tabs = await page.locator('.bottom-tabs').evaluate(node => ({ background: getComputedStyle(node).backgroundColor, blur: getComputedStyle(node).backdropFilter,
        inactive: getComputedStyle(node.querySelector('a:not([aria-current="page"])')).color }));
      assert.equal(tabs.background, theme === 'dark' ? 'rgba(36, 34, 31, 0.55)' : 'rgba(255, 255, 255, 0.55)');
      assert.equal(tabs.blur, 'blur(4px)');
      for (const underneath of [palette[theme].page, rendered.find(pair => pair.selector === '#chartKey').background]) {
        assert.ok(contrast(tabs.inactive, composite(tabs.background, underneath)) >= 4.5, `${theme} frosted tab label over page/card`);
      }
      const pairs = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement), value = name => style.getPropertyValue(name).trim();
        const asRgb = colour => { const probe = document.createElement('span'); probe.style.color = colour; document.body.append(probe); const result = getComputedStyle(probe).color; probe.remove(); return result; };
        return [['--ink-main', '--surface-page'], ['--ink-main', '--surface-panel'], ['--ink-muted', '--surface-page'], ['--ink-muted', '--surface-panel'], ['--ink-on-primary', '--surface-primary']].map(([ink, surface]) => [ink, surface, asRgb(value(ink)), asRgb(value(surface))]);
      });
      for (const [ink, surface, fg, bg] of pairs) assert.ok(contrast(fg, bg) >= 4.5, `${theme} ${ink}/${surface} contrast ${contrast(fg, bg).toFixed(2)}`);
      for (const hours of [24, 48]) {
        await page.locator(`[data-chart-hours="${hours}"]`).click();
        await page.mouse.move(0, 0);
        const selected = await page.locator(`[data-chart-hours="${hours}"]`).evaluate(node => ({ color: getComputedStyle(node).color, background: getComputedStyle(node, '::before').backgroundColor, pressed: node.getAttribute('aria-pressed') }));
        assert.equal(selected.pressed, 'true'); assert.equal(selected.color, 'rgb(64, 60, 55)'); assert.equal(selected.background, 'rgb(255, 255, 255)');
        assert.ok(contrast(selected.color, selected.background) >= 4.5);
      }
      await page.locator('#ahChart').focus(); await page.keyboard.press('ArrowRight');
      assert.ok(Number(await page.locator('#ahChart').getAttribute('aria-valuenow')) > 0);
      const originalRecommendation = await page.locator('.recommendation').getAttribute('class');
      // Render existing semantic surfaces without changing the weather calculation.
      for (const verdict of ['open', 'windows', 'closed', 'caution']) {
        await page.locator('.recommendation').evaluate((node, verdict) => { node.classList.remove('open', 'windows', 'closed', 'caution'); node.classList.add(verdict); }, verdict);
        const surface = await page.locator('.verdict-panel').evaluate(node => ({ background: getComputedStyle(node).backgroundImage,
          chartWet: getComputedStyle(node).getPropertyValue('--chart-wet').trim(), chartNear: getComputedStyle(node).getPropertyValue('--chart-near').trim(),
          gradientColours: [...node.querySelectorAll('#ahSemantic stop')].map(stop => stop.getAttribute('stop-color')) }));
        assert.match(surface.background, /^linear-gradient\(/); assert.equal(surface.chartWet, '#ffb3a8'); assert.equal(surface.chartNear, '#ffd27a');
        assert.ok(surface.gradientColours.length > 0 && surface.gradientColours.every(Boolean), 'semantic SVG has actual gradient stops');
        for (const expected of ['rgb(255, 255, 255)', 'rgb(255, 210, 122)', 'rgb(255, 179, 168)']) assert.ok(surface.gradientColours.includes(expected), `semantic gradient includes ${expected}`);
        if (theme === 'light') verdictSurfaces.set(verdict, surface); else assert.deepEqual(surface, verdictSurfaces.get(verdict), verdict + ' preserves verdict/chart palette');
      }
      await page.locator('.recommendation').evaluate((node, value) => { node.className = value; }, originalRecommendation);
      await page.screenshot({ path: path.join(artifacts, `${theme}-overview-390.png`), fullPage: true });
      await page.locator('#indoorDockButton').click();
      await page.locator('#voiceInputButton').click();
      await page.waitForFunction(() => document.querySelector('#voiceListenButton').classList.contains('is-listening'));
      const voice = await page.locator('#voiceListenButton').evaluate(node => ({ color: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor, waveform: getComputedStyle(node.querySelector('.voice-waveform span')).backgroundColor }));
      assert.deepEqual(voice, { color: palette[theme].onPrimary, background: palette[theme].primary, waveform: palette[theme].onPrimary });
      await page.evaluate(() => themeTestVoiceSessions.at(-1).result('25 and 60'));
      await page.locator('#voiceListenButton').click();
      assert.equal(await page.locator('#voiceApplyButton').isEnabled(), true);
      await page.locator('#indoorDialog').screenshot({ path: path.join(artifacts, `${theme}-voice-review.png`) });
      await page.locator('#voiceDialogCloseButton').click();

      // Presentation fixtures match the real camera states; no camera permission or pixels are transformed.
      await page.evaluate(() => {
        document.querySelector('#indoorDialog').classList.add('camera-mode'); document.querySelector('#cameraPanel').hidden = false;
        document.querySelector('#cameraCapturePanel').hidden = true; document.querySelector('#cameraReviewPanel').hidden = false;
        document.querySelector('#indoor-heading').textContent = 'Check readings'; document.querySelector('#cameraBackButton').hidden = false;
        const canvas = document.querySelector('#cameraPhoto'); canvas.width = 320; canvas.height = 240;
        const pixels = canvas.getContext('2d'); pixels.fillStyle = '#fff'; pixels.fillRect(0, 0, 320, 240); pixels.fillStyle = '#171614'; pixels.fillRect(80, 80, 160, 80);
      });
      for (const state of ['processing', 'info', 'ready', 'attention', 'error']) {
        await page.locator('#cameraReadStatus').evaluate((node, state) => { node.dataset.state = state; node.querySelector('span').textContent = state + ': review the current readings before confirming.'; }, state);
        const status = await page.locator('#cameraReadStatus').evaluate(node => ({ color: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor }));
        assert.ok(contrast(status.color, status.background) >= 4.5, `${theme}/${state} camera status contrast ${contrast(status.color, status.background).toFixed(2)}`);
        if (['ready', 'error'].includes(state)) await page.locator('#indoorDialog').screenshot({ path: path.join(artifacts, `${theme}-camera-review-${state}.png`) });
      }
      assert.equal(await page.locator('#cameraPhoto').evaluate(node => getComputedStyle(node).filter), 'none');
      await page.locator('#indoorDialog').screenshot({ path: path.join(artifacts, `${theme}-camera-review-error.png`) });
      for (const view of ['capture', 'error']) {
        await page.evaluate(view => {
          for (const name of ['Capture', 'Review', 'Error']) document.querySelector('#camera' + name + 'Panel').hidden = name.toLowerCase() !== view;
          document.querySelector('#indoor-heading').textContent = view === 'capture' ? 'Take a photo' : 'Camera';
          document.querySelector('#cameraCaptureStatus').textContent = 'Starting camera…';
          document.querySelector('#cameraErrorMessage').textContent = 'The camera is unavailable. Try again or enter readings manually.';
        }, view);
        await noOverflow(page, '#indoorDialog .sheet-body', `${theme}/camera-${view}`);
        const button = page.locator(view === 'capture' ? '#cameraCaptureButton' : '#cameraRetryButton');
        const primary = await button.evaluate(node => ({ color: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor, height: node.getBoundingClientRect().height }));
        assert.equal(primary.color, palette[theme].onPrimary); assert.equal(primary.background, palette[theme].primary); assert.ok(primary.height >= 44);
        await page.locator('#indoorDialog').screenshot({ path: path.join(artifacts, `${theme}-camera-${view}.png`) });
      }
      await page.reload(); await ready(page);
    }

    let mode = 'loading', releaseWeather;
    await page.route('**/api.open-meteo.com/**', async route => {
      if (mode === 'loading') await new Promise(resolve => { releaseWeather = resolve; });
      if (mode === 'failed') return route.fulfill({ status: 500, body: 'Mock weather unavailable' });
      return route.fulfill({ json: weatherResponse() });
    });
    await page.locator('[data-page-link="overview"]').click(); await page.locator('#refreshWeather').click();
    await page.waitForFunction(() => document.querySelector('.recommendation').dataset.weatherState === 'loading');
    await page.screenshot({ path: path.join(artifacts, 'dark-weather-loading.png') });
    mode = 'failed'; releaseWeather();
    await page.waitForFunction(() => document.querySelector('.recommendation').dataset.weatherState === 'failed');
    await page.screenshot({ path: path.join(artifacts, 'dark-weather-failed.png') });
    assert.equal(await page.locator('#refreshWeather').getAttribute('aria-label'), 'Retry outdoor weather');
    mode = 'ready'; await page.locator('#refreshWeather').click(); await ready(page);
    await page.emulateMedia({ forcedColors: 'active' });
    await page.setViewportSize({ width: 320, height: 900 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await openSettings(page); await page.locator(radio('dark')).focus();
    await page.keyboard.press('ArrowLeft'); assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    await page.keyboard.press('ArrowRight'); assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await page.locator(radio('dark')).isChecked(), true);
    await noOverflow(page, '#settingsDialog', 'forced-colour Settings');
    await noOverflow(page, 'fieldset.theme-options', 'forced-colour enlarged Appearance');
    const forced = await page.locator(radio('dark')).evaluate(node => {
      const span = getComputedStyle(node.nextElementSibling), probe = document.createElement('span');
      probe.style.color = 'Highlight'; document.body.append(probe); const highlight = getComputedStyle(probe).color; probe.remove();
      return { border: span.borderTopColor, outline: span.outlineColor, outlineStyle: span.outlineStyle, highlight };
    });
    assert.equal(forced.border, forced.highlight); assert.equal(forced.outline, forced.highlight); assert.equal(forced.outlineStyle, 'solid');
    await page.keyboard.press('ArrowLeft'); assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    assert.equal(await page.locator('[data-theme-preference]:checked').count(), 1, 'forced colours preserve native single selection');
    for (const checked of [false, true]) {
      await page.locator('#showVoiceButton').setChecked(checked);
      const toggle = await page.locator('#showVoiceButton').evaluate(node => {
        const track = node.parentElement.querySelector('.settings-switch'), style = getComputedStyle(track), thumb = getComputedStyle(track, '::after');
        const transform = thumb.transform === 'none' ? 0 : new DOMMatrixReadOnly(thumb.transform).m41;
        return { foreground: thumb.backgroundColor, background: style.backgroundColor, thumbWidth: parseFloat(thumb.width), left: parseFloat(thumb.left) + transform, width: track.getBoundingClientRect().width };
      });
      assert.ok(contrast(toggle.foreground, toggle.background) >= 3, `forced-colour ${checked ? 'checked' : 'unchecked'} thumb is visible`);
      assert.ok(toggle.thumbWidth > 0 && toggle.left >= 0 && toggle.left + toggle.thumbWidth <= toggle.width, 'forced-colour thumb stays inside its track');
    }
    await page.locator('#showVoiceButton').focus(); await page.keyboard.press('Space');
    const switchFocus = await page.locator('#showVoiceButton').evaluate(node => {
      const style = getComputedStyle(node.parentElement.querySelector('.settings-switch')), probe = document.createElement('span'); probe.style.color = 'Highlight'; document.body.append(probe);
      const highlight = getComputedStyle(probe).color; probe.remove(); return { outline: style.outlineColor, outlineStyle: style.outlineStyle, highlight };
    });
    assert.equal(switchFocus.outline, switchFocus.highlight); assert.equal(switchFocus.outlineStyle, 'solid');
    await page.screenshot({ path: path.join(artifacts, 'forced-colours-settings.png') });
    await closeSheet(page, 'settingsDialog');
    assert.deepEqual(errors, [], 'no browser runtime errors');
    await context.close();
    console.log(`PASS ${checks} first-paint/preference/sheet cases plus System recovery, keyboard, rendered contrast, chart, mocked media, weather recovery and forced colours. Screenshots: ${artifacts}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
