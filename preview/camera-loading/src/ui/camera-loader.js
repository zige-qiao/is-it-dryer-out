// Check lazy resources before import: browsers may remember failed module fetches
// for the rest of the page session, even after the network recovers.
export const CAMERA_MODULE_FILES = [
  'controller.js', 'capture.js', 'device-session.js', 'still-photo.js',
  'zoom-presets.js', 'labels.js', 'regions.js', 'help.js', 'readings.js',
  'recognition.js', 'segments.js', 'detection.js', 'crop-editor.js',
  'analysis.js', 'budget.js', 'cell-validator.js', 'orientation.js',
  'current-row.js', 'row-context.js', 'evidence.js', 'geometry.js',
  'image.js', 'units.js', 'worker.js',
];

export async function loadCameraModule(environment = globalThis) {
  // force-cache warms the HTTP cache for the subsequent native import. The
  // installed worker also provides these files when offline; no code is evaluated.
  await Promise.all(CAMERA_MODULE_FILES.map(async file => {
    const response = await environment.fetch(new URL('../camera/' + file, import.meta.url), { cache: 'force-cache' });
    if (!response.ok) throw Error('Camera resource unavailable');
    await response.arrayBuffer();
  }));
  return import('../camera/controller.js');
}

// Loading code can finish after cancellation; only a current request may activate it.
export function createCameraLoader({ load, canActivate, setBusy, showError }) {
  let controller = null, loading = null, pending = null;
  const clearError = () => showError('');
  function cancel() {
    pending = null;
    setBusy(false);
    clearError();
  }
  function loadController() {
    if (controller) return Promise.resolve(controller);
    loading ??= Promise.resolve().then(load).then(value => {
      value.initialize();
      controller = value;
      return value;
    }).finally(() => { loading = null; });
    return loading;
  }
  async function start() {
    if (pending || !canActivate()) return;
    const request = {};
    pending = request;
    clearError();
    setBusy(!controller);
    let camera;
    try {
      camera = await loadController();
    } catch {
      if (pending !== request) return;
      pending = null;
      setBusy(false);
      if (canActivate()) showError('Camera couldn’t load. Try again or enter readings manually.');
      return;
    }
    if (pending !== request) return;
    pending = null;
    setBusy(false);
    if (canActivate()) return camera.startCamera();
  }
  return { start, cancel };
}
