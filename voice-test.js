const BUILD = "v0.5.4.8-staged-mic-test";
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const requestedMode = new URLSearchParams(location.search).get("mode");
const staged = requestedMode === "track-pause" && new URLSearchParams(location.search).get("staged") === "1";
const mode = ["fresh", "interrupt", "prime", "hold", "hold-persist", "track-pause"].includes(requestedMode) ? requestedMode : "reuse";
const ui = Object.fromEntries(["build", "status", "start", "stop", "abort", "release-microphone", "mark-interruption", "interruption-guide", "reset-microphone", "reset-guide", "hold-guide", "hold-waveform", "copy", "clear", "log"].map(id => [id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), document.getElementById(id)]));
const holdWaveBars = [1, 2, 3, 4, 5].map(number => document.getElementById(`hold-wave-${number}`));
ui.openMicrophone = document.getElementById("open-microphone");
let startedAt = performance.now();
let attempt = 0;
let objectCount = 0;
let active = null;
let shared = null;
let heldMicrophone = null;
let requiresReload = false;
let resettingMicrophone = false;
const entries = [];

function log(event, detail = {}, run = active) {
  const fields = Object.entries(detail).map(([key, value]) => `${key}=${value}`).join(" ");
  entries.push(`${((performance.now() - startedAt) / 1000).toFixed(3)}s [attempt ${run?.id || "-"}] ${event} ${fields}`.trim());
  ui.log.value = entries.join("\n");
  ui.log.scrollTop = ui.log.scrollHeight;
}

