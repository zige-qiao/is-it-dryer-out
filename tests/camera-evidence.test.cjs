const { test } = require('node:test');
const assert = require('node:assert/strict');
const { monitor, image, rect, digit, unit } = require('./helpers/camera-pixels.cjs');
const { analyzeImage } = require('../src/camera/analysis.js');
const { combineEvidence, PROCESSING_VARIANTS, consolidateGlyphs } = require('../src/camera/evidence.js');
const { detectCandidates, digitPairs } = require('../src/camera/detection.js');
const { mergeResults } = require('../src/camera/regions.js');
function erase(p, x, y, w, h) { for (let yy=y;yy<y+h;yy++) for(let xx=x;xx<x+w;xx++){const i=(yy*p.width+xx)*4;p.data[i]=p.data[i+1]=p.data[i+2]=205;} }
for (let fraction=0;fraction<=9;fraction++) test(`humidity anchor reads fractional ${fraction} without Celsius`, async () => {
  const p=monitor(55,120,80,`22.${fraction}`,'62'); erase(p,171,116,33,36);
  const r=await analyzeImage(p,{quick:true}); assert.equal(r.values.temperature,`22.${fraction}`); assert.equal(r.values.humidity,'62');
  assert.equal(r.readings.temperature.confidence.evidence.assignment,'same-display-humidity');
  assert.ok(r.readings.temperature.integerCells.every(cell => !('variant' in cell)));
  assert.ok(JSON.stringify(r.readings.temperature.integerCells).length < 1000);
});
test('missing decimal or a broad intervening bezel cannot assign temperature from humidity',async()=>{
 for(const bezel of [false,true]){const p=monitor(55,120,80,'22.3','62');erase(p,171,116,33,36);if(bezel)rect(p,223,115,28,90);else erase(p,166,190,9,11);
 const r=await analyzeImage(p,{quick:true});assert.equal(r.values.temperature,'');assert.equal(r.values.humidity,'62');}
});
test('visible Fahrenheit rejects anchored and unit-based temperature',async()=>{
 const p=monitor(55,120,80,'22.3','62');erase(p,171,116,33,36);unit(p,'temperature',175,120,80);erase(p,187,141,15,5);rect(p,187,130,12,3);
 const r=await analyzeImage(p,{quick:true});assert.equal(r.values.temperature,'');assert.equal(r.values.humidity,'62');
});
test('fusion combines separate integer and fractional variants in the same geometry',async()=>{
 const p=monitor(55,120,80,'22.4','62');const variants=PROCESSING_VARIANTS.map(config=>({...config,found:detectCandidates(p,config.threshold,config.preprocessing)}));
 for(let i=0;i<variants.length;i++)variants[i].found.glyphs=variants[i].found.glyphs.filter(g=>i%2 ? g.height<60 : g.height>=60);
 const r=await combineEvidence(p,variants,async()=>true);assert.ok(r.some(r=>r.value==='22.4'));
 assert.deepEqual(consolidateGlyphs([{digit:'8',x:10,y:10,width:30,height:50,confidence:1},{digit:'0',x:11,y:11,width:30,height:50,confidence:1}]),[]);
});
test('another physical region cannot erase a validated reading but same-region conflicts do',()=>{
 const box={x:.1,y:.2,width:.2,height:.2},entry={value:'62',digitBounds:box,region:box,confidence:{numeric:1,unit:.9}};
 const different={...entry,value:'49',digitBounds:{...box,x:.7}};
 assert.equal(mergeResults([{readings:{humidity:entry}},{readings:{humidity:different}}]).values.humidity,'62');
 assert.equal(mergeResults([{readings:{humidity:entry}},{readings:{humidity:{...different,digitBounds:box}}}]).values.humidity,'');
});

test('humidity anchor searches either side and rejects two plausible temperatures',async()=>{
 const p=image();digit(p,'6',160,120,50);digit(p,'2',197.5,120,50);unit(p,'humidity',233,147.5,50);
 digit(p,'2',340,120,50);digit(p,'3',377.5,120,50);digit(p,'4',415,145,25);rect(p,411,166,2,4);
 const r=await analyzeImage(p,{quick:true});assert.equal(r.values.temperature,'23.4');assert.equal(r.values.humidity,'62');
 const ambiguous=monitor(55,120,80,'22.3','62');erase(ambiguous,171,116,33,36);
 // Both assignments meet the 80% integer-height floor of the 80px main row.
 digit(ambiguous,'3',420,130,70);digit(ambiguous,'3',472.5,130,70);digit(ambiguous,'4',525,165,35);rect(ambiguous,520,195,3,4);
 const a=await analyzeImage(ambiguous,{quick:true});assert.equal(a.values.temperature,'');assert.equal(a.values.humidity,'62');
});

