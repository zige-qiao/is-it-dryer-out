const {test}=require('node:test'),assert=require('node:assert/strict');
const {monitor,image,digit,unit,rect}=require('./helpers/camera-pixels.cjs');
const {analyzeImage}=require('../src/camera/analysis.js');
const {prepareOrientation}=require('../src/camera/orientation.js');
const {extract}=require('../src/camera/image.js');
const {mapRowContexts}=require('../src/camera/row-context.js');

test('manual humidity shares automatic digit validation while outside Celsius remains context',async()=>{
 const p=monitor(55,120,80,'23.2','60');
 const r=await analyzeImage(p,{field:'humidity',region:{x:.43,y:.275,width:.27,height:.255}});
 assert.equal(r.status,'found');assert.equal(r.field,'humidity');assert.equal(r.values.humidity,'60');
 assert.equal(r.values.temperature,'');assert.equal(r.readings.humidity.currentRowValidated,true);
 assert.equal(r.readings.humidity.integerCells.length,2);
});

test('an enlarged historical-only crop cannot replace upstream current row scale',async()=>{
 const p=monitor(55,120,80,'23.2','60');
 const prepared=prepareOrientation(p),box={x:255,y:225,width:100,height:50};
 const crop=extract(p,box),contexts=mapRowContexts(prepared.rowContexts,[1,0,-box.x,0,1,-box.y,0,0,1]);
 const r=await analyzeImage(crop,{field:'humidity',region:{x:0,y:0,width:1,height:1},refine:true,rowContexts:contexts});
 assert.equal(r.values.humidity,'');assert.equal(r.orientation?.resolvedFields.humidity,false);
 assert.ok(!r.readings.humidity?.value);assert.ok(r.rowContexts.length);
});


test('manual readings reuse a supported quarter-turn prior and its current digit axis',async()=>{
 const {expandedRotation,exactTransform}=require('../src/camera/geometry.js');
 const p=exactTransform(monitor(55,120,80,'22.1','64'),expandedRotation(600,420,-90));
 const automatic=await analyzeImage(p);assert.deepEqual(automatic.values,{temperature:'22.1',humidity:'64'});
 for(const field of ['temperature','humidity']){
  const entry=automatic.readings[field];
  const result=await analyzeImage(p,{field,region:entry.region,priorCorrection:entry.correction,sourceSize:p,refine:true});
  assert.equal(result.values[field],automatic.values[field]);assert.equal(result.readings[field].currentRowValidated,true);
 }
});

test('two independently validated LCDs cannot supply an arbitrary field assignment',async()=>{
 const a=monitor(55,120,80,'23.2','60'),b=monitor(55,120,80,'22.8','58');
 const p={width:1200,height:420,data:new Uint8ClampedArray(1200*420*4)};
 for(let y=0;y<420;y++){
  p.data.set(a.data.subarray(y*600*4,(y+1)*600*4),y*1200*4);
  p.data.set(b.data.subarray(y*600*4,(y+1)*600*4),y*1200*4+600*4);
 }
 const r=await analyzeImage(p);
 assert.deepEqual(r.values,{temperature:'',humidity:''});
 assert.equal(r.readings.humidity.rejectionReason,'ambiguous-display-assignment');
});
