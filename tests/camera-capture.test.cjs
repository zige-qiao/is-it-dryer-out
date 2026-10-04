const {test}=require('node:test'),assert=require('node:assert/strict');
const {visibleFrame,createCaptureControls}=require('../src/camera/capture.js');
const {element,environment}=require('./helpers/browser.cjs');
function fixture({native=false,torch=true,failZoom=false,failFlash=false,deferred=false,noFrames=false}={}){
 let time=0,id=0,pendingApply,changing=false;const timers=new Map(),calls=[];
 const env=environment({performance:{now:()=>time},setTimeout(fn,delay){timers.set(++id,{fn,at:time+delay});return id;},clearTimeout(id){timers.delete(id);}});
 async function tick(ms){const end=time+ms;for(;;){const next=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;time=next[1].at;timers.delete(next[0]);next[1].fn();for(let i=0;i<5;i++)await Promise.resolve();}time=end;}
 const video=element(),feed=element(),flash=element(),zoomControl=element(),zoomInput=element(),zoomValue=element(),status=element(),capture=element();
 video.videoWidth=noFrames?0:1920;video.videoHeight=noFrames?0:1080;video.readyState=2;
 feed.getBoundingClientRect=()=>({width:changing?(time%100?360:361):360,height:270});
 const current={zoom:1,width:1920,height:1080,torch:false};let errors=0;
 const track={getCapabilities:()=>({...native?{zoom:{min:1,max:2}}:{},torch}),getSettings:()=>({...current}),getConstraints:()=>({width:{ideal:1920}}),
 async applyConstraints(value){calls.push(value);if(deferred)await new Promise(resolve=>pendingApply=resolve);const c=value.advanced.at(-1);if(failZoom&&c.zoom>1)throw Error('zoom');if(failFlash&&c.torch)throw Error('flash');if(c.zoom!==undefined)current.zoom=c.zoom;if(c.torch!==undefined)current.torch=c.torch;}};
 const controls=createCaptureControls({video,feed,flash,zoomControl,zoomInput,zoomValue,status,capture,onError:()=>errors++},env);
 const startup=controls.start(track);
 return {controls,startup,tick,video,feed,flash,zoomInput,zoomControl,zoomValue,capture,status,current,track,calls,timers,
   changeGeometry(value){changing=value;},resolveApply(){pendingApply?.();},get errors(){return errors;}};
}
test('startup conceals transient frames, waits for stability and locks the settled baseline',async()=>{
 const f=fixture({native:true});await f.tick(300);assert.equal(f.capture.disabled,true);assert.equal(f.video.classList.contains('camera-starting'),true);
 f.current.zoom=1.2;await f.tick(300);assert.equal(f.capture.disabled,false);await f.startup;
 assert.equal(f.zoomControl.hidden,false);assert.equal(f.zoomValue.textContent,'1.0×');
 f.controls.setZoom(1.5);await f.tick(10);assert.ok(Math.abs(f.calls[0].advanced.at(-1).zoom-1.8)<1e-6);f.controls.stop();
});
test('unstable geometry reveals after the bounded wait but does not permit capture until stable',async()=>{
 const f=fixture();f.changeGeometry(true);await f.tick(1500);await f.startup;
 assert.equal(f.video.classList.contains('camera-starting'),false);assert.equal(f.capture.disabled,true);assert.match(f.status.textContent,/still settling/);
 f.changeGeometry(false);await f.tick(350);assert.equal(f.capture.disabled,false);f.controls.stop();
});
test('a stream with no valid frames fails with recovery; cancellation settles startup and removes all timers',async()=>{
 const missing=fixture({noFrames:true});await missing.tick(5000);await missing.startup;assert.equal(missing.errors,1);assert.equal(missing.timers.size,0);
 const stopped=fixture();await stopped.tick(100);stopped.controls.stop();await stopped.startup;await stopped.tick(6000);assert.equal(stopped.errors,0);assert.equal(stopped.timers.size,0);assert.equal(stopped.zoomControl.hidden,true);
});
test('digital zoom uses exactly the centred source region shown by cover at portrait and landscape sizes',async()=>{
 const f=fixture();await f.tick(550);f.controls.setZoom(2);assert.equal(f.capture.disabled,true);await f.tick(1);
 assert.deepEqual(f.controls.frame(),{x:600,y:270,width:720,height:540});assert.equal(f.video.style.transform,'scale(2)');assert.equal(f.capture.disabled,false);assert.equal(f.calls.length,0);
 assert.deepEqual(visibleFrame(1080,1920,360,270,3),{x:360,y:825,width:360,height:270});f.controls.stop();
});
test('native and digital zoom combine at the native limit while preserving existing track constraints',async()=>{
 const f=fixture({native:true});await f.tick(550);f.controls.setZoom(3);await f.tick(1);
 assert.equal(f.current.zoom,2);assert.equal(f.video.style.transform,'scale(1.5)');assert.deepEqual(f.calls[0].width,{ideal:1920});
 assert.deepEqual(f.controls.frame(),{x:480,y:180,width:960,height:720});f.controls.stop();
});
test('a failed native zoom resets to baseline and continues digitally; a failed flash preserves its confirmed state',async()=>{
 const f=fixture({native:true,failZoom:true,failFlash:true});await f.tick(550);f.controls.setZoom(2);await f.tick(1);
 assert.equal(f.calls.length,2);assert.equal(f.video.style.transform,'scale(2)');assert.equal(f.capture.disabled,false);
 const flash=f.controls.toggleFlash();await f.tick(100);await flash;assert.equal(f.flash.getAttribute('aria-pressed'),'false');assert.match(f.status.textContent,/Flash couldn’t change/);await f.tick(200);assert.match(f.status.textContent,/Flash couldn’t change/);f.controls.stop();
});
test('rapid adjustments coalesce, flash and zoom serialize, and late application cannot affect a new session',async()=>{
 const f=fixture({native:true,deferred:true});await f.tick(550);f.controls.setZoom(2);await f.tick(1);f.controls.setZoom(1.5);const flashing=f.controls.toggleFlash();
 assert.equal(f.calls.length,1);assert.equal(f.capture.disabled,true);f.resolveApply();await f.tick(100);assert.equal(f.calls.length,2);assert.deepEqual(f.calls[1].advanced.at(-1),{zoom:1.5,torch:true});
 f.controls.stop();await flashing;const restarted=f.controls.start(f.track);f.resolveApply();await f.tick(600);await restarted;
 assert.equal(f.zoomValue.textContent,'1.0×');assert.equal(f.video.style.transform,'scale(1)');assert.equal(f.flash.getAttribute('aria-pressed'),'false');f.controls.stop();
});
test('later orientation changes suspend capture without resetting the chosen zoom',async()=>{
 const f=fixture();await f.tick(550);f.controls.setZoom(2.4);await f.tick(1);f.video.videoWidth=1080;f.video.videoHeight=1920;
 assert.equal(f.controls.isReady(),false);
 await f.tick(50);assert.equal(f.capture.disabled,true);await f.tick(300);assert.equal(f.capture.disabled,false);assert.equal(f.zoomValue.textContent,'2.4×');f.controls.stop();
});

