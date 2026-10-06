// Session-scoped camera selection and lighting. Device IDs never leave the browser.
export function createDeviceSession({ video, controls, onStream, preferences, settingsOpen = () => false }, environment = globalThis) {
  let generation = 0, stream = null, main = '', telephoto = '', selected = '', zoom = 1;
  let switching = false, sampling = null, manual = false, lowLight = false, autoFailed = false;
  let autoTorch = false, wantedTorch = false, dark = 0, lastFrame = -1, warned = false;
  const valid = request => request === generation;
  const automatic = () => preferences.autoFlash !== false && !manual && !autoFailed;
  async function bounded(operation, milliseconds = 5000) {
    let timer;
    try { return await Promise.race([operation, new Promise((_, reject) => {
      timer = environment.setTimeout(() => reject(new Error('Camera operation timed out')), milliseconds);
    })]); } finally { environment.clearTimeout(timer); }
  }
  function stop() {
    generation++; environment.clearTimeout(sampling); sampling = null;
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    switching = false; controls.stop();
  }
  async function acquire(id, request) {
    let expired = false, timer;
    const operation = environment.navigator.mediaDevices.getUserMedia({ audio: false, video: {
      ...(id ? { deviceId: { exact: id } } : { facingMode: { ideal: 'environment' } }),
      width: { ideal: 1920 }, height: { ideal: 1080 },
    } }).then(result => {
      if (expired || !valid(request)) { result.getTracks().forEach(track => track.stop()); throw new Error('Camera request cancelled'); }
      return result;
    });
    try {
      const result = await Promise.race([operation, new Promise((_, reject) => {
        timer = environment.setTimeout(() => { expired = true; reject(new Error('Opening camera timed out')); }, 10000);
      })]);
      const track = result.getVideoTracks()[0];
      if (id && track.getSettings?.().deviceId !== id) { result.getTracks().forEach(t => t.stop()); throw new Error('Selected camera was not applied'); }
      return result;
    } finally { environment.clearTimeout(timer); }
  }
  async function open(id, request, base) {
    const result = await acquire(id, request);
    if (!valid(request)) { result.getTracks().forEach(t => t.stop()); return; }
    stream = result; selected = id || result.getVideoTracks()[0].getSettings?.().deviceId || '';
    onStream(result); video.srcObject = result;
    await bounded(video.play());
    if (!valid(request)) { result.getTracks().forEach(t => t.stop()); return; }
    await controls.start(result.getVideoTracks()[0], { base, zoom });
    if (!valid(request)) return;
    if (result.getVideoTracks()[0].readyState === 'ended') throw new Error('Camera ended while opening');
    if (zoom > base) { controls.setZoom(zoom, true); await bounded(controls.waitIdle()); }
    if (wantedTorch && controls.snapshot().supportsTorch) await bounded(controls.setTorch(true));
  }
  async function start() {
    stop(); const request = generation;
    main = telephoto = selected = ''; zoom = 1; manual = lowLight = autoFailed = autoTorch = wantedTorch = warned = false;
    dark = 0; lastFrame = -1;
    await open('', request, 1);
    if (!valid(request)) return;
    main = selected;
    try {
      const devices = await environment.navigator.mediaDevices.enumerateDevices?.() || [];
      if (valid(request)) telephoto = devices.find(device => device.kind === 'videoinput' && /\btelephoto\b/i.test(device.label) && device.deviceId !== main)?.deviceId || '';
    } catch { /* Keep the starting rear camera when enumeration is unavailable. */ }
    if (valid(request)) scheduleSample(request);
  }
  async function changeZoom(value) {
    zoom = Math.round(Math.max(1, Math.min(8, Number(value) || 1)) * 10) / 10;
    if (switching || !stream) return;
    const request = generation;
    switching = true;
    controls.setSwitching(true);
    try {
      await bounded(controls.waitIdle());
      while (valid(request) && stream) {
        const desired = zoom, target = desired >= 3 && telephoto && main ? telephoto : main;
        if (target && target !== selected) {
          const previous = selected, previousBase = previous === telephoto ? 3 : 1;
          controls.notify('Switching zoom…');
          stream.getTracks().forEach(track => track.stop()); stream = null;
          try { await open(target, request, target === telephoto ? 3 : 1); }
          catch (error) {
            if (!valid(request)) return;
            stream?.getTracks().forEach(track => track.stop()); stream = null;
            telephoto = ''; // Avoid repeatedly attempting a camera that failed.
            await open(previous, request, previousBase);
            controls.notify('Camera switch failed. Using the previous camera.', 3500);
          }
        } else { controls.setZoom(desired, true); await bounded(controls.waitIdle()); }
        if (!valid(request)) return;
        if (desired >= 3 && !telephoto && !warned) { warned = true; controls.notify('Telephoto unavailable. Using the current camera.', 3500); }
        if (desired === zoom) break;
      }
    } catch {
      if (valid(request)) {
        controls.setSwitching(false, { failed: true });
        if (!stream || stream.getVideoTracks()[0].readyState === 'ended') controls.stop();
        controls.notify('Camera could not change. Try again.');
      }
    } finally { if (valid(request)) { switching = false; controls.setSwitching(false); } }
  }
  function scheduleSample(request) {
    sampling = environment.setTimeout(async () => {
      sampling = null;
      if (!valid(request) || !stream) return;
      try {
        if (!automatic() && autoTorch && !switching && controls.settled()) {
          await bounded(controls.setTorch(false)); autoTorch = wantedTorch = false; lowLight = false; dark = 0;
        }
        if (automatic() && !lowLight && !switching && controls.settled() && !settingsOpen() && !environment.document.hidden && !video.paused && video.currentTime !== lastFrame && video.videoWidth) {
          lastFrame = video.currentTime;
          const canvas = environment.document.createElement('canvas'); canvas.width = canvas.height = 32;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context.drawImage(video, video.videoWidth / 4, video.videoHeight / 4, video.videoWidth / 2, video.videoHeight / 2, 0, 0, 32, 32);
          const pixels = context.getImageData(0, 0, 32, 32).data;
          let brightness = 0;
          for (let i = 0; i < pixels.length; i += 4) brightness += .299 * pixels[i] + .587 * pixels[i + 1] + .114 * pixels[i + 2];
          canvas.width = canvas.height = 0;
          dark = brightness / 1024 < 50 ? dark + 1 : 0;
          if (dark >= 3) {
            lowLight = true;
            if (controls.snapshot().supportsTorch) { await bounded(controls.setTorch(true)); if (valid(request)) autoTorch = wantedTorch = true; }
          }
        }
      } catch {
        if (valid(request)) { autoFailed = true; controls.notify('Auto flash unavailable. Use the flash button or improve lighting.'); }
      } finally { if (valid(request) && stream) scheduleSample(request); }
    }, 500);
  }
  async function toggleFlash() {
    if (switching) return;
    manual = true; autoTorch = false; lowLight = false;
    await controls.toggleFlash(); wantedTorch = controls.snapshot().flash;
  }
  return { start, stop, setZoom: value => void changeZoom(value), toggleFlash,
    busy: () => switching,
    captureMode: () => automatic() ? (lowLight ? 'flash' : 'default') : (!autoTorch && controls.snapshot().flash ? 'flash' : 'off') };
}
