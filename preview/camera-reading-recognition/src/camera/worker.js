import { analyzeImage } from './analysis.js';
import { proposeRegions } from './regions.js';

export async function processImage({ pixels, options = {}, kind = 'analyze' }, checkpoint = async () => true) {
  if (!pixels || pixels.width < 1 || pixels.height < 1 || Math.max(pixels.width, pixels.height) > 800 ||
    pixels.data?.length !== pixels.width * pixels.height * 4) throw new Error('Invalid bounded image');
  if (!await checkpoint()) return null;
  if (kind === 'propose') return proposeRegions(pixels);
  return analyzeImage(pixels, { ...options, thresholds: [.55, .4] }, checkpoint);
}
if (typeof self !== 'undefined' && typeof document === 'undefined') self.onmessage = async event => {
  const { id, pixels, options, kind } = event.data;
  try { self.postMessage({ id, result: await processImage({ pixels, options, kind }) }); }
  catch { self.postMessage({ id, error: 'Image analysis failed' }); }
};