test('a paused frame callback cannot leave startup concealed beyond the reveal deadline and is cancelled on stop',async()=>{
 const f=fixture();f.controls.stop();let cancelled=null;
 f.video.requestVideoFrameCallback=()=>17;f.video.cancelVideoFrameCallback=id=>cancelled=id;
 const started=f.controls.start(f.track);await f.tick(1500);await started;
 assert.equal(f.video.classList.contains('camera-starting'),false);assert.equal(f.capture.disabled,true);
 f.controls.stop();assert.equal(cancelled,17);assert.equal(f.timers.size,0);
});

test('a frame callback already queued before retaking cannot change the new session',async()=>{
 const f=fixture();f.controls.stop();const callbacks=[];
 f.video.requestVideoFrameCallback=fn=>{callbacks.push(fn);return callbacks.length;};f.video.cancelVideoFrameCallback=()=>{};
 void f.controls.start(f.track);const old=callbacks[0];f.controls.stop();const started=f.controls.start(f.track);
 await f.tick(600);callbacks.at(-1)(600,{width:1920,height:1080});await f.tick(100);callbacks.at(-1)(700,{width:1920,height:1080});await started;
 assert.equal(f.controls.isReady(),true);const count=callbacks.length;
 old(710,{width:100,height:100});assert.equal(f.controls.isReady(),true);assert.equal(callbacks.length,count);f.controls.stop();
});