test('manual temperature assignment uses fusion while missing fraction stays blank',async()=>{
 const p=monitor(55,120,80,'22.8','58');erase(p,171,116,33,36);
 const region={x:.085,y:.275,width:.27,height:.22};const r=await analyzeImage(p,{region,field:'temperature',quick:true});
 assert.equal(r.values.temperature,'22.8');assert.equal(r.readings.temperature.confidence.evidence.assignment,'manual');
 erase(p,170,158,35,44);const blank=await analyzeImage(p,{region,field:'temperature',quick:true});assert.equal(blank.values.temperature,'');
});

test('grayscale cell evidence rejects a narrow vertical fragment of three',()=>{
 const p=image();digit(p,'3',55,120,80);
 assert.equal(require('../src/camera/detection.js').grayscaleConfidence(p,{digit:'1',x:97,y:126,width:9,height:68}),0);
});

test('conflicting humidity cannot anchor a temperature without a unit',async()=>{
 const p=monitor(55,120,80,'22.8','58');erase(p,171,116,33,36);
 const variants=PROCESSING_VARIANTS.map(config=>({...config,found:detectCandidates(p,config.threshold,config.preprocessing)}));
 for(let i=0;i<variants.length;i++)for(const r of variants[i].found.readings)if(r.field==='humidity'){r.value=i%2?'50':'58';r.confidence.numeric=1;}
 assert.equal((await combineEvidence(p,variants,async()=>true)).length,0);
});

test('regional merging leaves competing anchored temperatures blank',()=>{
 const a={value:'22.8',region:{x:.1,y:.2,width:.2,height:.2},digitBounds:{x:.1,y:.2,width:.2,height:.2},confidence:{numeric:1,unit:0,evidence:{assignment:'same-display-humidity'}}};
 const b={...a,value:'23.4',digitBounds:{...a.digitBounds,x:.7}};
 const merged=mergeResults([{readings:{temperature:a}},{readings:{temperature:b}}]);
 assert.equal(merged.values.temperature,'');assert.equal(merged.readings.temperature.rejectionReason,'ambiguous-temperature');
});

test('parallel threshold slivers of one physical digit cannot become eleven',()=>{
 const a={digit:'1',x:50,y:20,width:3,height:50},b={...a,x:58};
 assert.equal(digitPairs([a,b]).length,0);
 assert.equal(digitPairs([a,{...b,x:85}])[0].value,'11');
});

test('complete spatial groups cannot skip an undecoded integer or insert a bezel one',()=>{
 const {temperatureGroups}=require('../src/camera/detection.js');
 const border={digit:'1',x:40,y:20,width:5,height:60},two={digit:'2',x:65,y:20,width:35,height:60};
 const one={digit:'1',x:110,y:20,width:6,height:60},fraction={digit:'3',x:125,y:50,width:20,height:30};
 assert.deepEqual(temperatureGroups([border,two,fraction],[border,two,one,fraction]),[]);
 assert.equal(temperatureGroups([border,two,one,fraction])[0].value,'21.3');
 assert.deepEqual(digitPairs([border,one],[border,two,one]),[]);
});

test('narrow ones use their own cell rather than neighbouring large digits',()=>{
 const {grayscaleConfidence}=require('../src/camera/detection.js');
 const p=image();digit(p,'2',50,120,80);digit(p,'1',109,120,80);
 const one={digit:'1',x:151,y:126,width:9,height:68},neighbour={digit:'2',x:50,y:120,width:51,height:80};
 assert.ok(grayscaleConfidence(p,one,[one,neighbour])>0);
});

test('grayscale segments tolerate a thin reflected stripe without inventing a missing bar',()=>{
 const {grayscaleConfidence}=require('../src/camera/detection.js');
 const p=image();digit(p,'2',55,120,80);
 for(let y=120;y<200;y++){const i=(y*p.width+80)*4;p.data[i]=p.data[i+1]=p.data[i+2]=205;}
 assert.ok(grayscaleConfidence(p,{digit:'2',x:55,y:120,width:51,height:80})>0);
 assert.equal(grayscaleConfidence(p,{digit:'8',x:55,y:120,width:51,height:80}),0);
});

test('fusion withdraws a provisional candidate when a stronger reference arrives later',async()=>{
 const p=monitor(55,120,80,'22.4','62');const variants=PROCESSING_VARIANTS.slice(0,2).map(config=>({...config,found:detectCandidates(p,config.threshold,config.preprocessing)}));
 variants[1].found.currentRows=[{row:{x:0,y:30,width:600,height:120},integerHeight:120,displayBounds:{x:0,y:0,width:600,height:420},evidence:'raw-strokes'}];
 const r=await combineEvidence(p,variants,async()=>true);assert.equal(r.length,0);
});
