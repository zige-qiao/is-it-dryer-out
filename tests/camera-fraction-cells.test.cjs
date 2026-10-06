const { test } = require('node:test');
const assert = require('node:assert/strict');
const { image, digit, monitor, rect } = require('./helpers/camera-pixels.cjs');
const { validateTemperatureGroup, detectCandidates, temperatureGroups, digitPairs } = require('../src/camera/detection.js');
const { analyzeImage } = require('../src/camera/analysis.js');
const { warp, expandedRotation, correctedPixels, inverse } = require('../src/camera/geometry.js');
const { extract } = require('../src/camera/image.js');
const { runWithRecognitionBudget, RecognitionDeadlineError } = require('../src/camera/budget.js');

test('a joined unit and complete fraction is evidence rather than a skipped integer',()=>{
  const {temperatureGroups}=require('../src/camera/detection.js');
  const integers=[{digit:'2',x:55,y:120,width:50,height:80},{digit:'2',x:115,y:120,width:50,height:80}];
  const fraction={digit:'0',x:175,y:160,width:25,height:40};
  const joined={x:172,y:115,width:32,height:85,rawComponent:true};
  assert.equal(temperatureGroups([...integers,fraction],[...integers,joined])[0].value,'22.0');
  assert.deepEqual(temperatureGroups([...integers,fraction],[...integers,{...joined,rawComponent:false}]),[]);
  assert.deepEqual(temperatureGroups([...integers,{...fraction,digit:'1'}],[...integers,joined]),[]);
});

function proposal(h = 40) {
  const x=Math.round(175+h*.52),y=Math.round(200-h+h*.08);
  return { height: 80, items: [
    { digit: '2', x: 55, y: 120, width: 50, height: 80 },
    { digit: '2', x: 115, y: 120, width: 50, height: 80 },
    { digit: '1', x, y, width: Math.round(175+h*.63)-x, height: Math.round(200-h+h*.92)-y },
  ] };
}

test('complete fraction cells reject right-stroke remnants of contradictory digits', () => {
  for (const value of ['0', '3', '5', '7', '8', '9']) {
    const p = image(); digit(p, value, 175, 160, 40);
    assert.equal(validateTemperatureGroup(p, proposal()), false, `fragment of ${value}`);
  }
});

test('genuine fractional ones survive nearby large digits and varied fractional heights', () => {
  for (const h of [26, 40, 60]) {
    const p = image(); digit(p, '2', 55, 120, 80); digit(p, '2', 115, 120, 80);
    digit(p, '1', 175, 200 - h, h);
    assert.equal(validateTemperatureGroup(p, proposal(h)), true, `fraction height ${h}`);
  }
});

test('fraction cell follows the full integer row slope and excludes the unit above it', () => {
  const p = image(); digit(p,'1',285,170,80); rect(p,285,157,30,5);
  const group = { height:160, items:[
    {digit:'2',x:55,y:40,width:100,height:160},
    {digit:'2',x:170,y:66,width:100,height:160},
    {digit:'1',x:327,y:176,width:9,height:68},
  ] };
  assert.equal(validateTemperatureGroup(p,group),true);
});

test('a full-height main one uses the neighbouring full digit baseline', () => {
  const p=image();digit(p,'2',55,120,80);rect(p,151,120,9,80);digit(p,'1',175,160,40);
  rect(p,175,205,25,3); // Display edge beneath the actual row, outside the fraction.
  const group=proposal();group.items[1]={digit:'1',x:151,y:120,width:9,height:80};
  assert.equal(validateTemperatureGroup(p,group,{sourceEvidence:{pixels:p,matrix:[1,0,0,0,1,0,0,0,1]}}),true);
});

test('a single native dark pixel cannot become a coherent bar through enlargement', () => {
  const raw = image(); digit(raw,'1',175,160,40); rect(raw,183,180,1,1);
  const enlarged = warp(raw,[.25,0,0,0,.25,0,0,0,1],2400,1680);
  const group = proposal(); group.height *= 4;
  group.items = group.items.map(g=>({...g,x:g.x*4,y:g.y*4,width:g.width*4,height:g.height*4}));
  assert.equal(validateTemperatureGroup(enlarged,group,{sourceEvidence:{pixels:raw,matrix:[.25,0,0,0,.25,0,0,0,1]}}),true);
});

test('native source evidence rejects a remnant even if corrected pixels lost its bars', () => {
  const raw = image(); digit(raw, '9', 175, 160, 40);
  const corrected = image(); digit(corrected, '1', 175, 160, 40);
  assert.equal(validateTemperatureGroup(corrected, proposal()), true);
  assert.equal(validateTemperatureGroup(corrected, proposal(), { sourceEvidence: { pixels: raw, matrix: [1,0,0,0,1,0,0,0,1] } }), false);
  const enlarged = warp(corrected, [.5,0,0,0,.5,0,0,0,1], 1200, 840);
  const group = proposal(); group.height *= 2;
  group.items = group.items.map(g => ({ ...g, x:g.x*2, y:g.y*2, width:g.width*2, height:g.height*2 }));
  assert.equal(validateTemperatureGroup(enlarged, group, { sourceEvidence: { pixels: raw, matrix: [.5,0,0,0,.5,0,0,0,1] } }), false);
});

