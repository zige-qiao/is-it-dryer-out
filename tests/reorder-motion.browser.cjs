const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const preview = process.argv[2] || 'http://127.0.0.1:8780/';
(async () => {
 const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? {channel:'msedge'} : {}) });
 try {
  const context = await browser.newContext({serviceWorkers:'block',hasTouch:true,viewport:{width:390,height:900}});
    await context.addInitScript(() => localStorage.setItem('is-it-dryer-out-ui-preferences', JSON.stringify({ openIndoorOnLaunch: false })));
    await context.route('**/api.open-meteo.com/**', route => {
      const start = Math.floor(Date.now() / 3600000) * 3600, time = Array.from({ length: 50 }, (_, i) => start + i * 3600), repeat = n => time.map(() => n);
      return route.fulfill({ json: { timezone: 'Europe/London', current: { time: start, temperature_2m: 12, relative_humidity_2m: 70, surface_pressure: 1013, wind_speed_10m: 9 }, hourly: { time, temperature_2m: repeat(12), relative_humidity_2m: repeat(70), surface_pressure: repeat(1013), wind_speed_10m: repeat(9), wind_direction_10m: repeat(90), rain: repeat(0), showers: repeat(0), precipitation_probability: repeat(0) } } });
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(preview); await page.waitForFunction(() => !document.documentElement.classList.contains('layout-pending') && document.querySelector('#decisionLabel').textContent !== 'CHECKING');

  await page.locator('#settingsButton').click();
  const cdp = await context.newCDPSession(page);
  fs.mkdirSync('work/page-layout/reorder-motion', {recursive:true});
  let checks = 0;
  for (const width of [320,390,768,1280]) for (const scale of [100,200]) {
   await page.setViewportSize({width,height:1100});
   await page.evaluate(scale => { document.documentElement.style.fontSize=scale+'%'; document.querySelector('.settings-dialog-content').scrollTop=0; },scale);
   await page.locator('#resetPageLayout').click();
   const original = await page.locator('#pageLayoutList > li').evaluateAll(nodes => nodes.map(n=>n.dataset.layoutRow));
   const source = page.locator('[data-layout-row="indoor-summary"]'), handle=source.locator('[data-drag-handle]');
   const b = await source.boundingBox(), h = await handle.boundingBox();
   const point = y => [{x:h.x+22,y,id:1}];
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:point(h.y+22)});
   await page.waitForTimeout(320);
   assert.equal(await source.evaluate(n=>n.classList.contains('is-reorder-ready')),true);
   if(width===390&&scale===100) await page.screenshot({path:'work/page-layout/reorder-motion/ready.png'});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:point(h.y+34)});
   const ghost=page.locator('.layout-drag-preview'), g=await ghost.boundingBox();
   assert.ok(Math.abs(g.width-b.width)<1 && Math.abs(g.height-b.height)<1,'preview measured size');
   assert.ok(Math.abs(g.x-b.x)<1 && Math.abs(g.y-b.y-12)<1,'preview preserves finger offset and horizontal position');
   assert.equal(await page.locator('.layout-drag-layer').evaluate(n=>n.inert && n.getAttribute('aria-hidden')==='true'),true);
   assert.equal(await page.locator('.layout-drag-layer [id],[data-insert]').count(),0);
   assert.equal(await ghost.evaluate(n=>getComputedStyle(n).opacity),'1');
   const next=await page.locator('[data-layout-row="moisture-comparison"]').boundingBox();
   const offset=h.y+22-b.y;
   const cross=next.y+next.height/2+10-b.height/2+offset;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:point(cross)});
   const gapTop=await page.locator('.layout-drag-gap').evaluate(n=>n.style.top);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:point(cross-4)});
   assert.equal(await page.locator('.layout-drag-gap').evaluate(n=>n.style.top),gapTop,'stable midpoint');
   assert.deepEqual(await page.locator('#pageLayoutList > li').evaluateAll(nodes=>nodes.map(n=>n.dataset.layoutRow)),original);
   const layer=await page.locator('.layout-drag-layer').boundingBox(), body=await page.locator('.settings-dialog-content').boundingBox();
   assert.ok(Math.abs(layer.y-body.y)<1 && Math.abs(layer.height-body.height)<1,'preview confined to body');
   if(width===390&&scale===100) await page.screenshot({path:'work/page-layout/reorder-motion/dragging.png'});
   await page.keyboard.press('Escape'); await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await page.waitForFunction(()=>!document.querySelector('.layout-drag-layer'));
   assert.deepEqual(await page.locator('#pageLayoutList > li').evaluateAll(nodes=>nodes.map(n=>n.dataset.layoutRow)),original);
   assert.equal(await page.locator('.is-drag-source,.is-reorder-ready').count(),0);
   assert.equal(await handle.evaluate(n=>document.activeElement===n),true);
   await handle.click(); await page.getByRole('menuitem',{name:'Move down',exact:true}).click();
   await page.waitForTimeout(180);
   assert.equal(await page.locator('#pageLayoutList > li').nth(2).getAttribute('data-layout-row'),'indoor-summary');
   checks++;
  }
  for(const reduced of [false,true]) {
   await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference',forcedColors:'active'});
   await page.setViewportSize({width:390,height:568}); await page.evaluate(()=>document.documentElement.style.fontSize='100%');
   await page.locator('#resetPageLayout').click();
   const handle=page.locator('[data-layout-row="indoor-summary"] [data-drag-handle]'); const b=await handle.boundingBox();
   await page.mouse.move(b.x+22,b.y+22);await page.mouse.down();await page.mouse.move(b.x+22,b.y+42);
   assert.equal(await page.locator('.layout-drag-gap').evaluate(n=>getComputedStyle(n).outlineStyle),'dashed');
   if(reduced) assert.equal(await page.locator('#pageLayoutList').evaluate(n=>n.getAnimations({subtree:true}).length),0);
   const pinned=await page.locator('[data-layout-row="recommendation"]').boundingBox();
   await page.mouse.move(b.x+22,pinned.y-50);
   const ghost=await page.locator('.layout-drag-preview').boundingBox();
   assert.ok(ghost.y>=pinned.y+pinned.height-1,'preview cannot cross pinned row');
   await page.mouse.up(); await page.waitForFunction(()=>!document.querySelector('.layout-drag-layer'));
   assert.equal(await page.locator('#pageLayoutList > li').first().getAttribute('data-layout-row'),'recommendation');
  }
  assert.deepEqual(errors,[]);
  console.log(`PASS ${checks} responsive hold/drag/gap/cancel/menu views, variable row geometry, inert previews, reduced motion and forced colours.`);
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
