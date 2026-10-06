const {test}=require('node:test'),assert=require('node:assert/strict');
const {mergeResults,mapRegionalResult}=require('../src/camera/regions.js');
const {IDENTITY}=require('../src/camera/geometry.js');
function context(height=100,y=30){return{state:'established',displayId:'lcd',row:{x:20,y,width:320,height},integerHeight:height,displayBounds:{x:0,y:0,width:400,height:300},matrix:IDENTITY};}
function result(value,cells,rows){const entry={field:'humidity',value,integerCells:cells,digitBounds:{x:.1,y:.4,width:.3,height:.15},region:{x:.1,y:.4,width:.3,height:.15},confidence:{numeric:1,unit:1},correction:{matrix:IDENTITY}};return{rowContexts:rows,values:{humidity:value},readings:{humidity:entry},orientation:{state:'resolved',resolvedFields:{humidity:true}}};}
test('larger main-row evidence withdraws a historical candidate arriving first',()=>{
 const cells=[{x:40,y:180,width:25,height:40},{x:75,y:180,width:25,height:40}],historical=result('49',cells,[context(40,180)]);
 assert.equal(mergeResults([historical]).values.humidity,'49');
 const merged=mergeResults([historical,{rowContexts:[context()],readings:{},values:{}}]);
 assert.equal(merged.values.humidity,'');assert.equal(merged.readings.humidity.rejectionReason,'historical-integer-height');
});
test('historical-only crop cannot replace established full-display scale',()=>{
 const cells=[{x:40,y:180,width:25,height:40},{x:75,y:180,width:25,height:40}];
 assert.equal(mergeResults([result('68',cells,[context(40,180)])],[context()]).values.humidity,'');
});
test('regional mapping preserves physical cells and rebases the row frame together',()=>{
 const cells=[{x:40,y:30,width:40,height:100},{x:90,y:30,width:40,height:100}],raw=result('60',cells,[context()]);
 const mapped=mapRegionalResult(raw,{x:.2,y:.1,width:.5,height:.6},{width:400,height:300},{width:1600,height:1000});
 assert.deepEqual(mapped.readings.humidity.integerCells,cells);
 assert.deepEqual(mapped.rowContexts[0].matrix,mapped.readings.humidity.correction.matrix);
 assert.equal(mergeResults([mapped]).values.humidity,'60');
});
test('uncertain field stays blank while a separate main-row humidity survives',()=>{
 const cells=[{x:40,y:30,width:40,height:100},{x:90,y:30,width:40,height:100}],valid=result('60',cells,[context()]);
 const merged=mergeResults([valid,{rowContexts:[context()],values:{temperature:''},readings:{}}]);
 assert.equal(merged.values.humidity,'60');assert.equal(merged.values.temperature,'');
});

test('a later competing-display assignment withdraws an earlier validated field',()=>{
 const cells=[{x:40,y:30,width:40,height:100},{x:90,y:30,width:40,height:100}],valid=result('60',cells,[context()]);
 const ambiguous=result('',cells,[context()]);ambiguous.readings.humidity.rejectionReason='ambiguous-display-assignment';
 const merged=mergeResults([valid,ambiguous]);assert.equal(merged.values.humidity,'');
 assert.equal(merged.readings.humidity.rejectionReason,'ambiguous-display-assignment');
});
