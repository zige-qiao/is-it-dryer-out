// Standalone diagnostic: never imports recognition or production camera code.
export function createFlashTest(elements, environment = globalThis) {
  const { start, capture, status, capabilities, video, result, photo } = elements;
  let session = 0, stream = null, imageCapture = null, supported = false, busy = false, photoURL = null;
  const pending = new Set();
  const stale = request => request !== session || environment.document.hidden;
  const aborted = () => Object.assign(new Error('Camera test cancelled.'), { name: 'AbortError' });
  const message = error => `${error?.name || 'Error'}: ${error?.message || 'Camera operation failed.'}`;

  function sync() { start.disabled = busy; capture.disabled = busy || !supported; }
  function bounded(operation, milliseconds, label) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true; environment.clearTimeout(timer); pending.delete(cancel); callback(value);
      };
      const cancel = () => finish(reject, aborted());
      const timer = environment.setTimeout(() => finish(reject,
        Object.assign(new Error(`${label} timed out.`), { name: 'TimeoutError' })), milliseconds);
      pending.add(cancel);
      Promise.resolve(operation).then(value => finish(resolve, value), error => finish(reject, error));
    });
  }
  function delay(milliseconds) {
    return new Promise((resolve, reject) => {
      const cancel = () => { environment.clearTimeout(timer); pending.delete(cancel); reject(aborted()); };
      const timer = environment.setTimeout(() => { pending.delete(cancel); resolve(); }, milliseconds);
      pending.add(cancel);
    });
  }
  function releaseStream() {
    supported = false; imageCapture = null;
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    video.pause(); video.srcObject = null; video.hidden = true;
  }
  function clearPhoto() {
    if (photoURL) environment.URL.revokeObjectURL(photoURL);
    photoURL = null; photo.removeAttribute('src'); result.hidden = true;
  }
  function stop() {
    session++; [...pending].forEach(cancel => cancel());
    releaseStream(); clearPhoto(); busy = false; capabilities.textContent = '';
    status.textContent = 'Camera stopped. Tap Start camera to try again.'; sync();
  }
  async function openStream(request) {
    // Permission prompts are left to the browser. Late approval after leaving
    // the page must immediately release its own stream.
    const acquired = await environment.navigator.mediaDevices.getUserMedia({
      audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
    if (stale(request)) { acquired.getTracks().forEach(track => track.stop()); throw aborted(); }
    stream = acquired; video.srcObject = stream; video.hidden = false;
    await bounded(video.play(), 5000, 'Starting preview');
    if (stale(request)) throw aborted();
  }
  async function checkCapabilities(request) {
    supported = false; imageCapture = null;
    if (typeof environment.ImageCapture !== 'function') {
      capabilities.textContent = 'ImageCapture is unavailable in this browser. Still-photo flash cannot be requested.'; return;
    }
    try {
      const candidate = new environment.ImageCapture(stream.getVideoTracks()[0]);
      if (typeof candidate.getPhotoCapabilities !== 'function' || typeof candidate.takePhoto !== 'function') {
        capabilities.textContent = 'This browser does not expose the required still-photo methods.'; return;
      }
      const available = await bounded(candidate.getPhotoCapabilities(), 5000, 'Photo capability check');
      if (stale(request)) return;
      const modes = Array.from(available?.fillLightMode || []);
      supported = modes.includes('flash'); imageCapture = supported ? candidate : null;
      capabilities.textContent = supported ? `Still-photo flash advertised (${modes.join(', ')}).`
        : `Still-photo flash is not advertised. Available modes: ${modes.join(', ') || 'none'}.`;
    } catch (error) {
      if (!stale(request)) capabilities.textContent = `Could not check still-photo flash. ${message(error)}`;
    }
  }
  async function startCamera() {
    if (busy || environment.document.hidden) return;
    stop(); const request = session; busy = true; sync(); status.textContent = 'Starting camera…';
    try {
      if (environment.isSecureContext === false) throw new Error('Open this test over HTTPS to use the camera.');
      if (!environment.navigator?.mediaDevices?.getUserMedia) throw new Error('Camera access is unavailable in this browser.');
      await openStream(request); await checkCapabilities(request);
      if (!stale(request)) status.textContent = supported ? 'Live feed ready. Tap Take flash photo.' : 'Live feed ready. Flash capture is unavailable.';
    } catch (error) {
      if (!stale(request)) { releaseStream(); status.textContent = message(error); }
    } finally {
      if (!stale(request)) { busy = false; sync(); }
    }
  }
  async function previewAdvances(request) {
    const time = video.currentTime;
    for (let sample = 0; sample < 20; sample++) {
      await delay(100);
      if (stale(request)) throw aborted();
      if (stream?.getVideoTracks()[0]?.readyState === 'ended') return false;
      if (!video.paused && video.readyState >= 2 && video.currentTime > time) return true;
    }
    return false;
  }
  async function restorePreview(request) {
    try {
      await bounded(video.play(), 3000, 'Resuming preview');
      if (await previewAdvances(request)) return;
    } catch (error) { if (stale(request)) throw error; }
    if (stale(request)) throw aborted();
    status.textContent = 'Restarting live feed…'; releaseStream();
    await openStream(request); await checkCapabilities(request);
    if (!(await previewAdvances(request))) throw new Error('Live feed did not resume. Tap Start camera to retry.');
  }
  async function takePhoto() {
    if (busy || !supported || !imageCapture || environment.document.hidden) return;
    const request = session; busy = true; sync(); status.textContent = 'Taking photo with flash…';
    let captureError = null;
    try {
      const blob = await bounded(imageCapture.takePhoto({ fillLightMode: 'flash' }), 10000, 'Still-photo capture');
      if (stale(request)) return;
      if (!blob?.size) throw new Error('Camera returned an empty photo.');
      clearPhoto(); photoURL = environment.URL.createObjectURL(blob); photo.src = photoURL;
      await bounded(photo.decode(), 5000, 'Loading photo');
      if (stale(request)) return;
      result.hidden = false;
    } catch (error) {
      if (stale(request)) return;
      captureError = error;
    }
    if (stale(request)) return;
    try {
      status.textContent = 'Resuming live feed…'; await restorePreview(request);
      if (stale(request)) return;
      status.textContent = captureError ? `Photo failed. ${message(captureError)} Live feed resumed.`
        : 'Photo captured. Live feed resumed. Check whether the flash fired.';
    } catch (error) {
      if (stale(request)) return;
      releaseStream(); status.textContent = `${captureError ? `Photo failed. ${message(captureError)} ` : 'Photo captured. '}${message(error)}`;
    } finally {
      if (!stale(request)) { busy = false; sync(); }
    }
  }
  function initialize() {
    start.addEventListener('click', () => void startCamera());
    capture.addEventListener('click', () => void takePhoto());
    environment.document.addEventListener('visibilitychange', () => { if (environment.document.hidden) stop(); });
    environment.addEventListener('pagehide', stop); sync();
  }
  return { initialize, startCamera, takePhoto, stop };
}
