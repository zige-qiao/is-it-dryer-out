const {test}=require('node:test'),assert=require('node:assert/strict');
const {monitor,image,digit,rect}=require('./helpers/camera-pixels.cjs');
const {processImage}=require('../src/camera/worker.js');
const {proposeRegions,mapRegionalResult,mergeResults}=require('../src/camera/regions.js');
const {createRecognitionService}=require('../src/camera/recognition.js');
const {placeLabels}=require('../src/camera/labels.js');
const {createZoomPresets}=require('../src/camera/zoom-presets.js');
const {element}=require('./helpers/browser.cjs');
function emit(worker,payload){worker.onmessage({data:{id:worker.message.id,stageId:worker.message.stageId,...payload}});}
function prepared(worker,proposals=[]){const {width,height}=worker.message.pixels;return {hypotheses:[{id:'identity',angle:0,shear:0,method:'none',matrix:[1,0,0,0,1,0,0,0,1],width,height}],proposals,orientation:{state:'pending',credibleIds:['identity']}};}

for(const value of ['21.1','21.4','21.7']) test(`unit and decimal evidence identifies narrow 1 and small fraction ${value}`,async()=>{
 const r=await processImage({pixels:monitor(55,120,80,value,'61')});assert.equal(r.values.temperature,value);assert.equal(r.values.humidity,'61');
});

test('background digits do not dominate the size of a verified monitor reading',async()=>{
 const p=monitor(55,190,55,'21.7','61');digit(p,'9',20,20,140);digit(p,'9',135,20,140);
 const r=await processImage({pixels:p});assert.deepEqual(r.values,{temperature:'21.7',humidity:'61'});
});
test('raw display proposals remain bounded and blank/textured inputs never become readings',async()=>{
 assert.deepEqual(proposeRegions(image()),[]);
 const p=image();for(let x=10;x<590;x+=23)rect(p,x,30,5,350);
 const proposals=proposeRegions(p);assert.ok(proposals.length<=4);
 const r=await processImage({pixels:p});assert.deepEqual(r.values,{temperature:'',humidity:''});
});
test('regional coordinates and correction metadata map through the source crop; conflicting results remain unresolved',()=>{
 const entry={field:'temperature',value:'21.7',region:{x:.1,y:.2,width:.4,height:.5},digitBounds:{x:.1,y:.2,width:.3,height:.5},unitBounds:{x:.4,y:.2,width:.1,height:.2},confidence:{numeric:.95,unit:.96},correction:{matrix:[1,0,0,0,1,0,0,0,1]}};
 const r=mapRegionalResult({regions:{temperature:entry.region},readings:{temperature:entry},values:{temperature:'21.7'}},{x:.2,y:.3,width:.5,height:.4},{width:600,height:300},{width:2400,height:1200});
 assert.equal(r.regions.temperature.x,.25);assert.equal(r.regions.temperature.y,.38);assert.equal(r.readings.temperature.correction.matrix[0],2);assert.equal(r.readings.temperature.correction.matrix[2],480);
 const merged=mergeResults([r,{readings:{temperature:{...r.readings.temperature,value:'21.1'}}}]);assert.equal(merged.values.temperature,'');assert.equal(merged.readings.temperature.confidence.numeric,0);
});
test('worker requests crop original source pixels before resizing and share one cancellation boundary',async()=>{
 const draws=[],workers=[];
 class Worker{constructor(){workers.push(this);}postMessage(message){this.message=message;}terminate(){this.stopped=true;}}
 const env={Worker,setTimeout,clearTimeout,document:{createElement(){const c={width:0,height:0};c.getContext=()=>({drawImage(...args){draws.push(args);},getImageData(){return {width:c.width,height:c.height,data:new Uint8ClampedArray(c.width*c.height*4)}}});return c;}}};
 const service=createRecognitionService(env),source={width:3200,height:1600},read=service.locate(source),w=workers[0];assert.equal(w.message.kind,'prepare');
 emit(w,{result:prepared(w,[{region:{x:.2,y:.3,width:.1,height:.1}}])});await new Promise(r=>setImmediate(r));assert.equal(w.message.kind,'analyze');
 emit(w,{result:{values:{temperature:'',humidity:''},readings:{},orientation:{state:'resolved',resolvedFields:{}}}});await new Promise(r=>setImmediate(r));
 assert.deepEqual(draws[1].slice(1,5),[640,480,320,160]);assert.equal(w.message.pixels.width,320);assert.equal(w.message.options.refine,true);assert.equal(workers.length,1);
 service.cancel();assert.equal(await read,null);assert.equal(w.stopped,true);
});
test('full labels avoid each other, photo edges, handles and retake without moving crop coordinates',()=>{
 const items=[{field:'temperature',box:{x:100,y:70,width:60,height:40},size:{width:88,height:18}},
 {field:'humidity',box:{x:168,y:70,width:45,height:40},size:{width:65,height:18}}];
 const saved=JSON.stringify(items),r=placeLabels({width:320,height:160,items,reserved:[{x:268,y:108,width:44,height:44}]});
 assert.equal(JSON.stringify(items),saved);assert.equal(r.length,2);
 const [a,b]=r;assert.ok(a.x+a.width+4<=b.x||b.x+b.width+4<=a.x||a.y+a.height+4<=b.y||b.y+b.height+4<=a.y);
 for(const p of r){assert.ok(p.x>=4&&p.y>=4&&p.x+p.width<=316&&p.y+p.height<=156);}
 const stable=placeLabels({width:320,height:160,items:items.map(i=>({...i,previous:{x:r.find(p=>p.field===i.field).x-i.box.x,y:r.find(p=>p.field===i.field).y-i.box.y}}))});assert.deepEqual(stable,r);
});


test('regional refinement cannot extend the original timeout and cancellation stops its worker',async()=>{
 let timeout,posts=0,worker;
 class Worker{constructor(){worker=this;}postMessage(m){this.message=m;posts++;}terminate(){this.stopped=true;}}
 const env={Worker,performance:{now:()=>0},setTimeout(fn,delay){assert.equal(delay,10000);timeout=fn;return 1;},clearTimeout(){},document:{createElement(){const c={width:0,height:0};c.getContext=()=>({drawImage(){},getImageData(){return {width:c.width,height:c.height,data:new Uint8ClampedArray(c.width*c.height*4)}}});return c;}}};
 const read=createRecognitionService(env).locate({width:2400,height:1200});emit(worker,{result:prepared(worker,[{region:{x:.2,y:.2,width:.2,height:.2}}])});await new Promise(r=>setImmediate(r));assert.equal(posts,2);
 timeout();await assert.rejects(read,/timed out/);assert.equal(worker.stopped,true);
});


test('zoom presets select immediately, remain interactive during switching, and reset on retake',()=>{
 const buttons=[1,3,5].map(v=>[v,element()]),values=[];
 const presets=createZoomPresets({buttons,onValue:v=>values.push(v)});presets.initialize();
 buttons[1][1].emit('click');assert.deepEqual(values,[]);
 presets.sync({available:true,capturing:false});buttons[1][1].emit('click');buttons[2][1].emit('click');
 assert.deepEqual(values,[3,5]);assert.equal(buttons[2][1].getAttribute('aria-pressed'),'true');
 assert.equal(buttons[1][1].getAttribute('aria-pressed'),'false');
 presets.sync({available:true,capturing:true});buttons[0][1].emit('click');assert.deepEqual(values,[3,5]);
 presets.reset();assert.equal(buttons[0][1].getAttribute('aria-pressed'),'true');assert.ok(buttons.every(([,b])=>b.disabled));
});
