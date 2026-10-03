const {test}=require('node:test');
const assert=require('node:assert/strict');
const { environment } = require('./helpers/browser.cjs');
const { createReadingControls } = require('../src/ui/readings.js');
const { createStorage } = require('../src/services/storage.js');
const ctx=createReadingControls();
test('ruler drag snaps in both directions without floating-point drift',()=>{
 assert.equal(ctx.rulerValueFromDrag(24,8,10,32,.1,8),23.9);
 assert.equal(ctx.rulerValueFromDrag(24,-80,10,32,.1,8),25);
 assert.equal(ctx.rulerValueFromDrag(58,-14,20,90,1,14),59);
 assert.equal(ctx.rulerValueFromDrag(58,27,20,90,1,14),56);
});
test('ruler drag and typed values clamp and snap to supported readings',()=>{
 assert.equal(ctx.rulerValueFromDrag(10,999,10,32,.1,8),10);
 assert.equal(ctx.rulerValueFromDrag(90,-999,20,90,1,14),90);
 assert.equal(ctx.rulerValueFromDrag(23.76,0,10,32,.1,8),23.8);
 assert.equal(ctx.rulerValueFromDrag(58.4,0,20,90,1,14),58);
});
test('old readings retain values without inventing a last-set timestamp',()=>{
 let saved=JSON.stringify({indoorTemp:21.5,indoorRh:61});
 const state={indoorTemp:24,indoorRh:58};
 const context=environment({state,Date,localStorage:{getItem:()=>saved,setItem:(_,s)=>saved=s,removeItem:()=>{}}});
 Object.assign(context,createStorage(context,context));
 context.loadIndoorReadings();
 assert.equal(state.indoorLastSet,null); assert.equal(state.indoorTemp,21.5);
 context.saveIndoorReadings(); const timestamp=state.indoorLastSet;
 assert.ok(timestamp<=Date.now()); assert.equal(JSON.parse(saved).indoorLastSet,timestamp);
 state.indoorLastSet=null;context.loadIndoorReadings();assert.equal(state.indoorLastSet,timestamp);
 saved=JSON.stringify({indoorTemp:21.5,indoorRh:61,indoorLastSet:'invalid'});
 context.loadIndoorReadings(); assert.equal(state.indoorLastSet,null);
});
test('pointer gestures ignore taps and vertical scrolling, and stop after cancellation',()=>{
 const events={},dialogEvents={}; let captured=false,changes=0;
 const input={value:24,min:10,max:32,step:.1,focus(){},dispatchEvent(){changes++;}};
 const ruler={dataset:{tickSpacing:8},closest:()=>({addEventListener:(name,fn)=>dialogEvents[name]=fn}),querySelector:()=>input,classList:{add(){},remove(){}},addEventListener:(name,fn)=>events[name]=fn,setPointerCapture(){captured=true},hasPointerCapture(){return captured},releasePointerCapture(){captured=false}};
 const field={addEventListener(){}};
 const context=environment({window:{addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})},document:{addEventListener(){},querySelectorAll:()=>[ruler],querySelector:()=>({addEventListener:(name,fn)=>dialogEvents[name]=fn})},elements:{indoorTempInput:field,indoorRhInput:field,minTempInput:field,targetRhInput:field},ResizeObserver:class{observe(){}},renderReadingRulers(){},Event:class{},rulerValueFromDrag:ctx.rulerValueFromDrag});
 Object.assign(context,createReadingControls(context,context));context.bindReadingRulers();
 const point=(x,y)=>({isPrimary:true,button:0,pointerId:1,clientX:x,clientY:y});
 events.pointerdown(point(100,100));events.pointerup(point(100,100));assert.equal(changes,0);
 events.pointerdown(point(100,100));events.pointermove(point(101,120));assert.equal(changes,0);
 events.pointerdown(point(100,100));events.pointermove(point(108,100));assert.equal(input.value,23.9);
 events.pointercancel();events.pointermove(point(180,100));assert.equal(changes,1);assert.equal(captured,false);
 events.pointerdown(point(100,100));dialogEvents.close();events.pointermove(point(180,100));assert.equal(changes,1);
});