function browserDetails() {
  const userAgent = navigator.userAgent || "";
  const browsers = [
    ["Chrome_iOS", /CriOS\/([\d.]+)/i],
    ["Firefox_iOS", /FxiOS\/([\d.]+)/i],
    ["Edge_iOS", /EdgiOS\/([\d.]+)/i],
    ["Opera_iOS", /OPiOS\/([\d.]+)/i],
    ["Edge", /Edg\/([\d.]+)/i],
    ["Chrome", /Chrome\/([\d.]+)/i],
    ["Firefox", /Firefox\/([\d.]+)/i],
    ["Safari", /Version\/([\d.]+).*Safari\//i],
  ];
  const browser = browsers.find(([, pattern]) => pattern.test(userAgent));
  const osVersion = userAgent.match(/(?:iPhone OS|CPU OS)\s([\d_]+)/i)?.[1]?.replace(/_/g, ".") || "unknown";
  const webkit = userAgent.match(/AppleWebKit\/([\d.]+)/i)?.[1] || "unknown";
  return {
    browser: browser?.[0] || "unknown",
    browserVersion: browser ? userAgent.match(browser[1])?.[1] : "unknown",
    osVersion,
    webkit,
    platform: navigator.platform || "unknown",
    touchPoints: navigator.maxTouchPoints || 0,
  };
}

function header() {
  log("diagnostics ready", {
    build: BUILD, assetRevision: new URL(import.meta.url).searchParams.get("v"),
    mode, recognition: Boolean(Recognition), secure: window.isSecureContext,
    language: document.documentElement.lang, meter: mode === "track-pause" ? "track-pause" : mode === "hold-persist" ? "held-persistent" : mode === "hold" ? "held" : "disabled", continuous: false,
    audioProbe: "levels-v1",
    staged,
  });
  log("browser details", browserDetails());
  log("user agent", { value: JSON.stringify(navigator.userAgent || "unavailable") });
}

function controls() {
  ui.start.disabled = !Recognition || Boolean(active) || requiresReload || resettingMicrophone;
  ui.openMicrophone.hidden = !staged;
  ui.openMicrophone.disabled = Boolean(active) || requiresReload || !navigator.mediaDevices?.getUserMedia;
  if (staged) {
    ui.start.textContent = "Start recognition";
    ui.start.disabled = !Recognition || !active?.stagedReady || active.stopping;
  }
  document.getElementById("staged-guide").hidden = !staged;
  ui.stop.disabled = !active || active.stopping;
  ui.abort.hidden = mode !== "track-pause";
  ui.abort.disabled = mode !== "track-pause" || !active || active.stopping;
  if (staged && active?.preparing) {
    ui.stop.disabled = true;
    ui.abort.disabled = true;
  }
  ui.releaseMicrophone.hidden = mode !== "track-pause";
  ui.releaseMicrophone.disabled = mode !== "track-pause" || Boolean(active) || !heldMicrophone;
  if (staged && active?.preparing) ui.releaseMicrophone.disabled = false;
  ui.markInterruption.hidden = mode !== "interrupt";
  ui.markInterruption.disabled = mode !== "interrupt" || !active || active.stopping;
  ui.markInterruption.textContent = active?.interruptionStartedAt == null ? "Mark before switching" : "Mark return";
  ui.interruptionGuide.hidden = mode !== "interrupt";
  ui.resetMicrophone.hidden = mode !== "prime";
  ui.resetMicrophone.disabled = mode !== "prime" || Boolean(active) || resettingMicrophone || !navigator.mediaDevices?.getUserMedia;
  ui.resetGuide.hidden = mode !== "prime";
  ui.holdGuide.hidden = !isHeldMode();
  ui.holdWaveform.hidden = !isHeldMode();
  document.querySelectorAll("nav a").forEach(link => link.setAttribute("aria-disabled", String(Boolean(active))));
}

function isHeldMode() {
  return mode === "hold" || mode === "hold-persist" || mode === "track-pause";
}

function resetHoldWaveform() {
  holdWaveBars.forEach(bar => {
    bar.style.height = "2px";
    bar.style.opacity = "0.72";
  });
}

// Independent of requestAnimationFrame: numeric levels only, never retained audio.
function startAudioProbe(microphone) {
  let sampleReads = 0;
  let previousReads = 0;
  let previousFrames = microphone.waveformFrames || 0;
  let rmsMax = 0;
  let peakMax = 0;
  let readError = "none";
  microphone.resetProbeWindow = () => {
    previousReads = sampleReads;
    previousFrames = microphone.waveformFrames || 0;
    rmsMax = peakMax = 0;
  };
  const samples = new Float32Array(256);
  const current = () => heldMicrophone === microphone && Boolean(microphone.stream);
  const read = () => {
    if (!current()) return;
    if (microphone.probeAnalyser) {
      try {
        microphone.probeAnalyser.getFloatTimeDomainData(samples);
        let sum = 0;
        let peak = 0;
        for (const value of samples) {
          sum += value * value;
          peak = Math.max(peak, Math.abs(value));
        }
        rmsMax = Math.max(rmsMax, Math.sqrt(sum / samples.length));
        peakMax = Math.max(peakMax, peak);
        sampleReads++;
        readError = "none";
      } catch (error) { readError = error.name || "unknown"; }
    }
    microphone.probeSampleTimer = setTimeout(read, 100);
  };
  const report = () => {
    if (!current()) return;
    const track = microphone.stream.getAudioTracks()[0];
    const frames = microphone.waveformFrames || 0;
    log("audio probe", {
      phase: active?.microphone === microphone ? (active.preparing ? "microphone-only" : "recognition") : "retained",
      enabled: track?.enabled ?? "unknown", muted: track?.muted ?? "unknown",
      readyState: track?.readyState || "none",
      context: microphone.audioContext?.state || "unavailable",
      sampleReads, readsSinceReport: sampleReads - previousReads,
      waveformFrames: frames, framesSinceReport: frames - previousFrames,
      rmsMax: sampleReads > previousReads ? rmsMax.toFixed(6) : "unavailable",
      peakMax: sampleReads > previousReads ? peakMax.toFixed(6) : "unavailable",
      readError,
    }, active?.microphone === microphone ? active : null);
    previousReads = sampleReads;
    previousFrames = frames;
    rmsMax = peakMax = 0;
    microphone.probeReportTimer = setTimeout(report, 1000);
  };
  read();
  microphone.probeReportTimer = setTimeout(report, 1000);
}

function releaseHeldMicrophone(run = null) {
  const microphone = run?.microphone || heldMicrophone;
  if (!microphone) return;
  clearTimeout(microphone.probeSampleTimer);
  clearTimeout(microphone.probeReportTimer);
  microphone.probeAnalyser = null;
  clearTimeout(microphone.idleTimer);
  microphone.idleTimer = null;
  if (microphone.meterFrame != null) cancelAnimationFrame(microphone.meterFrame);
  microphone.meterFrame = null;
  try { microphone.meterSource?.disconnect(); } catch { /* The source may already be disconnected. */ }
  microphone.meterSource = null;
  const tracks = microphone.stream?.getTracks() || [];
  tracks.forEach(track => {
    if (track.readyState !== "ended") track.stop();
  });
  if (microphone.stream) log("held microphone released", { tracks: tracks.length }, run);
  microphone.stream = null;
  if (microphone.audioContext && microphone.audioContext.state !== "closed") microphone.audioContext.close().catch(() => {});
  microphone.audioContext = null;
  if (heldMicrophone === microphone) heldMicrophone = null;
  if (run) run.microphone = null;
  resetHoldWaveform();
}

function pauseHeldMicrophone(run, reason) {
  const microphone = run?.microphone || heldMicrophone;
  if (!microphone?.stream) return;
  if (microphone.meterFrame != null) cancelAnimationFrame(microphone.meterFrame);
  microphone.meterFrame = null;
  resetHoldWaveform();
  const tracks = microphone.stream.getAudioTracks();
  tracks.forEach(track => { if (track.readyState === "live") track.enabled = false; });
  log("held microphone tracks disabled", {
    reason, tracks: tracks.length,
    guidance: "observe-iPhone-mic-indicator; disabled-does-not-prove-hardware-off-or-capture-stopped",
  }, run);
  clearTimeout(microphone.idleTimer);
  microphone.idleTimer = setTimeout(() => {
    if (heldMicrophone !== microphone || active) return;
    log("held microphone idle timeout", { seconds: 30 }, run);
    releaseHeldMicrophone();
    ui.status.textContent = "Paused microphone released after 30 seconds.";
    controls();
  }, 30000);
}

async function resumeHeldMicrophone(run, microphone) {
  clearTimeout(microphone.idleTimer);
  microphone.idleTimer = null;
  const tracks = microphone.stream.getAudioTracks();
  tracks.forEach(track => { if (track.readyState === "live") track.enabled = true; });
  if (microphone.audioContext?.state === "suspended") await microphone.audioContext.resume();
  if (active !== run || run.stopping || document.hidden) return false;
  log("held microphone tracks re-enabled", { tracks: tracks.length }, run);
  microphone.startMeter?.();
  return true;
}

async function startHeldMicrophone(run) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("MediaDevicesUnavailable");
  const existingTrack = heldMicrophone?.stream?.getAudioTracks()?.[0];
  if (existingTrack?.readyState === "live") {
    run.microphone = heldMicrophone;
    log("held microphone reused", {
      tracks: heldMicrophone.stream.getAudioTracks().length,
      state: existingTrack.readyState,
      context: heldMicrophone.audioContext?.state || "unavailable",
    }, run);
    if (mode === "track-pause") return resumeHeldMicrophone(run, heldMicrophone);
    if (heldMicrophone.audioContext?.state === "suspended") await heldMicrophone.audioContext.resume();
    return true;
  }
  if (heldMicrophone) releaseHeldMicrophone(run);
  log("held microphone requested", {}, run);
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  if (active !== run || run.stopping || document.hidden) {
    stream.getTracks().forEach(track => { if (track.readyState !== "ended") track.stop(); });
    log("held microphone preparation discarded", { reason: document.hidden ? "page hidden" : "run cancelled" }, run);
    return false;
  }
  const microphone = {
    stream,
    audioContext: null,
    meterSource: null,
    meterFrame: null,
    idleTimer: null,
    startMeter: null,
  };
  heldMicrophone = microphone;
  run.microphone = microphone;
  startAudioProbe(microphone);
  const tracks = microphone.stream.getAudioTracks();
  const track = tracks[0];
  log("held microphone opened", {
    tracks: tracks.length,
    state: track?.readyState || "none",
    enabled: track?.enabled ?? "unknown",
    muted: track?.muted ?? "unknown",
  }, run);
  track?.addEventListener?.("mute", () => log("held microphone track", { event: "mute", state: track.readyState }, run));
  track?.addEventListener?.("unmute", () => log("held microphone track", { event: "unmute", state: track.readyState }, run));
  track?.addEventListener?.("ended", () => log("held microphone track", { event: "ended", state: track.readyState }, run));

  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) {
    log("held meter unavailable", { reason: "AudioContext" }, run);
    return true;
  }
  microphone.audioContext = new AudioContextConstructor();
  if (microphone.audioContext.state === "suspended") await microphone.audioContext.resume();
  if (active !== run || run.stopping) return;
  const analyser = microphone.audioContext.createAnalyser();
  analyser.fftSize = 256;
  microphone.meterSource = microphone.audioContext.createMediaStreamSource(microphone.stream);
  microphone.meterSource.connect(analyser);
  microphone.probeAnalyser = microphone.audioContext.createAnalyser();
  microphone.probeAnalyser.fftSize = 256;
  microphone.meterSource.connect(microphone.probeAnalyser);
  const samples = new Uint8Array(analyser.fftSize);
  const maximumHeights = [8, 14, 22, 14, 8];
  let displayedLevel = 0;
  const draw = () => {
    if (heldMicrophone !== microphone || !microphone.stream) return;
    analyser.getByteTimeDomainData(samples);
    microphone.waveformFrames = (microphone.waveformFrames || 0) + 1;
    let mean = 0;
    for (const sample of samples) mean += sample;
    mean /= samples.length;
    let variance = 0;
    for (const sample of samples) variance += (sample - mean) ** 2;
    const measuredLevel = Math.min(1, Math.sqrt(variance / samples.length) / 24);
    displayedLevel += (measuredLevel - displayedLevel) * (measuredLevel > displayedLevel ? 0.55 : 0.14);
    holdWaveBars.forEach((bar, index) => {
      bar.style.height = `${Math.max(2, Math.round(2 + displayedLevel * (maximumHeights[index] - 2)))}px`;
      bar.style.opacity = `${0.72 + displayedLevel * 0.28}`;
    });
    microphone.meterFrame = requestAnimationFrame(draw);
  };
  microphone.startMeter = () => {
    if (microphone.meterFrame == null && heldMicrophone === microphone && microphone.stream) draw();
  };
  log("held meter started", { context: microphone.audioContext.state }, run);
  microphone.startMeter();
  return true;
}

