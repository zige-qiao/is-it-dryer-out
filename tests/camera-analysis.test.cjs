const {test}=require('node:test'),assert=require('node:assert/strict');
const {monitor,image,rect}=require('./helpers/camera-pixels.cjs');
const {analyzeImage}=require('../src/camera/analysis.js');
const {rotation,warp,homography,project,inverse,strokeAngles}=require('../src/camera/geometry.js');
const {normalise,extract}=require('../src/camera/image.js');
const {createRecognitionService}=require('../src/camera/recognition.js');
const {processImage}=require('../src/camera/worker.js');

test('worker rejects oversized or incomplete pixel buffers before analysis',async()=>{
 await assert.rejects(processImage({pixels:{width:801,height:1,data:new Uint8ClampedArray(801*4)},options:{}}),/Invalid bounded image/);
 await assert.rejects(processImage({pixels:{width:10,height:10,data:new Uint8ClampedArray(4)},options:{}}),/Invalid bounded image/);
});

for(const angle of [-25,-15,0,15,25]) test(`raw strokes correct ${angle} degree rotation with unit-inclusive mapped boxes`,async()=>{
 const p=warp(monitor(55,120,80),rotation(600,420,-angle)),r=await analyzeImage(p);
 assert.deepEqual(r.values,{temperature:'22.3',humidity:'59'});
 for(const f of ['temperature','humidity']){const e=r.readings[f],b=e.region,u=e.unitBounds;assert.ok(b.x<=u.x&&b.y<=u.y&&b.x+b.width>=u.x+u.width-1e-6&&b.y+b.height>=u.y+u.height-1e-6);assert.ok(e.preview.width>10);assert.ok(e.confidence.unit>0&&e.confidence.numeric>0);assert.ok(e.confidence.evidence.glyphs.length>=2);}
 assert.ok(strokeAngles(p).every(a=>Math.abs(a)<=25));
});
test('low contrast and uneven illumination retain values and share normalization with previews',async()=>{
 const p=monitor(55,120,80);for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){const q=(y*p.width+x)*4,v=90+p.data[q]*.08+x*.025; p.data[q]=p.data[q+1]=p.data[q+2]=v;}
 const r=await analyzeImage(p);assert.deepEqual(r.values,{temperature:'22.3',humidity:'59'});
 const expected=extract(normalise(p),{x:r.regions.temperature.x*p.width,y:r.regions.temperature.y*p.height,width:r.regions.temperature.width*p.width,height:r.regions.temperature.height*p.height});
 assert.deepEqual(r.readings.temperature.preview,expected);
});
test('a new box uses its unit, expands to the nearby symbol, and does not swap a known field',async()=>{
 const p=monitor(55,120,80), region={x:.07,y:.27,width:.28,height:.25};const r=await analyzeImage(p,{region});
 assert.equal(r.field,'temperature');assert.equal(r.values.temperature,'22.3');assert.ok(r.regions.temperature.x+r.regions.temperature.width>region.x+region.width);
 const wrong=await analyzeImage(p,{region,field:'humidity'});assert.equal(wrong.status,'contradictory');assert.equal(wrong.field,'humidity');
});
test('both units request a tighter box; missing units stay unassigned',async()=>{
 const both=await analyzeImage(monitor(55,120,80),{region:{x:0,y:.2,width:.95,height:.4}});assert.equal(both.status,'ambiguous');
 const blank=await analyzeImage(image(),{region:{x:.1,y:.1,width:.5,height:.5}});assert.equal(blank.status,'unassigned');assert.equal(blank.field,null);
});
test('homography and inverse map a quadrilateral without changing the original pixels',()=>{
 const a=[[0,0],[99,0],[99,49],[0,49]],b=[[15,8],[120,20],[105,65],[8,52]],h=homography(a,b),inv=inverse(h);
 a.forEach(([x,y],i)=>{const q=project(h,x,y);assert.ok(Math.hypot(q[0]-b[i][0],q[1]-b[i][1])<1e-6);const original=project(inv,...q);assert.ok(Math.hypot(original[0]-x,original[1]-y)<1e-6);});
});
test('cooperative fallback observes cancellation between correction stages',async()=>{let stages=0;assert.equal(await analyzeImage(monitor(55,120,80),{},async()=>++stages<1),null);});
function workerFixture(){const workers=[];class FakeWorker{constructor(url,opts){this.url=url;this.opts=opts;workers.push(this);}postMessage(message){this.message=message;}terminate(){this.stopped=true;}}
 const canvas={width:0,height:0,getContext:()=>({drawImage(){},getImageData:()=>({width:canvas.width,height:canvas.height,data:new Uint8ClampedArray(canvas.width*canvas.height*4)})})};
 const env={Worker:FakeWorker,document:{createElement:()=>canvas},setTimeout,clearTimeout};return {workers,service:createRecognitionService(env)};
}
function emit(worker,payload,id=worker.message.id){worker.onmessage({data:{id,stageId:worker.message.stageId,...payload}});}
function prepared(worker){const {width,height}=worker.message.pixels;return {hypotheses:[{id:'identity',angle:0,shear:0,method:'none',matrix:[1,0,0,0,1,0,0,0,1],width,height}],proposals:[],orientation:{state:'pending',credibleIds:['identity']}};}
function resolved(result){return {...result,orientation:{state:'resolved',credibleIds:['identity'],evaluatedIds:['identity'],resolvedFields:{temperature:Boolean(result.values?.temperature),humidity:Boolean(result.values?.humidity)}}};}
test('worker input is bounded; obsolete results settle as cancelled and cannot overwrite the next request',async()=>{
 const f=workerFixture(),old=f.service.locate({width:2400,height:1200}),w=f.workers[0];assert.equal(w.message.pixels.width,800);assert.equal(w.message.pixels.height,400);assert.equal(w.opts.type,'module');
 const next=f.service.readRegion({width:400,height:300},{x:.1,y:.1,width:.4,height:.3},'temperature');assert.equal(await old,null);assert.equal(w.stopped,true);
 emit(w,{result:resolved({values:{temperature:'31.0'}})});
 const newer=f.workers[1];emit(newer,{result:prepared(newer)});await new Promise(r=>setImmediate(r));
 emit(newer,{result:resolved({values:{temperature:'22.0',humidity:''}})});assert.deepEqual((await next).values,{temperature:'22.0',humidity:''});assert.equal(newer.stopped,true);
});
test('worker errors settle the read instead of leaving pending confirmation forever',async()=>{
 const f=workerFixture(),read=f.service.locate({width:400,height:300});f.workers[0].onerror();await assert.rejects(read,/could not start/);assert.equal(f.workers[0].stopped,true);
});

