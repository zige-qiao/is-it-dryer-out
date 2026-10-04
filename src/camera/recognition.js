import { analyzeImage } from './analysis.js';

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
  function pixels(source) {
    const scale = Math.min(1, 800 / Math.max(source.width, source.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(source.width * scale)); canvas.height = Math.max(1, Math.round(source.height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return { width: image.width, height: image.height, data: image.data };
  }
  function cancel() {
    generation++; worker?.terminate(); worker = null;
    if (pending) { environment.clearTimeout(pending.timer); pending.resolve(null); pending = null; }
  }
  async function analyze(source, options = {}) {
    cancel(); const id = generation, image = pixels(source);
    if (environment.Worker) {
      const candidate = new environment.Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      worker = candidate;
      return new Promise((resolve, reject) => {
        const finish = (result, error) => {
          if (worker !== candidate) return;
          candidate.terminate(); worker = null; environment.clearTimeout(pending.timer); pending = null;
          if (error) reject(error); else resolve(result);
        };
        pending = { resolve, timer: environment.setTimeout(() => finish(null, new Error('Local recognition timed out.')), 15000) };
        candidate.onmessage = event => { if (event.data.id === id) finish(event.data.result, event.data.error ? new Error(event.data.error) : null); };
        candidate.onerror = () => finish(null, new Error('Local recognition could not start.'));
        try { candidate.postMessage({ id, pixels: image, options }); }
        catch (error) { finish(null, error); }
      });
    }
    return analyzeImage(image, options, async () => {
      await new Promise(resolve => environment.setTimeout(resolve, 0));
      return id === generation;
    });
  }
  return { locate: source => analyze(source), readRegion: (source, region, field, angle) => analyze(source, { region, field, angle }), cancel };
}
