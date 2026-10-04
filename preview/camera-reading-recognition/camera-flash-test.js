// Standalone diagnostic: never imports recognition or production camera code.
export function createFlashTest(elements, environment = globalThis) {
  const { start, plain, capture, torch, pause, autoFlash, autoStatus, status, capabilities, video, result, resultMode, photo, log, copyLog, copyStatus } = elements;
  let session = 0, stream = null, imageCapture = null, busy = false, photoURL = null;
  let supportsTorch = false, torchState = false, previewPaused = false;
  let autoEnabled = autoFlash.checked, lowLight = false, darkSamples = 0, autoOwnsTorch = false;
  let sampleTimer = null, lastFrame = null, sampleCanvas = null;
  const brightnessThreshold = 50, sampleInterval = 500;
  const pending = new Set();
  const stale = request => request !== session || environment.document.hidden;
  const aborted = () => Object.assign(new Error('Camera test cancelled.'), { name: 'AbortError' });
  const message = error => `${error?.name || 'Error'}: ${error?.message || 'Camera operation failed.'}`;
  const clock = () => environment.performance.now();
  const started = clock(), entries = [];
  const header = ['Camera flash test — log v4', `Started: ${new Date().toISOString()}`,
    `Browser: ${environment.navigator?.userAgent || 'unknown'}`,
    `Secure context: ${environment.isSecureContext !== false}`, 'No photos or camera identifiers are included.'].join('\n');
  function record(event, details = {}) {
    entries.push(`+${Math.round(clock() - started)}ms ${event} ${JSON.stringify(details)}`);
    if (entries.length > 200) entries.shift();
    log.value = `${header}\n\n${entries.join('\n')}`;
  }
  function settings(owner = track()) {
    try {
      const source = owner?.getSettings?.() || {};
      return Object.fromEntries(['width', 'height', 'frameRate', 'facingMode', 'torch', 'zoom']
        .filter(key => source[key] !== undefined).map(key => [key, source[key]]));
    } catch { return {}; }
  }
  function preview() {
    return { paused: video.paused, readyState: video.readyState, width: video.videoWidth, height: video.videoHeight,
      trackState: track()?.readyState, muted: track()?.muted, settings: settings() };
  }
  async function copyDiagnosticLog() {
    const text = log.value;
    try {
      if (!environment.navigator?.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await environment.navigator.clipboard.writeText(text);
      copyStatus.textContent = 'Log copied. Paste it into the chat.';
    } catch {
      log.focus(); log.select(); log.setSelectionRange?.(0, log.value.length);
      copyStatus.textContent = 'Log selected. Tap and hold the text, choose Copy, then paste it into the chat.';
    }
  }

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
    autoFlash.checked = autoEnabled; autoFlash.disabled = busy;
    plain.textContent = autoEnabled ? 'Auto photo' : 'Take photo';
    scheduleSampling();
  }
  function cancelSampling() {
    if (sampleTimer !== null) environment.clearTimeout(sampleTimer);
    sampleTimer = null;
  }
  function scheduleSampling() {
    if (!autoEnabled || !live() || busy || previewPaused || video.paused || environment.document.hidden) {
      cancelSampling(); darkSamples = 0; return;
    }
    if (sampleTimer !== null) return;
    const request = session;
    sampleTimer = environment.setTimeout(() => { sampleTimer = null; void sampleBrightness(request); }, sampleInterval);
  }
  function disableAuto(reason) {
    autoEnabled = false; autoOwnsTorch = false; cancelSampling(); darkSamples = 0;
    autoStatus.textContent = reason;
    record('auto.disabled', { reason });
  }
  async function autoFailure(error, request) {
    const releaseTorch = autoOwnsTorch;
    disableAuto(`Auto flash disabled. ${message(error)} Manual controls remain available.`);
    busy = true; sync();
    record('auto.error', { error: message(error) });
    if (releaseTorch && live() && torchState !== false) {
      try { await applyTorch(false, request); }
      catch (cleanupError) {
        if (!stale(request)) {
          record('auto.cleanup.error', { error: message(cleanupError) });
          autoStatus.textContent += ` Could not turn torch off. ${message(cleanupError)}`;
        }
      }
    }
  }
  async function sampleBrightness(request) {
    if (stale(request) || !autoEnabled || busy || previewPaused || video.paused || !live()) { sync(); return; }
    try {
      const width = video.videoWidth, height = video.videoHeight, frame = video.currentTime;
      if (video.readyState < 2 || !width || !height || !Number.isFinite(frame) || frame === lastFrame) {
        darkSamples = 0; return;
      }
      lastFrame = frame;
      sampleCanvas ||= environment.document.createElement('canvas');
      sampleCanvas.width = sampleCanvas.height = 32;
      const context = sampleCanvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Preview brightness sampling is unavailable.');
      context.drawImage(video, width / 4, height / 4, width / 2, height / 2, 0, 0, 32, 32);
      const pixels = context.getImageData(0, 0, 32, 32).data;
      let sum = 0;
      for (let i = 0; i < pixels.length; i += 4) sum += .2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2];
      const brightness = sum / (pixels.length / 4);
      if (!Number.isFinite(brightness)) throw new Error('Preview brightness sampling returned no pixels.');
      darkSamples = brightness < brightnessThreshold ? darkSamples + 1 : 0;
      record('auto.brightness', { brightness: Math.round(brightness * 10) / 10, threshold: brightnessThreshold, darkSamples, lowLight });
      autoStatus.textContent = lowLight ? `Low light latched. Auto photo requests flash${autoOwnsTorch ? '; torch on' : ''}.`
        : `Brightness ${Math.round(brightness)}/255. Flash selected after 3 readings below ${brightnessThreshold}.`;
      if (!lowLight && darkSamples >= 3) {
        lowLight = true;
        record('auto.decision', { mode: 'flash', brightness, threshold: brightnessThreshold, supportsTorch });
        if (supportsTorch && torchState !== true) {
          busy = true; sync(); await applyTorch(true, request);
          if (stale(request)) return;
          autoOwnsTorch = true;
        }
        autoStatus.textContent = `Low light latched. Auto photo requests flash${autoOwnsTorch ? '; torch on' : '; torch unavailable'}. Restart camera to measure again.`;
      }
    } catch (error) { if (!stale(request)) await autoFailure(error, request); }
    finally { if (!stale(request)) { busy = false; sync(); } }
  }
  async function toggleAutoFlash() {
    if (busy || environment.document.hidden) { sync(); return; }
    const request = session, turnOffTorch = !autoFlash.checked && autoOwnsTorch;
    autoEnabled = autoFlash.checked; cancelSampling(); darkSamples = 0; lastFrame = null;
    record('auto.changed', { enabled: autoEnabled, lowLight });
    autoStatus.textContent = autoEnabled ? lowLight ? 'Low light remains latched for this camera session.' : 'Auto flash on. Waiting for fresh preview frames.' : 'Auto flash off.';
    // The flash decision survives toggles; only a new camera session resets it.
    busy = true; sync();
    try {
      if (turnOffTorch && live() && torchState !== false) await applyTorch(false, request);
      else if (autoEnabled && lowLight && live() && supportsTorch && torchState !== true) {
        await applyTorch(true, request); if (!stale(request)) autoOwnsTorch = true;
      }
      if (!autoEnabled) autoOwnsTorch = false;
    } catch (error) { if (!stale(request)) await autoFailure(error, request); }
    finally { if (!stale(request)) { busy = false; sync(); } }
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
    cancelSampling();
    if (sampleCanvas) { sampleCanvas.width = sampleCanvas.height = 0; sampleCanvas = null; }
    lastFrame = null;
    if (stream) record('camera.release', preview());
    imageCapture = null; supportsTorch = false; torchState = false;
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    video.pause(); video.srcObject = null; video.hidden = true;
  }
  function clearPhoto() {
    if (photoURL) environment.URL.revokeObjectURL(photoURL);
    photoURL = null; photo.removeAttribute('src'); result.hidden = true; resultMode.textContent = '';
  }
  function stop() {
    record('test.stop', { hidden: environment.document.hidden });
    session++; [...pending].forEach(cancel => cancel());
    cancelSampling(); lowLight = false; darkSamples = 0; lastFrame = null; autoOwnsTorch = false;
    autoStatus.textContent = autoEnabled ? 'Auto flash on. Waiting for camera.' : 'Auto flash off.';
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
    record('camera.open', { session: request, settings: settings() });
    const owner = track();
    for (const event of ['mute', 'unmute', 'ended']) owner?.addEventListener?.(event, () => {
      if (!stale(request) && owner === track()) record(`track.${event}`, preview());
    });
    await bounded(video.play(), 5000, 'Starting preview');
    if (stale(request)) throw aborted();
    record('preview.started', preview());
  }
  async function checkCapabilities(request) {
    imageCapture = null; supportsTorch = false;
    try { supportsTorch = Boolean(track()?.getCapabilities?.().torch); } catch { /* No torch capability exposed. */ }
    torchState = track()?.getSettings?.().torch === true;
    const report = text => {
      capabilities.textContent = `${text} Torch: ${supportsTorch ? 'available' : 'not advertised'}.`;
      record('capabilities.report', { imageCapture: Boolean(imageCapture), supportsTorch, text: capabilities.textContent });
    };
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
      record('photo.capabilities', { fillLightMode: modes, imageWidth: available?.imageWidth, imageHeight: available?.imageHeight, redEyeReduction: available?.redEyeReduction });
      report(modes.includes('flash') ? `Still-photo flash advertised (${modes.join(', ')}).`
        : `Still-photo flash is not advertised. Available modes: ${modes.join(', ') || 'none'}. Try flash will still attempt the request.`);
    } catch (error) {
      if (!stale(request)) record('photo.capabilities.error', { error: message(error) });
      if (!stale(request)) report(`Could not check still-photo flash. ${message(error)}`);
    }
  }
  async function applyTorch(on, request) {
    const owner = track();
    record('torch.request', { on, settings: settings(owner), previewPaused });
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
      record('torch.applied', { on: torchState, settings: settings(owner) });
    } catch (error) {
      if (!stale(request)) {
        record('torch.error', { requested: on, error: message(error), settings: settings(owner) });
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
    if (autoEnabled) disableAuto('Auto flash disabled by manual torch control.');
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
      video.pause(); previewPaused = true; record('preview.paused', preview()); status.textContent = 'Preview paused. Camera and torch controls remain active.'; sync(); return;
    }
    const request = session, wantedTorch = torchState === true; busy = true; sync();
    try {
      await restorePreview(request);
      if (wantedTorch && torchState !== true) await applyTorch(true, request);
      if (!stale(request)) { previewPaused = false; record('preview.resumed', preview()); status.textContent = 'Live feed resumed.'; }
    } catch (error) {
      if (!stale(request) && autoEnabled && autoOwnsTorch) await autoFailure(error, request);
      if (!stale(request)) { video.pause(); record('preview.resume.error', { error: message(error) }); status.textContent = `Could not fully resume. ${message(error)} Tap Start camera to retry.`; }
    } finally { if (!stale(request)) { busy = false; sync(); } }
  }
  async function startCamera() {
    if (busy || environment.document.hidden) return;
    stop(); const request = session; busy = true; sync(); status.textContent = 'Starting camera…';
    record('camera.start.request', { session: request });
    try {
      if (environment.isSecureContext === false) throw new Error('Open this test over HTTPS to use the camera.');
      if (!environment.navigator?.mediaDevices?.getUserMedia) throw new Error('Camera access is unavailable in this browser.');
      await openStream(request); await checkCapabilities(request);
      if (!stale(request)) status.textContent = imageCapture ? `Live feed ready. Try ${autoEnabled ? 'Auto photo' : 'Take photo'} or Try flash.` : 'Live feed ready. Still-photo capture is unavailable.';
    } catch (error) {
      if (!stale(request)) { record('camera.start.error', { error: message(error) }); releaseStream(); status.textContent = message(error); }
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
        if (await previewAdvances(request)) { record('preview.recovered', preview()); return; }
      } catch (error) { if (stale(request)) throw error; }
    }
    if (stale(request)) throw aborted();
    record('preview.restart', preview());
    status.textContent = 'Restarting live feed…'; releaseStream();
    await openStream(request); await checkCapabilities(request);
    if (!(await previewAdvances(request))) throw new Error('Live feed did not resume. Tap Start camera to retry.');
    record('preview.reopened', preview());
  }
  async function takePhoto(mode = 'auto') {
    if (busy || !live() || !imageCapture || environment.document.hidden) return;
    const automatic = mode === 'auto' && autoEnabled;
    if (mode === 'auto') mode = automatic && lowLight ? 'flash' : 'plain';
    const request = session, wantedTorch = torchState === true, wantedPause = previewPaused, wantedAutoTorch = autoOwnsTorch;
    const label = mode === 'flash' ? 'Flash requested: takePhoto({ fillLightMode: "flash" })' : 'Default photo: takePhoto()';
    const attempted = clock();
    record('photo.attempt', { mode, automatic, lowLight, wantedTorch, wantedPause, preview: preview() });
    busy = true; clearPhoto(); sync(); status.textContent = mode === 'flash' ? 'Trying still-photo flash…' : 'Taking default still photo…';
    let captureError = null, issued = false, recoveryError = null, torchError = null;
    try {
      if (torchState !== false || track()?.getSettings?.().torch === true) await applyTorch(false, request);
      if (stale(request)) return;
      issued = true;
      record('photo.request', { mode, settings: mode === 'flash' ? { fillLightMode: 'flash' } : {}, preview: preview() });
      const operation = mode === 'flash' ? imageCapture.takePhoto({ fillLightMode: 'flash' }) : imageCapture.takePhoto();
      const blob = await bounded(operation, 10000, 'Still-photo capture');
      if (stale(request)) return;
      if (!blob?.size) throw new Error('Camera returned an empty photo.');
      record('photo.returned', { mode, milliseconds: Math.round(clock() - attempted), bytes: blob.size, type: blob.type });
      photoURL = environment.URL.createObjectURL(blob); photo.src = photoURL;
      await bounded(photo.decode(), 5000, 'Loading photo');
      if (stale(request)) return;
      record('photo.displayed', { mode, width: photo.naturalWidth, height: photo.naturalHeight });
      resultMode.textContent = label;
      photo.alt = mode === 'flash' ? 'Returned still photo with flash requested' : 'Returned default still photo'; result.hidden = false;
    } catch (error) {
      if (stale(request)) return;
      captureError = error;
      if (autoEnabled && !issued) await autoFailure(error, request);
      record('photo.error', { mode, error: message(error), milliseconds: Math.round(clock() - attempted) });
      // Abandon the owner of a hung operation before allowing another attempt.
      if (error?.name === 'TimeoutError') releaseStream();
    }
    if (stale(request)) return;
    try {
      if (issued) { status.textContent = 'Restoring preview…'; await restorePreview(request); }
    } catch (error) {
      if (stale(request)) return;
      recoveryError = error; releaseStream();
      record('preview.recovery.error', { error: message(error) });
    }
    try {
      if (!stale(request) && live() && wantedTorch && (!wantedAutoTorch || autoEnabled) && torchState !== true) await applyTorch(true, request);
    } catch (error) { if (stale(request)) return; torchError = error; if (autoEnabled) await autoFailure(error, request); }
    if (stale(request)) return;
    previewPaused = wantedPause;
    if (wantedPause && live()) video.pause();
    status.textContent = [label + '.', captureError ? `Photo failed. ${message(captureError)}` : 'Photo returned. Check whether a flash actually fired.',
      recoveryError ? `Preview recovery failed. ${message(recoveryError)}` : !live() ? 'Camera stopped. Tap Start camera to retry.' : wantedPause ? 'Preview paused.' : 'Live feed active.',
      torchError ? `Torch restoration failed. ${message(torchError)}` : ''].filter(Boolean).join(' ');
    busy = false; sync();
    record('photo.complete', { mode, status: status.textContent, preview: preview(), torchState, previewPaused });
  }
  function initialize() {
    record('test.ready', { imageCaptureAPI: typeof environment.ImageCapture === 'function', autoFlash: autoEnabled, threshold: brightnessThreshold, sampleInterval });
    autoStatus.textContent = autoEnabled ? 'Auto flash on. Waiting for camera.' : 'Auto flash off.';
    copyLog.addEventListener('click', () => void copyDiagnosticLog());
    start.addEventListener('click', () => void startCamera());
    plain.addEventListener('click', () => void takePhoto());
    capture.addEventListener('click', () => void takePhoto('flash'));
    torch.addEventListener('click', () => void toggleTorch());
    pause.addEventListener('click', () => void togglePause());
    autoFlash.addEventListener('change', () => void toggleAutoFlash());
    environment.document.addEventListener('visibilitychange', () => { if (environment.document.hidden) stop(); });
    environment.addEventListener('pagehide', stop); sync();
  }
  return { initialize, startCamera, takePhoto, toggleTorch, togglePause, toggleAutoFlash, stop, copyDiagnosticLog };
}
