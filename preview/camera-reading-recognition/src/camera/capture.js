// The same centred cover/crop geometry is used by the live view and the photograph.
export function visibleFrame(width, height, viewWidth, viewHeight, zoom = 1) {
  const scale = Math.max(viewWidth / width, viewHeight / height) * zoom;
  const w = viewWidth / scale, h = viewHeight / scale;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}

export function createCaptureControls({ video, preview, feed, flash, zoomControl, zoomInput, zoomValue, status, capture, onError, onZoomSync = () => {} }, environment = globalThis) {
  const now = () => environment.performance.now();
  let owner = null, generation = 0, timer = null, frameCallback = null, watchdog = null, deadline = null;
  let first = null, changed = 0, samples = 0, geometry = '', ready = false, revealed = false, baselineLocked = false;
  let lastMetadata = {};
  let baseline = 1, nativeZoom = 1, nativeRange = null, desired = 1, digital = 1;
  let torch = false, desiredTorch = false, supportsTorch = false, pending = false, applying = false;
  let revision = 0, appliedRevision = 0, lastApply = -Infinity, controlTimer = null, startupResolve = null, waiters = [];
  let displayed = null, lastDraw = -Infinity, zoomGesturing = false;
  const settings = () => owner?.getSettings?.() || {};

  function captureStatus(text) { status.textContent = text; status.hidden = !text; }
  function currentFrame() {
    return displayed && displayed.geometry === geometry && displayed.revision === revision &&
      displayed.sourceWidth === video.videoWidth && displayed.sourceHeight === video.videoHeight;
  }
  function paint() {
    const time = now(), rect = feed.getBoundingClientRect();
    if (time - lastDraw < 1000 / 30 || !rect.width || !rect.height) return;
    const crop = visibleFrame(video.videoWidth, video.videoHeight, rect.width, rect.height, digital);
    const scale = Math.min(environment.devicePixelRatio || 1, 1280 / Math.max(rect.width, rect.height));
    const width = Math.max(1, Math.round(rect.width * scale)), height = Math.max(1, Math.round(rect.height * scale));
    try {
      if (preview.width !== width || preview.height !== height) { preview.width = width; preview.height = height; }
      preview.getContext('2d').drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
      displayed = { crop, geometry, revision: pending ? -1 : appliedRevision,
        sourceWidth: video.videoWidth, sourceHeight: video.videoHeight };
      lastDraw = time;
    } catch {
      stop(); onError({ name: 'NotReadableError' });
    }
  }

  function sync() {
    digital = Math.max(1, desired / nativeZoom);
    zoomInput.value = String(desired); zoomValue.textContent = `${desired.toFixed(1)}×`;
    zoomInput.setAttribute('aria-valuetext', `${desired.toFixed(1)} times zoom`);
    zoomInput.disabled = !ready; capture.disabled = !ready || pending || zoomGesturing || !currentFrame();
    onZoomSync();
    flash.disabled = !ready || pending;
    flash.setAttribute('aria-pressed', String(torch));
    flash.setAttribute('aria-label', torch ? 'Turn flash off' : 'Turn flash on');
  }
  function resolveStartup() { startupResolve?.(); startupResolve = null; }
  function lockBaseline() {
    if (baselineLocked) return;
    baselineLocked = true;
    const range = owner?.getCapabilities?.().zoom, value = settings().zoom;
    if (range && Number.isFinite(value) && value > 0 && Number.isFinite(range.min) && Number.isFinite(range.max) &&
      range.min > 0 && range.max > range.min && value >= range.min && value <= range.max) {
      baseline = value; nativeRange = range;
    }
  }
  function signature(metadata = {}) {
    const rect = feed.getBoundingClientRect(), s = settings();
    return JSON.stringify([video.videoWidth, video.videoHeight, metadata.width || video.videoWidth,
      metadata.height || video.videoHeight, rect.width, rect.height, s.width, s.height, s.aspectRatio,
      baselineLocked ? null : s.zoom]);
  }
  function sample(metadata) {
    if (!owner) return;
    lastMetadata = metadata || {};
    if (video.videoWidth && video.videoHeight && (video.readyState === undefined || video.readyState >= 2)) {
      const time = now(), key = signature(metadata);
      let update = false;
      if (first === null) {
        first = time; environment.clearTimeout(watchdog); watchdog = null;
        const request = generation, track = owner;
        deadline = environment.setTimeout(() => {
          if (owner === track && generation === request && !revealed) {
            revealed = true; preview.classList.remove('camera-starting');
            captureStatus('Camera framing is still settling.'); resolveStartup();
          }
        }, 1500);
      }
      if (key !== geometry) { geometry = key; changed = time; samples = 0; ready = false; update = true; }
      samples++;
      if (time - first >= (baselineLocked ? 0 : 500) && time - changed >= 250 && samples >= 3) {
        if (!ready) {
          lockBaseline(); geometry = signature(metadata); ready = true; revealed = true; update = true;
          preview.classList.remove('camera-starting'); zoomControl.hidden = false;
          captureStatus(''); resolveStartup();
        }
      } else if (!revealed && time - first >= 1500) {
        revealed = true; preview.classList.remove('camera-starting');
        captureStatus('Camera framing is still settling.'); resolveStartup();
      } else if (revealed && !ready && update) captureStatus('Camera framing is still settling.');
      const wasCurrent = Boolean(currentFrame());
      paint();
      if (!owner) return;
      if (update || wasCurrent !== Boolean(currentFrame())) sync();
    }
    const request = generation, track = owner;
    if (video.requestVideoFrameCallback) frameCallback = video.requestVideoFrameCallback((time, meta) => {
      if (generation === request && owner === track) sample(meta);
    });
    else timer = environment.setTimeout(() => { if (generation === request && owner === track) sample(); }, 1000 / 30);
  }
  function stop() {
    generation++; owner = null;
    environment.clearTimeout(timer); environment.clearTimeout(watchdog); environment.clearTimeout(controlTimer); environment.clearTimeout(deadline);
    if (frameCallback !== null) video.cancelVideoFrameCallback?.(frameCallback);
    timer = frameCallback = watchdog = controlTimer = deadline = null;
    resolveStartup(); waiters.splice(0).forEach(resolve => resolve());
    first = null; changed = samples = 0; geometry = ''; lastMetadata = {}; ready = revealed = baselineLocked = false;
    baseline = nativeZoom = desired = digital = 1; nativeRange = null;
    torch = desiredTorch = supportsTorch = pending = applying = false; revision = appliedRevision = 0; lastApply = -Infinity;
    displayed = null; lastDraw = -Infinity; zoomGesturing = false; preview.width = preview.height = 0;
    zoomControl.hidden = true; flash.hidden = true; preview.classList.add('camera-starting'); sync();
  }
  async function start(track) {
    stop(); owner = track; captureStatus('Starting camera…'); supportsTorch = Boolean(track.getCapabilities?.().torch); flash.hidden = !supportsTorch; zoomControl.hidden = false;
    const request = generation;
    const startup = new Promise(resolve => startupResolve = resolve);
    watchdog = environment.setTimeout(() => {
      if (owner === track && generation === request && first === null) { stop(); onError({ name: 'NotReadableError' }); }
    }, 5000);
    sample(); return startup;
  }
  function constraints(zoom, light) {
    const { zoom: oldZoom, torch: oldTorch, advanced: oldAdvanced, ...existing } = owner.getConstraints?.() || {};
    const advanced = (oldAdvanced || []).map(item => {
      const { zoom: oldZoom, torch: oldTorch, ...rest } = item; return rest;
    }).filter(item => Object.keys(item).length);
    const control = { ...(zoom === null ? {} : { zoom }), ...(supportsTorch ? { torch: light } : {}) };
    return { ...existing, advanced: [...advanced, control] };
  }
  function schedule() {
    if (!owner || applying || controlTimer !== null) return;
    const request = generation, track = owner;
    controlTimer = environment.setTimeout(() => {
      if (generation !== request || owner !== track) return;
      controlTimer = null; void apply();
    }, Math.max(0, 100 - (now() - lastApply)));
  }
  async function apply() {
    if (!owner || applying) return;
    const track = owner, request = generation, version = revision, light = desiredTorch, requestedZoom = desired;
    // Round down to a supported step: residual software zoom supplies the rest.
    const step = nativeRange?.step || 0;
    const limit = nativeRange ? Math.min(nativeRange.max, baseline * requestedZoom) : null;
    const target = limit === null ? null : step > 0 ? Math.max(nativeRange.min, nativeRange.min + Math.floor((limit - nativeRange.min + 1e-8) / step) * step) : limit;
    applying = true; lastApply = now();
    try {
      if (target !== null || light !== torch) {
        try {
          await track.applyConstraints(constraints(target, light));
          if (owner !== track || generation !== request) return;
          if (target !== null) {
            const actual = settings().zoom;
            if (!Number.isFinite(actual) || actual < baseline || actual > baseline * requestedZoom + .01) throw new Error('Unverified zoom');
            nativeZoom = actual / baseline;
          }
          torch = light;
        } catch {
          if (owner !== track || generation !== request) return;
          // Undo uncertain native zoom before continuing with the software crop.
          if (target !== null) {
            try { await track.applyConstraints(constraints(baseline, light)); } catch { /* Keep live capture available. */ }
            if (owner !== track || generation !== request) return;
            const actual = settings().zoom;
            nativeZoom = Number.isFinite(actual) && actual >= baseline ? actual / baseline : 1;
            nativeRange = null;
            if (nativeZoom > desired) { baseline *= nativeZoom; nativeZoom = 1; }
          }
          const actualTorch = settings().torch;
          if (typeof actualTorch === 'boolean') torch = actualTorch;
          desiredTorch = torch;
          if (light !== torch) captureStatus('Flash couldn’t change. Try improving the lighting.');
        }
      }
    } finally {
      if (owner === track && generation === request) {
        appliedRevision = version; applying = false; pending = appliedRevision !== revision;
        sync(); if (pending) schedule(); else waiters.splice(0).forEach(resolve => resolve());
      }
    }
  }
  function setZoom(value) {
    if (!owner || !ready) return;
    const next = Math.round(Math.max(1, Math.min(8, Number(value) || 1)) * 10) / 10;
    if (next === desired) { sync(); return; }
    desired = next;
    revision++; pending = true; sync(); schedule();
  }
  function toggleFlash() {
    if (!owner || !ready || !supportsTorch) return Promise.resolve();
    desiredTorch = !desiredTorch; revision++; pending = true; sync(); schedule();
    return new Promise(resolve => waiters.push(resolve));
  }
  function frame() {
    return displayed ? { ...displayed.crop } : null;
  }
  function isReady() {
    if (ready && signature(lastMetadata) !== geometry) {
      ready = false; changed = now(); samples = 0; captureStatus('Camera framing is still settling.'); sync();
    }
    return ready && !pending && !zoomGesturing && Boolean(currentFrame());
  }
  return { start, stop, setZoom, toggleFlash, frame, isReady, setZoomGesture: value => { zoomGesturing = value; sync(); } };
}
