// Standalone diagnostic: never imports recognition or production camera code.
export function createFlashTest(elements, environment = globalThis) {
  const { start, plain, capture, torch, pause, status, capabilities, video, result, resultMode, photo } = elements;
  let session = 0, stream = null, imageCapture = null, busy = false, photoURL = null;
  let supportsTorch = false, torchState = false, previewPaused = false;
  const pending = new Set();
  const stale = request => request !== session || environment.document.hidden;
  const aborted = () => Object.assign(new Error('Camera test cancelled.'), { name: 'AbortError' });
  const message = error => `${error?.name || 'Error'}: ${error?.message || 'Camera operation failed.'}`;

  const track = () => stream?.getVideoTracks()[0];
  const live = () => Boolean(track() && track().readyState !== 'ended');
  function sync() {
    start.disabled = busy;
    plain.disabled = capture.disabled = busy || !live() || !imageCapture;
    torch.disabled = busy || !live() || !supportsTorch;
    pause.disabled = busy || !live();
    torch.textContent = torchState === false ? 'Torch on' : 'Torch off';
    torch.setAttribute('aria-pressed', String(torchState === true));
    pause.textContent = previewPaused ? 'Resume feed' : 'Pause feed';
    pause.setAttribute('aria-pressed', String(previewPaused));
  }
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
    imageCapture = null; supportsTorch = false; torchState = false;
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    video.pause(); video.srcObject = null; video.hidden = true;
  }
  function clearPhoto() {
    if (photoURL) environment.URL.revokeObjectURL(photoURL);
    photoURL = null; photo.removeAttribute('src'); result.hidden = true; resultMode.textContent = '';
  }
  function stop() {
    session++; [...pending].forEach(cancel => cancel());
    releaseStream(); clearPhoto(); busy = false; previewPaused = false; capabilities.textContent = '';
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
    imageCapture = null; supportsTorch = false;
    try { supportsTorch = Boolean(track()?.getCapabilities?.().torch); } catch { /* No torch capability exposed. */ }
    torchState = track()?.getSettings?.().torch === true;
    const report = text => { capabilities.textContent = `${text} Torch: ${supportsTorch ? 'available' : 'not advertised'}.`; };
    if (typeof environment.ImageCapture !== 'function') {
      report('ImageCapture is unavailable in this browser.'); return;
    }
    try {
      const candidate = new environment.ImageCapture(stream.getVideoTracks()[0]);
      if (typeof candidate.takePhoto !== 'function') { report('ImageCapture.takePhoto() is unavailable.'); return; }
      // Keep the method available even if the capability query is missing or fails.
      imageCapture = candidate;
      if (typeof candidate.getPhotoCapabilities !== 'function') { report('Photo capability query is unavailable. Direct attempts are enabled.'); return; }
      const available = await bounded(candidate.getPhotoCapabilities(), 5000, 'Photo capability check');
      if (stale(request)) return;
      const modes = Array.from(available?.fillLightMode || []);
      report(modes.includes('flash') ? `Still-photo flash advertised (${modes.join(', ')}).`
        : `Still-photo flash is not advertised. Available modes: ${modes.join(', ') || 'none'}. Try flash will still attempt the request.`);
    } catch (error) {
      if (!stale(request)) report(`Could not check still-photo flash. ${message(error)}`);
    }
  }
  async function applyTorch(on, request) {
    const owner = track();
    if (!supportsTorch || !owner?.applyConstraints) throw new Error('Torch control is unavailable.');
    const { torch: oldTorch, advanced: oldAdvanced, ...existing } = owner.getConstraints?.() || {};
    const advanced = (oldAdvanced || []).map(item => {
      const { torch: previous, ...rest } = item; return rest;
    }).filter(item => Object.keys(item).length);
    try {
      await bounded(owner.applyConstraints({ ...existing, advanced: [...advanced, { torch: on }] }), 5000, 'Torch change');
      if (stale(request)) throw aborted();
      const actual = owner.getSettings?.().torch;
      torchState = typeof actual === 'boolean' ? actual : on;
      if (torchState !== on) throw new Error('Camera did not apply the requested torch state.');
    } catch (error) {
      if (!stale(request)) {
        const actual = owner.getSettings?.().torch;
        // Stop a timed-out owner so a late constraint cannot interfere with a
        // subsequent photo or change the light on a replacement stream.
        if (error?.name === 'TimeoutError') releaseStream();
        else torchState = typeof actual === 'boolean' ? actual : null;
      }
      throw error;
    }
  }
  async function toggleTorch() {
    if (busy || !live() || !supportsTorch || environment.document.hidden) return;
    const request = session; busy = true; sync();
    try {
      await applyTorch(torchState === false, request);
      if (!stale(request)) status.textContent = `Torch ${torchState ? 'on' : 'off'}. ${previewPaused ? 'Preview remains paused.' : 'Live feed active.'}`;
    } catch (error) { if (!stale(request)) status.textContent = `Torch change failed. ${message(error)}`; }
    finally { if (!stale(request)) { busy = false; sync(); } }
  }
  async function togglePause() {
    if (busy || !live() || environment.document.hidden) return;
    if (!previewPaused) {
      video.pause(); previewPaused = true; status.textContent = 'Preview paused. Camera and torch controls remain active.'; sync(); return;
    }
    const request = session, wantedTorch = torchState === true; busy = true; sync();
    try {
      await restorePreview(request);
      if (wantedTorch && torchState !== true) await applyTorch(true, request);
      if (!stale(request)) { previewPaused = false; status.textContent = 'Live feed resumed.'; }
    } catch (error) {
      if (!stale(request)) { video.pause(); status.textContent = `Could not fully resume. ${message(error)} Tap Start camera to retry.`; }
    } finally { if (!stale(request)) { busy = false; sync(); } }
  }
  async function startCamera() {
    if (busy || environment.document.hidden) return;
    stop(); const request = session; busy = true; sync(); status.textContent = 'Starting camera…';
    try {
      if (environment.isSecureContext === false) throw new Error('Open this test over HTTPS to use the camera.');
      if (!environment.navigator?.mediaDevices?.getUserMedia) throw new Error('Camera access is unavailable in this browser.');
      await openStream(request); await checkCapabilities(request);
      if (!stale(request)) status.textContent = imageCapture ? 'Live feed ready. Try Take photo or Try flash.' : 'Live feed ready. Still-photo capture is unavailable.';
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
    if (live()) {
      try {
        await bounded(video.play(), 3000, 'Resuming preview');
        if (await previewAdvances(request)) return;
      } catch (error) { if (stale(request)) throw error; }
    }
    if (stale(request)) throw aborted();
    status.textContent = 'Restarting live feed…'; releaseStream();
    await openStream(request); await checkCapabilities(request);
    if (!(await previewAdvances(request))) throw new Error('Live feed did not resume. Tap Start camera to retry.');
  }
  async function takePhoto(mode = 'plain') {
    if (busy || !live() || !imageCapture || environment.document.hidden) return;
    const request = session, wantedTorch = torchState === true, wantedPause = previewPaused;
    const label = mode === 'flash' ? 'Flash requested: takePhoto({ fillLightMode: "flash" })' : 'Default photo: takePhoto()';
    busy = true; clearPhoto(); sync(); status.textContent = mode === 'flash' ? 'Trying still-photo flash…' : 'Taking default still photo…';
    let captureError = null, issued = false, recoveryError = null, torchError = null;
    try {
      if (torchState !== false || track()?.getSettings?.().torch === true) await applyTorch(false, request);
      if (stale(request)) return;
      issued = true;
      const operation = mode === 'flash' ? imageCapture.takePhoto({ fillLightMode: 'flash' }) : imageCapture.takePhoto();
      const blob = await bounded(operation, 10000, 'Still-photo capture');
      if (stale(request)) return;
      if (!blob?.size) throw new Error('Camera returned an empty photo.');
      photoURL = environment.URL.createObjectURL(blob); photo.src = photoURL;
      await bounded(photo.decode(), 5000, 'Loading photo');
      if (stale(request)) return;
      resultMode.textContent = label;
      photo.alt = mode === 'flash' ? 'Returned still photo with flash requested' : 'Returned default still photo'; result.hidden = false;
    } catch (error) {
      if (stale(request)) return;
      captureError = error;
      // Abandon the owner of a hung operation before allowing another attempt.
      if (error?.name === 'TimeoutError') releaseStream();
    }
    if (stale(request)) return;
    try {
      if (issued) { status.textContent = 'Restoring preview…'; await restorePreview(request); }
    } catch (error) {
      if (stale(request)) return;
      recoveryError = error; releaseStream();
    }
    try {
      if (!stale(request) && live() && wantedTorch && torchState !== true) await applyTorch(true, request);
    } catch (error) { if (stale(request)) return; torchError = error; }
    if (stale(request)) return;
    previewPaused = wantedPause;
    if (wantedPause && live()) video.pause();
    status.textContent = [label + '.', captureError ? `Photo failed. ${message(captureError)}` : 'Photo returned. Check whether a flash actually fired.',
      recoveryError ? `Preview recovery failed. ${message(recoveryError)}` : !live() ? 'Camera stopped. Tap Start camera to retry.' : wantedPause ? 'Preview paused.' : 'Live feed active.',
      torchError ? `Torch restoration failed. ${message(torchError)}` : ''].filter(Boolean).join(' ');
    busy = false; sync();
  }
  function initialize() {
    start.addEventListener('click', () => void startCamera());
    plain.addEventListener('click', () => void takePhoto());
    capture.addEventListener('click', () => void takePhoto('flash'));
    torch.addEventListener('click', () => void toggleTorch());
    pause.addEventListener('click', () => void togglePause());
    environment.document.addEventListener('visibilitychange', () => { if (environment.document.hidden) stop(); });
    environment.addEventListener('pagehide', stop); sync();
  }
  return { initialize, startCamera, takePhoto, toggleTorch, togglePause, stop };
}
