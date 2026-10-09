const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const preview = process.argv[2] || 'http://127.0.0.1:8780/';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', hasTouch: true, reducedMotion: 'reduce', viewport: {width:390,height:1400} });
    await context.addInitScript(() => localStorage.setItem('is-it-dryer-out-ui-preferences', JSON.stringify({openIndoorOnLaunch:false,
      showIndoorSummary:true,showRecommendation:false,pageOrder:['supporting-details','moisture-comparison','recommendation','indoor-summary']})));
    let requests=0, finishWeather, failure=false;
    await context.route('**/api.open-meteo.com/**', async route => {
      requests++;
      if (requests>1) await new Promise(resolve => { finishWeather=resolve; });
      if (failure) return route.fulfill({status:500,body:'failed'});
      const start=Math.floor(Date.now()/3600000)*3600, time=Array.from({length:50},(_,i)=>start+i*3600), repeat=n=>time.map(()=>n);
      await route.fulfill({json:{timezone:'Europe/London',current:{time:start,temperature_2m:12,relative_humidity_2m:70,dew_point_2m:7,surface_pressure:1013,wind_speed_10m:9},
        hourly:{time,temperature_2m:repeat(12),relative_humidity_2m:repeat(70),dew_point_2m:repeat(7),surface_pressure:repeat(1013),wind_speed_10m:repeat(9),wind_direction_10m:repeat(90),rain:repeat(0),showers:repeat(0),precipitation_probability:repeat(0)}}});
    });
    const page=await context.newPage(), errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto(preview); await page.waitForFunction(()=>!document.querySelector('#refreshWeather').disabled && document.querySelector('#ahChart').hasAttribute('aria-valuenow'));
    assert.deepEqual(await page.locator('.app-shell > [data-page-box]').evaluateAll(nodes=>nodes.map(n=>n.dataset.pageBox)),
      ['recommendation','supporting-details','moisture-comparison','indoor-summary']);
    assert.equal(await page.locator('.recommendation').evaluate(n=>n.hidden),false);
    let popups=0; context.on('page',()=>popups++);
    const session=await context.newCDPSession(page);
    const touch=async(type,x,y)=>session.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y,id:1}]});
    const begin=async(selector,amount=210)=>{
      await page.evaluate(()=>window.scrollTo(0,0));
      const b=await page.locator(selector).boundingBox(), x=b.x+b.width/2, y=b.y+Math.min(b.height/2,30);
      await touch('touchStart',x,y); await touch('touchMove',x,y+20); await touch('touchMove',x,y+amount);
      return {x,y};
    };
    const settled=()=>page.waitForFunction(()=>!['pull-active','pull-refreshing','pull-result'].some(n=>document.body.classList.contains(n))&&!document.body.style.getPropertyValue('--pull-distance'));
    const geometry=async()=>{
      const result=await page.evaluate(()=>{
        const recommendation=document.querySelector('.recommendation'), verdict=document.querySelector('.verdict-panel'), strip=document.querySelector('.forecast-panel');
        const nodes=[...recommendation.parentElement.children].slice(1).filter(n=>!n.hidden), bottom=Math.max(verdict.getBoundingClientRect().bottom,strip.getBoundingClientRect().bottom);
        return {gaps:nodes.map((n,i)=>n.getBoundingClientRect().top-(i?nodes[i-1].getBoundingClientRect().bottom:bottom)),
          same:nodes.every(n=>getComputedStyle(n).transform===getComputedStyle(strip).transform)};
      });
      assert.ok(result.gaps.every(g=>Math.abs(g-16)<.1),JSON.stringify(result)); assert.equal(result.same,true);
    };
    fs.mkdirSync('work/page-layout/pull',{recursive:true});
    let starts=0;
    for(const selector of ['.recommendation h1','#locationButton','#refreshWeather','[data-chart-hours="24"]','#ahChart','#explanationToggle','#liveWeatherRequest']) {
      if(!await page.locator(selector).count()) continue;
      // Expanded supporting content remains compatible with a top-of-page pull.
      if(selector==='#liveWeatherRequest') { await page.locator('.weather-data-explainer').evaluate(n=>n.open=true); await page.setViewportSize({width:390,height:2600}); }
      const b=await page.locator(selector).boundingBox(); if(!b || b.y>2400) continue;
      const before=await page.locator('#ahChart').getAttribute('aria-valuenow');
      await begin(selector); assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('pull-active')),true,selector);
      await geometry(); await page.screenshot({path:`work/page-layout/pull/start-${starts}.png`});
      if(selector==='#ahChart') assert.equal(await page.locator('#ahChart').getAttribute('aria-valuenow'),before);
      await touch('touchEnd'); await page.waitForFunction(()=>document.body.classList.contains('pull-refreshing'));
      assert.equal(await page.locator('dialog[open]').count(),0,`no accidental action: ${selector}`);
      await geometry(); finishWeather(); await page.waitForFunction(()=>document.body.classList.contains('pull-result')); await geometry(); await settled(); starts++;
    }
    await page.setViewportSize({width:390,height:1400});
    // Chart taps and horizontal touch drags still inspect, without a refresh.
    await page.evaluate(()=>window.scrollTo(0,0)); const cb=await page.locator('#ahChart').boundingBox(), cx=cb.x+cb.width*.2, cy=cb.y+cb.height*.5;
    const count=requests;
    await touch('touchStart',cx,cy); await touch('touchEnd'); const initial=await page.locator('#ahChart').getAttribute('aria-valuenow');
    await touch('touchStart',cx,cy); await touch('touchMove',cx+80,cy+2); await touch('touchEnd');
    assert.notEqual(await page.locator('#ahChart').getAttribute('aria-valuenow'),initial); assert.equal(requests,count);
    await settled();
    // A cancelled pull must not consume the next ordinary tap.
    await begin('#locationButton',35); await touch('touchCancel'); await settled(); await page.locator('#locationButton').tap();
    assert.equal(await page.locator('#locationDialog').evaluate(n=>n.open),true); await page.locator('#locationDialog').evaluate(n=>n.close());
    const overlays=['#settingsDialog','#indoorDialog','#planDialog','#locationDialog','#timerDialog','#cameraCropHint','#pageLayoutMenu','.timer-help'];
    const setOverlay=async(selector,open)=>page.locator(selector).evaluate((n,open)=>{
      if(n.tagName==='DIALOG') { if(open)n.showModal();else n.close(); }
      else if(n.tagName==='DETAILS')n.open=open; else n.hidden=!open;
    },open);
    for(const selector of overlays) {
      await setOverlay(selector,true); const prior=requests;
      // Send to a noninteractive background coordinate; the modal may retarget it.
      await touch('touchStart',10,40); await touch('touchMove',10,250); await touch('touchEnd');
      assert.equal(requests,prior,selector); assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('pull-active')),false);
      await setOverlay(selector,false);
      await begin('.recommendation h1'); await setOverlay(selector,true); await page.waitForTimeout(0);
      assert.equal(await page.locator('body').evaluate(n=>n.style.getPropertyValue('--pull-distance')), '');
      await setOverlay(selector,false); await touch('touchEnd'); assert.equal(requests,prior,`cancelled ${selector}`);
    }
    // A native popover also locks refresh.
    await page.evaluate(()=>{const n=document.createElement('div');n.id='testPopover';n.popover='auto';n.textContent='Popup';document.body.append(n);n.showPopover();});
    const prior=requests; await begin('.recommendation h1'); await touch('touchEnd'); assert.equal(requests,prior);
    await page.evaluate(()=>document.querySelector('#testPopover').remove());
    // Opening and then closing a sheet during a request must not resurrect feedback.
    await begin('.recommendation h1'); await touch('touchEnd'); await page.waitForFunction(()=>document.body.classList.contains('pull-refreshing'));
    await setOverlay('#settingsDialog',true); await page.waitForTimeout(0); await setOverlay('#settingsDialog',false);
    finishWeather(); await page.waitForFunction(()=>!document.querySelector('#refreshWeather').disabled && document.querySelector('#ahChart').hasAttribute('aria-valuenow')); await settled();
    assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('pull-result')),false);
    failure=true; await begin('.recommendation h1'); await touch('touchEnd'); await page.waitForFunction(()=>document.body.classList.contains('pull-refreshing'));
    finishWeather(); await page.waitForFunction(()=>document.body.classList.contains('pull-failed')); await geometry(); await settled();
    assert.equal(popups,0,'No link was activated by a refresh gesture');
    // Animate a cancellation with the ordinary spring and measure intermediate frames.
    await page.emulateMedia({reducedMotion:'no-preference'});
    await begin('.recommendation h1',35); await touch('touchCancel');
    for(let i=0;i<5;i++){await page.waitForTimeout(60);await geometry();}
    await settled();
    assert.deepEqual(errors,[]);
    console.log(`PASS ${starts} interactive touch starts, chart taps/horizontal drags, ${overlays.length+1} overlay types, cancellation, pending-overlay suppression and failure geometry.`);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
