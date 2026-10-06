const {test}=require('node:test'),assert=require('node:assert/strict');
const {visibleFrame,createCaptureControls}=require('../src/camera/capture.js');
const {element,environment}=require('./helpers/browser.cjs');
function fixture({native=false,torch=true,failZoom=false,failFlash=false,deferred=false,noFrames=false,base=1}={}){
 let time=0,id=0,pendingApply,changing=false;const timers=new Map(),calls=[];
 const env=environment({performance:{now:()=>time},setTimeout(fn,delay){timers.set(++id,{fn,at:time+delay});return id;},clearTimeout(id){timers.delete(id);}});
 async function tick(ms){const end=time+ms;for(;;){const next=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;time=next[1].at;timers.delete(next[0]);next[1].fn();for(let i=0;i<5;i++)await Promise.resolve();}time=end;}
 const video=element(),preview=element(),feed=element(),flash=element(),zoomControl=element(),status=element(),capture=element(),draws=[];
 preview.width=preview.height=0;preview.getContext=()=>({drawImage(...args){draws.push({time,args});}});
 video.videoWidth=noFrames?0:1920;video.videoHeight=noFrames?0:1080;video.readyState=2;
 feed.getBoundingClientRect=()=>({width:changing?(Math.floor(time/100)%2?360:361):360,height:180});
 const current={zoom:1,width:1920,height:1080,torch:false};let errors=0;
 const track={getCapabilities:()=>({...native?{zoom:{min:1,max:2}}:{},torch}),getSettings:()=>({...current}),getConstraints:()=>({width:{ideal:1920}}),
 async applyConstraints(value){calls.push(value);if(deferred)await new Promise(resolve=>pendingApply=resolve);const c=value.advanced.at(-1);if(failZoom&&c.zoom>1)throw Error('zoom');if(failFlash&&c.torch)throw Error('flash');if(c.zoom!==undefined)current.zoom=c.zoom;if(c.torch!==undefined)current.torch=c.torch;}};
 const controls=createCaptureControls({video,preview,feed,flash,zoomControl,status,capture,onZoomSync:state=>capture.zoomState=state,onError:()=>errors++},env);
 const startup=controls.start(track,{base,zoom:base});
 return {controls,startup,tick,video,preview,draws,env,feed,flash,zoomControl,capture,status,current,track,calls,timers,
   changeGeometry(value){changing=value;},resolveApply(){pendingApply?.();},get errors(){return errors;}};
}
test('startup conceals transient frames, waits for stability and locks the settled baseline',async()=>{
 const f=fixture({native:true});await f.tick(300);assert.equal(f.capture.disabled,true);assert.equal(f.preview.classList.contains('camera-starting'),true);
 f.current.zoom=1.2;await f.tick(300);assert.equal(f.capture.disabled,false);await f.startup;
 assert.equal(f.zoomControl.hidden,false);assert.equal(f.capture.zoomState.desired,1);assert.equal(f.status.hidden,true);
 f.controls.setZoom(1.5);await f.tick(10);assert.ok(Math.abs(f.calls[0].advanced.at(-1).zoom-1.8)<1e-6);f.controls.stop();
});
test('unstable geometry reveals after the bounded wait but does not permit capture until stable',async()=>{
 const f=fixture();f.changeGeometry(true);await f.tick(1500);await f.startup;
 assert.equal(f.preview.classList.contains('camera-starting'),false);assert.equal(f.capture.disabled,true);assert.equal(f.status.hidden,false);assert.match(f.status.textContent,/still settling/);
 f.changeGeometry(false);await f.tick(350);assert.equal(f.capture.disabled,false);f.controls.stop();
});
test('a stream with no valid frames fails with recovery; cancellation settles startup and removes all timers',async()=>{
 const missing=fixture({noFrames:true});await missing.tick(5000);await missing.startup;assert.equal(missing.errors,1);assert.equal(missing.timers.size,0);
 const stopped=fixture();await stopped.tick(100);stopped.controls.stop();await stopped.startup;await stopped.tick(6000);assert.equal(stopped.errors,0);assert.equal(stopped.timers.size,0);assert.equal(stopped.zoomControl.hidden,true);
});
test('2:1 digital preview and capture use the same centred source bounds without CSS scaling',async()=>{
 const f=fixture();await f.tick(550);f.controls.setZoom(2);assert.equal(f.capture.disabled,true);await f.tick(40);
 assert.deepEqual(f.controls.frame(),{x:480,y:300,width:960,height:480});assert.equal(f.video.style.transform,undefined);assert.equal(f.capture.disabled,false);assert.equal(f.calls.length,0);
 assert.deepEqual(f.draws.at(-1).args.slice(1),[480,300,960,480,0,0,360,180]);
 assert.deepEqual(visibleFrame(1080,1920,360,180,3),{x:360,y:870,width:360,height:180});f.controls.stop();
});
test('4:3 preview keeps centred capture bounds at every preset and after portrait rotation',async()=>{
 const f=fixture();f.feed.getBoundingClientRect=()=>({width:360,height:270});await f.tick(600);
 for(const zoom of [1,3,5]){
  f.controls.setZoom(zoom);await f.tick(350);
  const width=1440/zoom,height=1080/zoom;
  const crop={x:(1920-width)/2,y:(1080-height)/2,width,height};
  assert.equal(f.capture.disabled,false);assert.deepEqual(f.controls.frame(),crop);
  assert.deepEqual(f.draws.at(-1).args.slice(1),[crop.x,crop.y,width,height,0,0,360,270]);
  assert.equal(f.controls.snapshot().aspect,4/3);
 }
 f.video.videoWidth=1080;f.video.videoHeight=1920;assert.equal(f.controls.isReady(),false);
 await f.tick(350);assert.equal(f.capture.disabled,false);
 const portrait=f.controls.frame();
 for(const [key,value] of Object.entries({x:432,y:879,width:216,height:162}))assert.ok(Math.abs(portrait[key]-value)<1e-6);
 f.controls.stop();
});