test('every fractional template checks active and inactive strokes in the native original', () => {
  const m=[1,0,0,0,1,0,0,0,1];
  for (const [original,decoded] of [['8','0'],['0','8'],['9','3'],['6','5'],['3','7']]) {
    const raw=monitor(55,120,80,`22.${original}`,'64'),corrected=monitor(55,120,80,`22.${decoded}`,'64');
    const found=detectCandidates(corrected,.55,'adaptive',{sourceEvidence:{pixels:raw,matrix:m}});
    assert.equal(found.readings.some(r=>r.field==='temperature'),false,`${original} cannot become ${decoded}`);
    assert.equal(found.readings.find(r=>r.field==='humidity')?.value,'64');
  }
  for (let value=0;value<=9;value++) {
    const raw=monitor(55,120,80,`22.${value}`,'64');
    const found=detectCandidates(raw,.55,'adaptive',{sourceEvidence:{pixels:raw,matrix:m}});
    assert.equal(found.readings.find(r=>r.field==='temperature')?.value,`22.${value}`);
  }
});

test('native fraction evidence maps through cardinal turns, perspective, enlargement and crop offsets', () => {
  const raw=monitor(55,120,80,'22.8','64'),lostBar=monitor(55,120,80,'22.0','64');
  const check=(corrected,source,matrix,expected)=>assert.equal(detectCandidates(corrected,.55,'adaptive',{sourceEvidence:{pixels:source,matrix}}).readings.find(r=>r.field==='temperature')?.value,expected);
  for (const angle of [90,-90,180]) {
    const descriptor=expandedRotation(raw.width,raw.height,angle);
    const source=correctedPixels(raw,descriptor),mapping=inverse(descriptor.matrix);
    check(raw,source,mapping,'22.8'); check(lostBar,source,mapping,undefined);
  }
  const perspective=[1,.03,5,.02,1,5,.0001,.0002,1];
  const source=warp(raw,inverse(perspective),raw.width,raw.height);
  check(raw,source,perspective,'22.8'); check(lostBar,source,perspective,undefined);
  const enlarge=[.5,0,0,0,.5,0,0,0,1];
  check(warp(raw,enlarge,1200,840),raw,enlarge,'22.8');
  check(warp(lostBar,enlarge,1200,840),raw,enlarge,undefined);
  const crop={x:40,y:100,width:300,height:180},offset=[1,0,40,0,1,100,0,0,1];
  check(extract(raw,crop),raw,offset,'22.8'); check(extract(lostBar,crop),raw,offset,undefined);
});

test('unit masking preserves original mask pixels and unit-overlapping raw components', () => {
  const p = monitor(55,120,80,'22.1','64');
  const found = detectCandidates(p);
  assert.equal(found.rawMask, found.prepared.mask);
  const unitPoints = found.units.flatMap(u => u.strokes.flatMap(s => s.points || []));
  assert.ok(unitPoints.length);
  assert.ok(unitPoints.some(point => found.rawMask[point]));
  assert.ok(found.rawComponents.some(c => c.points.some(point => unitPoints.includes(point))));
});

test('a joined unit containing a complete fraction is not an inserted integer', () => {
  const a={digit:'2',x:10,y:10,width:30,height:60},b={digit:'2',x:50,y:10,width:30,height:60};
  const fraction={digit:'0',x:100,y:40,width:20,height:30};
  const joined={x:90,y:10,width:35,height:60,rawComponent:true};
  assert.equal(temperatureGroups([a,b,fraction],[a,b,fraction,joined])[0]?.value,'22.0');
  const one={...fraction,digit:'1',x:112,width:4,height:25};
  assert.deepEqual(temperatureGroups([a,b,one],[a,b,one,joined]),[]);
  const skipped={x:42,y:10,width:5,height:60,rawComponent:true};
  assert.deepEqual(digitPairs([a,b],[a,b,skipped]),[]);
  const raw=monitor(55,120,80,'22.8','64');
  const falseZero={...proposal(),items:proposal().items.slice(0,2).concat({digit:'0',x:175,y:160,width:25,height:40})};
  assert.equal(validateTemperatureGroup(raw,falseZero),false);
});

test('fraction cell scans observe the shared synchronous recognition deadline', () => {
  const p = image(); digit(p,'1',175,160,40);
  let checks = 0;
  assert.throws(() => runWithRecognitionBudget(() => { if (++checks === 3) throw new RecognitionDeadlineError(); }, () => validateTemperatureGroup(p,proposal())), RecognitionDeadlineError);
});

test('automatic and manually assigned genuine one use the same fraction safety check', async () => {
  const p = monitor(55,120,80,'22.1','64');
  const automatic = await analyzeImage(p, { quick: true });
  assert.equal(automatic.values.temperature, '22.1');
  const manual = await analyzeImage(p, { region: { x:.085, y:.275, width:.27, height:.22 }, field:'temperature', quick:true });
  assert.equal(manual.values.temperature, '22.1');
});
