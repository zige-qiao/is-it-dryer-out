const { test } = require('node:test');
const assert = require('node:assert/strict');
const { element, memoryStorage } = require('./helpers/browser.cjs');
const { LOCATION_STORAGE_KEY } = require('../src/config.js');

test('entry point wires features, restores values, opens Indoor readings and refreshes weather',async()=>{
  const nodes=new Map(),pageEvents=new Map(),windowEvents=new Map(),frames=[],intervals=[],registered=[];
  const node=selector=>{
    if(!nodes.has(selector)) {
      const value=element();value.getBoundingClientRect=()=>({width:390,left:0,top:0});value.querySelector=child=>node(`${selector} ${child}`);
      nodes.set(selector,value);
    }
    return nodes.get(selector);
  };
  const document={
    hidden:false,visibilityState:'visible',documentElement:element(),body:element(),
    querySelector:selector=>selector==='dialog[open]'?[...nodes.values()].find(el=>el.open)||null:node(selector),querySelectorAll:()=>[],createElement:element,createElementNS:()=>element(),
    addEventListener:(name,fn)=>pageEvents.set(name,fn),
  };
  const properties=new Map();
  for(const el of [document.body,document.documentElement,node('.app-shell')]) el.style={getPropertyValue:n=>properties.get(n)||'',getPropertyPriority:()=>'',setProperty:(n,v)=>properties.set(n,v),removeProperty:n=>properties.delete(n)};
  const localStorage=memoryStorage();localStorage.setItem(LOCATION_STORAGE_KEY,JSON.stringify({location:{name:'Sale',latitude:53.4,longitude:-2.3}}));
  const replacements={document,localStorage,
    window:{location:{search:''},matchMedia:()=>({matches:false}),addEventListener:(name,fn)=>windowEvents.set(name,fn),removeEventListener(){},requestAnimationFrame:fn=>frames.push(fn),cancelAnimationFrame(){},innerHeight:844,scrollX:0,scrollY:0,scrollTo(){}},
    navigator:{userAgent:'Test',serviceWorker:{register:url=>registered.push(url)}},
    ResizeObserver:class {observe(){}},
    requestAnimationFrame:fn=>frames.push(fn),cancelAnimationFrame(){},
    setInterval:fn=>intervals.push(fn),clearInterval(){},setTimeout:()=>1,clearTimeout(){},
    fetch:async()=>({ok:true,json:async()=>({current:{temperature_2m:10,relative_humidity_2m:70,surface_pressure:1013.25,time:Date.now()/1000}})}),
  };
  const previous=Object.fromEntries(Object.keys(replacements).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  try {
    for(const [key,value] of Object.entries(replacements)) Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
    require('../app.js');await new Promise(setImmediate);
    // Run the scheduled launch action; viewport frames may enqueue one more frame.
    for(const fn of frames.splice(0)) fn();
    assert.equal(node('#indoorDialog').open,true);
    assert.equal(node('#indoorTempValue').textContent,'24.0°C');
    assert.equal(node('#weatherStatus').textContent,'Checked just now');
    assert.equal(node('#decisionLabel').textContent,'OPEN WINDOWS');
    assert.deepEqual(registered,['service-worker.js']);assert.equal(intervals.length,2);
    assert.ok(pageEvents.has('visibilitychange'));assert.ok(windowEvents.has('pagehide'));
    node('#planSummaryButton').emit('click');assert.equal(node('#planDialog').open,true);
    node('#locationButton').emit('click');assert.equal(node('#locationDialog').open,true);
    node('#settingsButton').emit('click');assert.equal(node('#settingsDialog').open,true);
  } finally {
    for(const [key,descriptor] of Object.entries(previous)) {if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
  }
});