test('native and digital zoom combine at the native limit while preserving existing track constraints',async()=>{
 const f=fixture({native:true});await f.tick(550);f.controls.setZoom(3);await f.tick(40);
 assert.equal(f.current.zoom,2);assert.deepEqual(f.calls[0].width,{ideal:1920});
 assert.deepEqual(f.controls.frame(),{x:320,y:220,width:1280,height:640});assert.deepEqual(f.draws.at(-1).args.slice(1,5),[320,220,1280,640]);f.controls.stop();
});
test('a failed native zoom resets to baseline and continues digitally; a failed flash preserves its confirmed state',async()=>{
 const f=fixture({native:true,failZoom:true,failFlash:true});await f.tick(550);f.controls.setZoom(2);await f.tick(40);
 assert.equal(f.calls.length,2);assert.equal(f.controls.frame().width,960);assert.equal(f.capture.disabled,false);
 const flash=f.controls.toggleFlash();await f.tick(100);await flash;assert.equal(f.flash.getAttribute('aria-pressed'),'false');assert.match(f.status.textContent,/Flash couldn’t change/);await f.tick(200);assert.match(f.status.textContent,/Flash couldn’t change/);f.controls.stop();
});
test('rapid adjustments coalesce, flash and zoom serialize, and late application cannot affect a new session',async()=>{
 const f=fixture({native:true,deferred:true});await f.tick(550);f.controls.setZoom(2);await f.tick(1);f.controls.setZoom(1.5);const flashing=f.controls.toggleFlash();
 assert.equal(f.calls.length,1);assert.equal(f.capture.disabled,true);f.resolveApply();await f.tick(100);assert.equal(f.calls.length,2);assert.deepEqual(f.calls[1].advanced.at(-1),{zoom:1.5,torch:true});
 f.controls.stop();await flashing;const restarted=f.controls.start(f.track);f.resolveApply();await f.tick(600);await restarted;
 assert.equal(f.capture.zoomState.desired,1);assert.equal(f.controls.frame().width,1920);assert.equal(f.flash.getAttribute('aria-pressed'),'false');f.controls.stop();
});
test('later orientation changes suspend capture without resetting the chosen zoom',async()=>{
 const f=fixture();await f.tick(550);f.controls.setZoom(2.4);await f.tick(40);f.video.videoWidth=1080;f.video.videoHeight=1920;
 assert.equal(f.controls.isReady(),false);
 await f.tick(50);assert.equal(f.capture.disabled,true);await f.tick(300);assert.equal(f.capture.disabled,false);assert.equal(f.capture.zoomState.desired,2.4);f.controls.stop();
});

