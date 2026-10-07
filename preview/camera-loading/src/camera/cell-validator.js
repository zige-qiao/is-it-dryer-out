// A thresholded fragment supplies a proposal, never the physical character cell.
// In particular, a blurred nine can leave the two right strokes of a one.
import { checkRecognitionBudget } from './budget.js';
const PATTERNS = ['1111110','0110000','1101101','1111001','0110011','1011011','1011111','1110000','1111111','1111011'];
function sampler(pixels, sourceEvidence) {
  const source = sourceEvidence?.pixels || pixels, m = sourceEvidence?.matrix;
  const position = (x, y) => {
    if (m) {
      const d = m[6] * x + m[7] * y + m[8];
      const xx = (m[0] * x + m[1] * y + m[2]) / d;
      y = (m[3] * x + m[4] * y + m[5]) / d; x = xx;
    }
    x = Math.round(x); y = Math.round(y);
    return [x, y];
  };
  const sample = (x, y) => {
    [x, y] = position(x, y);
    if (x < 0 || y < 0 || x >= source.width || y >= source.height) return NaN;
    const p = (y * source.width + x) * 4;
    return .299 * source.data[p] + .587 * source.data[p + 1] + .114 * source.data[p + 2];
  };
  sample.key = (x, y) => position(x, y).join(':');
  return sample;
}

function nativeTemplate(pixels, glyph, sourceEvidence) {
  const pattern = PATTERNS[Number(glyph.digit)];
  if (!pattern) return false;
  const at = sampler(pixels, sourceEvidence);
  const sample = (x,y) => at(glyph.x + glyph.width*x, glyph.y + glyph.height*y);
  const backgrounds = [(sample(.4,.27)+sample(.6,.27))/2,(sample(.4,.73)+sample(.6,.73))/2];
  const zones = [[.5,.05],[.9,.27],[.9,.73],[.5,.95],[.1,.73],[.1,.27],[.5,.5]];
  const values = zones.map(([x,y])=>sample(x,y));
  if ([...backgrounds,...values].some(v=>!Number.isFinite(v))) return false;
  const minimumContrast = Math.max(8,(Math.max(...backgrounds)-Math.min(...values))*.15);
  // Joined decimal pixels can widen a three's proposal. Search its entire
  // left interior for coherent forbidden strokes rather than letting that
  // expanded proposal move the one inactive-segment sample away from a nine.
  for (const index of [4,5]) if (pattern[index]==='0') {
    const y=index===5?.27:.73,background=backgrounds[index===5?0:1];
    for (const x of [.06,.12,.18,.24,.3,.36]) {
      const samples=new Map();
      for (const delta of [-.12,-.06,0,.06,.12])
        samples.set(at.key(glyph.x+glyph.width*x,glyph.y+glyph.height*(y+delta)),background-sample(x,y+delta));
      const contrasts=[...samples.values()].sort((a,b)=>a-b);
      if (contrasts.length>=2&&contrasts[Math.floor((contrasts.length-1)/2)]>=minimumContrast) return false;
    }
  }
  return zones.every(([x,y],index)=>{
    checkRecognitionBudget();
    const background = index===6 ? (backgrounds[0]+backgrounds[1])/2 : backgrounds[y<.5?0:1];
    const horizontal = index===0 || index===3 || index===6;
    const samples = new Map();
    for (const delta of [-.12,-.06,0,.06,.12]) {
      const xx=x+(horizontal?delta:0), yy=y+(horizontal?0:delta);
      samples.set(at.key(glyph.x+glyph.width*xx,glyph.y+glyph.height*yy),background-sample(xx,yy));
    }
    const contrasts=[...samples.values()].sort((a,b)=>a-b);
    if (contrasts.length<2 || contrasts.some(v=>!Number.isFinite(v))) return false;
    const lit = contrasts[Math.floor((contrasts.length-1)/2)]>=minimumContrast;
    return lit === (pattern[index]==='1');
  });
}

function physicalHeight(glyph) {
  return glyph.height / (glyph.digit==='1'||glyph.digit==='4' ? .84 : glyph.digit==='7' ? .92 : 1);
}

