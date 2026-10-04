// The same centred cover/crop geometry is used by the live view and the photograph.
export function visibleFrame(width, height, viewWidth, viewHeight, zoom = 1) {
  const scale = Math.max(viewWidth / width, viewHeight / height) * zoom;
  const w = viewWidth / scale, h = viewHeight / scale;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}

export function createCaptureControls({ video, feed, flash, zoomControl, zoomInput, zoomValue, status, capture, onError }, environment = globalThis) {
  const now = () => environment.performance.now();
  let owner = null, generation = 0, timer = null, frameCallback = null, watchdog = null, deadline = null;
  let first = null, changed = 0, samples = 0, geometry = '', ready = false, revealed = false, baselineLocked = false;
  let lastMetadata = {};
  let baseline = 1, nativeZoom = 1, nativeRange = null, desired = 1, digital = 1;
  let torch = false, desiredTorch = false, supportsTorch = false, pending = false, applying = false;
  let revision = 0, appliedRevision = 0, lastApply = -Infinity, controlTimer = null, startupResolve = null, waiters = [];
  const settings = () => owner?.getSettings?.() || {};

  function sync() {
    digital = Math.max(1, desired / nativeZoom);
    video.style.transform = `scale(${digital})`;
    zoomInput.value = String(desired); zoomValue.textContent = `${desired.toFixed(1)}×`;
    zoomInput.setAttribute('aria-valuetext', `${desired.toFixed(1)} times zoom`);
    zoomInput.disabled = !ready; capture.disabled = !ready || pending;
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
            revealed = true; video.classList.remove('camera-starting');
            status.textContent = 'Camera framing is still settling.'; resolveStartup();
          }
        }, 1500);
      }
      if (key !== geometry) { geometry = key; changed = time; samples = 0; ready = false; update = true; }
      samples++;
      if (time - first >= (baselineLocked ? 0 : 500) && time - changed >= 250 && samples >= 3) {
        if (!ready) {
          lockBaseline(); geometry = signature(metadata); ready = true; revealed = true; update = true;
          video.classList.remove('camera-starting'); zoomControl.hidden = false;
          status.textContent = 'Keep the digits sharp and avoid reflections.'; resolveStartup();
        }
      } else if (!revealed && time - first >= 1500) {
        revealed = true; video.classList.remove('camera-starting');
        status.textContent = 'Camera framing is still settling.'; resolveStartup();
      } else if (revealed && !ready && update) status.textContent = 'Camera framing is still settling.';
      if (update) sync();
    }
    const request = generation, track = owner;
    if (video.requestVideoFrameCallback) frameCallback = video.requestVideoFrameCallback((time, meta) => {
      if (generation === request && owner === track) sample(meta);
    });
    else timer = environment.setTimeout(() => { if (generation === request && owner === track) sample(); }, 50);
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
    zoomControl.hidden = true; flash.hidden = true; video.classList.add('camera-starting'); sync();
  }
  async function start(track) {
    stop(); owner = track; supportsTorch = Boolean(track.getCapabilities?.().torch); flash.hidden = !supportsTorch; zoomControl.hidden = false;
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
    const target = nativeRange ? Math.min(nativeRange.max, baseline * requestedZoom) : null;
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
          if (light !== torch) status.textContent = 'Flash couldn’t change. Try improving the lighting.';
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
    desired = Math.round(Math.max(1, Math.min(3, Number(value) || 1)) * 10) / 10;
    revision++; pending = true; sync(); schedule();
  }
  function toggleFlash() {
    if (!owner || !ready || !supportsTorch) return Promise.resolve();
    desiredTorch = !desiredTorch; revision++; pending = true; sync(); schedule();
    return new Promise(resolve => waiters.push(resolve));
  }
  function frame() {
    const rect = feed.getBoundingClientRect();
    return visibleFrame(video.videoWidth, video.videoHeight, rect.width, rect.height, digital);
  }
  function isReady() {
    if (ready && signature(lastMetadata) !== geometry) { ready = false; changed = now(); samples = 0; sync(); }
    return ready && !pending;
  }
  return { start, stop, setZoom, toggleFlash, frame, isReady };
}
