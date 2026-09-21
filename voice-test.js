const BUILD = "v0.5.4.5-voice-diagnostics";
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const requestedMode = new URLSearchParams(location.search).get("mode");
const mode = ["fresh", "interrupt", "prime", "hold", "hold-persist"].includes(requestedMode) ? requestedMode : "reuse";
const ui = Object.fromEntries(["build", "status", "start", "stop", "mark-interruption", "interruption-guide", "reset-microphone", "reset-guide", "hold-guide", "hold-waveform", "copy", "clear", "log"].map(id => [id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), document.getElementById(id)]));
const holdWaveBars = [1, 2, 3, 4, 5].map(number => document.getElementById(`hold-wave-${number}`));
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
    language: document.documentElement.lang, meter: mode === "hold-persist" ? "held-persistent" : mode === "hold" ? "held" : "disabled", continuous: false,
  });
  log("browser details", browserDetails());
  log("user agent", { value: JSON.stringify(navigator.userAgent || "unavailable") });
}

function controls() {
  ui.start.disabled = !Recognition || Boolean(active) || requiresReload || resettingMicrophone;
  ui.stop.disabled = !active || active.stopping;
  ui.markInterruption.hidden = mode !== "interrupt";
  ui.markInterruption.disabled = mode !== "interrupt" || !active || active.stopping;
  ui.markInterruption.textContent = active?.interruptionStartedAt == null ? "Mark before switching" : "Mark return";
  ui.interruptionGuide.hidden = mode !== "interrupt";
  ui.resetMicrophone.hidden = mode !== "prime";
  ui.resetMicrophone.disabled = mode !== "prime" || Boolean(active) || resettingMicrophone || !navigator.mediaDevices?.getUserMedia;
  ui.resetGuide.hidden = mode !== "prime";
  ui.holdGuide.hidden = mode !== "hold" && mode !== "hold-persist";
  ui.holdWaveform.hidden = mode !== "hold" && mode !== "hold-persist";
  document.querySelectorAll("nav a").forEach(link => link.setAttribute("aria-disabled", String(Boolean(active))));
}

function resetHoldWaveform() {
  holdWaveBars.forEach(bar => {
    bar.style.height = "2px";
    bar.style.opacity = "0.72";
  });
}

function releaseHeldMicrophone(run = null) {
  const microphone = run?.microphone || heldMicrophone;
  if (!microphone) return;
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
    if (heldMicrophone.audioContext?.state === "suspended") await heldMicrophone.audioContext.resume();
    return;
  }
  if (heldMicrophone) releaseHeldMicrophone(run);
  log("held microphone requested", {}, run);
  const microphone = {
    stream: await navigator.mediaDevices.getUserMedia({ audio: true }),
    audioContext: null,
    meterSource: null,
    meterFrame: null,
  };
  heldMicrophone = microphone;
  run.microphone = microphone;
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
    return;
  }
  microphone.audioContext = new AudioContextConstructor();
  if (microphone.audioContext.state === "suspended") await microphone.audioContext.resume();
  if (active !== run || run.stopping) return;
  const analyser = microphone.audioContext.createAnalyser();
  analyser.fftSize = 256;
  microphone.meterSource = microphone.audioContext.createMediaStreamSource(microphone.stream);
  microphone.meterSource.connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);
  const maximumHeights = [8, 14, 22, 14, 8];
  let displayedLevel = 0;
  const draw = () => {
    if (heldMicrophone !== microphone || !microphone.stream) return;
    analyser.getByteTimeDomainData(samples);
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
  log("held meter started", { context: microphone.audioContext.state }, run);
  draw();
}

function finish(run, timedOut = false) {
  if (active !== run) return;
  if (run.interruptionStartedAt != null) log("audio interruption ended before return marker", {}, run);
  clearTimeout(run.limit);
  clearTimeout(run.cleanup);
  const retainMicrophone = mode === "hold-persist" && run.stopReason === "manual" && !timedOut;
  if (retainMicrophone) log("held microphone retained", { reason: "manual stop", nextAttempt: attempt + 1 }, run);
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
        run.results++;
        if (!run.stopping) ui.status.textContent = detail.final ? "Final result received" : "Speech received";
      }
      if (name === "error" && !(run.stopping && event.error === "aborted")) run.error = event.error || "unknown";
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

ui.start.addEventListener("click", async () => {
  if (active || requiresReload || !Recognition) return;
  try {
    const holder = mode === "reuse" ? (shared ||= createRecognizer()) : createRecognizer();
    const run = { id: ++attempt, ...holder, results: 0, error: null, stopping: false, stopReason: null, preparing: mode === "hold" || mode === "hold-persist", cleanup: null, interruptionStartedAt: null, startedAt: performance.now(), microphone: null };
    active = run;
    ui.status.textContent = "Starting microphone";
    controls();
    if (mode === "hold" || mode === "hold-persist") {
      try {
        await startHeldMicrophone(run);
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
      run.preparing = false;
      if (active !== run || run.stopping) {
        if (active === run) finish(run);
        return;
      }
    }
    log("start requested", { object: run.objectId, mode });
    run.limit = setTimeout(() => stop("30-second limit"), 30000);
    run.recognition.start();
  } catch (error) {
    log("start threw", { name: error.name });
    if (active) { active.error = error.name; finish(active, true); }
    else ui.status.textContent = `Could not create recognizer: ${error.name}`;
  }
});
ui.stop.addEventListener("click", () => stop());
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
    if (active) stop("page hidden");
    else releaseHeldMicrophone();
  }
});
window.addEventListener?.("pagehide", () => releaseHeldMicrophone());
document.getElementById(mode).setAttribute("aria-current", "page");
ui.build.textContent = `Build ${BUILD}`;
if (!Recognition) ui.status.textContent = "Speech recognition is unavailable in this browser.";
header();
controls();