test('a paused frame callback cannot leave startup concealed beyond the reveal deadline and is cancelled on stop',async()=>{
 const f=fixture();f.controls.stop();let cancelled=null;
 f.video.requestVideoFrameCallback=()=>17;f.video.cancelVideoFrameCallback=id=>cancelled=id;
 const started=f.controls.start(f.track);await f.tick(1500);await started;
 assert.equal(f.preview.classList.contains('camera-starting'),false);assert.equal(f.capture.disabled,true);
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

test('a zoom revision cannot be captured until a subsequent frame paints it',async()=>{
 const f=fixture();await f.tick(550);const previous=f.controls.frame();f.controls.setZoom(2);await f.tick(1);
 assert.equal(f.controls.isReady(),false);assert.equal(f.capture.disabled,true);assert.deepEqual(f.controls.frame(),previous);
 await f.tick(40);assert.equal(f.controls.isReady(),true);assert.equal(f.controls.frame().width,960);
 assert.equal(f.status.hidden,true);f.controls.stop();
});

test('portrait frames fill every preview pixel and resize with a bounded resolution and draw rate',async()=>{
 const f=fixture();f.video.videoWidth=1080;f.video.videoHeight=1920;f.env.devicePixelRatio=4;
 await f.tick(550);assert.deepEqual(f.controls.frame(),{x:0,y:690,width:1080,height:540});
 assert.equal(f.preview.width,1280);assert.equal(f.preview.height,640);
 assert.deepEqual(f.draws.at(-1).args.slice(1),[0,690,1080,540,0,0,1280,640]);
 for(let i=1;i<f.draws.length;i++)assert.ok(f.draws[i].time-f.draws[i-1].time>=1000/30);
 f.feed.getBoundingClientRect=()=>({width:600,height:300});assert.equal(f.controls.isReady(),false);await f.tick(350);
 assert.equal(f.controls.isReady(),true);assert.deepEqual(f.controls.frame(),{x:0,y:690,width:1080,height:540});
 const count=f.draws.length;f.controls.stop();await f.tick(1000);assert.equal(f.draws.length,count);assert.equal(f.preview.width,0);
});

test('landscape viewport rotation changes the displayed crop before capture resumes',async()=>{
 const f=fixture();await f.tick(550);f.feed.getBoundingClientRect=()=>({width:180,height:360});
 assert.equal(f.controls.isReady(),false);await f.tick(350);assert.equal(f.controls.isReady(),true);
 assert.deepEqual(f.controls.frame(),{x:690,y:0,width:540,height:1080});
 assert.deepEqual(f.draws.at(-1).args.slice(1),[690,0,540,1080,0,0,180,360]);f.controls.stop();
});

test('canvas failure cancels rendering and leaves camera recovery available',async()=>{
 const f=fixture();f.preview.getContext=()=>{throw Error('canvas unavailable');};await f.tick(100);
 await f.startup;assert.equal(f.errors,1);assert.equal(f.capture.disabled,true);assert.equal(f.timers.size,0);assert.equal(f.preview.width,0);
});

test('8x supports native, mixed and digital framing, and switching gates capture until ready',async()=>{
 for(const native of [false,true]){const f=fixture({native});await f.tick(550);
 for(const zoom of [1,3,5,8]){f.controls.setSwitching(true);f.controls.setZoom(zoom);await f.tick(120);assert.equal(f.controls.isReady(),false);assert.equal(f.capture.disabled,true);f.controls.setSwitching(false);assert.equal(f.controls.isReady(),true);assert.equal(f.controls.frame().width,1920/(zoom/(native?Math.min(2,zoom):1)));}
 f.controls.stop();assert.equal(f.capture.zoomState.desired,1);}
});

test('native zoom respects capability steps and uses a residual crop without doubling magnification',async()=>{
 const f=fixture();f.controls.stop();f.track.getCapabilities=()=>({zoom:{min:1,max:4,step:.3},torch:true});
 const started=f.controls.start(f.track);await f.tick(550);await started;f.controls.setZoom(1.8);await f.tick(100);
 assert.ok(Math.abs(f.current.zoom-1.6)<1e-8);assert.ok(Math.abs(f.controls.frame().width-1920/(1.8/1.6))<1e-6);f.controls.stop();
});

test('telephoto native baseline combines zoom with the residual crop without applying 3x twice',async()=>{
 const f=fixture({native:true,base:3});await f.tick(550);f.controls.setZoom(8);await f.tick(100);
 assert.equal(f.current.zoom,2);assert.equal(f.controls.snapshot().digital,8/6);assert.equal(f.capture.disabled,false);
 assert.deepEqual(f.controls.frame(),visibleFrame(1920,1080,360,180,8/6));f.controls.stop();
});

test('zoom blur lasts until the revised frame renders, without changing captured pixel bounds', async () => {
 const f=fixture(); await f.tick(550); const initial=f.controls.frame();
 f.controls.setSwitching(true); assert.equal(f.feed.classList.contains('is-switching'),true);
 assert.equal(f.status.textContent,'Switching zoom…'); assert.equal(f.capture.disabled,true);
 f.controls.setZoom(3); await f.tick(1); f.controls.setSwitching(false);
 assert.equal(f.feed.classList.contains('is-switching'),true); assert.deepEqual(f.controls.frame(),initial);
 await f.tick(80); assert.equal(f.feed.classList.contains('is-switching'),false);
 assert.equal(f.status.hidden,true); assert.equal(f.controls.frame().width,640); f.controls.stop();
});

test('blur and switching selection survive replacing the track, and stopping clears presentation state', async () => {
 const f=fixture(); await f.tick(550); f.controls.setSwitching(true);
 const next=f.controls.start(f.track,{base:3,zoom:3});
 assert.equal(f.feed.classList.contains('is-switching'),true);
 assert.equal(f.capture.zoomState.available,true); await f.tick(550); await next;
 f.controls.setSwitching(false); assert.equal(f.feed.classList.contains('is-switching'),false);
 f.controls.setSwitching(true); f.controls.stop(); assert.equal(f.feed.classList.contains('is-switching'),false);
});

test('switching failure clears blur even while unverified constraints still prevent capture', async () => {
 const f=fixture({deferred:true}); await f.tick(550);
 f.controls.setSwitching(true); f.controls.setZoom(3); await f.tick(1);
 f.controls.setSwitching(false,{failed:true});
 assert.equal(f.feed.classList.contains('is-switching'),false); assert.equal(f.capture.disabled,true);
 f.controls.stop(); f.resolveApply();
});
