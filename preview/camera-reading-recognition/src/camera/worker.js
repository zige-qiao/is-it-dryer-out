import { analyzeImage } from './analysis.js';
import { prepareOrientation } from './orientation.js';
import { proposeRegions } from './regions.js';
import { createRecognitionBudget, runWithRecognitionBudget } from './budget.js';

export async function processImage({ pixels, options = {}, kind = 'analyze', remainingMs = 8000 }, checkpoint = async () => true, onProgress = () => {}) {
  if (!pixels || pixels.width < 1 || pixels.height < 1 || Math.max(pixels.width, pixels.height) > 800 ||
    pixels.data?.length !== pixels.width * pixels.height * 4) throw new Error('Invalid bounded image');
  const now = () => globalThis.performance?.now() ?? Date.now();
  const budget = createRecognitionBudget({ now, deadline: now() + Math.max(0, remainingMs) });
  const check = () => { checkpoint.check?.(); budget.check(); };
  const guardedCheckpoint = async () => { check(); const active = await checkpoint(); check(); return active; };
  guardedCheckpoint.check = check;
  if (!await guardedCheckpoint()) return null;
  if (kind === 'prepare' || kind === 'propose') {
    const result = runWithRecognitionBudget(check, () => kind === 'prepare' ? prepareOrientation(pixels, options) : proposeRegions(pixels));
    check(); return result;
  }
  const result = await analyzeImage(pixels, options, guardedCheckpoint, result => { check(); onProgress(result); });
  check(); return result;
}
if (typeof self !== 'undefined' && typeof document === 'undefined') self.onmessage = async event => {
  const { id, stageId, pixels, options, kind, remainingMs } = event.data;
  try {
    const budget = createRecognitionBudget({ deadline: performance.now() + Math.max(0, remainingMs ?? 8000) });
    self.postMessage({ id, stageId, result: await processImage({ pixels, options, kind, remainingMs }, budget.checkpoint,
      result => self.postMessage({ id, stageId, progress: result })) });
  } catch (error) {
    self.postMessage({ id, stageId, error: 'Image analysis failed', errorName: error?.name });
  }
};
