import { components, density, bounds, extract, binaryPixels } from './image.js';
import { readSegmentedDigits } from './segments.js';

export function locateUnits(pixels, mask) {
  const all = [0, 1, 2].flatMap(radius => components(mask, pixels.width, pixels.height, radius)).filter(i => i.width >= 2 && i.height >= 3);
  const sample = (i, ...zone) => density(mask, pixels.width, i, ...zone);
  const rings = all.filter(i => i.height >= 3 && i.width / i.height > .55 && i.width / i.height < 1.7 &&
    (sample(i, .4, .4, .6, .6) < .35 || i.height <= 10) && sample(i, 0, .25, .25, .75) > .2 && sample(i, .75, .25, 1, .75) > .2 &&
    sample(i, .25, 0, .75, .25) > .2 && sample(i, .25, .75, .75, 1) > .2);
  const result = [];
  let binary = null;
  const numeric = box => { binary ||= binaryPixels(pixels, mask); return readSegmentedDigits(extract(binary, box), 1); };
  const degrees = [...rings, ...all.filter(i => i.height <= 14 && i.width / i.height > .65 && i.width / i.height < 1.4 &&
    sample(i, .4, .4, .6, .6) < .55 && i.count / (i.width * i.height) > .2)];
  // Antialiasing can separate the short top stroke of C; join only aligned
  // fragments, without joining its lower neighbour (the decimal digit).
  const cShapes = [...all];
  const tops = all.filter(i => i.width >= 4 && i.height <= 12);
  const sides = all.filter(i => i.width >= 4 && i.height >= 10 && i.height <= 90);
  for (const a of tops) for (const b of sides) if (a.height < b.height * .35 &&
    b.y >= a.y + a.height && b.y - a.y - a.height <= 3 && Math.abs(a.x - b.x) < b.width * .3)
    cShapes.push(bounds([a, b]));
  for (const c of cShapes) {
    if (c.height < 6 || c.width / c.height < .3 || c.width / c.height > 1.1) continue;
    if (sample(c, .22, 0, .8, .2) < .25 || sample(c, .22, .8, .8, 1) < .25 || sample(c, 0, .2, .25, .8) < .25 ||
      sample(c, .65, .3, 1, .7) > .16 || sample(c, .3, .3, .6, .7) > .2) continue;
    const degree = [...degrees, ...all.filter(i => i.height <= 14 && i.width / i.height > .65 && i.width / i.height < 1.4 && i.count / (i.width * i.height) > .2)].find(i => i.height >= c.height * .15 && i.height <= c.height * .55 &&
      i.x + i.width <= c.x + c.width * .15 && c.x - (i.x + i.width) < c.height * .45 && Math.abs(i.y - c.y) < c.height * .3);
    if (degree) result.push({ field: 'temperature', unit: '°C', box: bounds([c, degree]), confidence: rings.includes(degree) ? .96 : .9 });
  }
  for (const slash of all) {
    if (slash.height < 10 || slash.width / slash.height < .18 || slash.width / slash.height > 1.1 || slash.correlation > -.5 || slash.count / (slash.width * slash.height) > .55) continue;
    if (slash.correlation > -.65 && sample(slash, 0, 0, .4, .25) < .25) continue;
    if (slash.width / slash.height >= .3 && numeric(slash)) continue;
    const nearby = rings.filter(i => i.height >= slash.height * .12 && i.height <= slash.height * .5);
    const top = nearby.find(i => i.x + i.width * .5 < slash.x + slash.width * .65 && i.x > slash.x - slash.height * .3 && Math.abs(i.y - slash.y) < slash.height * .25) ||
      (sample(slash, 0, 0, .4, .25) > .25 && sample(slash, .4, .4, .6, .6) > .4 ? { x: slash.x, y: slash.y, width: slash.width * .4, height: slash.height * .25 } : null);
    const bottom = nearby.find(i => i !== top && i.x + i.width * .5 > slash.x + slash.width * .35 && i.x < slash.x + slash.width + slash.height * .25 && Math.abs(i.y + i.height - slash.y - slash.height) < slash.height * .25);
    if (top && bottom) result.push({ field: 'humidity', unit: '%', box: bounds([slash, top, bottom]), confidence: .96 });
  }
  // At small resolutions a percent ring may touch the slash. Require both
  // corner rings and empty space beside its diagonal, rather than splitting it.
  for (const i of all) if (i.height >= 12 && i.width / i.height > .3 && i.width / i.height < .9 &&
    i.correlation < -.4 && i.count / (i.width * i.height) < .5 &&
    sample(i, 0, 0, .4, .3) > .2 && sample(i, .6, .7, 1, 1) > .13 &&
    sample(i, .05, .4, .25, .6) < .12 && sample(i, .75, .4, .95, .6) < .12 && sample(i, .4, .4, .6, .6) > .4 &&
    !numeric(i))
    result.push({ field: 'humidity', unit: '%', box: bounds([i]), confidence: .9 });
  return result.filter((unit, i) => !result.slice(0, i).some(other => other.field === unit.field && Math.abs(other.box.x - unit.box.x) < 3 && Math.abs(other.box.y - unit.box.y) < 3));
}
