const {test}=require('node:test'),assert=require('node:assert/strict');
const {createStillPhoto}=require('../src/camera/still-photo.js');
function fixture(){
 const calls=[],draws=[],timers=new Map();let serial=0,resolvePhoto,resolveDecode,closed=0;
 class Capture { constructor(track){this.track=track;} takePhoto(options){calls.push(options);return new Promise(r=>resolvePhoto=r);} }
 const env={ImageCapture:Capture,setTimeout(fn){const id=++serial;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),createImageBitmap:()=>new Promise(r=>resolveDecode=r),document:{createElement(){const c={width:0,height:0};c.getContext=()=>({drawImage(...args){draws.push(args)}});return c;}}};
 return {service:createStillPhoto(env),env,calls,draws,timers,photo:()=>resolvePhoto({size:5}),decode:()=>resolveDecode({width:6000,height:4000,close(){closed++}}),get closed(){return closed;}};
}
const flush=()=>new Promise(setImmediate);
test('still capture disables torch before explicit off/flash requests and crops the decoded image only',async()=>{
 for(const flash of [false,true]){const f=fixture(),events=[],p=f.service.take({}, {flash,digital:2,aspect:2},async()=>events.push('prepared'));await flush();assert.deepEqual(events,['prepared']);assert.deepEqual(f.calls,[{fillLightMode:flash?'flash':'off'}]);f.photo();await flush();f.decode();const c=await p;assert.equal(c.width,3000);assert.equal(c.height,1500);assert.deepEqual(f.draws[0].slice(1),[1500,1250,3000,1500,0,0,3000,1500]);assert.equal(f.closed,1);assert.equal(f.timers.size,0);}
});
test('cancellation disposes a late decoded still and cannot return it as a new capture',async()=>{
 const f=fixture(),p=f.service.take({}, {flash:false,digital:1,aspect:2});await flush();f.photo();await flush();f.service.cancel();await assert.rejects(p,{name:'AbortError'});f.decode();await flush();assert.equal(f.closed,1);assert.equal(f.draws.length,0);assert.equal(f.timers.size,0);
});
test('timeouts are bounded and unsupported still capture never substitutes a video frame',async()=>{
 const f=fixture(),p=f.service.take({}, {flash:true,digital:1,aspect:2});await flush();[...f.timers.values()][0]();await assert.rejects(p,{name:'TimeoutError'});f.photo();await flush();assert.equal(f.draws.length,0);
 delete f.env.ImageCapture;await assert.rejects(f.service.take({},{}),{name:'NotSupportedError'});assert.equal(f.draws.length,0);
});
