const {test}=require('node:test');
const assert=require('node:assert/strict');
const {detectReadingRegions}=require('../src/camera/detection.js');
const {monitor,image}=require('./helpers/camera-pixels.cjs');
test('boundaries follow current glyphs when the monitor moves or changes size',()=>{
  const a=detectReadingRegions(monitor(55,50,90)),b=detectReadingRegions(monitor(170,170,65));
  assert.deepEqual(a?.values,{temperature:'22.3',humidity:'59'});assert.deepEqual(b?.values,a.values);
  assert.ok(b.regions.temperature.x>a.regions.temperature.x);assert.ok(b.regions.temperature.y>a.regions.temperature.y);
  assert.ok(b.regions.temperature.width<a.regions.temperature.width);
  assert.ok(a.regions.temperature.y+a.regions.temperature.height<(50+90*1.4)/420);
});
test('different segment values are read from evidence rather than memorising the supplied photo',()=>{
  const result=detectReadingRegions(monitor(80,100,85,'28.4','61'));
  assert.deepEqual(result?.values,{temperature:'28.4',humidity:'61'});
});
test('a blank or textured photo has no fabricated reading boxes',()=>{
  const blank=image();assert.equal(detectReadingRegions(blank),null);
  for(let y=0;y<blank.height;y++)for(let x=0;x<blank.width;x++){const p=(y*blank.width+x)*4;const gray=75+((x*17+y*23)%15);blank.data[p]=blank.data[p+1]=blank.data[p+2]=gray;}
  assert.equal(detectReadingRegions(blank),null);
});