function finish(run, timedOut = false) {
  if (active !== run) return;
  clearTimeout(run.stageLimit);
  if (run.interruptionStartedAt != null) log("audio interruption ended before return marker", {}, run);
  clearTimeout(run.limit);
  clearTimeout(run.cleanup);
  const retainMicrophone = !timedOut && ((mode === "hold-persist" && run.stopReason === "manual")
    || (mode === "track-pause" && (run.stopReason === "manual" || run.stopReason === "abort")));
  if (retainMicrophone) {
    if (mode === "track-pause") pauseHeldMicrophone(run, run.stopReason);
    log("held microphone retained", { reason: run.stopReason === "manual" ? "manual stop" : run.stopReason, nextAttempt: attempt + 1 }, run);
  }
  else releaseHeldMicrophone(run);
  active = null;
  // A missing end event makes safe attribution on a reused recognizer impossible.
  requiresReload = timedOut;
  ui.status.textContent = timedOut ? "Recognition did not finish. Reload to continue."
    : run.error ? `Recognition error: ${run.error}`
      : run.results ? "Recognition completed." : "No speech detected.";
  controls();
}

function createRecognizer() {
  const recognition = new Recognition();
  const objectId = ++objectCount;
  recognition.lang = "en-GB";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  for (const name of ["start", "audiostart", "soundstart", "speechstart", "speechend", "soundend", "audioend", "nomatch", "error", "result", "end"]) {
    recognition.addEventListener(name, event => {
      const run = active?.recognition === recognition ? active : null;
      const detail = { object: objectId, current: Boolean(run) };
      if (name === "error") detail.error = event.error || "unknown";
      if (name === "result") {
        detail.results = event.results.length;
        detail.final = event.results[event.results.length - 1]?.isFinal || false;
      }
      log(name, detail, run);
      if (!run) return;
      if (name === "audiostart" && !run.stopping) ui.status.textContent = "Listening";
      if (name === "result") {
        if (run.aborted) {
          log("result discarded", { reason: "aborted run" }, run);
          return;
        }
        run.results++;
        if (!run.stopping) ui.status.textContent = detail.final ? "Final result received" : "Speech received";
      }
      const expectedAbortError = name === "error" && run.stopping && event.error === "aborted";
      if (name === "error" && !expectedAbortError) run.error = event.error || "unknown";
      if (name === "error" && !expectedAbortError) {
        releaseHeldMicrophone(run);
        if (!run.cleanup) run.cleanup = setTimeout(() => {
          if (active === run) {
            log("end timeout", { after: "error" }, run);
            finish(run, true);
          }
        }, 3000);
      }
      if (name === "end") finish(run);
    });
  }
  log("recognizer created", { object: objectId });
  return { recognition, objectId };
}

