const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const preview = process.argv[2] || 'http://127.0.0.1:8780/';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
 try{
 const context=await browser.newContext({serviceWorkers:'block',hasTouch:true,viewport:{width:390,height:1400}});
    await context.addInitScript(() => localStorage.setItem('is-it-dryer-out-ui-preferences', JSON.stringify({ openIndoorOnLaunch: false })));
    await context.route('**/api.open-meteo.com/**', route => {
      const start = Math.floor(Date.now() / 3600000) * 3600, time = Array.from({ length: 50 }, (_, i) => start + i * 3600), repeat = n => time.map(() => n);
      return route.fulfill({ json: { timezone: 'Europe/London', current: { time: start, temperature_2m: 12, relative_humidity_2m: 70, surface_pressure: 1013, wind_speed_10m: 9 }, hourly: { time, temperature_2m: repeat(12), relative_humidity_2m: repeat(70), surface_pressure: repeat(1013), wind_speed_10m: repeat(9), wind_direction_10m: repeat(90), rain: repeat(0), showers: repeat(0), precipitation_probability: repeat(0) } } });
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(preview); await page.waitForFunction(() => !document.documentElement.classList.contains('layout-pending') && document.querySelector('#decisionLabel').textContent !== 'CHECKING');


 await page.locator('#settingsButton').click();
 const cdp=await context.newCDPSession(page);
 let checks=0;
 for(const width of [320,390,768,1280]) for(const scale of [100,200]) {
  await page.setViewportSize({width,height:1400});
  await page.evaluate(scale=>{document.documentElement.style.fontSize=scale+'%';const b=document.querySelector('.settings-dialog-content');b.style.maxHeight='';b.scrollTop=0;},scale);
  await page.locator('#resetPageLayout').click();
  await page.evaluate(()=>{const body=document.querySelector('.settings-dialog-content'),list=document.querySelector('#pageLayoutList');body.style.maxHeight=(list.getBoundingClientRect().bottom-body.getBoundingClientRect().top+20)+'px';});
  const extent=await page.locator('.settings-dialog-content').evaluate(n=>n.scrollHeight-n.clientHeight);
  assert.ok(extent>0,'unrelated settings can scroll but reordered list fits');
  const order=await page.locator('#pageLayoutList > li').evaluateAll(ns=>ns.map(n=>n.dataset.layoutRow));
  const body=await page.locator('.settings-dialog-content').boundingBox();
  const last=await page.locator('[data-layout-row="supporting-details"]').boundingBox();
  assert.ok(last.y+last.height<=body.y+body.height-16+.5,'all destinations visible');
  for(const id of ['indoor-summary','moisture-comparison','supporting-details']) for(const target of ['indoor-summary','supporting-details']) {
   const h=await page.locator(`[data-layout-row="${id}"] [data-drag-handle]`).boundingBox();
   const dest=await page.locator(`[data-layout-row="${target}"]`).boundingBox();
   const start=h.y+22,finish=target==='supporting-details'?dest.y+dest.height-2:dest.y+2;
   const points=y=>[{x:h.x+22,y,id:1}];
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(start)});await page.waitForTimeout(320);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(finish)});await page.waitForTimeout(350);
   assert.equal(await page.locator('.settings-dialog-content').evaluate(n=>n.scrollTop),0,`${width}/${scale}/${id}/${target}: visible rows cannot scroll`);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
   await page.waitForFunction(()=>!document.querySelector('.layout-drag-layer'));
   assert.deepEqual(await page.locator('#pageLayoutList > li').evaluateAll(ns=>ns.map(n=>n.dataset.layoutRow)),order);
   checks++;
  }
 }
 // A short screen with large text must reveal clipped destinations, then stop before unrelated settings.
 await page.evaluate(()=>document.querySelector('.settings-dialog-content').style.maxHeight='');
 await page.setViewportSize({width:390,height:568});await page.evaluate(()=>document.documentElement.style.fontSize='200%');
 await page.locator('#resetPageLayout').click();
 const body=await page.locator('.settings-dialog-content').boundingBox();
 const h=await page.locator('[data-layout-row="indoor-summary"] [data-drag-handle]').boundingBox();
 await page.mouse.move(h.x+22,h.y+22);await page.mouse.down();await page.mouse.move(h.x+22,body.y+body.height-17);

 await page.waitForTimeout(120);assert.equal(await page.locator('.settings-dialog-content').evaluate(n=>n.scrollTop),0,'edge dwell');
 await page.waitForFunction(()=>{const body=document.querySelector('.settings-dialog-content').getBoundingClientRect(),list=document.querySelector('#pageLayoutList').getBoundingClientRect();return list.bottom<=body.bottom-16+.5;},{},{timeout:6000});
 const stopped=await page.locator('.settings-dialog-content').evaluate(n=>n.scrollTop);
 assert.ok(stopped>0,'clipped destinations scroll');
 const last=await page.locator('#pageLayoutList').boundingBox();
 assert.ok(last.y+last.height<=body.y+body.height-16+1,'last destination revealed');
 await page.waitForTimeout(350);assert.equal(await page.locator('.settings-dialog-content').evaluate(n=>n.scrollTop),stopped,'do not scroll into Indoor readings');
 await page.keyboard.press('Escape');await page.mouse.up();await page.waitForFunction(()=>!document.querySelector('.layout-drag-layer'));
 assert.deepEqual(errors,[]);
 console.log(`PASS ${checks} native held drags with a fully visible list and scrollable unrelated settings; short-screen enlarged-text dwell, reveal and automatic stopping.`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