test('timeout preserves session-matched validated worker progress instead of discarding it', async () => {
 let timeout, worker;
 class Worker { constructor() { worker = this; } postMessage(message) { this.message = message; } terminate() { this.stopped = true; } }
 const env = { Worker, performance:{now:()=>0}, setTimeout(fn) { timeout = fn; return 1; }, clearTimeout() {}, document: { createElement() {
   const c = { width: 0, height: 0 }; c.getContext = () => ({ drawImage() {}, getImageData: () => ({ width: c.width, height: c.height, data: new Uint8ClampedArray(c.width * c.height * 4) }) }); return c;
 } } };
 const service = createRecognitionService(env), read = service.locate({ width: 400, height: 200 });
 emit(worker,{result:prepared(worker)});await new Promise(r=>setImmediate(r));
 const entry = { field: 'humidity', value: '58', region: { x: .5, y: .2, width: .3, height: .4 }, digitBounds: { height: .4 }, confidence: { unit: .96, numeric: 1 }, rejectionReason: null };
 emit(worker,{progress:resolved({readings:{humidity:{...entry,value:'50'}},values:{humidity:'50'}})},worker.message.id-1);
 emit(worker,{progress:resolved({readings:{humidity:entry},values:{humidity:'58'}})});
 timeout(); const result = await read; assert.equal(result.values.humidity, '58'); assert.equal(result.values.temperature, ''); assert.equal(result.rejectionReason, 'timeout'); assert.equal(worker.stopped, true);
});

test('mild perspective on a black case works without requiring an LCD boundary',async()=>{
 const p=monitor(55,120,80);for(const d of [[40,100,460,8],[40,100,8,225],[40,317,460,8],[492,100,8,225]])rect(p,...d);
 const h=homography([[40,100],[500,100],[500,325],[40,325]],[[40,100],[500,120],[480,325],[65,305]]),r=await analyzeImage(warp(p,inverse(h)));
 assert.deepEqual(r.values,{temperature:'22.3',humidity:'59'});
});
test('a missing decimal is not invented and an explicitly assigned blank crop remains editable',async()=>{
 const p=monitor(55,120,80);for(let y=193;y<201;y++)for(let x=166;x<175;x++){const q=(y*p.width+x)*4;p.data[q]=p.data[q+1]=p.data[q+2]=205;}
 const r=await analyzeImage(p);assert.equal(r.values.temperature,'');
 const blank=await analyzeImage(image(),{field:'temperature',region:{x:.1,y:.1,width:.5,height:.5}});assert.equal(blank.field,'temperature');assert.equal(blank.readings.temperature.value,'');assert.ok(blank.readings.temperature.preview.width>0);
});

test('small native crops combine enlargement and correction while retaining mapped units and matching previews',async()=>{
 const p=warp(monitor(55,120,80),[2,0,0,0,2,0,0,0,1],300,210),r=await analyzeImage(p,{refine:true});
 assert.deepEqual(r.values,{temperature:'22.3',humidity:'59'});
 for(const field of ['temperature','humidity']){const e=r.readings[field];assert.ok(e.correction.width<=800);assert.ok(e.unitBounds.x+e.unitBounds.width<=1);assert.ok(e.correction.matrix[0]<1);const preview=require('../src/camera/analysis.js').makePreview(p,e.correction,{x:e.region.x*p.width,y:e.region.y*p.height,width:e.region.width*p.width,height:e.region.height*p.height});assert.deepEqual(e.preview,preview);}
});
