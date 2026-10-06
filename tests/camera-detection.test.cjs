const {test}=require('node:test');
const assert=require('node:assert/strict');
const {detectReadingRegions}=require('../src/camera/detection.js');
const {monitor,image}=require('./helpers/camera-pixels.cjs');
const { detectCandidates } = require('../src/camera/detection.js');
const { grayscaleConfidence } = require('../src/camera/detection.js');

test('a full-width fragmented glyph cannot become a narrow LCD one', () => {
  const pixels = image(100, 100);
  assert.equal(grayscaleConfidence(pixels, { digit: '1', x: 20, y: 20, width: 39, height: 53 }), 0);
});

test('detached middle bars remain eight, while genuine zero remains zero across processing variants', () => {
  for (const rh of ['58', '50']) {
    const p = monitor(55, 50, 80, '22.8', rh);
    if (rh === '58') {
      const x = 55 + 80 * 1.5 + 80 * 1.2 + 80 * .75;
      for (let y = 85; y < 96; y++) for (const range of [[x + 5, x + 12], [x + 40, x + 47]]) for (let xx = Math.round(range[0]); xx < range[1]; xx++) {
        const i = (y * p.width + xx) * 4; p.data[i] = p.data[i + 1] = p.data[i + 2] = 205;
      }
    }
    for (const [threshold, variant] of [[.55, 'adaptive'], [.4, 'adaptive'], [.55, 'gentle'], [.7, 'denoised']]) {
      const r = detectCandidates(p, threshold, variant);
      assert.equal(r.readings.find(e => e.field === 'humidity')?.value, rh);
    }
  }
});
test('expanded temperature and humidity values are recognised without clamping', () => {
  for (const [temp, rh] of [['38.7', '15'], ['45.0', '10']]) assert.deepEqual(detectReadingRegions(monitor(55, 50, 80, temp, rh))?.values, { temperature: temp, humidity: rh });
});
test('undecodable large current digits prevent historical readings from becoming the main readings', () => {
  const { rect } = require('./helpers/camera-pixels.cjs');
  const p = monitor(55, 50, 80, '22.8', '58'), records = monitor(55, 240, 35, '20.4', '49');
  for (let i = 0; i < records.data.length; i += 4) if (records.data[i] === 30) p.data[i] = p.data[i + 1] = p.data[i + 2] = 30;
  // Add interior strokes that invalidate the large glyphs without hiding their band.
  for (const x of [55, 115, 271, 331]) rect(p, x + 22, 67, 15, 16);
  const r = detectCandidates(p);
  assert.ok(r.currentBand); assert.equal(r.readings.some(e => e.value === '20.4' || e.value === '49'), false);
});
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

test('authoritative empty or stronger row context cannot be replaced by a crop',()=>{
 const p=monitor(55,50,80,'22.3','59');
 assert.equal(detectCandidates(p,.55,'adaptive',{currentRows:[]}).readings.length,0);
 const stronger={row:{x:0,y:50,width:600,height:110},integerHeight:110,displayBounds:{x:0,y:0,width:600,height:420},evidence:'raw-strokes'};
 const r=detectCandidates(p,.55,'adaptive',{currentRows:[stronger]});
 assert.equal(r.readings.length,0);assert.equal(r.rejectionReason,'outside-current-row');
});

test('candidate entries preserve integer cells independently of the smaller fraction',()=>{
 const found=detectCandidates(monitor(55,50,80,'22.3','59'));
 for(const reading of found.readings){assert.equal(reading.integerCells.length,2);assert.equal(reading.currentRowValidated,true);assert.equal(reading.confidence.evidence.currentRow,true);}
 assert.ok(found.readings.some(r=>r.field==='temperature'));
});
