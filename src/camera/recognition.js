import { processImage } from './worker.js';
import { boundedRegion, mapRegionalResult, mergeResults } from './regions.js';

export function cropCanvas(source, crop, document = globalThis.document) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * crop.width));
  canvas.height = Math.max(1, Math.round(source.height * crop.height));
  canvas.getContext('2d').drawImage(source, source.width * crop.x, source.height * crop.y,
    source.width * crop.width, source.height * crop.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function createRecognitionService(environment = globalThis) {
  let generation = 0, worker = null, pending = null;
  const { document } = environment;
  function pixels(source, region = { x: 0, y: 0, width: 1, height: 1 }, refine = false) {
    const width = source.width * region.width, height = source.height * region.height;
    // Keep small native crops intact. The worker combines any enlargement and
    // geometric correction in one resampling pass instead of blurring twice.
    const scale = Math.min(1, 800 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(source, source.width * region.x, source.height * region.y, width, height, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = canvas.height = 0;
    return { width: image.width, height: image.height, data: image.data };
  }
  function cancel() {
    generation++; worker?.terminate(); worker = null;
    if (pending) { environment.clearTimeout(pending.timer); pending.resolve(null); pending = null; }
  }
  async function analyze(source, options = {}) {
    cancel(); const id = generation, sourceSize = { width: source.width, height: source.height };
    const now = () => environment.performance?.now() ?? Date.now(), deadline = now() + 15000;
    const alive = () => id === generation && now() < deadline;
    const candidate = environment.Worker ? new environment.Worker(new URL('./worker.js', import.meta.url), { type: 'module' }) : null;
    worker = candidate;
    let receive, rejectStage;
    const request = async (image, opts, kind = 'analyze') => {
      if (!alive()) return null;
      if (!candidate) return processImage({ pixels: image, options: opts, kind }, async () => {
        await new Promise(resolve => environment.setTimeout(resolve, 0)); return alive();
      });
      return new Promise((resolve, reject) => {
        receive = resolve; rejectStage = reject;
        try { candidate.postMessage({ id, pixels: image, options: opts, kind }); } catch (error) { reject(error); }
      });
    };
    return new Promise((resolve, reject) => {
      const finish = (result, error) => {
        if (id !== generation || !pending) return;
        candidate?.terminate(); worker = null; environment.clearTimeout(pending.timer); pending = null;
        receive?.(null); receive = null;
        if (error) reject(error); else resolve(result);
      };
      pending = { resolve: () => { receive?.(null); resolve(null); }, timer: environment.setTimeout(() => finish(null, new Error('Local recognition timed out.')), 15000) };
      if (candidate) {
        candidate.onmessage = event => {
          if (id !== generation || event.data.id !== id) return;
          if (event.data.error) rejectStage?.(new Error(event.data.error)); else receive?.(event.data.result);
        };
        candidate.onerror = () => finish(null, new Error('Local recognition could not start.'));
      }
      void (async () => {
        try {
          if (options.region) {
            const b = options.region;
            const crop = boundedRegion({ x: b.x * source.width, y: b.y * source.height, width: b.width * source.width, height: b.height * source.height }, source.width, source.height, b.height * source.height * .35);
            const image = pixels(source, crop, true);
            const selection = { x: (b.x - crop.x) / crop.width, y: (b.y - crop.y) / crop.height, width: b.width / crop.width, height: b.height / crop.height };
            const result = await request(image, { ...options, region: selection, refine: true });
            finish(mapRegionalResult(result, crop, image, sourceSize)); return;
          }
          const overview = pixels(source), proposals = await request(overview, {}, 'propose');
          if (!alive()) return;
          const results = [];
          for (const proposal of proposals || []) {
            const image = pixels(source, proposal.region, true), result = await request(image, { allowPartial: true, refine: true });
            if (!alive()) return;
            results.push(mapRegionalResult(result, proposal.region, image, sourceSize));
            // A verified reading anchors this display proposal. Search it once
            // for the other unit/digit group, without assuming its position or value.
            const identified = ['temperature', 'humidity'].filter(field => result?.values?.[field]);
            if (identified.length === 1 && now() < deadline - 5000) {
              const missing = identified[0] === 'temperature' ? 'humidity' : 'temperature';
              const neighbour = await request(image, { allowPartial: true, refine: true, requiredField: missing });
              if (!alive()) return;
              results.push(mapRegionalResult(neighbour, proposal.region, image, sourceSize));
            }
            const merged = mergeResults(results);
            if (merged.values.temperature && merged.values.humidity) { finish(merged); return; }
          }
          if (!results.length) results.push(await request(overview, {}));
          finish(mergeResults(results));
        } catch (error) { finish(null, error); }
      })();
    });
  }
  return { locate: source => analyze(source), readRegion: (source, region, field, angle) => analyze(source, { region, field, angle }), cancel };
}
