const {test}=require('node:test'),assert=require('node:assert/strict');
const {monitor,image,rect}=require('./helpers/camera-pixels.cjs');
const {expandedRotation,exactTransform,project,IDENTITY}=require('../src/camera/geometry.js');
const {prepareOrientation,remapHypotheses}=require('../src/camera/orientation.js');
const {analyzeImage}=require('../src/camera/analysis.js');
const {mergeResults}=require('../src/camera/regions.js');

test('quarter turns preserve every RGBA pixel and exchange non-square axes without interpolation',()=>{
 const p={width:3,height:2,data:Uint8ClampedArray.from({length:24},(_,i)=>i)};
 for(const angle of [0,90,180,270]){const correction=expandedRotation(3,2,angle),turned=exactTransform(p,correction);
  assert.deepEqual([...turned.data].sort((a,b)=>a-b),[...p.data].sort((a,b)=>a-b));
  assert.equal(turned.width,angle%180?2:3);assert.equal(turned.height,angle%180?3:2);
  const back=exactTransform(turned,expandedRotation(turned.width,turned.height,-angle));assert.deepEqual(back,p);
 }
});
test('expanded diagonal rotation keeps all source corners inside its destination',()=>{
 const {inverse}=require('../src/camera/geometry.js');const c=expandedRotation(320,180,48),forward=inverse(c.matrix);
 for(const [x,y]of[[0,0],[319,0],[319,179],[0,179]]){const [u,v]=project(forward,x,y);assert.ok(u>=-1e-8&&v>=-1e-8&&u<c.width&&v<c.height);}
});
test('raw preparations count identity and regional reuse retains the global hypothesis identities',()=>{
 const prepared=prepareOrientation(monitor(55,120,80));assert.ok(prepared.hypotheses.length<=4);assert.equal(prepared.hypotheses[0].id,'identity');
 const mapped=remapHypotheses(prepared.hypotheses,{width:200,height:130});assert.deepEqual(mapped.map(h=>h.id),prepared.hypotheses.map(h=>h.id));
});
test('coherent disconnected elongated LCD strokes support its raw axis while a divider does not',()=>{
 function lcd(){const p=image();for(let y=130;y<300;y++)for(let x=120;x<480;x++){const q=(y*p.width+x)*4;p.data[q]=175;p.data[q+1]=195;p.data[q+2]=185;}return p;}
 const p=lcd();rect(p,180,170,6,50);rect(p,250,170,6,48);
 const prepared=prepareOrientation(p),display=prepared.proposals.find(p=>p.region.x<.21&&p.region.width>.55);assert.ok(display?.strokeScore>0);assert.equal(prepared.hypotheses[0].evidence.longAxis,0);assert.deepEqual(prepared.orientation.credibleIds,['identity','orientation--180']);
 const divider=lcd();rect(divider,290,150,3,130);assert.ok(prepareOrientation(divider).proposals.every(p=>!p.strokeScore));
});
test('perspective prior is rebased into a native regional source rather than reduced to angle',()=>{
 const h={id:'supported',method:'perspective',matrix:IDENTITY,width:600,height:300,sourceWidth:1200,sourceHeight:600};
 const mapped=remapHypotheses([h],{width:300,height:150},{crop:{x:.25,y:.25,width:.5,height:.5},sourceSize:{width:1200,height:600}})[0];
 assert.deepEqual(project(mapped.matrix,300,150),[0,0]);assert.equal(mapped.id,h.id);assert.equal(mapped.method,'perspective');
});
test('a supported full prior reserves a global slot and resolves direction for the same retained photo',()=>{
 const p=monitor(55,120,80),prior={id:'chosen',method:'strokes',angle:90,shear:.08,matrix:[0,-1,599,1,.08,0,0,0,1],width:420,height:600,sourceWidth:600,sourceHeight:420,orientationResolved:true};
 const prepared=prepareOrientation(p,{priorCorrection:prior,sourceSize:p});assert.ok(prepared.hypotheses.length<=4);assert.equal(prepared.hypotheses[0].id,'identity');assert.deepEqual(prepared.orientation.credibleIds,['supported-chosen']);
 const selected=prepared.hypotheses.find(h=>h.id==='supported-chosen');assert.deepEqual(selected.matrix,prior.matrix);assert.equal(selected.native,true);
 const remapped=remapHypotheses([selected],{width:300,height:210},{crop:{x:.25,y:.25,width:.5,height:.5},sourceSize:p})[0];
 const sourcePoint=project(prior.matrix,20,40),regionalPoint=project(remapped.matrix,20,40);assert.ok(Math.abs(regionalPoint[0]-(sourcePoint[0]-150))<1e-6);assert.ok(Math.abs(regionalPoint[1]-(sourcePoint[1]-105))<1e-6);
});
test('resolved orientation evaluates its credible alternative before exposing validated progress',async()=>{
 const p=monitor(55,120,80),hypotheses=[0,180].map((angle,i)=>({id:i?'opposite':'identity',angle,method:i?'strokes':'none',...expandedRotation(p.width,p.height,angle)})),progress=[];
 const r=await analyzeImage(p,{hypotheses,orientation:{credibleIds:['identity','opposite']}},async()=>true,x=>progress.push(x));
 assert.deepEqual(r.values,{temperature:'22.3',humidity:'59'});assert.deepEqual(r.orientation.evaluatedIds,['identity','opposite']);
 assert.ok(progress.every(x=>x.orientation.state!=='pending'));
});
test('an unfinished or rejected reading cannot mark its correction as a supported manual prior',async()=>{
 const p=monitor(55,120,80),h={id:'identity',angle:0,method:'none',...expandedRotation(p.width,p.height,0)};
 const result=await analyzeImage(p,{hypotheses:[h],orientation:{credibleIds:['identity','unexamined']}});assert.equal(result.values.humidity,'');assert.equal(result.readings.humidity.correction.orientationResolved,false);
 const prepared=prepareOrientation(p,{priorCorrection:result.readings.humidity.correction,sourceSize:p});assert.ok(!prepared.orientation.credibleIds.some(id=>id.startsWith('supported-')));
});
test('a later mapped conflict withdraws an earlier resolved field while retaining the other field',()=>{
 const entry=(field,value)=>({field,value,digitBounds:{x:.2,y:.2,width:.3,height:.3},region:{x:.2,y:.2,width:.3,height:.3},confidence:{numeric:.96,unit:.95}});
 const a={readings:{temperature:entry('temperature','22.1'),humidity:entry('humidity','64')},orientation:{state:'resolved',resolvedFields:{temperature:true,humidity:true}}};
 const b={readings:{humidity:{...entry('humidity',''),rejectionReason:'conflicting-digits'}},orientation:{state:'conflicted',resolvedFields:{humidity:false}}};
 const r=mergeResults([a,b]);assert.equal(r.values.temperature,'22.1');assert.equal(r.values.humidity,'');assert.equal(r.orientation.state,'conflicted');
});
test('a stronger unlabelled overview cannot erase a conflict between credible physical displays',()=>{
 const result=(displayId,value,x,numeric)=>({displayId,readings:{humidity:{field:'humidity',value,digitBounds:{x,y:.2,width:.2,height:.2},confidence:{numeric,unit:.96},correction:{orientationResolved:true}}},orientation:{state:'resolved',credibleDisplayIds:['a','b'],resolvedFields:{humidity:true}}});
 const r=mergeResults([result('a','58',.1,.95),result('b','64',.6,.95),result(undefined,'58',.1,1)]);assert.equal(r.values.humidity,'');assert.equal(r.orientation.state,'conflicted');assert.equal(r.readings.humidity.correction.orientationResolved,false);
});