function stop(reason = "manual") {
  const run = active;
  if (!run || run.stopping) return;
  run.stopping = true;
  run.stopReason = reason;
  log("stop requested", { reason });
  ui.status.textContent = "Stopping";
  controls();
  if (mode === "track-pause") pauseHeldMicrophone(run, reason);
  if (run.preparing) return;
  clearTimeout(run.limit);
  run.cleanup = setTimeout(() => {
    if (active !== run) return;
    log("end timeout");
    try { run.recognition.abort(); } catch { /* The browser may already have stopped. */ }
    if (active === run) finish(run, true);
  }, 3000);
  try { run.recognition.stop(); }
  catch (error) {
    log("stop threw", { name: error.name });
    try { run.recognition.abort(); } catch { /* Finish through the watchdog. */ }
  }
}

function abort() {
  const run = active;
  if (mode !== "track-pause" || !run || run.stopping) return;
  run.stopping = true;
  run.aborted = true;
  run.stopReason = "abort";
  log("abort requested");
  ui.status.textContent = "Aborting";
  pauseHeldMicrophone(run, "abort");
  controls();
  if (run.preparing) return;
  clearTimeout(run.limit);
  run.cleanup = setTimeout(() => {
    if (active !== run) return;
    log("end timeout");
    releaseHeldMicrophone(run);
    finish(run, true);
  }, 3000);
  try { run.recognition.abort(); }
  catch (error) { log("abort threw", { name: error.name }); }
}