function fractionEnvelope(group) {
  const fraction=group.items[2],integers=group.items.slice(0,2);
  // Ones/fours/sevens have no bottom bar: their ink ends above the physical
  // baseline. Correct that before inferring row slope from their components.
  const anchors=integers.filter(g=>!['1','4','7'].includes(g.digit));
  const reference=anchors.length ? Math.max(...anchors.map(g=>g.height)) : null;
  const heights=integers.map(g=>reference===null?physicalHeight(g):Math.max(reference,g.height));
  const centres=integers.map((g,i)=>g.x+g.width-heights[i]*.63/2);
  const bottoms=integers.map((g,i)=>g.y+g.height+(reference===null ? (['1','4','7'].includes(g.digit)?heights[i]*.08:0) :
    ['1','4'].includes(g.digit)?Math.max(0,reference-g.height)/2:g.digit==='7'?Math.max(0,reference-g.height):0));
  const rise=bottoms[1]-bottoms[0];
  const fractionHeight=physicalHeight(fraction),fractionCentre=fraction.x+fraction.width-fractionHeight*.63/2;
  const baseline=bottoms[1]+rise*(fractionCentre-centres[1])/Math.max(1,centres[1]-centres[0]);
  const height=fraction.digit==='1' ? Math.max(Math.max(...heights)*.5,fraction.height) : fractionHeight;
  const width=height*.63;
  return {x:fraction.x+fraction.width-width,y:baseline-height,width,height};
}

export function validateFractionCell(pixels, group, { sourceEvidence = null } = {}) {
  const fraction = group.items[2];
  if (!fraction) return false;
  if (fraction.digit !== '1') {
    // Full glyphs retain their measured proportions under perspective. Rebuild
    // the missing physical margins of three/seven/four before checking absent
    // strokes; otherwise a three's tight box can hide a nine's left stroke.
    const height=physicalHeight(fraction),width=fraction.width*(['3','7'].includes(fraction.digit)?63/57:1);
    const cell={x:fraction.x+fraction.width-width,y:fraction.y-(fraction.digit==='4'?height*.08:0),width,height};
    return nativeTemplate(pixels,{...fraction,...cell},sourceEvidence);
  }
  const cell=fractionEnvelope(group);
  const integers = group.items.slice(0, 2);
  // Follow residual row slope using both full integer cells. A flat maximum
  // baseline can move the search into Celsius above a legitimate tilted one.
  // Search the lower half of the main row, extending for taller fractions.
  // This is a contradiction envelope, not a new fractional-height limit.
  // Its baseline comes from the main row, not the surviving stroke's y/h.
  // The stroke's right edge locates its character column; its left edge does not.
  if (cell.x < integers[1].x + integers[1].width || fraction.width / fraction.height >= .3) return false;
  const at = sampler(pixels, sourceEvidence);
  const sample = (x, y) => at(cell.x + cell.width * x, cell.y + cell.height * y);
  const background = [.25, .4, .55, .7].flatMap(x => [.27, .73].map(y => sample(x, y))).sort((a, b) => a - b);
  const rightStroke = [.27, .73].map(y => at(fraction.x+fraction.width*.5,fraction.y+fraction.height*y));
  if ([...background, ...rightStroke].some(v => !Number.isFinite(v))) return false;
  const contrast = Math.max(8, (background[6] - Math.min(...rightStroke)) * .15);
  if (rightStroke.some((value,i)=>at(fraction.x-fraction.height*.2,fraction.y+fraction.height*[.27,.73][i])-value<contrast)) return false;
  // Scan bands, rather than a few fragment-relative points. A horizontal bar
  // must cover several distinct pixels; an isolated speckle is not a veto.
  const xs = [.16, .24, .32, .4, .48, .56, .64, .72];
  for (const [start, end] of [[0, .18], [.36, .64], [.82, 1]]) {
    checkRecognitionBudget();
    for (let y = start; y <= end + .001; y += .04) {
      let run = 0;
      const seen = new Set();
      for (const x of xs) {
        const position = at.key(cell.x + cell.width * x, cell.y + cell.height * y);
        if (seen.has(position)) continue; seen.add(position);
        const bg = (sample(x, .27) + sample(x, .73)) / 2;
        const value = sample(x, y);
        if (!Number.isFinite(bg + value)) return false;
        run = bg - value >= contrast ? run + 1 : 0;
        if (run >= 3) return false;
      }
    }
  }
  // Left vertical strokes also contradict a one, even if horizontal strokes
  // were lost. Compare each stroke with the adjacent empty interior.
  for (const [start, end] of [[.18, .4], [.6, .82]]) {
    checkRecognitionBudget();
    const contrasts = [];
    for (let y = start; y <= end + .001; y += .04)
      contrasts.push(sample(.4, y) - Math.min(sample(.08, y), sample(.14, y)));
    contrasts.sort((a, b) => a - b);
    if (contrasts.some(v => !Number.isFinite(v)) || contrasts[Math.floor(contrasts.length / 2)] >= contrast) return false;
  }
  return true;
}
