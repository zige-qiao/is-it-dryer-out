// Isolated geometry/material checks; contrast findings are reported for user review.
const { chromium } = require('playwright');
const sharp = require('sharp');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const preview = process.argv[2] || 'http://127.0.0.1:8776/';
const artifacts = path.resolve('work/glass-sheets');
fs.mkdirSync(artifacts, { recursive: true });

const luminance = channels => channels.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  .reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
const contrast = (a, b) => {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
};

async function contextFor(browser, theme, feature) {
  const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: theme,
    viewport: { width: 390, height: 700 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' });
  await context.addInitScript(({ theme, feature }) => {
    localStorage.setItem('is-it-dryer-out-ui-preferences', JSON.stringify({ theme, openIndoorOnLaunch: false }));
    localStorage.setItem('is-it-dryer-out-location', JSON.stringify({ location: { name: 'Sale', latitude: 53.4, longitude: -2.3 } }));
    if (feature) {
      const supports = CSS.supports.bind(CSS);
      CSS.supports = (property, value) => (feature === 'native' && property === 'scrollbar-width') ||
        (feature === 'opaque' && /backdrop-filter/.test(property)) ? false : supports(property, value);
    }
  }, { theme, feature });
  await context.route('**/api.open-meteo.com/**', route => {
    const start = Math.floor(Date.now() / 3600000) * 3600, time = Array.from({ length: 50 }, (_, i) => start + i * 3600), repeat = value => time.map(() => value);
    return route.fulfill({ json: { timezone: 'Europe/London', current: { time: start, temperature_2m: 12, relative_humidity_2m: 70, surface_pressure: 1013, wind_speed_10m: 9 },
      hourly: { time, temperature_2m: repeat(12), relative_humidity_2m: repeat(70), surface_pressure: repeat(1013), wind_speed_10m: repeat(9), wind_direction_10m: repeat(90), rain: repeat(0), showers: repeat(0), precipitation_probability: repeat(0) } } });
  });
  return context;
}

async function open(page, id, opener) {
  await page.locator(`[data-page-link="${id === 'settingsDialog' ? 'why' : 'overview'}"]`).click();
  await page.locator(opener).first().click();
  await page.waitForFunction(id => {
    const node = document.getElementById(id), header = node.querySelector('.sheet-header'), footer = node.querySelector('.sheet-footer');
    return Math.abs(parseFloat(node.style.getPropertyValue('--sheet-header-height')) - header.getBoundingClientRect().height) < .1 &&
      Math.abs(parseFloat(node.style.getPropertyValue('--sheet-footer-height')) - (footer?.getBoundingClientRect().height || 0)) < .1;
  }, id);
  await page.locator(`#${id} .sheet-body`).evaluate(node => { node.scrollTop = 0; });
}

async function reportContrast(page, id, theme) {
  const samples = await page.locator('#' + id).evaluate(node => {
    const body = node.querySelector('.sheet-body').getBoundingClientRect(), header = node.querySelector('.sheet-header').getBoundingClientRect();
    return [...node.querySelectorAll('h2, .settings-group > h3, .settings-group-heading > h3, .ruler-control > label:first-child, .location-current strong, #indoorLastSet, .ruler-help, .plan-choice-group legend, #openingLabel, .air-change-estimate')]
      .filter(n => n.getClientRects().length && !n.classList.contains('reading-field'))
      .map(n => { const box = n.getBoundingClientRect(), style = getComputedStyle(n);
        return { node: n, text: n.textContent.trim(), colour: style.color, size: parseFloat(style.fontSize), weight: parseFloat(style.fontWeight),
          box: { x: box.left, y: box.top, width: box.width, height: box.height }, old: n.style.cssText }; })
      .filter(sample => sample.box.width > 2 && sample.box.height > 2 && sample.box.y >= 0 && sample.box.y + sample.box.height < innerHeight &&
        (sample.node.tagName === 'H2' || sample.box.y >= header.bottom && sample.box.y + sample.box.height <= body.bottom))
      .map(sample => { sample.node.dataset.glassContrastSample = 'true'; sample.node.dataset.glassOldStyle = sample.old;
        sample.node.style.setProperty('color', 'transparent', 'important'); delete sample.node; return sample; });
  });
  const screenshot = await page.screenshot();
  const { data, info } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  await page.locator('[data-glass-contrast-sample]').evaluateAll(nodes => nodes.forEach(node => {
    node.style.cssText = node.dataset.glassOldStyle; delete node.dataset.glassOldStyle; delete node.dataset.glassContrastSample;
  }));
  return samples.map(sample => {
    const foreground = sample.colour.match(/[\d.]+/g).slice(0, 3).map(Number), backgrounds = [];
    for (const xFraction of [.2, .5, .8]) for (const yFraction of [.35, .65]) {
      const x = Math.max(0, Math.min(info.width - 1, Math.round(sample.box.x + sample.box.width * xFraction))),
        y = Math.max(0, Math.min(info.height - 1, Math.round(sample.box.y + sample.box.height * yFraction))), index = (y * info.width + x) * info.channels;
      backgrounds.push([...data.subarray(index, index + 3)]);
    }
    const threshold = sample.size >= 24 || sample.size >= 18.66 && sample.weight >= 700 ? 3 : 4.5;
    return { theme, sheet: id, text: sample.text, foreground: sample.colour, threshold,
      ratio: +Math.min(...backgrounds.map(bg => contrast(foreground, bg))).toFixed(2),
      proposed24221f: +Math.min(...backgrounds.map(bg => contrast([36, 34, 31], bg))).toFixed(2) };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  const reports = [], errors = [];
  let checks = 0;
  try {
    for (const theme of ['light', 'dark']) {
      const context = await contextFor(browser, theme), page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(preview); await page.waitForFunction(() => document.querySelector('.recommendation').dataset.weatherState === 'ready');
      for (const width of [320, 390, 640, 1280]) for (const scale of [100, 200]) {
        await page.setViewportSize({ width, height: 700 });
        await page.evaluate(scale => { document.documentElement.style.fontSize = scale + '%'; }, scale);
        for (const [id, opener] of [['settingsDialog', '#settingsButton'], ['indoorDialog', '#indoorDockButton'], ['planDialog', '#planSummaryButton'], ['locationDialog', '#locationButton'], ['timerDialog', '.verdict-time']]) {
          await open(page, id, opener);
          const geometry = await page.locator('#' + id).evaluate(node => {
            const header = node.querySelector('.sheet-header'), body = node.querySelector('.sheet-body'), footer = node.querySelector('.sheet-footer'), box = n => n.getBoundingClientRect(), style = (n, pseudo) => getComputedStyle(n, pseudo);
            const glass = style(node, '::before'), h = box(header), b = box(body), f = footer && box(footer), rail = node.querySelector('.sheet-scrollbar');
            const before = [h.top, f?.top ?? null]; body.scrollTop = body.scrollHeight; const after = [box(header).top, footer && box(footer).top]; body.scrollTop = 0;
            return { before, after, bodyTop: b.top, bodyBottom: b.bottom, headerBottom: h.bottom, footerTop: f?.top,
              headerHeight: h.height, footerHeight: f?.height || 0, background: style(node).backgroundColor,
              material: glass.backgroundColor, headerMaterial: style(header).backgroundColor, footerMaterial: footer && style(footer).backgroundColor,
              blur: glass.backdropFilter, headerBlur: style(header).backdropFilter, footerBlur: footer && style(footer).backdropFilter,
              baseTop: parseFloat(glass.top), baseBottom: parseFloat(glass.bottom), fade: style(header, '::after').content,
              footerFade: footer && style(footer, '::before').content, scrollbarHeight: rail && parseFloat(rail.style.height),
              paddingBottom: parseFloat(style(body).paddingBottom), scrollPaddingBottom: parseFloat(style(body).scrollPaddingBottom),
              overflow: node.scrollWidth > node.clientWidth + 1, contentGap: box(body.firstElementChild).top - h.bottom };
          });
          const label = `${theme}/${width}/${scale}/${id}`, expected = theme === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(36, 34, 31, 0.55)';
          assert.deepEqual(geometry.before, geometry.after, label + ' pinned');
          assert.ok(geometry.bodyTop < geometry.headerBottom, label + ' behind header');
          assert.equal(geometry.material, expected); assert.equal(geometry.headerMaterial, 'rgba(0, 0, 0, 0)');
          assert.equal(geometry.background, 'rgba(0, 0, 0, 0)'); assert.equal(geometry.blur, 'blur(4px)'); assert.equal(geometry.headerBlur, 'none');
          assert.equal(geometry.baseTop, 0); assert.equal(geometry.fade, 'none');
          assert.ok(Math.abs(geometry.contentGap - 16) < .1, `${label} gap ${geometry.contentGap}`); assert.equal(geometry.overflow, false);
          if (geometry.footerHeight) {
            assert.ok(geometry.bodyBottom > geometry.footerTop, label + ' behind footer'); assert.equal(geometry.footerMaterial, expected); assert.equal(geometry.footerBlur, 'blur(4px)');
            assert.equal(geometry.footerFade, 'none'); assert.ok(Math.abs(geometry.baseBottom - geometry.footerHeight) < .1);
            assert.ok(geometry.paddingBottom >= geometry.footerHeight + 16); assert.ok(geometry.scrollPaddingBottom >= geometry.footerHeight + 20);
          }
          if (width === 390 && scale === 100) {
            await page.locator('#' + id).screenshot({ path: path.join(artifacts, `${theme}-${id}.png`) });
            reports.push(...await reportContrast(page, id, theme));
            if (theme === 'light' && id === 'indoorDialog') {
              const proposal = await page.addStyleTag({ content: '#indoorDialog .ruler-control > label:first-child:not(.reading-field) { color: #24221f; }' });
              await page.locator('#' + id).screenshot({ path: path.join(artifacts, 'light-indoor-label-proposal.png') });
              await proposal.evaluate(node => node.remove());
            }
            if (id === 'settingsDialog' || id === 'planDialog') {
              await page.locator('#' + id + ' .sheet-body').evaluate(node => { node.scrollTop = node.scrollHeight; });
              reports.push(...await reportContrast(page, id, theme));
            }
          }
          await page.locator(`#${id} .sheet-close-button`).click(); checks++;
        }
      }
      await page.setViewportSize({ width: 390, height: 568 }); await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      for (const [id, opener] of [['settingsDialog', '#settingsButton'], ['indoorDialog', '#indoorDockButton'], ['planDialog', '#planSummaryButton'], ['locationDialog', '#locationButton'], ['timerDialog', '.verdict-time']]) {
        await open(page, id, opener);
        await page.locator('#' + id + ' .sheet-body').evaluate(node => {
          const extra = document.createElement('div'); extra.style.height = '1000px'; extra.dataset.glassScrollTest = 'true'; node.append(extra);
        });
        const tint = theme === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(36, 34, 31, 0.55)';
        for (const [scroll, cover] of [[0, false], [8, false], [16, false], [20, true], [80, true], [0, false]]) {
          await page.locator('#' + id + ' .sheet-body').evaluate((node, scroll) => { node.scrollTop = scroll; }, scroll);
          await page.waitForFunction(({ id, cover }) => document.getElementById(id).classList.contains('has-header-overlap') === cover, { id, cover });
          const layers = await page.locator('#' + id).evaluate(node => ({
            top: parseFloat(getComputedStyle(node, '::before').top), height: node.querySelector('.sheet-header').getBoundingClientRect().height,
            tint: getComputedStyle(node.querySelector('.sheet-header')).backgroundColor,
            blur: getComputedStyle(node.querySelector('.sheet-header')).backdropFilter
          }));
          assert.ok(Math.abs(layers.top - (cover ? layers.height : 0)) < .01, `${theme}/${id}/${scroll} single tint`);
          assert.equal(layers.tint, cover ? tint : 'rgba(0, 0, 0, 0)'); assert.equal(layers.blur, cover ? 'blur(4px)' : 'none');
          if (id === 'settingsDialog' && (scroll === 8 || scroll === 80)) {
            await page.locator('#' + id).screenshot({ path: path.join(artifacts, `${theme}-header-${cover ? 'covered' : 'continuous'}.png`) });
          }
        }
        await page.locator('#' + id + ' [data-glass-scroll-test]').evaluate(node => node.remove());
        await page.locator(`#${id} .sheet-close-button`).click();
      }
      await open(page, 'timerDialog', '.verdict-time');
      await page.locator('#timerDialog .sheet-body').evaluate(node => {
        const test = document.createElement('div'); test.innerHTML = '<p style="height:800px">Scrollable footer verification</p><label class="reading-field ruler-value">Last control<input id="glassLastControl" aria-label="Last control" value="42"></label>';
        node.append(test);
      });
      await page.locator('#glassLastControl').focus();
      await page.locator('#glassLastControl').evaluate(node => node.scrollIntoView({ block: 'end' }));
      const last = await page.locator('#glassLastControl').evaluate(node => ({ bottom: node.getBoundingClientRect().bottom, footer: node.closest('dialog').querySelector('.sheet-footer').getBoundingClientRect().top }));
      assert.ok(last.bottom <= last.footer - 16, `${theme} last control clears footer ${JSON.stringify(last)}`);
      const hit = await page.locator('#timerStartButton').evaluate(node => { const b = node.getBoundingClientRect(); return document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2)?.closest('#timerStartButton') === node; });
      assert.equal(hit, true, 'pinned action stays clickable');
      await page.locator('#timerDialog').screenshot({ path: path.join(artifacts, `${theme}-timer-footer-scroll.png`) });
      const board = await context.newPage();
      await board.setViewportSize({ width: 1280, height: 900 });
      await board.goto(new URL('docs/design-system.html#sheet-headers', preview).href);
      await board.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      await board.waitForFunction(() => document.querySelectorAll('.board-sheet.has-frosted-header').length === 7);
      const specimens = await board.locator('.board-sheet').evaluateAll(nodes => nodes.map(node => {
        const header = node.querySelector('.sheet-header'), body = node.querySelector('.sheet-body'), footer = node.querySelector('.sheet-footer'),
          style = (n, pseudo) => getComputedStyle(n, pseudo), base = style(node, '::before');
        return { tint: base.backgroundColor, blur: base.backdropFilter, header: style(header).backgroundColor,
          footer: footer && style(footer).backgroundColor, gap: body.firstElementChild.getBoundingClientRect().top - header.getBoundingClientRect().bottom,
          baseTop: parseFloat(base.top), height: header.getBoundingClientRect().height,
          baseBottom: parseFloat(base.bottom), footerHeight: footer?.getBoundingClientRect().height || 0,
          bodyBottom: body.getBoundingClientRect().bottom, footerTop: footer?.getBoundingClientRect().top,
          fade: style(header, '::after').content, footerFade: footer && style(footer, '::before').content };
      }));
      const boardTint = theme === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(36, 34, 31, 0.55)';
      for (const specimen of specimens) {
        assert.equal(specimen.tint, boardTint); assert.equal(specimen.header, 'rgba(0, 0, 0, 0)'); assert.equal(specimen.blur, 'blur(4px)');
        assert.ok(Math.abs(specimen.gap - 16) < .1); assert.equal(specimen.baseTop, 0);
        assert.equal(specimen.fade, 'none');
        if (specimen.footerHeight) {
          assert.equal(specimen.footer, boardTint); assert.equal(specimen.footerFade, 'none');
          assert.ok(specimen.bodyBottom > specimen.footerTop); assert.ok(Math.abs(specimen.baseBottom - specimen.footerHeight) < .1);
        }
      }
      await board.locator('#sheet-headers').screenshot({ path: path.join(artifacts, `${theme}-visual-board.png`) });
      await board.locator('.board-sheet .sheet-body').evaluateAll(nodes => nodes.forEach(node => { node.scrollTop = 40; }));
      await board.waitForFunction(() => document.querySelectorAll('.board-sheet.has-header-overlap').length === 7);
      const coveredSpecimens = await board.locator('.board-sheet').evaluateAll(nodes => nodes.map(node => ({
        top: parseFloat(getComputedStyle(node, '::before').top), height: node.querySelector('.sheet-header').getBoundingClientRect().height,
        tint: getComputedStyle(node.querySelector('.sheet-header')).backgroundColor,
        blur: getComputedStyle(node.querySelector('.sheet-header')).backdropFilter
      })));
      for (const specimen of coveredSpecimens) {
        assert.ok(Math.abs(specimen.top - specimen.height) < .01); assert.equal(specimen.tint, boardTint); assert.equal(specimen.blur, 'blur(4px)');
      }
      await context.close();
    }
    for (const feature of ['native', 'opaque']) {
      const context = await contextFor(browser, 'light', feature), page = await context.newPage();
      await page.goto(preview); await page.waitForFunction(() => !document.documentElement.classList.contains('layout-pending'));
      await page.locator('[data-page-link="why"]').click(); await page.locator('#settingsButton').click();
      if (feature === 'native') {
        await page.waitForFunction(() => document.querySelector('#settingsDialog').classList.contains('has-frosted-header'));
        assert.equal(await page.locator('#settingsDialog .sheet-scrollbar').count(), 0);
      } else assert.equal(await page.locator('#settingsDialog').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(255, 255, 255)');
      await context.close();
    }
    const context = await contextFor(browser, 'dark'), page = await context.newPage();
    await page.emulateMedia({ forcedColors: 'active' }); await page.goto(preview);
    await page.waitForFunction(() => !document.documentElement.classList.contains('layout-pending'));
    await page.locator('[data-page-link="why"]').click(); await page.locator('#settingsButton').click();
    assert.equal(await page.locator('#settingsDialog').evaluate(node => node.classList.contains('has-frosted-header')), false);
    assert.equal(await page.locator('#settingsDialog .sheet-body').evaluate(node => getComputedStyle(node).scrollbarWidth), 'auto');
    await context.close();
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(artifacts, 'contrast.json'), JSON.stringify(reports, null, 2));
    console.log(`PASS ${checks} glass sheet layouts, 14 visual-board specimens, 60 header overlap transitions, footer overlap/focus, native-scrollbar independence, opaque fallback and forced colours.`);
    console.log('READABILITY REVIEW ' + JSON.stringify(reports.filter(sample => sample.ratio < sample.threshold)));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