function beginRecognition(run) {
  clearTimeout(run.stageLimit);
  run.microphone?.resetProbeWindow?.();
  run.stagedReady = false;
  run.preparing = false;
  log("start requested", { object: run.objectId, mode });
  run.limit = setTimeout(() => stop("30-second limit"), 30000);
  run.recognition.start();
  controls();
}

async function prepareAttempt() {
  if (active || requiresReload || !Recognition) return;
  try {
    const holder = mode === "reuse" ? (shared ||= createRecognizer()) : createRecognizer();
    const run = { id: ++attempt, ...holder, results: 0, error: null, stopping: false, aborted: false, stopReason: null, preparing: isHeldMode(), cleanup: null, interruptionStartedAt: null, startedAt: performance.now(), microphone: null };
    active = run;
    ui.status.textContent = "Starting microphone";
    controls();
    if (isHeldMode()) {
      try {
        const prepared = await startHeldMicrophone(run);
        if (!prepared) {
          if (active === run) {
            run.stopReason = null;
            finish(run);
          }
          return;
        }
      } catch (error) {
        if (run.stopping) {
          finish(run);
          return;
        }
        log("held microphone failed", { name: error?.name || error?.message || "unknown" }, run);
        run.error = error?.name || error?.message || "microphone unavailable";
        finish(run);
        return;
      }
      if (staged && active === run && !run.stopping) {
        run.stagedReady = true;
        log("microphone-only phase ready", {}, run);
        ui.status.textContent = "Microphone active — recognition not started. Speak for five seconds, then Start recognition.";
        run.stageLimit = setTimeout(() => {
          if (active !== run || !run.preparing) return;
          log("microphone-only timeout", { seconds: 30 }, run);
          run.stopReason = null;
          finish(run);
          ui.status.textContent = "Microphone released after 30 seconds without recognition.";
        }, 30000);
        controls();
        return;
      }
      run.preparing = false;
      if (active !== run || run.stopping) {
        if (active === run) finish(run);
        return;
      }
    }
    beginRecognition(run);
  } catch (error) {
    log("start threw", { name: error.name });
    if (active) { active.error = error.name; finish(active, true); }
    else ui.status.textContent = `Could not create recognizer: ${error.name}`;
  }
}
ui.openMicrophone.addEventListener("click", () => { if (staged) return prepareAttempt(); });
ui.start.addEventListener("click", () => {
  if (!staged) return prepareAttempt();
  if (!active?.stagedReady || active.stopping || !Recognition) return;
  const run = active;
  try { beginRecognition(run); }
  catch (error) {
    log("start threw", { name: error.name }, run);
    run.error = error.name;
    finish(run, true);
  }
});
ui.stop.addEventListener("click", () => stop());
ui.abort.addEventListener("click", abort);
ui.releaseMicrophone.addEventListener("click", () => {
  if (staged && active?.preparing) {
    const run = active;
    run.stopping = true;
    run.stopReason = null;
    log("explicit microphone release requested", { phase: "microphone-only" }, run);
    finish(run);
    ui.status.textContent = "Microphone released; recognition was not started.";
    return;
  }
  if (mode !== "track-pause" || active) return;
  log("explicit microphone release requested");
  releaseHeldMicrophone();
  ui.status.textContent = "Microphone released.";
  controls();
});
ui.resetMicrophone.addEventListener("click", async () => {
  if (mode !== "prime" || active || resettingMicrophone || !navigator.mediaDevices?.getUserMedia) return;
  resettingMicrophone = true;
  ui.status.textContent = "Resetting microphone";
  controls();
  log("microphone reset requested");
  let stream = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const tracks = stream.getAudioTracks();
    log("microphone reset opened", { tracks: tracks.length, state: tracks[0]?.readyState || "none" });
    await new Promise(resolve => setTimeout(resolve, 400));
    tracks.forEach(track => track.stop());
    log("microphone reset released", { tracks: tracks.length });
    ui.status.textContent = "Microphone reset complete. Try Start now.";
  } catch (error) {
    log("microphone reset failed", { name: error?.name || "unknown" });
    ui.status.textContent = "Microphone reset failed.";
  } finally {
    stream?.getTracks().forEach(track => {
      if (track.readyState !== "ended") track.stop();
    });
    resettingMicrophone = false;
    controls();
  }
});
ui.markInterruption.addEventListener("click", () => {
  const run = active;
  if (mode !== "interrupt" || !run || run.stopping) return;
  if (run.interruptionStartedAt == null) {
    run.interruptionStartedAt = performance.now();
    log("external audio interruption marker", { phase: "before" }, run);
    ui.status.textContent = "Switch apps, start and stop audio, then return and mark it.";
  } else {
    const durationMs = Math.max(0, Math.round(performance.now() - run.interruptionStartedAt));
    log("external audio interruption marker", { phase: "after", durationMs }, run);
    run.interruptionStartedAt = null;
    ui.status.textContent = "Interruption marked. Continue speaking or stop the test.";
  }
  controls();
});
ui.copy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(entries.join("\n"));
    ui.copy.textContent = "Copied";
    setTimeout(() => { ui.copy.textContent = "Copy log"; }, 1800);
  } catch {
    ui.log.focus();
    ui.log.select();
    ui.copy.textContent = "Select and copy log";
  }
});
ui.clear.addEventListener("click", () => {
  entries.length = 0;
  startedAt = performance.now();
  header();
  if (active) log("active attempt", { object: active.objectId });
});
document.querySelectorAll("nav a").forEach(link => link.addEventListener("click", event => {
  if (active) event.preventDefault();
}));
document.addEventListener("visibilitychange", () => {
  log("visibility", { state: document.visibilityState });
  if (mode === "interrupt") {
    if (active && !document.hidden && performance.now() - active.startedAt >= 30000) stop("30-second limit after background");
    else if (active) ui.status.textContent = document.hidden ? "Backgrounded; interruption test remains active." : "Back in the page; check the recognition events.";
    return;
  }
  if (document.hidden) {
    if (active && isHeldMode()) {
      const run = active;
      run.stopReason = "page hidden";
      run.stopping = true;
      releaseHeldMicrophone(run);
      if (!run.preparing) try { run.recognition.abort(); } catch { /* Cleanup watchdog handles it. */ }
      finish(run, true);
    } else if (active) stop("page hidden");
    else releaseHeldMicrophone();
  }
});
window.addEventListener?.("pagehide", () => {
  if (active) {
    const run = active;
    run.stopping = true;
    run.stopReason = "page hide";
    releaseHeldMicrophone(run);
    if (!run.preparing) try { run.recognition.abort(); } catch { /* Navigation is already releasing resources. */ }
    finish(run, true);
  } else releaseHeldMicrophone();
});
document.getElementById(mode).setAttribute("aria-current", "page");
ui.build.textContent = `Build ${BUILD}`;
if (!Recognition) ui.status.textContent = "Speech recognition is unavailable in this browser.";
header();
controls();