function momentumFixture({reduced=false,value=24,step=.1,min=10,max=32,spacing=step<1?8:14}={}) {
 const events={},dialogEvents={},pageEvents={},motionEvents={};let captured=false,time=0,id=0;
 const frames=new Map(); const motion={matches:reduced,addEventListener:(n,fn)=>motionEvents[n]=fn};
 const input={value,min,max,step,focus(){},dispatchEvent(){}};
 const ruler={dataset:{tickSpacing:spacing},closest:()=>({addEventListener:(name,fn)=>dialogEvents[name]=fn}),querySelector:()=>input,classList:{add(){},remove(){}},addEventListener:(n,fn)=>events[n]=fn,setPointerCapture(){captured=true},hasPointerCapture:()=>captured,releasePointerCapture(){captured=false;events.lostpointercapture();}};
 const doc={hidden:false,querySelectorAll:()=>[ruler],querySelector:()=>({addEventListener:(n,fn)=>dialogEvents[n]=fn}),addEventListener:(n,fn)=>pageEvents[n]=fn};
 const field={addEventListener(){}};
 const context=environment({document:doc,window:{matchMedia:()=>motion,addEventListener:(n,fn)=>pageEvents[n]=fn},performance:{now:()=>time},requestAnimationFrame:fn=>{frames.set(++id,fn);return id},cancelAnimationFrame:id=>frames.delete(id),elements:{indoorTempInput:field,indoorRhInput:field,minTempInput:field,targetRhInput:field},ResizeObserver:class{observe(){}},renderReadingRulers(){},Event:class{},rulerValueFromDrag:ctx.rulerValueFromDrag});
 Object.assign(context,createReadingControls(context,context));context.bindReadingRulers();
 const event=(x,t,y=100)=>({isPrimary:true,button:0,pointerId:1,clientX:x,clientY:y,timeStamp:t});
 return {input,events,dialogEvents,pageEvents,motionEvents,motion,doc,frames,event,
 flick(dx=40,release=45){events.pointerdown(event(100,0));events.pointermove(event(100+dx,40));events.pointerup(event(100+dx,release));},
 advance(t){time=t;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(t));}};
}
test('fast flick coasts, decelerates and settles on a tick within 450ms',()=>{
 const f=momentumFixture();f.flick();const released=f.input.value;
 assert.equal(f.frames.size,1);f.advance(100);const a=f.input.value;f.advance(200);const b=f.input.value;
 assert.ok(a<released);assert.ok(released-a > a-b); // subsequent movement is smaller
 f.advance(450);assert.equal(f.frames.size,0);assert.ok(f.input.value>=released-1.5);
 assert.equal(Number(f.input.value.toFixed(1)),f.input.value);
});
test('momentum is capped, clamps at limits, and works for humidity',()=>{
 const f=momentumFixture({value:58,step:1,min:20,max:90});f.flick(-400);const released=f.input.value;f.advance(450);
 assert.ok(f.input.value<=Math.min(90,released+9));assert.equal(f.frames.size,0);
 const edge=momentumFixture({value:10.1});edge.flick(8);edge.advance(16);assert.equal(edge.input.value,10);assert.equal(edge.frames.size,0);
});
test('slow drag, paused release and reduced motion do not coast',()=>{
 for(const f of [momentumFixture({reduced:true}),momentumFixture()]) {
  if(f.motion.matches)f.flick();else f.flick(8,100);
  assert.equal(f.frames.size,0);
 }
 const paused=momentumFixture();paused.flick(40,200);assert.equal(paused.frames.size,0);
});
test('new touch, keyboard, close, hidden page and reduced-motion change stop momentum',()=>{
 for(const stop of [f=>f.events.pointerdown(f.event(110,60)),f=>f.dialogEvents.pointerdown(),f=>f.dialogEvents.keydown(),f=>f.dialogEvents.close(),f=>f.pageEvents.pagehide(),f=>{f.doc.hidden=true;f.pageEvents.visibilitychange()},f=>{f.motion.matches=true;f.motionEvents.change()}]) {
  const f=momentumFixture();f.flick();assert.equal(f.frames.size,1);stop(f);const value=f.input.value;f.advance(450);assert.equal(f.frames.size,0);assert.equal(f.input.value,value);
 }
});

test('ventilation rulers honour their spacing, whole-degree steps and owning dialog close',()=>{
 const f=momentumFixture({value:21,step:1,min:16,max:26,spacing:40});
 f.flick(40); assert.equal(f.input.value,20);
 assert.equal(f.frames.size,1); f.dialogEvents.close(); f.advance(450);
 assert.equal(f.input.value,20); assert.equal(f.frames.size,0);
 const humidity=momentumFixture({value:55,step:1,min:40,max:65,spacing:10});
 humidity.flick(-10); assert.equal(humidity.input.value,56);
 humidity.advance(450); assert.ok(humidity.input.value<=65);
});

test('ventilation major ticks use explicit intervals and announce the correct units',()=>{
 const rulers=[['minTemp',18,16,26,1,40,1,'degrees Celsius'],['targetRh',55,40,65,1,10,5,'percent']].map(([key,value,min,max,step,spacing,interval,unit])=>{
  const ticks={innerHTML:''}, input={min,max,step,setAttribute(n,v){this[n]=v;}};
  return {dataset:{ruler:key,tickSpacing:spacing,majorInterval:interval,unit},clientWidth:124,ticks,input,querySelector:s=>s==='input'?input:ticks};
 });
 const context=environment({state:{minTemp:18,targetRh:55},document:{querySelectorAll:()=>rulers,querySelector:()=>({})}});
 Object.assign(context,createReadingControls(context,context));context.renderReadingRulers();
 assert.match(rulers[0].ticks.innerHTML, /<span>17<\/span>/);
 assert.match(rulers[0].ticks.innerHTML, /<span>19<\/span>/);
 assert.match(rulers[1].ticks.innerHTML, /<span>50<\/span>/);
 assert.match(rulers[1].ticks.innerHTML, /<span>60<\/span>/);
 assert.equal(rulers[0].input['aria-valuetext'],'18 degrees Celsius');
 assert.equal(rulers[1].input['aria-valuetext'],'55 percent');
});
