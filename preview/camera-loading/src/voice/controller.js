import { parseVoiceCommand } from './parser.js';
import { APP_BUILD_VERSION, VOICE_SILENCE_DURATION_MS, VOICE_CLEANUP_TIMEOUT_MS, VOICE_START_TIMEOUT_MS, VOICE_MAX_DURATION_MS, VOICE_IOS_MAX_DURATION_MS, VOICE_METER_CALIBRATION_MS, VOICE_MIN_ACTIVITY_THRESHOLD } from '../config.js';

export function createVoiceController({
  state,
  elements,
  dialogScrollLock,
  saveIndoorReadings,
  formatTemp,
  formatRh,
  render,
} = {}, environment = globalThis) {
  const { window, document, navigator, performance, setTimeout, clearTimeout, requestAnimationFrame, cancelAnimationFrame } = environment;

  let activeVoiceSession = null;

  let retainedVoiceMeter = null;

  let voiceDebugSession = 0;

  let voiceDebugStartedAt = performance.now();

  const voiceDebugEntries = [];

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  const VOICE_DEBUG_ENABLED = new URLSearchParams(window.location.search).get("voice-debug") === "1";

  const IS_IOS = /iP(?:hone|ad|od)/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);


  function voiceDebugLog(event, details = {}, sessionId = activeVoiceSession?.id || voiceDebugSession) {
    if (!VOICE_DEBUG_ENABLED) return;
    const elapsed = ((performance.now() - voiceDebugStartedAt) / 1000).toFixed(3);
    const detailText = Object.entries(details)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(" ");
    voiceDebugEntries.push(`${elapsed}s [session ${sessionId || "-"}] ${event}${detailText ? ` ${detailText}` : ""}`);
    const output = document.querySelector("#voiceDebugOutput");
    if (output) {
      output.textContent = voiceDebugEntries.join("\n");
      output.scrollTop = output.scrollHeight;
    }
  }

  function logVoiceDebugEnvironment(event) {
    voiceDebugLog(event, {
      build: APP_BUILD_VERSION,
      assetRevision: new URL(import.meta.url).searchParams.get("v") || "unversioned",
      recognition: Boolean(SpeechRecognition),
      mediaDevices: Boolean(navigator.mediaDevices?.getUserMedia),
      audioContext: Boolean(window.AudioContext || window.webkitAudioContext),
    });
  }

  function initializeVoiceDebugPanel() {
    if (!VOICE_DEBUG_ENABLED) return;
    const panel = document.createElement("details");
    panel.className = "voice-debug-panel";
    panel.open = true;
    panel.innerHTML = `
      <summary>Voice diagnostics</summary>
      <div class="voice-debug-actions">
        <button type="button" id="voiceDebugCopy">Copy</button>
        <button type="button" id="voiceDebugClear">Clear</button>
      </div>
      <pre id="voiceDebugOutput" aria-live="polite"></pre>
    `;
    document.body.append(panel);
    panel.querySelector("#voiceDebugCopy").addEventListener("click", async () => {
      const text = voiceDebugEntries.join("\n");
      try {
        await navigator.clipboard.writeText(text);
        voiceDebugLog("diagnostics copied", { lines: voiceDebugEntries.length });
      } catch {
        voiceDebugLog("diagnostics copy failed");
      }
    });
    panel.querySelector("#voiceDebugClear").addEventListener("click", () => {
      voiceDebugEntries.length = 0;
      voiceDebugStartedAt = performance.now();
      panel.querySelector("#voiceDebugOutput").textContent = "";
      logVoiceDebugEnvironment("diagnostics cleared");
    });
    logVoiceDebugEnvironment("debug mode ready");
  }

  let pendingVoiceChanges = null;

  function voiceChangeRows(values) {
    const rows = [];
    if (values.indoorTemp !== undefined) rows.push(["Indoor temperature", formatTemp(values.indoorTemp)]);
    if (values.indoorRh !== undefined) rows.push(["Indoor humidity", formatRh(values.indoorRh)]);
    return rows;
  }

  function showVoiceResult(transcript, allowApply = true, session = activeVoiceSession) {
    if (session) session.hadResult = true;
    elements.voiceExamples.hidden = true;
    const parsed = parseVoiceCommand(transcript);
    const rows = voiceChangeRows(parsed.values);
    pendingVoiceChanges = rows.length ? parsed.values : null;
    elements.voiceTranscript.textContent = `Heard: “${transcript}”`;
    elements.voiceTranscriptPanel.hidden = !allowApply;
    elements.voiceChanges.classList.toggle("has-single-change", rows.length === 1);
    elements.voiceChanges.replaceChildren(...rows.map(([label, value]) => {
      const row = document.createElement("div");
      row.className = "voice-change";
      const term = document.createElement("dt");
      const detail = document.createElement("dd");
      term.textContent = label;
      detail.textContent = value;
      row.append(term, detail);
      return row;
    }));
    elements.voiceUpdateNote.hidden = rows.length === 0;
    elements.voiceStatus.textContent = allowApply
      ? parsed.errors.length
        ? parsed.errors.join(" ")
        : rows.length ? "Review the changes before applying." : "Couldn't find a temperature or humidity reading."
      : `Hearing: “${transcript}”`;
    elements.voiceApplyButton.disabled = !pendingVoiceChanges || parsed.errors.length > 0;
    elements.voiceApplyButton.hidden = elements.voiceApplyButton.disabled;
    if (allowApply) {
      elements.voiceListenButton.setAttribute("aria-label", "Record again");
      elements.voiceListenButton.title = "Record again";
    }
  }

  function resetVoiceMeter() {
    document.querySelectorAll(".voice-input-button").forEach((button) => button.style.setProperty("--voice-level", "0"));
    document.querySelectorAll(".voice-waveform span").forEach((bar) => {
      bar.style.height = "2px";
      bar.style.opacity = "0.72";
    });
  }

  function stopVoiceMeter(session) {
    const meter = session?.meter;
    if (!meter) return;
    voiceDebugLog("meter stopping", {
      track: meter.stream?.getAudioTracks()[0]?.readyState || "none",
      context: meter.context?.state || "none",
    }, session?.id);
    if (meter.releaseTimer !== null) clearTimeout(meter.releaseTimer);
    meter.releaseTimer = null;
    if (meter.frame !== null) cancelAnimationFrame(meter.frame);
    meter.frame = null;
    if (meter.source) {
      try {
        meter.source.disconnect();
      } catch {
        // The browser may already have disconnected this source.
      }
    }
    meter.source = null;
    meter.stream?.getTracks().forEach((track) => track.stop());
    meter.stream = null;
    if (meter.context && meter.context.state !== "closed") meter.context.close().catch(() => {});
    meter.context = null;
    meter.session = null;
    if (retainedVoiceMeter === meter) retainedVoiceMeter = null;
    session.meter = null;
    if (activeVoiceSession === session) resetVoiceMeter();
  }

  function releaseRetainedVoiceMeter(reason) {
    if (!retainedVoiceMeter) return;
    const meter = retainedVoiceMeter;
    const owner = { id: meter.lastSessionId, meter };
    voiceDebugLog("retained meter released", { reason }, meter.lastSessionId);
    stopVoiceMeter(owner);
    resetVoiceMeter();
  }

  function retainVoiceMeter(session) {
    const meter = session?.meter;
    const track = meter?.stream?.getAudioTracks()[0];
    if (!meter || track?.readyState !== "live") return false;
    if (meter.releaseTimer !== null) clearTimeout(meter.releaseTimer);
    meter.session = null;
    meter.lastSessionId = session.id;
    session.meter = null;
    retainedVoiceMeter = meter;
    meter.releaseTimer = null;
    if (meter.frame !== null) cancelAnimationFrame(meter.frame);
    meter.frame = null;
    resetVoiceMeter();
    voiceDebugLog("meter retained for foreground session", {
      track: track.readyState,
    }, session.id);
    return true;
  }

  function markVoiceActivity(session, source) {
    if (activeVoiceSession !== session) return;
    if (!session.soundDetected) voiceDebugLog("voice activity detected", { source }, session.id);
    session.soundDetected = true;
    session.silentSince = null;
  }

  async function prepareVoiceAudioContext(session) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    const meter = session.meter;
    if (!meter.context || meter.context.state === "closed") {
      meter.context = new AudioContext();
      const context = meter.context;
      context.addEventListener("statechange", () => {
        voiceDebugLog("audio context statechange", { state: context.state }, session.id);
      });
      voiceDebugLog("audio context created", { state: context.state }, session.id);
    }
    if (meter.context.state === "suspended") {
      try {
        await meter.context.resume();
        voiceDebugLog("audio context resumed", { state: meter.context.state }, session.id);
      } catch (error) {
        voiceDebugLog("audio context resume failed", { name: error?.name || "unknown" }, session.id);
        return null;
      }
    }
    return meter.context;
  }

  async function startVoiceMeter(session) {
    const retainedTrack = retainedVoiceMeter?.stream?.getAudioTracks()[0];
    if (IS_IOS && retainedTrack?.readyState === "live") {
      const meter = retainedVoiceMeter;
      retainedVoiceMeter = null;
      if (meter.releaseTimer !== null) clearTimeout(meter.releaseTimer);
      meter.releaseTimer = null;
      meter.session = session;
      meter.lastSessionId = session.id;
      session.meter = meter;
      voiceDebugLog("retained meter reused", {
        track: retainedTrack.readyState,
        context: meter.context?.state || "none",
      }, session.id);
      if (meter.context?.state === "suspended") await meter.context.resume();
      if (activeVoiceSession === session && !session.finished && !document.hidden) meter.startDrawing?.();
      return;
    }
    if (retainedVoiceMeter) releaseRetainedVoiceMeter("stale track");
    const meter = {
      stream: null,
      context: null,
      source: null,
      frame: null,
      releaseTimer: null,
      session,
      lastSessionId: session.id,
    };
    session.meter = meter;
    try {
      voiceDebugLog("getUserMedia requested", {}, session.id);
      meter.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      voiceDebugLog("meter unavailable", { name: error?.name || "unknown" }, session.id);
      session.meter = null;
      return;
    }
    if (activeVoiceSession !== session || session.finished) {
      meter.stream.getTracks().forEach((track) => track.stop());
      meter.stream = null;
      session.meter = null;
      return;
    }
    const track = meter.stream.getAudioTracks()[0];
    voiceDebugLog("getUserMedia resolved", {
      track: track?.readyState || "none",
      enabled: track?.enabled ?? "unknown",
      muted: track?.muted ?? "unknown",
    }, session.id);
    ["mute", "unmute", "ended"].forEach((name) => {
      track?.addEventListener(name, () => {
        voiceDebugLog(`track ${name}`, { state: track.readyState, muted: track.muted }, session.id);
      });
    });
    const context = await prepareVoiceAudioContext(session);
    if (activeVoiceSession !== session || !context || context.state !== "running") {
      voiceDebugLog("meter unavailable", { context: context?.state || "none" }, session.id);
      stopVoiceMeter(session);
      return;
    }
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    meter.source = context.createMediaStreamSource(meter.stream);
    meter.source.connect(analyser);
    voiceDebugLog("meter started", { context: context.state }, session.id);
    const samples = IS_IOS ? new Uint8Array(analyser.fftSize) : new Float32Array(analyser.fftSize);
    const waveforms = [...document.querySelectorAll(".voice-waveform")];
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const maximumHeights = IS_IOS ? [8, 14, 22, 14, 8] : [8, 12, 16, 12, 8];
    const calibrationLevels = [];
    const meterStartedAt = performance.now();
    let noiseFloor = 0.006;
    let activityThreshold = VOICE_MIN_ACTIVITY_THRESHOLD;
    let calibrationLogged = false;
    let displayedLevel = 0;
    const draw = () => {
      const owner = meter.session;
      if (!meter.stream || !owner || owner.finished || owner.isStopping || activeVoiceSession !== owner) return;
      if (IS_IOS) analyser.getByteTimeDomainData(samples);
      else analyser.getFloatTimeDomainData(samples);
      let mean = 0;
      for (const sample of samples) mean += sample;
      mean /= samples.length;
      let total = 0;
      for (const sample of samples) total += (sample - mean) ** 2;
      let targetLevel;
      if (IS_IOS) {
        const measuredLevel = Math.min(1, Math.sqrt(total / samples.length) / 24);
        targetLevel = measuredLevel;
      } else {
        const measuredLevel = Math.sqrt(total / samples.length);
        const elapsed = performance.now() - meterStartedAt;
        if (elapsed <= VOICE_METER_CALIBRATION_MS) {
          calibrationLevels.push(measuredLevel);
        } else if (!calibrationLogged) {
          const sorted = calibrationLevels.sort((a, b) => a - b);
          noiseFloor = sorted[Math.floor(sorted.length * 0.2)] || noiseFloor;
          activityThreshold = Math.max(VOICE_MIN_ACTIVITY_THRESHOLD, noiseFloor * 2.8);
          calibrationLogged = true;
          voiceDebugLog("meter calibrated", {
            noiseFloor: noiseFloor.toFixed(4),
            threshold: activityThreshold.toFixed(4),
          }, session.id);
        } else if (!session.soundDetected && measuredLevel < activityThreshold) {
          noiseFloor = noiseFloor * 0.98 + measuredLevel * 0.02;
          activityThreshold = Math.max(VOICE_MIN_ACTIVITY_THRESHOLD, noiseFloor * 2.8);
        }
        targetLevel = reduceMotion || measuredLevel < activityThreshold
          ? 0
          : Math.min(1, (measuredLevel - activityThreshold) / Math.max(0.08, 0.18 - activityThreshold));
        if (owner?.isListening && calibrationLogged) {
          if (measuredLevel >= activityThreshold) {
            markVoiceActivity(owner, "meter");
          } else if (owner.soundDetected) {
            if (owner.silentSince === null) owner.silentSince = performance.now();
            if (performance.now() - owner.silentSince >= VOICE_SILENCE_DURATION_MS) {
              voiceDebugLog("silence threshold reached", { durationMs: VOICE_SILENCE_DURATION_MS }, owner.id);
              owner.silentSince = null;
              stopVoiceInput(false, owner);
              return;
            }
          }
        }
      }
      displayedLevel += (targetLevel - displayedLevel) * (targetLevel > displayedLevel ? 0.55 : (IS_IOS ? 0.14 : 0.12));
      document.querySelectorAll(".voice-input-button").forEach((button) => {
        button.style.setProperty("--voice-level", displayedLevel.toFixed(3));
      });
      waveforms.forEach((waveform) => {
        [...waveform.children].forEach((bar, index) => {
          bar.style.height = `${Math.round(2 + displayedLevel * (maximumHeights[index] - 2))}px`;
          bar.style.opacity = `${0.72 + displayedLevel * 0.28}`;
        });
      });
      meter.frame = requestAnimationFrame(draw);
    };
    meter.startDrawing = () => {
      displayedLevel = 0;
      if (meter.frame === null) draw();
    };
    meter.startDrawing();
  }

  function voiceErrorMessage(error) {
    const messages = {
      "no-speech": "No speech detected.",
      "audio-capture": "No microphone is available.",
      "not-allowed": "Microphone access was not allowed.",
      "service-not-allowed": "Speech recognition is blocked in this browser.",
      network: "Voice recognition is unavailable right now.",
      "language-not-supported": "Speech recognition does not support this language.",
    };
    return messages[error] || "Voice input could not be completed.";
  }

  function showVoiceError(message) {
    pendingVoiceChanges = null;
    elements.voiceExamples.hidden = true;
    elements.voiceStatus.textContent = "";
    elements.voiceStatus.hidden = true;
    elements.voiceTranscript.textContent = message;
    elements.voiceTranscriptPanel.hidden = false;
    elements.voiceChanges.replaceChildren();
    elements.voiceChanges.classList.remove("has-single-change");
    elements.voiceUpdateNote.hidden = true;
    elements.voiceApplyButton.disabled = true;
    elements.voiceApplyButton.hidden = true;
  }

  function clearVoiceSessionTimers(session) {
    ["silenceTimer", "cleanupTimer", "startupTimer", "maxTimer", "finalTimer"].forEach((name) => {
      if (session[name] !== null) clearTimeout(session[name]);
      session[name] = null;
    });
  }

  function finishVoiceListening(session, retainMeter = true) {
    if (!session || session.finished) return;
    session.finished = true;
    clearVoiceSessionTimers(session);
    session.isListening = false;
    session.isStopping = false;
    const meterRetained = retainMeter && IS_IOS && !document.hidden && retainVoiceMeter(session);
    if (!meterRetained) stopVoiceMeter(session);
    if (activeVoiceSession === session) activeVoiceSession = null;
    elements.voiceStatus.classList.remove("is-listening");
    elements.voiceInputButton.classList.remove("is-listening");
    elements.voiceInputButton.classList.remove("is-meterless");
    elements.voiceListenButton.classList.remove("is-listening");
    elements.voiceListenButton.classList.remove("is-meterless");
    elements.voiceInputButton.disabled = false;
    elements.voiceInputButton.setAttribute("aria-label", "Update indoor readings by voice");
    elements.voiceInputButton.title = "Update indoor readings by voice";
    elements.voiceListenButton.disabled = false;
    elements.voiceListenButton.setAttribute("aria-label", "Record again");
    elements.voiceListenButton.title = "Record again";
  }

  function completeVoiceSession(session) {
    if (activeVoiceSession !== session || session.finished) return;
    if (session.latestTranscript) showVoiceResult(session.latestTranscript, true, session);
    else if (!session.hadError) showVoiceError("No speech detected. Try again.");
    finishVoiceListening(session);
    if (!session.dialogCancelled) showVoiceDialog();
  }

  function showVoiceDialog() {
    const indoorDialog = document.querySelector('#indoorDialog');
    const entering = elements.voiceDialog.hidden;
    if (!indoorDialog.open) dialogScrollLock.open(indoorDialog);
    indoorDialog.classList.add('voice-mode');
    elements.voiceDialog.hidden = false;
    if (entering) document.querySelector('#indoor-heading').focus({ preventScroll: true });
  }

  function resetVoiceResult() {
    pendingVoiceChanges = null;
    elements.voiceExamples.hidden = false;
    elements.voiceChanges.replaceChildren();
    elements.voiceChanges.classList.remove("has-single-change");
    elements.voiceTranscriptPanel.hidden = true;
    elements.voiceUpdateNote.hidden = true;
    elements.voiceApplyButton.disabled = true;
    elements.voiceApplyButton.hidden = true;
    elements.voiceListenButton.setAttribute("aria-label", "Record indoor readings");
    elements.voiceListenButton.title = "Record indoor readings";
    elements.voiceStatus.hidden = false;
    elements.voiceStatus.textContent = "Ready to listen.";
    elements.voiceStatus.classList.remove("is-listening");
    resetVoiceMeter();
  }

  function startVoiceInput() {
    if (activeVoiceSession) return;
    voiceDebugSession += 1;
    const recognition = new SpeechRecognition();
    const session = {
      id: voiceDebugSession,
      recognition,
      meter: null,
      silenceTimer: null,
      cleanupTimer: null,
      startupTimer: null,
      maxTimer: null,
      finalTimer: null,
      isListening: false,
      isStopping: false,
      manualStop: false,
      cleanupTimedOut: false,
      hadResult: false,
      hadError: false,
      latestTranscript: "",
      soundDetected: false,
      silentSince: null,
      dialogCancelled: false,
      started: false,
      audioStarted: false,
      finished: false,
    };
    activeVoiceSession = session;
    voiceDebugLog("session requested", {
      context: "none",
      visibility: document.visibilityState,
    }, session.id);
    resetVoiceResult();
    elements.voiceStatus.textContent = "Starting microphone...";
    elements.voiceInputButton.disabled = true;
    elements.voiceListenButton.disabled = true;
    showVoiceDialog();
    recognition.lang = document.documentElement.lang || navigator.language || "en-GB";
    recognition.continuous = !IS_IOS;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    voiceDebugLog("recognition configured", { continuous: recognition.continuous, ios: IS_IOS }, session.id);
    ["start", "audiostart", "soundstart", "speechstart", "speechend", "soundend", "audioend", "end", "nomatch"].forEach((name) => {
      recognition.addEventListener(name, () => {
        voiceDebugLog(`recognition ${name}`, { current: activeVoiceSession === session }, session.id);
      });
    });
    recognition.addEventListener("result", (event) => {
      const latest = event.results[event.results.length - 1];
      voiceDebugLog("recognition result", {
        current: activeVoiceSession === session,
        results: event.results.length,
        final: latest?.isFinal ?? false,
      }, session.id);
    });
    recognition.addEventListener("error", (event) => {
      voiceDebugLog("recognition error", {
        current: activeVoiceSession === session,
        error: event.error || "unknown",
        message: event.message || "none",
      }, session.id);
    });
    recognition.addEventListener("start", () => {
      if (activeVoiceSession !== session) return;
      session.started = true;
      session.isListening = true;
      const maximumDuration = IS_IOS ? VOICE_IOS_MAX_DURATION_MS : VOICE_MAX_DURATION_MS;
      session.maxTimer = setTimeout(() => {
        voiceDebugLog("maximum duration reached", { durationMs: maximumDuration }, session.id);
        stopVoiceInput(false, session);
      }, maximumDuration);
      elements.voiceInputButton.disabled = false;
      elements.voiceStatus.textContent = "Listening...";
      elements.voiceStatus.classList.add("is-listening");
      elements.voiceListenButton.disabled = false;
      elements.voiceInputButton.classList.add("is-listening");
      elements.voiceListenButton.classList.add("is-listening");
      elements.voiceInputButton.classList.toggle("is-meterless", IS_IOS && !session.meter?.stream);
      elements.voiceListenButton.classList.toggle("is-meterless", IS_IOS && !session.meter?.stream);
      elements.voiceInputButton.setAttribute("aria-label", "Stop and review voice input");
      elements.voiceInputButton.title = "Stop and review";
      elements.voiceListenButton.setAttribute("aria-label", "Stop recording");
      elements.voiceListenButton.title = "Stop recording";
    });
    recognition.addEventListener("audiostart", () => {
      if (activeVoiceSession !== session) return;
      session.audioStarted = true;
      if (session.startupTimer !== null) clearTimeout(session.startupTimer);
      session.startupTimer = null;
    });
    recognition.addEventListener("result", (event) => {
      if (activeVoiceSession !== session) return;
      markVoiceActivity(session, "recognition result");
      if (session.finalTimer !== null) clearTimeout(session.finalTimer);
      session.finalTimer = null;
      const transcript = [...event.results].map((result) => result[0].transcript).join(" ").trim();
      session.latestTranscript = transcript;
      if (transcript) elements.voiceExamples.hidden = true;
      elements.voiceStatus.textContent = `Hearing: “${transcript}”`;
      elements.voiceTranscriptPanel.hidden = true;
      const latestResult = event.results[event.results.length - 1];
      if (latestResult.isFinal) {
        showVoiceResult(transcript, false, session);
        if (!IS_IOS) {
          session.finalTimer = setTimeout(() => {
            voiceDebugLog("final result silence fallback", { durationMs: VOICE_SILENCE_DURATION_MS }, session.id);
            stopVoiceInput(false, session);
          }, VOICE_SILENCE_DURATION_MS);
        }
      }
    });
    recognition.addEventListener("speechstart", () => {
      if (activeVoiceSession !== session) return;
      markVoiceActivity(session, "recognition speechstart");
      if (session.silenceTimer !== null) clearTimeout(session.silenceTimer);
      session.silenceTimer = null;
    });
    recognition.addEventListener("speechend", () => {
      if (activeVoiceSession !== session) return;
      if (IS_IOS) return;
      if (session.silenceTimer !== null) clearTimeout(session.silenceTimer);
      session.silenceTimer = setTimeout(() => stopVoiceInput(false, session), VOICE_SILENCE_DURATION_MS);
    });
    recognition.addEventListener("error", (event) => {
      if (activeVoiceSession !== session) return;
      if (session.isStopping && event.error === "aborted") {
        voiceDebugLog("intentional stop reported as aborted", {}, session.id);
        return;
      }
      if (session.latestTranscript) {
        voiceDebugLog("recognition error ignored after result", { error: event.error || "unknown" }, session.id);
        return;
      }
      session.hadError = true;
      showVoiceError(voiceErrorMessage(event.error));
    });
    recognition.addEventListener("end", () => {
      if (activeVoiceSession !== session) return;
      completeVoiceSession(session);
    });
    const startRecognition = () => {
      if (activeVoiceSession !== session || session.finished) return;
      try {
        voiceDebugLog("recognition start requested", { meter: session.meter?.stream ? "held" : "unavailable" }, session.id);
        recognition.start();
        session.startupTimer = setTimeout(() => {
          if (activeVoiceSession !== session || session.audioStarted) return;
          voiceDebugLog("recognition startup timeout", { durationMs: VOICE_START_TIMEOUT_MS }, session.id);
          session.hadError = true;
          showVoiceError("Speech recognition could not be started.");
          try {
            recognition.abort();
          } catch {
            // Continue with local cleanup if recognition never entered a running state.
          }
          finishVoiceListening(session);
          showVoiceDialog();
        }, VOICE_START_TIMEOUT_MS);
        if (!IS_IOS && navigator.mediaDevices?.getUserMedia) {
          startVoiceMeter(session).catch((error) => {
            voiceDebugLog("meter failed", { name: error?.name || "unknown" }, session.id);
            stopVoiceMeter(session);
          });
        }
      } catch (error) {
        voiceDebugLog("recognition start threw", { name: error?.name || "unknown" }, session.id);
        if (activeVoiceSession !== session) return;
        session.hadError = true;
        showVoiceError("Speech recognition could not be started.");
        finishVoiceListening(session);
        elements.voiceListenButton.disabled = false;
        showVoiceDialog();
      }
    };

    if (IS_IOS && navigator.mediaDevices?.getUserMedia) {
      // This stream is an iOS audio-session keep-alive, not merely a visual meter.
      // Releasing it before recognition or skipping it reproduced silent immediate retries.
      voiceDebugLog("recognition waiting for held meter", {}, session.id);
      startVoiceMeter(session)
        .catch((error) => {
          voiceDebugLog("meter failed", { name: error?.name || "unknown" }, session.id);
          stopVoiceMeter(session);
        })
        .then(startRecognition);
    } else {
      if (!navigator.mediaDevices?.getUserMedia) voiceDebugLog("meter unavailable", { reason: "mediaDevices" }, session.id);
      startRecognition();
    }
  }

  function stopVoiceInput(showDialogImmediately, session = activeVoiceSession, reason = "automatic") {
    if (!session || activeVoiceSession !== session || session.isStopping || session.finished) return;
    session.manualStop = reason === "manual";
    voiceDebugLog("stop requested", { immediateDialog: showDialogImmediately, reason }, session.id);
    ["silenceTimer", "startupTimer", "maxTimer", "finalTimer"].forEach((name) => {
      if (session[name] !== null) clearTimeout(session[name]);
      session[name] = null;
    });
    session.isListening = false;
    session.isStopping = true;
    if (session.meter?.frame != null) cancelAnimationFrame(session.meter.frame);
    if (session.meter) session.meter.frame = null;
    resetVoiceMeter();
    elements.voiceStatus.textContent = "Finishing...";
    elements.voiceStatus.classList.remove("is-listening");
    elements.voiceInputButton.classList.remove("is-listening");
    elements.voiceInputButton.classList.remove("is-meterless");
    elements.voiceListenButton.classList.remove("is-listening");
    elements.voiceListenButton.classList.remove("is-meterless");
    elements.voiceInputButton.disabled = true;
    elements.voiceListenButton.disabled = true;
    elements.voiceListenButton.setAttribute("aria-label", "Finishing recording");
    elements.voiceListenButton.title = "Finishing recording";
    if (showDialogImmediately) showVoiceDialog();
    try {
      session.recognition.stop();
      session.cleanupTimer = setTimeout(() => {
        if (activeVoiceSession !== session) return;
        voiceDebugLog("recognition cleanup timeout", {}, session.id);
        session.cleanupTimedOut = true;
        try {
          session.recognition.abort();
        } catch {
          // Continue with local cleanup if Safari has already released recognition.
        }
        completeVoiceSession(session);
      }, VOICE_CLEANUP_TIMEOUT_MS);
    } catch {
      session.hadError = true;
      showVoiceError("Voice input could not be completed.");
      finishVoiceListening(session);
      showVoiceDialog();
    }
  }

  function toggleVoiceListening() {
    if (activeVoiceSession?.isListening) {
      stopVoiceInput(elements.voiceDialog.hidden, activeVoiceSession, "manual");
      return;
    }
    if (!activeVoiceSession) startVoiceInput();
  }

  function closeVoiceDialog() {
    const session = activeVoiceSession;
    voiceDebugLog("dialog closed", {}, session?.id);
    if (session) {
      session.dialogCancelled = true;
      try {
        session.recognition.abort();
      } catch {
        // Continue closing if recognition has already ended.
      }
      finishVoiceListening(session);
    }
    pendingVoiceChanges = null;
    elements.voiceDialog.hidden = true;
    const indoorDialog = document.querySelector('#indoorDialog');
    indoorDialog.classList.remove('voice-mode');
    if (indoorDialog.open) (elements.voiceInputButton.hidden ? document.querySelector('#indoor-heading') : elements.voiceInputButton)?.focus({ preventScroll: true });
  }

  function applyVoiceChanges() {
    if (!pendingVoiceChanges) return;
    Object.assign(state, pendingVoiceChanges);
    saveIndoorReadings();
    closeVoiceDialog();
    render();
  }

  function handleVoiceHidden(reason = "page hidden") {
    const session = activeVoiceSession;
    if (session) {
      voiceDebugLog(reason + " during session", {}, session.id);
      session.dialogCancelled = true;
      try { session.recognition.abort(); } catch { /* Continue releasing capture. */ }
      finishVoiceListening(session, false);
    }
    releaseRetainedVoiceMeter(reason);
  }

  return { supported: Boolean(SpeechRecognition), initializeVoiceDebugPanel, startVoiceInput, stopVoiceInput, toggleVoiceListening, closeVoiceDialog, applyVoiceChanges, handleVoiceHidden };
}
