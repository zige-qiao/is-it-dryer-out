import { visibleFrame } from './capture.js';

// A still request cannot be aborted by the browser. Invalidate it and dispose of
// any late decoded image instead of allowing it to enter a newer camera session.
export function createStillPhoto(environment = globalThis) {
  let generation = 0;
  const pending = new Set();
  function cancel() {
    generation++;
    for (const reject of pending) reject(Object.assign(new Error('Photo cancelled'), { name: 'AbortError' }));
  }
  function bounded(operation, milliseconds, request, dispose = () => {}) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, value) => {
        if (settled) { if (!error) dispose(value); return; }
        settled = true; environment.clearTimeout(timer); pending.delete(abort);
        error ? reject(error) : resolve(value);
      };
      const abort = error => finish(error);
      const timer = environment.setTimeout(() => finish(Object.assign(new Error('Photo timed out'), { name: 'TimeoutError' })), milliseconds);
      pending.add(abort);
      Promise.resolve().then(() => {
        if (request !== generation) throw Object.assign(new Error('Photo cancelled'), { name: 'AbortError' });
        return operation();
      }).then(value => {
        if (request !== generation) { dispose(value); finish(Object.assign(new Error('Photo cancelled'), { name: 'AbortError' })); }
        else finish(null, value);
      }, error => finish(error));
    });
  }
  async function take(track, { flash, fillLightMode, digital, aspect }, prepare = async () => {}) {
    const request = generation;
    const Capture = environment.ImageCapture;
    if (!Capture || typeof Capture.prototype?.takePhoto !== 'function') {
      throw Object.assign(new Error('Still photos are unavailable in this browser. Try another browser or enter readings manually.'), { name: 'NotSupportedError' });
    }
    const capture = new Capture(track);
    await bounded(prepare, 5000, request);
    const blob = await bounded(() => fillLightMode === 'default' ? capture.takePhoto() : capture.takePhoto({ fillLightMode: fillLightMode || (flash ? 'flash' : 'off') }), 10000, request);
    if (!blob?.size) throw new Error('The camera returned an empty photo. Try again.');
    let image;
    if (environment.createImageBitmap) {
      image = await bounded(() => environment.createImageBitmap(blob), 5000, request, image => image?.close?.());
    } else {
      const url = environment.URL.createObjectURL(blob);
      try {
        image = await bounded(() => new Promise((resolve, reject) => {
          const photo = new environment.Image();
          photo.onload = () => resolve(photo); photo.onerror = () => reject(new Error('Photo could not be decoded.'));
          photo.src = url;
        }), 5000, request);
      } finally { environment.URL.revokeObjectURL(url); }
    }
    try {
      if (request !== generation) throw Object.assign(new Error('Photo cancelled'), { name: 'AbortError' });
      const width = image.width || image.naturalWidth, height = image.height || image.naturalHeight;
      if (!width || !height) throw new Error('Photo could not be decoded.');
      const crop = visibleFrame(width, height, aspect, 1, digital);
      const canvas = environment.document.createElement('canvas');
      const scale = Math.min(1, 4096 / Math.max(crop.width, crop.height));
      canvas.width = Math.max(1, Math.round(crop.width * scale)); canvas.height = Math.max(1, Math.round(crop.height * scale));
      canvas.getContext('2d').drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
      return canvas;
    } finally { image.close?.(); }
  }
  return { take, cancel, restore: operation => bounded(operation, 5000, generation) };
}
