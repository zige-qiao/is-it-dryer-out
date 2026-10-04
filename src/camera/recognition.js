import { parseRecognisedDigits } from './readings.js';
import { readSegmentedDigits } from './segments.js';
import { detectReadingRegions, locateGlyphs, temperatureGroups } from './detection.js';

const ASSET_ROOT = new URL('../../vendor/tesseract/', import.meta.url);
export const OCR_CACHE_NAME = 'dew-camera-ocr-6.0.1-v1';
export const OCR_ASSETS = [
  'tesseract.min.js', 'worker.min.js', 'core/tesseract-core-lstm.wasm.js',
  'core/tesseract-core-simd-lstm.wasm.js', 'lang/eng.traineddata.gz',
].map(path => new URL(path, ASSET_ROOT).href);

export function cropCanvas(source, crop, document = globalThis.document) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * crop.width));
  canvas.height = Math.max(1, Math.round(source.height * crop.height));
  canvas.getContext('2d').drawImage(source, source.width * crop.x, source.height * crop.y,
    source.width * crop.width, source.height * crop.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function prepareDigits(source, document = globalThis.document) {
  const canvas = document.createElement('canvas');
  const scale = Math.max(1, Math.min(4, 240 / source.height));
  canvas.width = Math.round(source.width * scale) + 40;
  canvas.height = Math.round(source.height * scale) + 40;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 20, 20, canvas.width - 40, canvas.height - 40);
  const pixels = context.getImageData(20, 20, canvas.width - 40, canvas.height - 40);
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const luminance = Math.round(.299 * pixels.data[i] + .587 * pixels.data[i + 1] + .114 * pixels.data[i + 2]);
    pixels.data[i] = luminance; histogram[luminance]++;
  }
  // Otsu separates dark LCD segments from the unevenly lit screen background.
  const count = pixels.data.length / 4;
  let sum = histogram.reduce((total, n, i) => total + n * i, 0), weight = 0, running = 0, best = 0, threshold = 128;
  for (let i = 0; i < 256; i++) {
    weight += histogram[i]; if (!weight) continue;
    const other = count - weight; if (!other) break;
    running += i * histogram[i];
    const variance = weight * other * (running / weight - (sum - running) / other) ** 2;
    if (variance > best) { best = variance; threshold = i; }
  }
  for (let i = 0; i < pixels.data.length; i += 4) {
    const value = best > 0 && pixels.data[i] <= threshold ? 0 : 255;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value; pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 20, 20);
  return canvas;
}

export function createRecognitionService(environment = globalThis) {
  let worker = null, generation = 0, scriptPromise = null;
  const { document, caches, fetch } = environment;

  function pixels(source, maxSize = 800) {
    const scale = Math.min(1, maxSize / Math.max(source.width, source.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(source.width * scale)); canvas.height = Math.max(1, Math.round(source.height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  }

  async function locate(source) {
    const session = ++generation;
    // Let the finding state paint before bounded, local image analysis.
    await new Promise(resolve => environment.setTimeout(resolve, 0));
    if (session !== generation) return null;
    return detectReadingRegions(pixels(source));
  }

  async function loadAssets(onStatus) {
    onStatus('Preparing offline recognition…');
    const cache = caches ? await caches.open(OCR_CACHE_NAME) : null;
    for (const url of OCR_ASSETS) {
      const cached = await cache?.match(url);
      if (!cached) {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Recognition files could not be downloaded. Connect to the internet and try again.');
        if (cache) await cache.put(url, response);
      }
    }
    if (!environment.Tesseract) {
      if (!scriptPromise) scriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = OCR_ASSETS[0]; script.onload = resolve;
        script.onerror = () => { script.remove(); scriptPromise = null; reject(new Error('Recognition could not start. Try again.')); };
        document.head.append(script);
      });
      await scriptPromise;
    }
  }

  async function recognise({ temperature, humidity }, onStatus = () => {}) {
    const session = ++generation;
    onStatus('Reading selected region…');
    const result = { temperature: '', humidity: '' }, candidates = {};
    for (const [field, source] of Object.entries({ temperature, humidity })) {
      if (!source?.width || !source.height) continue;
      const prepared = prepareDigits(source, document);
      const thresholded = prepared.getContext('2d').getImageData(20, 20, prepared.width - 40, prepared.height - 40);
      const glyphs = locateGlyphs(thresholded, true).sort((a, b) => a.x - b.x);
      if (field === 'temperature') result.temperature = temperatureGroups(glyphs)[0]?.value || '';
      else {
        result.humidity = readSegmentedDigits(thresholded, 2);
      }
      // No OCR fallback on blank photos or a lone clipped glyph.
      if (!result[field] && glyphs.length >= 2) candidates[field] = source;
    }
    if (!Object.keys(candidates).length) return result;
    await loadAssets(onStatus);
    if (session !== generation) return null;
    const candidate = await environment.Tesseract.createWorker('eng', 1, {
      workerPath: new URL('worker.min.js', ASSET_ROOT).href,
      corePath: new URL('core/', ASSET_ROOT).href,
      langPath: new URL('lang', ASSET_ROOT).href,
      logger: () => {},
    });
    if (session !== generation) { await candidate.terminate(); return null; }
    worker = candidate;
    try {
      await worker.setParameters({ tessedit_char_whitelist: '0123456789.', tessedit_pageseg_mode: '7' });
      onStatus('Reading selected region…');
      for (const [field, source] of Object.entries(candidates)) {
        const response = await candidate.recognize(prepareDigits(source, document));
        if (session !== generation) return null;
        const text = response.data.text.trim();
        result[field] = field === 'humidity' ? parseRecognisedDigits(text, response.data.confidence, 2)
          : response.data.confidence >= 85 && /^\d{2}\.\d$/.test(text) ? text : '';
      }
      if (session !== generation) return null;
      return result;
    } finally {
      if (worker === candidate) { worker = null; await candidate.terminate(); }
    }
  }

  function cancel() { generation++; const previous = worker; worker = null; if (previous) void previous.terminate().catch(() => {}); }
  return { locate, recognise, cancel };
}
