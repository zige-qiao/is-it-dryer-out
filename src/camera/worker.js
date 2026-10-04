import { analyzeImage } from './analysis.js';

export async function processImage({ pixels, options }) {
  if (!pixels || pixels.width < 1 || pixels.height < 1 || Math.max(pixels.width, pixels.height) > 800 ||
    pixels.data?.length !== pixels.width * pixels.height * 4) throw new Error('Invalid bounded image');
  return analyzeImage(pixels, options);
}
if (typeof self !== 'undefined' && typeof document === 'undefined') self.onmessage = async event => {
  const { id, pixels, options } = event.data;
  try { self.postMessage({ id, result: await processImage({ pixels, options }) }); }
  catch { self.postMessage({ id, error: 'Image analysis failed' }); }
};
