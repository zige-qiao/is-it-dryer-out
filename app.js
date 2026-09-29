const WEATHER_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";
const UK_POSTCODE_ENDPOINT = "https://api.postcodes.io/postcodes";
const UK_OUTCODE_ENDPOINT = "https://api.postcodes.io/outcodes";
const REVERSE_GEOCODING_ENDPOINT = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const DEFAULT_LOCATION = {
  name: "Sale, Greater Manchester",
  latitude: 53.4252,
  longitude: -2.3244,
};
const LOCATION_LABEL_OVERRIDES = new Map([
  ["Stretford, Greater Manchester", "Sale, Greater Manchester"],
]);
const STORAGE_KEY = "dew-indoor-readings";
const PLAN_STORAGE_KEY = "is-it-dryer-out-plan";
const UI_PREFERENCES_STORAGE_KEY = "is-it-dryer-out-ui-preferences";
const LOCATION_STORAGE_KEY = "is-it-dryer-out-location";
const LOCATION_HISTORY_STORAGE_KEY = "is-it-dryer-out-location-history";
let recentLocations = [];
let locationSearchTimer;
let locationSearchRequestId = 0;
let locationAttemptId = 0;
let locationFinding = false;
let locationStatus = "";
let locationRetry = false;
const LOCATION_REQUESTED_STORAGE_KEY = "is-it-dryer-out-location-requested";
const DEFAULT_TIMEZONE = "Europe/London";
const DEFAULT_PRESSURE_HPA = 1013.25;
const MINIMUM_MOISTURE_MARGIN = 0.4;
const WEATHER_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const MAX_OPEN_MINUTES = 180;
const TARGET_MARGIN_RH = 0.5;
const MINIMUM_NOTICEABLE_RH_CHANGE = 1;
const THERMAL_RESPONSE_FACTOR = 0.22;
const ROOM_PRESETS = { small: 30, medium: 50, large: 80 };
const OPENING_SETUPS = {
  slightly: { label: "Window slightly open", airflow: 25 },
  single: { label: "One window fully open", airflow: 80 },
  cross: { label: "Cross-ventilation", airflow: 180 },
};
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
// Keep the build identity in the script so stale code identifies itself correctly.
const APP_BUILD_VERSION = "v0.7.2";
const VOICE_DEBUG_ENABLED = new URLSearchParams(window.location.search).get("voice-debug") === "1";
const IS_IOS = /iP(?:hone|ad|od)/.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const VOICE_SILENCE_DURATION_MS = 1000;
const VOICE_CLEANUP_TIMEOUT_MS = 3000;
const VOICE_START_TIMEOUT_MS = 6000;
const VOICE_MAX_DURATION_MS = 15000;
const VOICE_IOS_MAX_DURATION_MS = 30000;
const VOICE_METER_CALIBRATION_MS = 600;
const VOICE_MIN_ACTIVITY_THRESHOLD = 0.018;
const INPUT_UNCERTAINTY = {
  indoorTemp: 0.3,
  indoorRh: 2,
  outdoorTemp: 0.5,
  outdoorRh: 3,
};

let dialogScrollLock;
const uiPreferences = { showIndoorSummary: false, openIndoorOnLaunch: true };

const state = {
  indoorLastSet: null,
  indoorTemp: 24,
  indoorRh: 58,
  targetRh: 55,
  minTemp: 18,
  roomPreset: "medium",
  roomLength: 4,
  roomWidth: 5,
  roomHeight: 2.5,
  openingSetup: "single",
  customAirflow: 80,
  outdoorTemp: null,
  outdoorRh: null,
  outdoorDewPoint: null,
  outdoorPressure: DEFAULT_PRESSURE_HPA,
  outdoorWind: 0,
  forecast: [],
  chartHours: 48,
  chartSelection: 0,
  updatedAt: null,
  lastCheckedAt: null,
  lastSuccessfulUpdateAt: null,
  weatherRequestPending: false,
  weatherLoadFailed: false,
  timezone: DEFAULT_TIMEZONE,
  location: { ...DEFAULT_LOCATION },
  locationMode: "current",
};

const elements = {
  recommendation: document.querySelector(".recommendation"),
  verdictPanel: document.querySelector(".verdict-panel"),
  forecastPanel: document.querySelector(".forecast-panel"),
  dashboardPanel: document.querySelector(".dashboard-panel"),
  decisionLabel: document.querySelector("#decisionLabel"),
  decisionPrimary: document.querySelector("#decisionPrimary"),
  decisionSecondary: document.querySelector("#decisionSecondary"),
  weatherStatus: document.querySelector("#weatherStatus"),
  indoorTemp: document.querySelector("#indoorTemp"),
  indoorRh: document.querySelector("#indoorRh"),
  indoorTempInput: document.querySelector("#indoorTempInput"),
  indoorRhInput: document.querySelector("#indoorRhInput"),
  indoorTempValue: document.querySelector("#indoorTempValue"),
  indoorRhValue: document.querySelector("#indoorRhValue"),
  indoorSummaryTemp: document.querySelector("#indoorSummaryTemp"),
  indoorSummaryRh: document.querySelector("#indoorSummaryRh"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsDialog: document.querySelector("#settingsDialog"),
  settingsDialogTitle: document.querySelector("#settingsDialogTitle"),
  showIndoorSummary: document.querySelector("#showIndoorSummary"),
  openIndoorOnLaunch: document.querySelector("#openIndoorOnLaunch"),
  pullRefresh: document.querySelector("#pullRefresh"),
  pullRefreshText: document.querySelector("#pullRefreshText"),
  outdoorTempValue: document.querySelector("#outdoorTempValue"),
  outdoorRhValue: document.querySelector("#outdoorRhValue"),
  indoorDewPoint: document.querySelector("#indoorDewPoint"),
  outdoorDewPoint: document.querySelector("#outdoorDewPoint"),
  indoorAbsoluteHumidity: document.querySelector("#indoorAbsoluteHumidity"),
  outdoorAbsoluteHumidity: document.querySelector("#outdoorAbsoluteHumidity"),
  warmingTemp: document.querySelector("#warmingTemp"),
  warmedOutdoorRh: document.querySelector("#warmedOutdoorRh"),
  adjustedAirNote: document.querySelector("#adjustedAirNote"),
  explanationText: document.querySelector("#explanationText"),
  weatherDataStatus: document.querySelector("#weatherDataStatus"),
  refreshWeather: document.querySelector("#refreshWeather"),
  targetRh: document.querySelector("#targetRh"),
  minTemp: document.querySelector("#minTemp"),
  targetRhInput: document.querySelector("#targetRhInput"),
  minTempInput: document.querySelector("#minTempInput"),
  roomPreset: document.querySelector("#roomPreset"),
  customRoomFields: document.querySelector("#customRoomFields"),
  roomLength: document.querySelector("#roomLength"),
  roomWidth: document.querySelector("#roomWidth"),
  roomHeight: document.querySelector("#roomHeight"),
  roomVolume: document.querySelector("#roomVolume"),
  openingSetup: document.querySelector("#openingSetup"),
  customFlowField: document.querySelector("#customFlowField"),
  customAirflow: document.querySelector("#customAirflow"),
  planConfidence: document.querySelector("#planConfidence"),
  planSummaryButton: document.querySelector("#planSummaryButton"),
  planSummaryText: document.querySelector("#planSummaryText"),
  planSummaryVentilationText: document.querySelector("#planSummaryVentilationText"),
  planDialog: document.querySelector("#planDialog"),
  planDoneButton: document.querySelector("#planDoneButton"),
  planDialogTitle: document.querySelector("#planDialogTitle"),
  locationName: document.querySelector("#locationName"),
  sourceLocationName: document.querySelector("#sourceLocationName"),
  liveWeatherRequest: document.querySelector("#liveWeatherRequest"),
  locationButton: document.querySelector("#locationButton"),
  locationDialog: document.querySelector("#locationDialog"),
  locationDialogStatus: document.querySelector("#locationDialogStatus"),
  locationUpdateButton: document.querySelector("#locationUpdateButton"),
  locationSearchForm: document.querySelector("#locationSearchForm"),
  locationSearchInput: document.querySelector("#locationSearchInput"),
  locationClearButton: document.querySelector("#locationClearButton"),
  locationCurrentName: document.querySelector("#locationCurrentName"),
  locationIdle: document.querySelector("#locationIdle"),
  locationRecents: document.querySelector("#locationRecents"),
  locationRecentList: document.querySelector("#locationRecentList"),
  locationSearchResults: document.querySelector("#locationSearchResults"),
  voiceInputButton: document.querySelector("#voiceInputButton"),
  voiceDialog: document.querySelector("#voiceDialog"),
  voiceStatus: document.querySelector("#voiceStatus"),
  voiceExamples: document.querySelector("#voiceExamples"),
  voiceTranscriptPanel: document.querySelector("#voiceTranscriptPanel"),
  voiceTranscript: document.querySelector("#voiceTranscript"),
  voiceChanges: document.querySelector("#voiceChanges"),
  voiceUpdateNote: document.querySelector("#voiceUpdateNote"),
  voiceDialogCloseButton: document.querySelector("#voiceDialogCloseButton"),
  voiceListenButton: document.querySelector("#voiceListenButton"),
  voiceApplyButton: document.querySelector("#voiceApplyButton"),
};

let activeWeatherRequestId = 0;
let checkedLabelTimer = null;
let activeVoiceSession = null;
let retainedVoiceMeter = null;
let voiceDebugSession = 0;
let voiceDebugStartedAt = performance.now();
const voiceDebugEntries = [];

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

const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

function parseSpokenNumberCore(value) {
  const normalized = value.toLowerCase().replace(/-/g, " ");
  const includesHalf = /\b(?:and\s+)?(?:a\s+)?half\b/.test(normalized);
  const withoutHalf = normalized.replace(/\b(?:and\s+)?(?:a\s+)?half\b/, " ");
  const numeric = withoutHalf.match(/\d+(?:[.,]\d+)?/);
  if (numeric) return Number(numeric[0].replace(",", ".")) + (includesHalf ? 0.5 : 0);
  const words = withoutHalf.split(/\s+/);
  let total = 0;
  let found = false;
  let decimal = "";
  let afterPoint = false;
  for (const word of words) {
    if (word === "point") {
      if (!found) continue;
      afterPoint = true;
      continue;
    }
    if (word === "and" || word === "a") continue;
    const number = NUMBER_WORDS[word];
    if (number === undefined) {
      if (found) break;
      continue;
    }
    found = true;
    if (afterPoint) decimal += String(number);
    else total += number;
  }
  if (!found) return null;
  return Number(`${total}${decimal ? `.${decimal}` : ""}`) + (includesHalf ? 0.5 : 0);
}

function parseSpokenNumber(value) {
  const parts = value.split(/\b(?:actually|sorry|i\s+mean|make\s+that|no)\b/i);
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const parsed = parseSpokenNumberCore(parts[index]);
    if (parsed !== null) return parsed;
  }
  return null;
}

const VOICE_FIELD_BOUNDARY = /\b(?:(?:indoor|room)\s+(?:temperature|temp)|(?:indoor\s+)?(?:relative\s+)?humidity|(?:indoor\s+)?rh|room\s+(?:is|at)|(?:temperature|temp))\b/;
const NEGATED_FIELD = /\b(?:do\s+not|don't|dont)\s+(?:change|update|set)(?:\s+(?:the|my|indoor|room|target|minimum|relative)){0,4}\s*$/;

function lastValueAfterLabel(text, pattern, excludedPattern = null) {
  const matches = text.matchAll(new RegExp(pattern.source, `${pattern.flags}g`));
  let value = null;
  for (const match of matches) {
    const before = text.slice(0, match.index);
    if (NEGATED_FIELD.test(before) || excludedPattern?.test(before)) continue;
    const valueStart = match.index + match[0].length;
    const nextField = text.slice(valueStart).match(VOICE_FIELD_BOUNDARY);
    const valueEnd = nextField ? valueStart + nextField.index : text.length;
    value = parseSpokenNumber(text.slice(valueStart, valueEnd));
  }
  return value;
}

function lastValueBeforeUnit(text, unitType) {
  const units = [...text.matchAll(/\b(?:degrees?|celsius|c|percent|per\s+cent)\b/g)];
  let previousEnd = 0;
  let value = null;
  for (const unit of units) {
    const isPercent = /^(?:percent|per\s+cent)$/.test(unit[0]);
    if ((unitType === "percent") === isPercent) {
      const segment = text.slice(previousEnd, unit.index);
      const isPlanValue = unitType === "percent"
        ? /\btarget(?:\s+indoor)?(?:\s+relative)?\s+(?:humidity|rh)\b/.test(segment)
        : /\b(?:minimum|min)\s+(?:indoor\s+)?(?:temperature|temp)\b/.test(segment);
      if (!isPlanValue) value = parseSpokenNumber(segment);
    }
    previousEnd = unit.index + unit[0].length;
  }
  return value;
}

function inferUnlabelledIndoorValues(text) {
  const correctedPhrase = text.split(/\b(?:actually|sorry|i\s+mean|make\s+that|no)\b/i).at(-1);
  const numberTokens = [...correctedPhrase.matchAll(/\d+(?:\.\d+)?/g)].map((match) => ({
    value: Number(match[0]),
    hasDecimal: match[0].includes("."),
  }));
  if (numberTokens.length === 0 || numberTokens.length > 2) return {};

  const isTemperature = (number) => number >= 10 && number <= 32;
  const isHumidity = (number) => Number.isInteger(number) && number >= 20 && number <= 90;
  if (numberTokens.length === 1) {
    const [{ value, hasDecimal }] = numberTokens;
    if (hasDecimal && isTemperature(value)) return { indoorTemp: value };
    if (isTemperature(value) && !isHumidity(value)) return { indoorTemp: value };
    if (isHumidity(value) && !isTemperature(value)) return { indoorRh: value };
    return {};
  }

  const [first, second] = numberTokens;
  const temperatureFirst = isTemperature(first.value) && isHumidity(second.value);
  const temperatureSecond = isTemperature(second.value) && isHumidity(first.value);
  if (temperatureFirst && !temperatureSecond) return { indoorTemp: first.value, indoorRh: second.value };
  if (temperatureSecond && !temperatureFirst) return { indoorTemp: second.value, indoorRh: first.value };
  if (temperatureFirst && temperatureSecond) return { indoorTemp: first.value, indoorRh: second.value };
  return {};
}

function parseVoiceCommand(transcript) {
  const text = transcript.toLowerCase()
    .replace(/°\s*c?/g, " degrees ")
    .replace(/%/g, " percent ")
    .replace(/,/g, " ");
  const values = {};
  const errors = [];
  let indoorTemp = lastValueAfterLabel(
    text,
    /\b(?:(?:indoor|room)\s+(?:temperature|temp)|(?:temperature|temp)|room\s+(?:is|at))\b/,
    /\b(?:minimum|min)(?:\s+indoor)?\s*$/,
  );
  let indoorRh = lastValueAfterLabel(
    text,
    /\b(?:(?:indoor\s+)?(?:relative\s+)?humidity|(?:indoor\s+)?rh)\b/,
    /\btarget(?:\s+indoor)?(?:\s+relative)?\s*$/,
  );
  if (indoorTemp === null) indoorTemp = lastValueBeforeUnit(text, "temperature");
  if (indoorRh === null) indoorRh = lastValueBeforeUnit(text, "percent");
  const hasLabelsOrUnits = VOICE_FIELD_BOUNDARY.test(text)
    || /\b(?:degrees?|celsius|c|percent|per\s+cent)\b/.test(text);
  if (indoorTemp === null && indoorRh === null && !hasLabelsOrUnits) {
    const inferred = inferUnlabelledIndoorValues(text);
    indoorTemp = inferred.indoorTemp ?? null;
    indoorRh = inferred.indoorRh ?? null;
  }
  if (indoorTemp !== null) {
    if (indoorTemp < 10 || indoorTemp > 32) errors.push("Indoor temperature must be between 10 and 32.");
    else values.indoorTemp = Number(indoorTemp.toFixed(1));
  }
  if (indoorRh !== null) {
    if (indoorRh < 20 || indoorRh > 90) errors.push("Indoor humidity must be between 20 and 90.");
    else values.indoorRh = Math.round(indoorRh);
  }
  return { values, errors };
}

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
  if (indoorDialog.open) elements.voiceInputButton.focus({ preventScroll: true });
}

function applyVoiceChanges() {
  if (!pendingVoiceChanges) return;
  Object.assign(state, pendingVoiceChanges);
  saveIndoorReadings();
  closeVoiceDialog();
  render();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function numberInRange(value, min, max, fallback) {
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

function saturationVaporPressure(tempC) {
  return 6.112 * Math.exp((17.67 * tempC) / (tempC + 243.5));
}

function vaporPressure(tempC, relativeHumidity) {
  return saturationVaporPressure(tempC) * (relativeHumidity / 100);
}

function dewPoint(tempC, relativeHumidity) {
  const gamma = Math.log(relativeHumidity / 100) + (17.67 * tempC) / (243.5 + tempC);
  return (243.5 * gamma) / (17.67 - gamma);
}

function absoluteHumidity(tempC, relativeHumidity) {
  return (216.7 * vaporPressure(tempC, relativeHumidity)) / (tempC + 273.15);
}

function relativeHumidityAtTemperature(actualVaporPressure, newTempC) {
  return (actualVaporPressure / saturationVaporPressure(newTempC)) * 100;
}

function humidityRatioFromVaporPressure(actualVaporPressure, pressureHpa) {
  return (0.62198 * actualVaporPressure) / (pressureHpa - actualVaporPressure);
}

function vaporPressureFromHumidityRatio(ratio, pressureHpa) {
  return (ratio * pressureHpa) / (0.62198 + ratio);
}

function humidityRatio(tempC, relativeHumidity, pressureHpa = DEFAULT_PRESSURE_HPA) {
  return humidityRatioFromVaporPressure(vaporPressure(tempC, relativeHumidity), pressureHpa);
}

function formatTemp(value) {
  return `${value.toFixed(1)}\u00b0C`;
}

function formatRh(value) {
  return `${Math.round(value)}%`;
}

function formatMoisture(value) {
  return `${value.toFixed(1)} g/m3`;
}

function formatShortTime(date) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: state.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    state.timezone = DEFAULT_TIMEZONE;
    return formatShortTime(date);
  }
}

function updateWeatherCheckedLabel() {
  if (checkedLabelTimer !== null) clearTimeout(checkedLabelTimer);
  checkedLabelTimer = null;
  if (state.weatherRequestPending || state.weatherLoadFailed || !state.lastSuccessfulUpdateAt) return;
  const elapsed = Math.max(0, Date.now() - state.lastSuccessfulUpdateAt.getTime());
  if (elapsed < 60_000) {
    elements.weatherStatus.textContent = "Checked just now";
    checkedLabelTimer = setTimeout(updateWeatherCheckedLabel, 60_000 - elapsed);
  } else {
    elements.weatherStatus.textContent = `Checked ${formatShortTime(state.lastSuccessfulUpdateAt)}`;
  }
}

function formatWeatherTimestamp(date) {
  const options = { dateStyle: "medium", timeStyle: "short" };
  try {
    return new Intl.DateTimeFormat("en-GB", {
      ...options,
      timeZone: state.timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-GB", options).format(date);
  }
}

function formatDuration(minutes) {
  if (!Number.isFinite(minutes)) return "--";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours} hr ${remaining} min` : `${hours} hr`;
}

function minutesSince(date) {
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
}

function dateFromApiTime(value) {
  return new Date(typeof value === "number" ? value * 1000 : value);
}

function roomVolume() {
  if (state.roomPreset !== "custom") return ROOM_PRESETS[state.roomPreset] ?? ROOM_PRESETS.medium;
  return state.roomLength * state.roomWidth * state.roomHeight;
}

function baseAirflow() {
  if (state.openingSetup === "custom") return state.customAirflow;
  return OPENING_SETUPS[state.openingSetup]?.airflow ?? OPENING_SETUPS.single.airflow;
}

function effectiveAirExchange(weather, indoorTemp) {
  const windKmh = Number.isFinite(weather.wind) ? weather.wind : 0;
  const temperatureDifference = Math.abs(indoorTemp - weather.temp);
  const conditionMultiplier = clamp(0.65 + windKmh / 40 + temperatureDifference / 30, 0.65, 2);
  const airflow = baseAirflow() * conditionMultiplier;
  return {
    airflow,
    airChangesPerHour: clamp(airflow / roomVolume(), 0.1, 12),
  };
}

function absoluteHumidityUncertainty(tempC, rh, tempError, rhError) {
  const temperatureContribution =
    (absoluteHumidity(tempC + tempError, rh) - absoluteHumidity(tempC - tempError, rh)) / 2;
  const humidityContribution =
    (absoluteHumidity(tempC, clamp(rh + rhError, 1, 100)) -
      absoluteHumidity(tempC, clamp(rh - rhError, 1, 100))) /
    2;
  return Math.hypot(temperatureContribution, humidityContribution);
}

function moistureMargin(indoorTemp, indoorRh, outdoorTemp, outdoorRh) {
  const indoorError = absoluteHumidityUncertainty(
    indoorTemp,
    indoorRh,
    INPUT_UNCERTAINTY.indoorTemp,
    INPUT_UNCERTAINTY.indoorRh,
  );
  const outdoorError = absoluteHumidityUncertainty(
    outdoorTemp,
    outdoorRh,
    INPUT_UNCERTAINTY.outdoorTemp,
    INPUT_UNCERTAINTY.outdoorRh,
  );
  return Math.max(MINIMUM_MOISTURE_MARGIN, Math.hypot(indoorError, outdoorError));
}

function compareMoisture(indoorTemp, indoorRh, outdoorTemp, outdoorRh) {
  const indoor = absoluteHumidity(indoorTemp, indoorRh);
  const outdoor = absoluteHumidity(outdoorTemp, outdoorRh);
  const margin = moistureMargin(indoorTemp, indoorRh, outdoorTemp, outdoorRh);
  const difference = indoor - outdoor;
  return {
    indoor,
    outdoor,
    difference,
    margin,
    status: difference > margin ? "drier" : difference < -margin ? "wetter" : "uncertain",
  };
}
function forecastHasBecomeLessDry(startWeather, weather) {
  const startAbsolute = absoluteHumidity(startWeather.temp, startWeather.rh);
  const weatherAbsolute = absoluteHumidity(weather.temp, weather.rh);
  const startUncertainty = absoluteHumidityUncertainty(
    startWeather.temp,
    startWeather.rh,
    INPUT_UNCERTAINTY.outdoorTemp,
    INPUT_UNCERTAINTY.outdoorRh,
  );
  const weatherUncertainty = absoluteHumidityUncertainty(
    weather.temp,
    weather.rh,
    INPUT_UNCERTAINTY.outdoorTemp,
    INPUT_UNCERTAINTY.outdoorRh,
  );
  const changeMargin = Math.max(
    MINIMUM_MOISTURE_MARGIN,
    Math.hypot(startUncertainty, weatherUncertainty),
  );
  return weatherAbsolute > startAbsolute + changeMargin;
}

function saveIndoorReadings() {
  state.indoorLastSet = Date.now();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ indoorTemp: state.indoorTemp, indoorRh: state.indoorRh, indoorLastSet: state.indoorLastSet }),
  );
}

function savePlanSettings() {
  localStorage.setItem(
    PLAN_STORAGE_KEY,
    JSON.stringify({
      targetRh: state.targetRh,
      minTemp: state.minTemp,
      roomPreset: state.roomPreset,
      roomLength: state.roomLength,
      roomWidth: state.roomWidth,
      roomHeight: state.roomHeight,
      openingSetup: state.openingSetup,
      customAirflow: state.customAirflow,
    }),
  );
}

function loadIndoorReadings() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    state.indoorTemp = numberInRange(parsed.indoorTemp, 10, 32, state.indoorTemp);
    state.indoorRh = numberInRange(parsed.indoorRh, 20, 90, state.indoorRh);
    state.indoorLastSet = Number.isFinite(parsed.indoorLastSet) && parsed.indoorLastSet > 0 && parsed.indoorLastSet <= Date.now() ? parsed.indoorLastSet : null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function loadPlanSettings() {
  const saved = localStorage.getItem(PLAN_STORAGE_KEY);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    state.targetRh = numberInRange(parsed.targetRh, 40, 65, state.targetRh);
    state.minTemp = Math.round(numberInRange(parsed.minTemp, 16, 26, state.minTemp));
    if (ROOM_PRESETS[parsed.roomPreset] || parsed.roomPreset === "custom") {
      state.roomPreset = parsed.roomPreset;
    }
    state.roomLength = numberInRange(parsed.roomLength, 1, 20, state.roomLength);
    state.roomWidth = numberInRange(parsed.roomWidth, 1, 20, state.roomWidth);
    state.roomHeight = numberInRange(parsed.roomHeight, 1.8, 5, state.roomHeight);
    const migratedOpening = { slow: "slightly", normal: "single", fast: "cross" }[
      parsed.ventilationSpeed
    ];
    const opening = parsed.openingSetup ?? migratedOpening;
    if (OPENING_SETUPS[opening] || opening === "custom") state.openingSetup = opening;
    state.customAirflow = numberInRange(parsed.customAirflow, 10, 500, state.customAirflow);
  } catch {
    localStorage.removeItem(PLAN_STORAGE_KEY);
  }
}

function loadUiPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(UI_PREFERENCES_STORAGE_KEY));
    if (typeof saved?.showIndoorSummary === 'boolean') uiPreferences.showIndoorSummary = saved.showIndoorSummary;
    if (typeof saved?.openIndoorOnLaunch === 'boolean') uiPreferences.openIndoorOnLaunch = saved.openIndoorOnLaunch;
  } catch { /* Keep the defaults if browser storage is unavailable or invalid. */ }
  applyUiPreferences();
}

function applyUiPreferences() {
  document.documentElement.dataset.showIndoorSummary = String(uiPreferences.showIndoorSummary);
  elements.showIndoorSummary.checked = uiPreferences.showIndoorSummary;
  elements.openIndoorOnLaunch.checked = uiPreferences.openIndoorOnLaunch;
}

function saveUiPreferences() {
  try { localStorage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify(uiPreferences)); }
  catch { /* The switches still work for this page session. */ }
}


function buildForecast(data) {
  const times = data.hourly?.time ?? [];
  const temperatures = data.hourly?.temperature_2m ?? [];
  const humidities = data.hourly?.relative_humidity_2m ?? [];
  const dewPoints = data.hourly?.dew_point_2m ?? [];
  const pressures = data.hourly?.surface_pressure ?? [];
  const winds = data.hourly?.wind_speed_10m ?? [];

  return times
    .map((time, index) => ({
      time: dateFromApiTime(time),
      temp: temperatures[index],
      rh: humidities[index],
      dewPoint: dewPoints[index],
      pressure: pressures[index],
      wind: winds[index],
    }))
    .filter(
      (item) =>
        Number.isFinite(item.time.getTime()) &&
        Number.isFinite(item.temp) &&
        Number.isFinite(item.rh) &&
        Number.isFinite(item.dewPoint),
    )
    .map((item) => ({
      ...item,
      pressure: Number.isFinite(item.pressure) ? item.pressure : DEFAULT_PRESSURE_HPA,
      wind: Number.isFinite(item.wind) ? item.wind : 0,
    }));
}

function currentWeather() {
  return {
    time: new Date(),
    observationTime: dateFromApiTime(state.updatedAt),
    temp: state.outdoorTemp,
    rh: state.outdoorRh,
    dewPoint: Number.isFinite(state.outdoorDewPoint)
      ? state.outdoorDewPoint
      : dewPoint(state.outdoorTemp, state.outdoorRh),
    pressure: state.outdoorPressure,
    wind: state.outdoorWind,
  };
}

function buildWeatherTimeline() {
  if (state.outdoorTemp === null || state.outdoorRh === null) return [];
  const current = currentWeather();
  return [current, ...state.forecast.filter((item) => item.time > current.time)];
}

function weatherAtTime(timeline, targetTime) {
  if (timeline.length === 1 || targetTime <= timeline[0].time) return timeline[0];

  let previous = timeline[0];
  for (const next of timeline.slice(1)) {
    if (targetTime <= next.time) {
      const interval = next.time.getTime() - previous.time.getTime();
      const progress = interval > 0 ? (targetTime.getTime() - previous.time.getTime()) / interval : 0;
      const temp = previous.temp + (next.temp - previous.temp) * progress;
      const dew = previous.dewPoint + (next.dewPoint - previous.dewPoint) * progress;
      const pressure = previous.pressure + (next.pressure - previous.pressure) * progress;
      const wind = previous.wind + (next.wind - previous.wind) * progress;
      return {
        time: targetTime,
        temp,
        dewPoint: dew,
        pressure,
        wind,
        rh: clamp(relativeHumidityAtTemperature(saturationVaporPressure(dew), temp), 0, 100),
      };
    }
    previous = next;
  }

  return { ...timeline.at(-1), time: targetTime };
}

function planResult(status, overrides = {}) {
  return {
    status,
    minutes: null,
    limitMinutes: 0,
    projectedTemp: state.indoorTemp,
    projectedRh: state.indoorRh,
    ...overrides,
  };
}

function hasMeaningfulRhImprovement(projectedRh) {
  return state.indoorRh - projectedRh >= MINIMUM_NOTICEABLE_RH_CHANGE;
}

function projectedDryAirHorizon(startWeather, timeline) {
  const startTime = startWeather.time instanceof Date ? startWeather.time : new Date();
  let projectedRatio = humidityRatio(
    state.indoorTemp,
    state.indoorRh,
    startWeather.pressure ?? state.outdoorPressure,
  );
  let projectedTemp = state.indoorTemp;

  for (let minute = 1; minute <= MAX_OPEN_MINUTES; minute += 1) {
    const weather = weatherAtTime(
      timeline,
      new Date(startTime.getTime() + minute * 60 * 1000),
    );
    const pressure = Number.isFinite(weather.pressure)
      ? weather.pressure
      : state.outdoorPressure;
    const projectedVapor = vaporPressureFromHumidityRatio(projectedRatio, pressure);
    const projectedRh = clamp(
      relativeHumidityAtTemperature(projectedVapor, projectedTemp),
      0,
      100,
    );
    const comparison = compareMoisture(
      projectedTemp,
      projectedRh,
      weather.temp,
      weather.rh,
    );
    if (comparison.status !== "drier") {
      return { minutes: minute - 1, capped: false };
    }

    const exchange = effectiveAirExchange(weather, projectedTemp);
    const airExchangeFraction = 1 - Math.exp(-exchange.airChangesPerHour / 60);
    const heatChangesPerHour = exchange.airChangesPerHour * THERMAL_RESPONSE_FACTOR;
    const heatExchangeFraction = 1 - Math.exp(-heatChangesPerHour / 60);
    const outdoorRatio = humidityRatio(weather.temp, weather.rh, pressure);
    projectedRatio += (outdoorRatio - projectedRatio) * airExchangeFraction;
    projectedTemp += (weather.temp - projectedTemp) * heatExchangeFraction;
  }

  return { minutes: MAX_OPEN_MINUTES, capped: true };
}

function estimateOpeningWindowPlan(startWeather, timeline) {
  if (state.indoorRh <= state.targetRh + TARGET_MARGIN_RH) return planResult("target-met");
  if (state.indoorTemp < state.minTemp) return planResult("below-minimum");

  const initialComparison = compareMoisture(
    state.indoorTemp,
    state.indoorRh,
    startWeather.temp,
    startWeather.rh,
  );
  if (initialComparison.status === "wetter") return planResult("wetter");
  if (initialComparison.status === "uncertain") return planResult("uncertain");

  const startTime = startWeather.time instanceof Date ? startWeather.time : new Date();
  let projectedRatio = humidityRatio(
    state.indoorTemp,
    state.indoorRh,
    startWeather.pressure ?? state.outdoorPressure,
  );
  const initialAbsolute = initialComparison.indoor;
  let projectedTemp = state.indoorTemp;
  let projectedRh = state.indoorRh;
  let finalPressureHpa = startWeather.pressure ?? state.outdoorPressure;
  let lastComfortableMinute = 0;
  let lastComfortableTemp = state.indoorTemp;
  let lastComfortableRh = state.indoorRh;

  for (let minute = 1; minute <= MAX_OPEN_MINUTES; minute += 1) {
    const targetTime = new Date(startTime.getTime() + minute * 60 * 1000);
    const weather = weatherAtTime(timeline, targetTime);
    const projectedPressureHpa = Number.isFinite(weather.pressure)
      ? weather.pressure
      : state.outdoorPressure;
    finalPressureHpa = projectedPressureHpa;
    const outdoorRatio = humidityRatio(weather.temp, weather.rh, projectedPressureHpa);
    const projectedVaporBeforeMixing = vaporPressureFromHumidityRatio(
      projectedRatio,
      projectedPressureHpa,
    );
    const projectedRhBeforeMixing = clamp(
      relativeHumidityAtTemperature(projectedVaporBeforeMixing, projectedTemp),
      0,
      100,
    );
    const usefulness = compareMoisture(
      projectedTemp,
      projectedRhBeforeMixing,
      weather.temp,
      weather.rh,
    );

    if (usefulness.status !== "drier") {
      const status = forecastHasBecomeLessDry(startWeather, weather)
        ? "forecast-limit"
        : "settling";
      if (!hasMeaningfulRhImprovement(projectedRhBeforeMixing)) {
        return planResult("minimal-impact", {
          limitMinutes: minute - 1,
          projectedTemp,
          projectedRh: projectedRhBeforeMixing,
        });
      }
      return planResult(status, {
        minutes: minute > 1 ? minute - 1 : null,
        limitMinutes: minute - 1,
        projectedTemp,
        projectedRh: projectedRhBeforeMixing,
      });
    }

    const exchange = effectiveAirExchange(weather, projectedTemp);
    const airExchangeFraction = 1 - Math.exp(-exchange.airChangesPerHour / 60);
    const heatChangesPerHour = exchange.airChangesPerHour * THERMAL_RESPONSE_FACTOR;
    const heatExchangeFraction = 1 - Math.exp(-heatChangesPerHour / 60);
    projectedRatio += (outdoorRatio - projectedRatio) * airExchangeFraction;
    projectedTemp += (weather.temp - projectedTemp) * heatExchangeFraction;

    const projectedVapor = vaporPressureFromHumidityRatio(projectedRatio, projectedPressureHpa);
    const saturation = saturationVaporPressure(projectedTemp);
    if (projectedVapor >= saturation) {
      if (lastComfortableMinute && !hasMeaningfulRhImprovement(lastComfortableRh)) {
        return planResult("minimal-impact", {
          limitMinutes: lastComfortableMinute,
          projectedTemp: lastComfortableTemp,
          projectedRh: lastComfortableRh,
        });
      }
      return planResult("condensation", {
        limitMinutes: minute - 1,
        projectedTemp: lastComfortableTemp,
        projectedRh: lastComfortableRh,
      });
    }

    projectedRh = relativeHumidityAtTemperature(projectedVapor, projectedTemp);
    if (projectedTemp < state.minTemp) {
      if (lastComfortableMinute && !hasMeaningfulRhImprovement(lastComfortableRh)) {
        return planResult("minimal-impact", {
          limitMinutes: lastComfortableMinute,
          projectedTemp: lastComfortableTemp,
          projectedRh: lastComfortableRh,
        });
      }
      return planResult("too-cold", {
        limitMinutes: lastComfortableMinute,
        projectedTemp: lastComfortableTemp,
        projectedRh: lastComfortableRh,
      });
    }

    lastComfortableMinute = minute;
    lastComfortableTemp = projectedTemp;
    lastComfortableRh = projectedRh;
    const projectedAbsolute = (216.7 * projectedVapor) / (projectedTemp + 273.15);
    const netImprovement = initialAbsolute - projectedAbsolute;
    if (
      projectedRh <= state.targetRh + TARGET_MARGIN_RH &&
      netImprovement > initialComparison.margin
    ) {
      return planResult("good", {
        minutes: minute,
        limitMinutes: minute,
        projectedTemp,
        projectedRh,
      });
    }
  }

  const finalVapor = vaporPressureFromHumidityRatio(projectedRatio, finalPressureHpa);
  const finalAbsolute = (216.7 * finalVapor) / (projectedTemp + 273.15);
  return planResult(
    hasMeaningfulRhImprovement(projectedRh) &&
      initialAbsolute - finalAbsolute > initialComparison.margin
      ? "slow"
      : "minimal-impact",
    {
      limitMinutes: lastComfortableMinute,
      projectedTemp,
      projectedRh,
    },
  );
}

function formatPlanSummary() {
  const minimum = state.minTemp.toFixed(1).replace(/\.0$/, "");
  return `Min ${minimum}°C · Target ${formatRh(state.targetRh)} RH`;
}

function formatVentilationSummary() {
  const volume = roomVolume().toFixed(1).replace(/\.0$/, "");
  const opening = state.openingSetup === "custom"
    ? `Custom airflow · ${state.customAirflow.toFixed(1).replace(/\.0$/, "")} m³/h`
    : state.openingSetup === "single"
      ? "One window open"
      : OPENING_SETUPS[state.openingSetup]?.label ?? OPENING_SETUPS.single.label;
  return `${volume} m³ · ${opening}`;
}

function renderPlanControls() {
  elements.targetRh.value = state.targetRh;
  elements.minTemp.value = state.minTemp;
  if (document.activeElement !== elements.targetRhInput) elements.targetRhInput.value = Math.round(state.targetRh);
  if (document.activeElement !== elements.minTempInput) elements.minTempInput.value = state.minTemp.toFixed(1).replace(".0", "");
  elements.roomPreset.querySelectorAll('input').forEach(input => { input.checked = input.value === state.roomPreset; });
  for (const key of ['roomLength', 'roomWidth', 'roomHeight', 'customAirflow']) {
    if (document.activeElement !== elements[key]) elements[key].value = state[key];
  }
  elements.roomVolume.textContent = `${roomVolume().toFixed(1).replace(".0", "")} m³`;
  document.querySelector('#customRoomVolume').textContent = `${(state.roomLength * state.roomWidth * state.roomHeight).toFixed(1).replace('.0', '')} m³`;
  elements.customRoomFields.hidden = state.roomPreset !== "custom";
  elements.openingSetup.querySelectorAll('input').forEach(input => { input.checked = input.value === state.openingSetup; });
  elements.customFlowField.hidden = state.openingSetup !== "custom";
  elements.planSummaryText.textContent = formatPlanSummary();
  elements.planSummaryVentilationText.textContent = formatVentilationSummary();
}

function renderPlan() {
  renderPlanControls();
  const timeline = buildWeatherTimeline();
  if (!timeline.length || state.weatherRequestPending || state.weatherLoadFailed) {
    elements.planConfidence.textContent = state.weatherLoadFailed ? "Outdoor data unavailable" : "Waiting for outdoor data...";
    return null;
  }
  const current = timeline[0];
  const plan = estimateOpeningWindowPlan(current, timeline);
  if (plan.status === "good") plan.dryAirHorizon = projectedDryAirHorizon(current, timeline);
  elements.planConfidence.textContent = 'Est. ' + effectiveAirExchange(current, state.indoorTemp).airChangesPerHour.toFixed(1) + ' air changes/hr';
  return plan;
}

function setDecisionLine(element, text, emphasizedDuration, emphasizeWhole) {
  element.replaceChildren();
  if (emphasizedDuration && text.includes(emphasizedDuration)) {
    const [prefix, suffix] = text.split(emphasizedDuration);
    const duration = document.createElement("strong");
    duration.textContent = emphasizedDuration;
    element.append(prefix, duration, suffix);
    return;
  }

  if (emphasizeWhole) {
    const emphasis = document.createElement("strong");
    emphasis.textContent = text;
    element.append(emphasis);
    return;
  }

  element.textContent = text;
}

function setDecisionSummary(primary, secondary, primaryDuration, secondaryDuration) {
  setDecisionLine(elements.decisionPrimary, primary, primaryDuration, true);
  setDecisionLine(elements.decisionSecondary, secondary, secondaryDuration, false);
}
function planTone(plan) {
  if (plan.status === "target-met") return "open";
  if (["good", "slow"].includes(plan.status)) return "windows";
  if (
    ["forecast-limit", "settling", "too-cold", "condensation"].includes(plan.status) &&
    (plan.minutes ?? plan.limitMinutes)
  ) {
    return "windows";
  }
  if (["below-minimum", "wetter"].includes(plan.status)) return "closed";
  if (["too-cold", "condensation"].includes(plan.status)) return "closed";
  return "caution";
}

function setToneClass(element, tone) {
  element.classList.remove("tone-open", "tone-windows", "tone-caution", "tone-closed");
  element.classList.add(`tone-${tone}`);
}
function renderRecommendation(plan) {
  elements.recommendation.classList.remove("open", "windows", "closed", "caution");
  elements.recommendation.classList.add(planTone(plan));
  const limited = ["too-cold", "condensation"].includes(plan.status);

  if (plan.status === "target-met") {
    elements.decisionLabel.textContent = "TARGET MET";
    setDecisionSummary(
      `At or near your ${formatRh(state.targetRh)} target.`,
      "No ventilation needed now.",
    );
  } else if (plan.status === "below-minimum") {
    elements.decisionLabel.textContent = "KEEP CLOSED";
    setDecisionSummary(
      `Room is below your ${formatTemp(state.minTemp)} minimum.`,
      "Ventilation would cool it further.",
    );
  } else if (plan.status === "wetter") {
    elements.decisionLabel.textContent = "KEEP CLOSED";
    setDecisionSummary(
      "Outdoor air contains more moisture.",
      "Opening would likely raise indoor humidity.",
    );
  } else if (plan.status === "uncertain") {
    elements.decisionLabel.textContent = "OPEN IF NEEDED";
    setDecisionSummary(
      "No clear drying benefit.",
      "Open briefly for fresh air; humidity may not fall.",
    );
  } else if (plan.status === "good") {
    elements.decisionLabel.textContent = "OPEN WINDOWS";
    const targetDuration = formatDuration(plan.minutes);
    const dryDuration = formatDuration(plan.dryAirHorizon.minutes);
    setDecisionSummary(
      `About ${targetDuration} to reach ${formatRh(state.targetRh)} RH.`,
      plan.dryAirHorizon.capped
        ? `At least ${dryDuration} of reliably drier air.`
        : `Up to ${dryDuration} of reliably drier air.`,
      targetDuration,
      dryDuration,
    );
  } else if (plan.status === "forecast-limit") {
    elements.decisionLabel.textContent = plan.limitMinutes ? "OPEN WINDOWS" : "OPEN IF NEEDED";
    const limitDuration = formatDuration(plan.limitMinutes);
    setDecisionSummary(
      plan.limitMinutes
        ? `Up to ${limitDuration} of reliably drier forecast air.`
        : "No clear drying benefit.",
      plan.limitMinutes
        ? `Estimated then: ${formatRh(plan.projectedRh)} RH at ${formatTemp(plan.projectedTemp)}.`
        : "Open briefly for fresh air; humidity may not fall.",
      plan.limitMinutes ? limitDuration : null,
    );
  } else if (plan.status === "settling") {
    elements.decisionLabel.textContent = plan.minutes ? "OPEN WINDOWS" : "OPEN IF NEEDED";
    const settlingDuration = formatDuration(plan.minutes);
    setDecisionSummary(
      plan.minutes
        ? `Up to ${settlingDuration} of useful drying.`
        : "No clear drying benefit.",
      plan.minutes
        ? `Estimated then: ${formatRh(plan.projectedRh)} RH at ${formatTemp(plan.projectedTemp)}.`
        : "Open briefly for fresh air; humidity may not fall.",
      plan.minutes ? settlingDuration : null,
    );
  } else if (limited) {
    elements.decisionLabel.textContent = plan.limitMinutes ? "OPEN WINDOWS" : "KEEP CLOSED";
    const limitDuration = formatDuration(plan.limitMinutes);
    const primary =
      plan.status === "too-cold"
        ? plan.limitMinutes
          ? `${limitDuration} to minimum indoor temperature.`
          : `Opening would drop it below ${formatTemp(state.minTemp)} now.`
        : plan.limitMinutes
          ? `${limitDuration} until condensation risk rises.`
          : "Opening may cause condensation now.";
    const secondary =
      plan.status === "condensation" && plan.limitMinutes
        ? "Stop then to limit condensation risk."
        : plan.limitMinutes
          ? `Estimated then: ${formatRh(plan.projectedRh)} RH at ${formatTemp(plan.projectedTemp)}.`
          : "No useful opening time is available.";
    setDecisionSummary(
      primary,
      secondary,
      plan.limitMinutes ? limitDuration : null,
    );
  } else if (plan.status === "slow") {
    elements.decisionLabel.textContent = "OPEN WINDOWS";
    const modelDuration = formatDuration(MAX_OPEN_MINUTES);
    setDecisionSummary(
      `More than ${modelDuration} to reach ${formatRh(state.targetRh)} RH.`,
      `Recheck within ${modelDuration}; drying will be slow.`,
      modelDuration,
      modelDuration,
    );
  } else if (plan.status === "minimal-impact") {
    elements.decisionLabel.textContent = "OPEN IF NEEDED";
    setDecisionSummary(
      "No clear drying benefit.",
      "Open briefly for fresh air; humidity may not fall.",
    );
  } else {
    elements.decisionLabel.textContent = "WAIT";
    setDecisionSummary("No clear drying benefit.", "Check conditions again later.");
  }
}

function planLimitingExplanation(plan, comparison) {
  const limitedAfter = Number.isFinite(plan.limitMinutes) && plan.limitMinutes > 0
    ? `after about ${formatDuration(plan.limitMinutes)}`
    : "almost immediately";

  switch (plan.status) {
    case "target-met":
      return `indoor humidity is already at or near your ${formatRh(state.targetRh)} target, so ventilation is not needed now.`;
    case "below-minimum":
      return `the room is already below your ${formatTemp(state.minTemp)} minimum, so opening would cool it further.`;
    case "wetter":
      return "opening would bring in air with more moisture and could raise indoor humidity.";
    case "uncertain":
      return "the model therefore recommends opening only if needed for fresh air.";
    case "good":
      return `the model estimates about ${formatDuration(plan.minutes)} to reach your ${formatRh(state.targetRh)} target.`;
    case "forecast-limit":
      return plan.limitMinutes
        ? `forecast air is expected to stop being reliably drier ${limitedAfter}.`
        : "the forecast does not stay reliably drier long enough for useful airing.";
    case "settling":
      return `the simulated indoor-outdoor moisture difference no longer clears the uncertainty allowance ${limitedAfter}.`;
    case "too-cold":
      return plan.limitMinutes
        ? `the room is estimated to reach your ${formatTemp(state.minTemp)} minimum ${limitedAfter}.`
        : `the room would fall below your ${formatTemp(state.minTemp)} minimum almost immediately.`;
    case "condensation":
      return plan.limitMinutes
        ? `the model predicts condensation risk ${limitedAfter}.`
        : "the model predicts condensation risk almost immediately.";
    case "slow":
      return `the model projects some drying, but does not reach your target within its ${MAX_OPEN_MINUTES / 60}-hour simulation.`;
    case "minimal-impact": {
      const projectedRhDrop = state.indoorRh - plan.projectedRh;
      if (projectedRhDrop < MINIMUM_NOTICEABLE_RH_CHANGE) {
        return "With this plan, opening a window isn't expected to lower the indoor humidity reading by even one percentage point.";
      }
      const projectedMoisture = absoluteHumidity(plan.projectedTemp, plan.projectedRh);
      if (comparison.indoor - projectedMoisture <= comparison.margin) {
        return "With this plan, the expected moisture reduction is within the margin of error, so the change is unclear.";
      }
      return "With this plan, the model does not predict a clear reduction in indoor moisture.";
    }
    default:
      return "the model does not find a clear drying benefit under the current settings.";
  }
}

function renderRecommendationExplanation(plan, comparison, adjustedRh, condensationRisk) {
  if (state.weatherRequestPending || state.weatherLoadFailed || state.outdoorTemp === null || state.outdoorRh === null) {
    const locationName = state.location.name || "the selected location";
    elements.explanationText.textContent = state.weatherLoadFailed
      ? `Outdoor weather is unavailable for ${locationName}. A recommendation cannot be made until current data is available.`
      : `Checking outdoor weather for ${locationName}. The recommendation will appear when current data arrives.`;
    return;
  }

  const percentDifference = (Math.abs(comparison.difference) / comparison.indoor) * 100;
  const relationship = comparison.status === "drier"
    ? `Outdoor air contains about ${percentDifference.toFixed(
        0,
      )}% less water vapour than indoors, more than the margin of error in the readings (about ±${comparison.margin.toFixed(
        1,
      )} g/m³).`
    : comparison.status === "wetter"
      ? `Outdoor air contains about ${percentDifference.toFixed(
        0,
      )}% more water vapour than indoors, more than the margin of error in the readings (about ±${comparison.margin.toFixed(
        1,
      )} g/m³).`
      : `Indoor and outdoor air contain similar amounts of water vapour, within the margin of error in the readings (about ±${comparison.margin.toFixed(
        1,
      )} g/m³).`;
  const adjustedHumidity = condensationRisk
    ? "If warmed to your room's current temperature, outdoor air would be at 100% RH"
    : `If warmed to your room's current temperature, it would be about ${formatRh(adjustedRh)} RH`;
  const sentences = [relationship];
  const limitingExplanation = planLimitingExplanation(plan, comparison);
  sentences.push(plan.status === "minimal-impact"
    ? `${adjustedHumidity}. ${limitingExplanation}`
    : `${adjustedHumidity}; ${limitingExplanation}`);
  elements.explanationText.textContent = sentences.join(" ");
}

function renderWeatherDataDetails() {
  elements.sourceLocationName.textContent = state.location.name || "Selected location";
  elements.liveWeatherRequest.href = weatherUrlForLocation(state.location);

  const lastSuccess = state.lastSuccessfulUpdateAt;
  if (state.weatherRequestPending) {
    elements.weatherDataStatus.textContent = lastSuccess
      ? `Weather refresh in progress. Last successful update: ${formatWeatherTimestamp(lastSuccess)}.`
      : "Weather update in progress. No successful update is available yet.";
  } else if (state.weatherLoadFailed) {
    const failedAt = state.lastCheckedAt
      ? `Latest refresh failed at ${formatWeatherTimestamp(state.lastCheckedAt)}.`
      : "The latest weather refresh failed.";
    elements.weatherDataStatus.textContent = lastSuccess
      ? `${failedAt} Last successful update: ${formatWeatherTimestamp(lastSuccess)}.`
      : `${failedAt} No successful weather data is available.`;
  } else {
    elements.weatherDataStatus.textContent = lastSuccess
      ? `Last successful update: ${formatWeatherTimestamp(lastSuccess)}.`
      : "No successful weather update is available yet.";
  }
}

function render() {
  renderAhChart();
  elements.indoorTemp.value = state.indoorTemp;
  elements.indoorRh.value = state.indoorRh;
  if (document.activeElement !== elements.indoorTempInput) elements.indoorTempInput.value = state.indoorTemp.toFixed(1);
  if (document.activeElement !== elements.indoorRhInput) elements.indoorRhInput.value = Math.round(state.indoorRh);
  renderReadingRulers();
  elements.indoorTempValue.textContent = formatTemp(state.indoorTemp);
  elements.indoorRhValue.textContent = formatRh(state.indoorRh);
  elements.indoorSummaryTemp.textContent = state.indoorTemp.toFixed(1);
  elements.indoorSummaryRh.textContent = String(Math.round(state.indoorRh));
  elements.warmingTemp.textContent = formatTemp(state.indoorTemp);

  const plan = renderPlan();
  renderWeatherDataDetails();
  const indoorDew = dewPoint(state.indoorTemp, state.indoorRh);
  const indoorAbsolute = absoluteHumidity(state.indoorTemp, state.indoorRh);
  elements.indoorDewPoint.textContent = formatTemp(indoorDew);
  elements.indoorAbsoluteHumidity.textContent = indoorAbsolute.toFixed(1);
  elements.outdoorAbsoluteHumidity.classList.remove("lower", "higher", "near");
  document.querySelector(".outdoor-card").classList.remove("lower", "higher", "near");

  const unavailable = state.weatherRequestPending || state.weatherLoadFailed || state.outdoorTemp === null || state.outdoorRh === null;
  elements.recommendation.dataset.weatherState = unavailable ? (state.weatherLoadFailed ? 'failed' : 'loading') : 'ready';
  elements.dashboardPanel.classList.toggle('weather-unavailable', unavailable);
  const refreshLabel = state.weatherLoadFailed ? 'Retry outdoor weather' : 'Refresh outdoor weather';
  elements.refreshWeather.setAttribute('aria-label', refreshLabel);
  elements.refreshWeather.title = refreshLabel;
  if (unavailable) {
    elements.recommendation.classList.remove("open", "windows", "closed", "caution");
    elements.decisionLabel.textContent = state.weatherLoadFailed
      ? "NO DATA"
      : "Checking";
    setDecisionSummary(
      state.weatherLoadFailed ? "Outdoor weather is currently unavailable." : "Getting local conditions...",
      state.weatherLoadFailed ? "Check your connection and try again." : "",
    );
    renderRecommendationExplanation(null, null, null, false);
    elements.outdoorTempValue.textContent = "--";
    elements.outdoorRhValue.textContent = "--";
    elements.outdoorDewPoint.textContent = "--";
    elements.outdoorAbsoluteHumidity.textContent = "--";
    elements.warmedOutdoorRh.textContent = "--";
    elements.adjustedAirNote.textContent = "";
    return;
  }

  const outdoorDew = Number.isFinite(state.outdoorDewPoint)
    ? state.outdoorDewPoint
    : dewPoint(state.outdoorTemp, state.outdoorRh);
  const comparison = compareMoisture(
    state.indoorTemp,
    state.indoorRh,
    state.outdoorTemp,
    state.outdoorRh,
  );
  const outdoorVaporPressure = saturationVaporPressure(outdoorDew);
  const adjustedRh = relativeHumidityAtTemperature(outdoorVaporPressure, state.indoorTemp);
  const condensationRisk = adjustedRh >= 100;
  const displayedAdjustedRh = Math.min(adjustedRh, 100);

  elements.outdoorTempValue.textContent = formatTemp(state.outdoorTemp);
  elements.outdoorRhValue.textContent = formatRh(state.outdoorRh);
  elements.outdoorDewPoint.textContent = formatTemp(outdoorDew);
  elements.outdoorAbsoluteHumidity.textContent = comparison.outdoor.toFixed(1);
  elements.warmedOutdoorRh.textContent = formatRh(displayedAdjustedRh);
  elements.adjustedAirNote.textContent = condensationRisk ? "Condensation risk" : "";
  elements.outdoorAbsoluteHumidity.classList.toggle("lower", comparison.status === "drier");
  elements.outdoorAbsoluteHumidity.classList.toggle("higher", comparison.status === "wetter");
  elements.outdoorAbsoluteHumidity.classList.toggle("near", comparison.status === "uncertain");

  document.querySelector(".outdoor-card").classList.add(comparison.status === "drier" ? "lower" : comparison.status === "wetter" ? "higher" : "near");

  renderRecommendation(plan);
  renderRecommendationExplanation(plan, comparison, displayedAdjustedRh, condensationRisk);
}

function weatherUrlForLocation(location = state.location) {
  const params = new URLSearchParams({
    latitude: location.latitude.toFixed(4),
    longitude: location.longitude.toFixed(4),
    current: "temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,wind_speed_10m",
    hourly: "temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,wind_speed_10m",
    forecast_hours: "50",
    timeformat: "unixtime",
    timezone: "auto",
  });
  return `${WEATHER_ENDPOINT}?${params}`;
}

function updateLocationUi() {
  const locationName = state.location.name || "Selected location";
  elements.locationName.textContent = locationName;
  elements.sourceLocationName.textContent = locationName;
  elements.liveWeatherRequest.href = weatherUrlForLocation();
}

function saveLocation() {
  try {
    localStorage.setItem(
      LOCATION_STORAGE_KEY,
      JSON.stringify({ location: state.location, mode: state.locationMode }),
    );
  } catch {
    // Location selection still works when browser storage is unavailable.
  }
}

function loadLocation() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCATION_STORAGE_KEY));
    const location = saved?.location;
    if (
      location &&
      typeof location.name === "string" &&
      Number.isFinite(location.latitude) &&
      Number.isFinite(location.longitude)
    ) {
      state.location = location;
      state.locationMode = "current";
      return true;
    }
  } catch {
    localStorage.removeItem(LOCATION_STORAGE_KEY);
  }
  return false;
}

function hasRequestedLocation() {
  try {
    return localStorage.getItem(LOCATION_REQUESTED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function markLocationRequested() {
  try {
    localStorage.setItem(LOCATION_REQUESTED_STORAGE_KEY, "true");
  } catch {
    // The browser may request location again when storage is unavailable.
  }
}

function setLocation(location, mode) {
  activeWeatherRequestId += 1;
  if (checkedLabelTimer !== null) clearTimeout(checkedLabelTimer);
  checkedLabelTimer = null;
  state.location = location;
  state.locationMode = mode;
  state.outdoorTemp = null;
  state.outdoorRh = null;
  state.outdoorDewPoint = null;
  state.forecast = [];
  state.updatedAt = null;
  state.lastCheckedAt = null;
  state.lastSuccessfulUpdateAt = null;
  state.weatherRequestPending = false;
  state.weatherLoadFailed = false;
  saveLocation();
  updateLocationUi();
  render();
}


function formatBrowserLocation(data) {
  const locality = data.locality || data.city || "Nearby location";
  const county = data.localityInfo?.administrative?.find((item) =>
    /county/i.test(item.description || ""),
  )?.name;
  const area = county || (data.city !== locality ? data.city : data.principalSubdivision);
  const label = area && area !== locality ? `${locality}, ${area}` : locality;
  return LOCATION_LABEL_OVERRIDES.get(label) || label;
}

async function reverseGeocodeLocation(latitude, longitude) {
  const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), localityLanguage: "en" });
  const response = await fetch(`${REVERSE_GEOCODING_ENDPOINT}?${params}`);
  if (!response.ok) throw new Error("Reverse geocoding failed");
  return formatBrowserLocation(await response.json());
}

function formatSearchLocation(result) {
  if (result.source === "postcode") {
    return [result.postcode, result.admin_district || result.region].filter(Boolean).join(", ");
  }
  if (result.source === "outcode") {
    const districts = Array.isArray(result.admin_district)
      ? result.admin_district.filter(Boolean).join(" / ")
      : result.admin_district;
    return [result.outcode, districts].filter(Boolean).join(", ");
  }
  const parts = [result.name, result.admin2 || result.admin1, result.country].filter(Boolean);
  return [...new Set(parts)].join(", ");
}

function normalizeUkPostcode(query) {
  const compact = query.toUpperCase().replace(/\s+/g, "");
  if (!/^(GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/.test(compact)) return null;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

function normalizeUkOutcode(query) {
  const compact = query.toUpperCase().replace(/\s+/g, "");
  return /^[A-Z]{1,2}\d[A-Z\d]?$/.test(compact) ? compact : null;
}

async function searchUkPostcode(postcode) {
  const response = await fetch(`${UK_POSTCODE_ENDPOINT}/${encodeURIComponent(postcode)}`);
  if (response.status === 404) return [];
  if (!response.ok) throw new Error("Postcode search failed");
  const data = await response.json();
  if (!data.result) return [];
  return [{ ...data.result, source: "postcode" }];
}

async function searchUkOutcode(outcode) {
  const response = await fetch(`${UK_OUTCODE_ENDPOINT}/${encodeURIComponent(outcode)}`);
  if (response.status === 404) return [];
  if (!response.ok) throw new Error("Outward-code search failed");
  const data = await response.json();
  if (!data.result) return [];
  return [{ ...data.result, source: "outcode" }];
}

function locationMatchesQualifier(result, qualifier) {
  if (!qualifier) return true;
  const fields = [result.admin1, result.admin2, result.admin3, result.admin4, result.country];
  return fields.some((field) => field?.toLowerCase().includes(qualifier.toLowerCase()));
}

async function searchTownLocations(query, worldwide = false) {
  const [town, qualifier = ""] = query.split(",", 2).map((part) => part.trim());
  const params = new URLSearchParams({
    name: worldwide ? query : town,
    count: worldwide ? "5" : "20",
    language: "en",
    format: "json",
  });
  if (!worldwide) params.set("countryCode", "GB");
  const response = await fetch(`${GEOCODING_ENDPOINT}?${params}`);
  if (!response.ok) throw new Error("Location search failed");
  const data = await response.json();
  const results = Array.isArray(data.results) ? data.results : [];
  if (worldwide) return results.slice(0, 5);
  if (!qualifier) return results.slice(0, 4);

  const matching = results.filter((result) => locationMatchesQualifier(result, qualifier));
  return (matching.length ? matching : results).slice(0, 4);
}

async function searchLocations(query, worldwide = false) {
  const postcode = normalizeUkPostcode(query);
  if (postcode && !worldwide) return searchUkPostcode(postcode);
  const outcode = normalizeUkOutcode(query);
  if (outcode && !worldwide) return searchUkOutcode(outcode);
  return searchTownLocations(query, worldwide);
}

function isUkPostcodeQuery(query) {
  return Boolean(normalizeUkPostcode(query) || normalizeUkOutcode(query));
}

function validHistoryLocation(location) {
  return location && typeof location.name === "string" && location.name.trim() &&
    Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90 &&
    Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180;
}

function sameLocation(a, b) {
  return a.latitude === b.latitude && a.longitude === b.longitude;
}

function saveLocationHistory() {
  try { localStorage.setItem(LOCATION_HISTORY_STORAGE_KEY, JSON.stringify(recentLocations)); } catch {}
}

function loadLocationHistory(hasSavedLocation) {
  let stored;
  try { stored = localStorage.getItem(LOCATION_HISTORY_STORAGE_KEY); } catch {}
  if (stored == null) {
    recentLocations = hasSavedLocation ? [{ ...state.location }] : [];
    saveLocationHistory();
    return;
  }
  try {
    const parsed = JSON.parse(stored);
    recentLocations = Array.isArray(parsed) ? parsed.filter(validHistoryLocation)
      .filter((location, index, all) => all.findIndex(other => sameLocation(location, other)) === index).slice(0, 3) : [];
  } catch { recentLocations = []; }
}

function rememberLocation(location) {
  recentLocations = [{ ...location }, ...recentLocations.filter(other => !sameLocation(location, other))].slice(0, 3);
  saveLocationHistory();
}

async function selectLocation(location) {
  locationAttemptId += 1;
  locationFinding = false;
  locationStatus = "";
  locationRetry = false;
  rememberLocation(location);
  setLocation(location, "search");
  closeLocationDialog();
  await fetchWeather();
}

function renderRecentLocations() {
  elements.locationRecentList.replaceChildren();
  elements.locationRecents.hidden = recentLocations.length === 0;
  recentLocations.forEach((location, index) => {
    const row = document.createElement("div");
    row.className = "location-recent-row";
    const select = document.createElement("button");
    select.type = "button";
    select.className = "location-recent-select";
    const name = document.createElement("span");
    name.textContent = location.name;
    select.append(name);
    if (sameLocation(location, state.location)) {
      select.setAttribute("aria-current", "location");
    }
    select.addEventListener("click", () => selectLocation(location));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "location-remove-button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove ${location.name} from recent places`);
    remove.title = "Remove from recent places";
    remove.addEventListener("click", () => {
      recentLocations.splice(index, 1);
      saveLocationHistory();
      renderRecentLocations();
      const buttons = elements.locationRecentList.querySelectorAll(".location-remove-button");
      const next = buttons[Math.min(index, buttons.length - 1)];
      // The location action is disabled while locating, so search is the fallback then.
      (next || (locationFinding ? elements.locationSearchInput : elements.locationUpdateButton)).focus();
    });
    row.append(select, remove);
    elements.locationRecentList.append(row);
  });
}

function renderLocationIdle() {
  const typing = elements.locationSearchInput.value.trim().length > 0;
  elements.locationIdle.hidden = typing;
  elements.locationSearchResults.hidden = !typing;
  elements.locationClearButton.hidden = elements.locationSearchInput.value.length === 0;
  elements.locationCurrentName.textContent = state.location.name;
  elements.locationUpdateButton.disabled = locationFinding;
  elements.locationUpdateButton.textContent = locationFinding ? "Finding your location…" : locationRetry ? "Try again" : "Use current location";
  if (!typing) {
    elements.locationDialogStatus.textContent = locationStatus;
    renderRecentLocations();
  }
}

function cancelLocationSearch() {
  clearTimeout(locationSearchTimer);
  locationSearchRequestId += 1;
}

function handleLocationInput() {
  cancelLocationSearch();
  elements.locationSearchResults.replaceChildren();
  renderLocationIdle();
  const query = elements.locationSearchInput.value.trim();
  if (!query) return;
  elements.locationDialogStatus.textContent = query.length < 2 ? "Enter at least two characters." : "Searching…";
  if (query.length >= 2) locationSearchTimer = setTimeout(() => runLocationSearch(query), 300);
}

function addWorldwideSearchButton(query) {
  const button = document.createElement("button");
  button.className = "location-worldwide-button";
  button.type = "button";
  button.textContent = "Search worldwide";
  button.addEventListener("click", () => runLocationSearch(query, true));
  elements.locationSearchResults.append(button);
}

function renderLocationResults(results, query, worldwide = false) {
  elements.locationSearchResults.replaceChildren();

  if (!results.length) {
    const isPostcode = isUkPostcodeQuery(query);
    elements.locationDialogStatus.textContent = isPostcode
      ? "Postcode not found. Check it and try again."
      : worldwide
        ? "No matching locations found."
        : "No UK locations found.";
    if (!isPostcode && !worldwide) addWorldwideSearchButton(query);
    return;
  }

  results.forEach((result) => {
    const button = document.createElement("button");
    button.className = "location-result-button";
    button.type = "button";
    const label = formatSearchLocation(result);
    const [primary, ...secondary] = label.split(", ");
    const name = document.createElement("strong");
    name.textContent = primary;
    button.append(name);
    if (secondary.length) {
      const region = document.createElement("span");
      region.textContent = secondary.join(", ");
      button.append(region);
    }
    button.addEventListener("click", () => selectLocation({
      name: label, latitude: result.latitude, longitude: result.longitude,
    }));
    elements.locationSearchResults.append(button);
  });

  if (!worldwide && !isUkPostcodeQuery(query)) addWorldwideSearchButton(query);
}

async function handleLocationSearch(event) {
  event.preventDefault();
  clearTimeout(locationSearchTimer);
  const query = elements.locationSearchInput.value.trim();
  if (query.length < 2) {
    handleLocationInput();
    return;
  }
  await runLocationSearch(query);
}

async function runLocationSearch(query, worldwide = false) {
  const requestId = ++locationSearchRequestId;
  elements.locationSearchResults.replaceChildren();
  elements.locationDialogStatus.textContent = worldwide ? "Searching worldwide…" : "Searching…";
  try {
    const results = await searchLocations(query, worldwide);
    if (requestId !== locationSearchRequestId || !elements.locationDialog.open) return;
    elements.locationDialogStatus.textContent = results.length ? `${results.length} ${results.length === 1 ? "place" : "places"} found.` : "";
    renderLocationResults(results, query, worldwide);
  } catch {
    if (requestId !== locationSearchRequestId || !elements.locationDialog.open) return;
    elements.locationDialogStatus.textContent = "Location search is unavailable. Try again.";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "location-result-button";
    retry.textContent = "Try again";
    retry.addEventListener("click", () => runLocationSearch(query, worldwide));
    elements.locationSearchResults.append(retry);
  }
}

function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not supported by this browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}

async function useCurrentLocation() {
  const attemptId = ++locationAttemptId;
  locationFinding = true;
  locationRetry = false;
  locationStatus = "";
  renderLocationIdle();

  try {
    const position = await getBrowserLocation();
    if (attemptId !== locationAttemptId) return;
    let locationName = "Nearby location";
    try {
      locationName = await reverseGeocodeLocation(position.coords.latitude, position.coords.longitude);
    } catch {
      // Weather can still be fetched when the locality lookup is unavailable.
    }
    if (attemptId !== locationAttemptId) return;
    setLocation(
      {
        name: locationName,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
      "current",
    );
    rememberLocation(state.location);
    closeLocationDialog();
    await fetchWeather();
  } catch (error) {
    if (attemptId !== locationAttemptId) return;
    locationStatus = error.code === 1
      ? "Location permission is blocked. Allow location in your browser or device settings, or search by town or postcode."
      : error.code === 3
        ? "Finding your location took too long. Try again or search by town or postcode."
        : "Couldn't find your location. Try again or search by town or postcode.";
    locationRetry = true;
    locationFinding = false;
    renderLocationIdle();
    if (!state.lastCheckedAt) await fetchWeather();
  } finally {
    if (attemptId === locationAttemptId) {
      locationFinding = false;
      renderLocationIdle();
    }
  }
}

function openLocationDialog() {
  cancelLocationSearch();
  locationStatus = "";
  locationRetry = false;
  elements.locationSearchInput.value = "";
  elements.locationSearchResults.replaceChildren();
  renderLocationIdle();
  dialogScrollLock.open(elements.locationDialog);
  document.querySelector("#locationDialogTitle").focus({ preventScroll: true });
}

function openPlanDialog() {
  if (elements.planDialog.open) return;
  dialogScrollLock.open(elements.planDialog);
  elements.planDialogTitle.focus({ preventScroll: true });
}

function closePlanDialog() {
  if (elements.planDialog.open) elements.planDialog.close();
}

function closeLocationDialog() {
  cancelLocationWork();
  if (elements.locationDialog.open) elements.locationDialog.close();
}

function cancelLocationWork() {
  cancelLocationSearch();
  locationAttemptId += 1;
  locationFinding = false;
}

async function initializeLocation(hasSavedLocation) {
  if (hasSavedLocation || hasRequestedLocation()) {
    await fetchWeather();
    return;
  }

  markLocationRequested();
  await useCurrentLocation();
}
async function fetchWeather() {
  const requestId = ++activeWeatherRequestId;
  const requestLocation = { ...state.location };
  if (checkedLabelTimer !== null) clearTimeout(checkedLabelTimer);
  checkedLabelTimer = null;
  state.weatherRequestPending = true;
  state.weatherLoadFailed = false;
  elements.weatherStatus.textContent = "Updating…";
  elements.recommendation.setAttribute("aria-busy", "true");
  elements.dashboardPanel.setAttribute("aria-busy", "true");
  elements.refreshWeather.disabled = true;
  render();

  try {
    const response = await fetch(weatherUrlForLocation(requestLocation));
    if (!response.ok) throw new Error("Weather request failed");
    const data = await response.json();
    if (requestId !== activeWeatherRequestId) return;
    const current = data.current ?? {};
    if (!Number.isFinite(current.temperature_2m) || !Number.isFinite(current.relative_humidity_2m)) {
      throw new Error("Incomplete weather data");
    }

    state.outdoorTemp = current.temperature_2m;
    state.outdoorRh = current.relative_humidity_2m;
    state.outdoorDewPoint = Number.isFinite(current.dew_point_2m)
      ? current.dew_point_2m
      : dewPoint(state.outdoorTemp, state.outdoorRh);
    state.outdoorPressure = Number.isFinite(current.surface_pressure)
      ? current.surface_pressure
      : DEFAULT_PRESSURE_HPA;
    state.outdoorWind = Number.isFinite(current.wind_speed_10m) ? current.wind_speed_10m : 0;
    state.forecast = buildForecast(data);
    state.updatedAt = current.time;
    state.lastCheckedAt = new Date();
    state.lastSuccessfulUpdateAt = state.lastCheckedAt;
    state.weatherLoadFailed = false;
    if (typeof data.timezone === "string" && data.timezone) state.timezone = data.timezone;

  } catch {
    if (requestId !== activeWeatherRequestId) return;
    state.lastCheckedAt = new Date();
    state.weatherLoadFailed = true;
    elements.weatherStatus.textContent = "Update failed";
  } finally {
    if (requestId !== activeWeatherRequestId) return;
    state.weatherRequestPending = false;
    updateWeatherCheckedLabel();
    elements.recommendation.removeAttribute("aria-busy");
    elements.dashboardPanel.removeAttribute("aria-busy");
    elements.refreshWeather.disabled = false;
    render();
  }
}

function bindPullToRefresh() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let start = null;
  let distance = 0;
  let threshold = 100;
  let pullLimit = 0;
  let active = false;
  let visibleDistance = 0;
  let footerClearance = 0;
  let animationFrame = null;
  let settling = false;
  let resultTimer = null;
  const measureFooterClearance = () => Math.max(0,
    elements.forecastPanel.offsetTop + elements.forecastPanel.offsetHeight -
    elements.verdictPanel.offsetTop - elements.verdictPanel.offsetHeight);
  const paintDistance = value => {
    visibleDistance = Math.max(-8, value);
    const followDistance = Math.max(0, visibleDistance - footerClearance);
    document.body.style.setProperty('--pull-distance', `${Math.round(visibleDistance * 100) / 100}px`);
    document.body.style.setProperty('--pull-follow-distance', `${Math.round(followDistance * 100) / 100}px`);
  };
  const stopAnimation = () => {
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    animationFrame = null;
    settling = false;
  };
  const settleTo = (target, onComplete = () => {}) => {
    stopAnimation();
    if (reducedMotion.matches || Math.abs(visibleDistance - target) < 0.5) {
      paintDistance(target);
      if (target === 0) {
        document.body.style.removeProperty('--pull-distance');
        document.body.style.removeProperty('--pull-follow-distance');
      }
      onComplete();
      return;
    }
    const from = visibleDistance;
    let startedAt = null;
    settling = true;
    const frame = time => {
      if (startedAt === null) startedAt = time;
      const progress = Math.min(1, (time - startedAt) / 450);
      const spring = 1 - Math.exp(-8 * progress) * Math.cos(7 * progress);
      paintDistance(from + (target - from) * spring);
      if (progress < 1) {
        animationFrame = requestAnimationFrame(frame);
      } else {
        animationFrame = null;
        settling = false;
        paintDistance(target);
        if (target === 0) {
          document.body.style.removeProperty('--pull-distance');
          document.body.style.removeProperty('--pull-follow-distance');
        }
        onComplete();
      }
    };
    animationFrame = requestAnimationFrame(frame);
  };
  const resetGesture = () => {
    start = null;
    distance = 0;
    active = false;
    document.body.classList.remove('pull-active', 'pull-mid', 'pull-ready');
  };
  const closePull = (immediate = false) => {
    if (resultTimer) clearTimeout(resultTimer);
    resultTimer = null;
    resetGesture();
    document.body.classList.remove('pull-refreshing');
    const resetResult = () => {
      document.body.classList.remove('pull-result', 'pull-failed');
      elements.pullRefreshText.textContent = 'Keep pulling';
    };
    if (immediate) {
      stopAnimation();
      paintDistance(0);
      document.body.style.removeProperty('--pull-distance');
      document.body.style.removeProperty('--pull-follow-distance');
      resetResult();
    } else {
      settleTo(0, resetResult);
    }
  };
  document.addEventListener('touchstart', event => {
    if (event.touches.length !== 1 || window.scrollY > 0 || settling || state.weatherRequestPending ||
        document.body.classList.contains('pull-refreshing') || document.body.classList.contains('pull-result') ||
        document.querySelector('dialog[open]') ||
        event.target.closest('button, a, input, select, textarea, summary, .ah-chart, .reading-ruler')) return;
    const touch = event.touches[0];
    start = { x: touch.clientX, y: touch.clientY };
    footerClearance = measureFooterClearance();
    pullLimit = elements.verdictPanel.offsetHeight / 2;
    const cueHeight = elements.pullRefresh.offsetHeight;
    threshold = pullLimit > cueHeight
      ? Math.max(100, Math.ceil(-pullLimit * Math.log(1 - cueHeight / pullLimit)))
      : 100;
    distance = 0;
    active = false;
  }, { passive: true });
  document.addEventListener('touchmove', event => {
    if (!start) return;
    if (event.touches.length !== 1) { closePull(); return; }
    const touch = event.touches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (window.scrollY > 0 || dy < -8 || Math.abs(dx) > Math.max(12, dy * 0.7)) { closePull(); return; }
    if (dy <= 0) return;
    event.preventDefault();
    if (dy < 12) {
      if (active) {
        active = false;
        document.body.classList.remove('pull-active', 'pull-mid', 'pull-ready');
        paintDistance(0);
      }
      return;
    }
    active = true;
    distance = dy;
    document.body.classList.add('pull-active');
    paintDistance(pullLimit * (1 - Math.exp(-dy / pullLimit)));
    document.body.classList.toggle('pull-mid', dy >= threshold / 2);
    document.body.classList.toggle('pull-ready', dy >= threshold);
    elements.pullRefreshText.textContent = dy >= threshold ? 'Release to re-check' : 'Keep pulling';
  }, { passive: false });
  document.addEventListener('touchend', async () => {
    if (!start) return;
    const refresh = active && distance >= threshold && !state.weatherRequestPending;
    if (!refresh) { closePull(); return; }
    resetGesture();
    document.body.classList.add('pull-refreshing');
    settleTo(elements.pullRefresh.offsetHeight);
    elements.pullRefreshText.textContent = 'Updating weather…';
    try {
      const update = fetchWeather();
      footerClearance = measureFooterClearance();
      paintDistance(visibleDistance);
      await update;
      elements.pullRefreshText.textContent = state.weatherLoadFailed ? 'Weather update failed' : 'Weather updated';
      document.body.classList.toggle('pull-failed', state.weatherLoadFailed);
    } catch {
      elements.pullRefreshText.textContent = 'Weather update failed';
      document.body.classList.add('pull-failed');
    } finally {
      footerClearance = measureFooterClearance();
      paintDistance(visibleDistance);
      document.body.classList.remove('pull-refreshing');
      if (document.hidden) { closePull(true); return; }
      document.body.classList.add('pull-result');
      resultTimer = setTimeout(closePull, 1400);
    }
  }, { passive: true });
  document.addEventListener('touchcancel', () => { if (start) closePull(); }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) closePull(true); });
}


function bindTypedValue(input, stateKey, min, max, save) {
  const applyValue = () => {
    const value = input.valueAsNumber;
    if (!Number.isFinite(value) || value < min || value > max) return false;
    state[stateKey] = ["indoorTemp", "indoorRh", "minTemp", "targetRh"].includes(stateKey)
      ? rulerValueFromDrag(value, 0, min, max, Number(input.step), 1) : value;
    input.value = stateKey === "indoorTemp" ? state[stateKey].toFixed(1) : state[stateKey];
    save();
    render();
    return true;
  };
  input.addEventListener("change", () => {
    if (!applyValue()) { input.value = stateKey === "indoorTemp" ? state[stateKey].toFixed(1) : state[stateKey]; render(); }
  });
}

function bindSteppers() {
  const settings = {
    indoorTemp: { min: 10, max: 32, step: 0.1, save: saveIndoorReadings },
    indoorRh: { min: 20, max: 90, step: 1, save: saveIndoorReadings },
    targetRh: { min: 40, max: 65, step: 1, save: savePlanSettings },
    minTemp: { min: 16, max: 26, step: 1, save: savePlanSettings },
  };

  document.querySelectorAll(".step-button").forEach((button) => {
    const stateKey = button.dataset.stepTarget;
    const setting = settings[stateKey];
    const direction = Number(button.dataset.stepDirection);
    if (!setting || !Number.isFinite(direction)) return;

    let repeatDelay;
    let repeatTimer;
    let repeated = false;

    const applyStep = () => {
      const precision = setting.step < 1 ? 1 : 0;
      state[stateKey] = Number(
        clamp(state[stateKey] + setting.step * direction, setting.min, setting.max).toFixed(precision),
      );
      setting.save();
      render();
    };

    const stopRepeating = () => {
      clearTimeout(repeatDelay);
      clearInterval(repeatTimer);
    };

    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      repeated = false;
      repeatDelay = setTimeout(() => {
        repeated = true;
        applyStep();
        repeatTimer = setInterval(applyStep, 110);
      }, 450);
    });
    button.addEventListener("pointerup", stopRepeating);
    button.addEventListener("pointercancel", stopRepeating);
    button.addEventListener("pointerleave", stopRepeating);
    button.addEventListener("click", () => {
      if (!repeated) applyStep();
    });
  });
}

function bindEvents() {
  let lastChartWidth = 0;
  const chartResizeObserver = new ResizeObserver(entries => {
    const width = entries[0].contentRect.width;
    if (Math.abs(width - lastChartWidth) < .5) return;
    lastChartWidth = width;
    renderAhChart();
  });
  chartResizeObserver.observe(document.querySelector('#ahChart'));
  const indoorDialog = document.querySelector('#indoorDialog');
  const editIndoor = document.querySelector('#editIndoorButton');
  const summaryEdit = document.querySelector('#indoorSummaryEdit');
  const summaryVoice = document.querySelector('#indoorSummaryVoice');
  const indoorOpeners = [editIndoor, summaryEdit, summaryVoice];
  let indoorDialogOpener = null;
  dialogScrollLock = createDialogScrollLock();
  [indoorDialog, elements.planDialog, elements.locationDialog, elements.settingsDialog].forEach(dialog => {
    dialog.addEventListener('close', dialogScrollLock.release);
    enableSheetDrag(dialog);
    let startedOutside = false;
    const isOutside = event => {
      const bounds = dialog.getBoundingClientRect();
      return event.target === dialog && (
        event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom
      );
    };
    dialog.addEventListener('pointerdown', event => {
      startedOutside = isOutside(event);
    });
    dialog.addEventListener('pointercancel', () => { startedOutside = false; });
    dialog.addEventListener('click', event => {
      if (startedOutside && isOutside(event)) dialog.close();
      startedOutside = false;
    });
    dialog.addEventListener('close', () => { startedOutside = false; });
  });
  const openIndoorEditor = opener => {
    indoorDialogOpener = opener;
    opener?.setAttribute('aria-expanded', 'true');
    dialogScrollLock.open(indoorDialog);
    document.querySelector('#indoor-heading').focus({ preventScroll: true });
  };
  editIndoor.addEventListener('click', () => openIndoorEditor(editIndoor));
  summaryEdit.addEventListener('click', () => openIndoorEditor(summaryEdit));
  document.querySelector('#indoorDoneButton').addEventListener('click', () => indoorDialog.close());
  indoorDialog.addEventListener('close', () => {
    if (!elements.voiceDialog.hidden) closeVoiceDialog();
    indoorOpeners.forEach(opener => opener.setAttribute('aria-expanded', 'false'));
    (indoorDialogOpener || elements.locationButton).focus({ preventScroll: true });
    indoorDialogOpener = null;
  });
  elements.settingsButton.addEventListener('click', () => {
    elements.settingsButton.setAttribute('aria-expanded', 'true');
    dialogScrollLock.open(elements.settingsDialog);
    elements.settingsDialogTitle.focus({ preventScroll: true });
  });
  elements.settingsDialog.addEventListener('close', () => {
    elements.settingsButton.setAttribute('aria-expanded', 'false');
    elements.settingsButton.focus({ preventScroll: true });
  });
  elements.showIndoorSummary.addEventListener('change', () => {
    uiPreferences.showIndoorSummary = elements.showIndoorSummary.checked;
    applyUiPreferences();
    saveUiPreferences();
  });
  elements.openIndoorOnLaunch.addEventListener('change', () => {
    uiPreferences.openIndoorOnLaunch = elements.openIndoorOnLaunch.checked;
    saveUiPreferences();
  });
  if (uiPreferences.openIndoorOnLaunch) {
    requestAnimationFrame(() => {
      if (!document.querySelector('dialog[open]')) openIndoorEditor(null);
    });
  }
  document.querySelectorAll('[data-chart-hours]').forEach(button => button.addEventListener('click', () => {
    state.chartHours = Number(button.dataset.chartHours);
    state.chartSelection = Math.min(state.chartSelection, state.chartHours);
    renderAhChart();
  }));
  elements.indoorTemp.addEventListener("input", (event) => {
    state.indoorTemp = Number(event.target.value);
    saveIndoorReadings();
    render();
  });
  elements.indoorRh.addEventListener("input", (event) => {
    state.indoorRh = Number(event.target.value);
    saveIndoorReadings();
    render();
  });
  bindTypedValue(elements.indoorTempInput, "indoorTemp", 10, 32, saveIndoorReadings);
  bindTypedValue(elements.indoorRhInput, "indoorRh", 20, 90, saveIndoorReadings);
  bindSteppers();
  bindReadingRulers();
  bindTypedValue(elements.targetRhInput, "targetRh", 40, 65, savePlanSettings);
  bindTypedValue(elements.minTempInput, "minTemp", 16, 26, savePlanSettings);

  elements.targetRh.addEventListener("input", (event) => {
    state.targetRh = Number(event.target.value);
    savePlanSettings();
    render();
  });
  elements.minTemp.addEventListener("input", (event) => {
    state.minTemp = Number(event.target.value);
    savePlanSettings();
    render();
  });

  elements.roomPreset.addEventListener("change", (event) => {
    state.roomPreset = event.target.value;
    savePlanSettings();
    render();
  });
  bindTypedValue(elements.roomLength, "roomLength", 1, 20, savePlanSettings);
  bindTypedValue(elements.roomWidth, "roomWidth", 1, 20, savePlanSettings);
  bindTypedValue(elements.roomHeight, "roomHeight", 1.8, 5, savePlanSettings);

  elements.openingSetup.addEventListener("change", (event) => {
    state.openingSetup = event.target.value;
    savePlanSettings();
    render();
  });
  bindTypedValue(elements.customAirflow, "customAirflow", 10, 500, savePlanSettings);

  elements.refreshWeather.addEventListener("click", fetchWeather);
  document.querySelector("#pageRefreshButton").addEventListener("click", () => window.location.reload());
  elements.locationButton.addEventListener("click", openLocationDialog);
  elements.locationDialog.addEventListener("close", () => {
    cancelLocationWork();
    elements.locationButton.focus({ preventScroll: true });
  });
  elements.locationUpdateButton.addEventListener("click", useCurrentLocation);
  elements.locationSearchForm.addEventListener("submit", handleLocationSearch);
  elements.locationSearchInput.addEventListener("input", handleLocationInput);
  elements.locationClearButton.addEventListener("click", () => {
    elements.locationSearchInput.value = "";
    handleLocationInput();
    elements.locationSearchInput.focus();
  });
  document.querySelectorAll("[data-close-dialog]").forEach(button => {
    button.addEventListener("click", () => {
      const dialog = button.closest("dialog");
      if (dialog === elements.locationDialog) closeLocationDialog();
      else dialog.close();
    });
  });
  elements.planSummaryButton.addEventListener("click", openPlanDialog);
  elements.planDoneButton.addEventListener("click", closePlanDialog);
  elements.planDialog.addEventListener("close", () => {
    elements.planSummaryButton.focus({ preventScroll: true });
  });
  if (SpeechRecognition) {
    elements.voiceInputButton.hidden = false;
    summaryVoice.hidden = false;
    summaryVoice.addEventListener('click', () => {
      indoorDialogOpener = summaryVoice;
      summaryVoice.setAttribute('aria-expanded', 'true');
      startVoiceInput();
    });
    elements.voiceInputButton.addEventListener("click", toggleVoiceListening);
    elements.voiceListenButton.addEventListener("click", toggleVoiceListening);
    elements.voiceDialogCloseButton.addEventListener("click", closeVoiceDialog);
    elements.voiceApplyButton.addEventListener("click", applyVoiceChanges);

  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}

loadIndoorReadings();
loadPlanSettings();
loadUiPreferences();
initializeVoiceDebugPanel();
const hasSavedLocation = loadLocation();
loadLocationHistory(hasSavedLocation);
updateLocationUi();
bindEvents();
bindPullToRefresh();
render();
initializeLocation(hasSavedLocation);
setInterval(fetchWeather, WEATHER_REFRESH_INTERVAL_MS);
setInterval(updateIndoorLastSetLabels, 60_000);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") {
    const session = activeVoiceSession;
    if (session) {
      voiceDebugLog("page hidden during session", {}, session.id);
      session.dialogCancelled = true;
      try {
        session.recognition.abort();
      } catch {
        // Continue cleanup if recognition was interrupted by the browser first.
      }
      finishVoiceListening(session, false);
    }
    releaseRetainedVoiceMeter("page hidden");
    return;
  }
  updateIndoorLastSetLabels();
  updateWeatherCheckedLabel();
  if (!state.lastCheckedAt || minutesSince(state.lastCheckedAt) >= 15) fetchWeather();
});

window.addEventListener("pagehide", () => {
  const session = activeVoiceSession;
  if (session) {
    session.dialogCancelled = true;
    try { session.recognition.abort(); } catch { /* Navigation cleanup must continue. */ }
    finishVoiceListening(session, false);
  }
  releaseRetainedVoiceMeter("page left");
});

// Both views derive their scales from the same 48-hour forecast.
function buildAhOutlook(timeline, hours) {
  const start = timeline[0].time.getTime();
  const fullEnd = Math.min(start + 48 * 3600000, timeline.at(-1).time.getTime());
  const end = Math.min(start + hours * 3600000, fullEnd);
  const sample = weather => ({ time: weather.time.getTime(), value: absoluteHumidity(weather.temp, weather.rh), ach: effectiveAirExchange(weather, state.indoorTemp).airChangesPerHour });
  const full = timeline.filter(p => p.time.getTime() < fullEnd).map(sample);
  full.push(sample(weatherAtTime(timeline, new Date(fullEnd))));
  const points = full.filter(p => p.time < end);
  points.push(sample(weatherAtTime(timeline, new Date(end))));
  const indoor = absoluteHumidity(state.indoorTemp, state.indoorRh);
  const low = Math.max(0, Math.floor(Math.min(indoor, ...full.map(p => p.value)) - 1));
  const high = Math.ceil(Math.max(indoor, ...full.map(p => p.value)) + 1);
  const achHigh = Math.max(3, Math.ceil(Math.max(...full.map(p => p.ach)) * 1.1));
  return { start, end, points, indoor, low, high, achHigh };
}

function renderAhChart() {
  const chart = document.querySelector('#ahChart');
  const reading = document.querySelector('#ahChartReading');
  if (!chart || !reading) return;
  // SVG text scales with the viewBox; cancel that scale to retain CSS-pixel type sizes.
  const chartWidth = chart.getBoundingClientRect().width;
  const textScale = chartWidth > 0 ? 480 / chartWidth : 1;
  chart.style.setProperty('--chart-text-scale', String(textScale));
  const left = 0, right = 480, top = 8, bottom = 158;
  // Share geometry across loading, failure and live data, including label rows.
  const hourY = bottom + 16 * textScale;
  const dayY = hourY + 18 * textScale;
  const labelBottom = dayY + 7 * textScale;
  chart.setAttribute('viewBox', '0 0 480 ' + labelBottom);
  const timeline = buildWeatherTimeline();
  const unavailable = timeline.length < 2 || state.weatherRequestPending || state.weatherLoadFailed;
  document.querySelectorAll('[data-chart-hours]').forEach(button => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.chartHours) === state.chartHours));
    button.disabled = unavailable;
  });
  chart.dataset.weatherState = unavailable ? (state.weatherLoadFailed ? 'failed' : 'loading') : 'ready';
  if (unavailable) {
    const indoor = absoluteHumidity(state.indoorTemp, state.indoorRh);
    // These shapes are placeholders, not a scale or estimates of outdoor weather.
    const heights = [22, 25, 25, 28, 27, 26, 25, 22, 21, 20, 21, 22];
    const bars = heights.map((height, i) => `<rect class="ah-skeleton-bar" x="${i * 40 + 1.5}" y="${bottom - height}" width="37" height="${height}" rx="2"/>`).join('');
    const grid = [150, 270, 390].map(x => `<path class="ah-day-line" d="M${x} ${top}V${labelBottom}"/>`).join('');
    const placeholders = [4, 154, 274, 394].map((x, i) => `<rect class="ah-skeleton-label" x="${x}" y="${hourY - 7 * textScale}" width="${(i === 0 ? 30 : 19) * textScale}" height="${9 * textScale}" rx="${4.5 * textScale}"/>` + (i === 0 || i === 3 ? `<rect class="ah-skeleton-label" x="${x}" y="${dayY - 7 * textScale}" width="${28 * textScale}" height="${9 * textScale}" rx="${4.5 * textScale}"/>` : '')).join('');
    const shimmer = state.weatherLoadFailed ? '' : `<defs><linearGradient id="ahSkeletonShimmer"><stop stop-color="white" stop-opacity="0"/><stop offset=".5" stop-color="white" stop-opacity=".055"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><clipPath id="ahSkeletonClip"><rect width="480" height="${labelBottom}" rx="5"/></clipPath></defs><g clip-path="url(#ahSkeletonClip)" aria-hidden="true"><g transform="skewX(-18)"><rect class="ah-skeleton-shimmer" x="-280" width="280" height="${labelBottom}" fill="url(#ahSkeletonShimmer)"/></g></g>`;
    chart.innerHTML = `<g class="ah-skeleton" aria-hidden="true">${grid}<path class="ah-grid" d="M0 ${bottom}H480 M0 124H480"/>${bars}${placeholders}<path class="ah-indoor-line" d="M0 76H480"/><text class="ah-indoor-label" x="4" y="70">Indoor ${indoor.toFixed(1)} g/m³</text></g>${shimmer}`;
    chart.setAttribute('role', 'img');
    chart.setAttribute('tabindex', '-1');
    chart.setAttribute('aria-label', `${state.weatherLoadFailed ? 'Outdoor forecast unavailable' : 'Loading outdoor forecast'}. Indoor ${indoor.toFixed(1)} g/m³. Chart shapes are placeholders.`);
    chart.setAttribute('aria-disabled', 'true');
    ['aria-valuetext', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow'].forEach(name => chart.removeAttribute(name));
    chart.onpointerdown = chart.onpointermove = chart.onkeydown = null;
    reading.textContent = state.weatherLoadFailed ? 'Outdoor forecast unavailable' : 'Loading outdoor forecast…';
    return;
  }
  chart.removeAttribute('aria-disabled');
  chart.setAttribute('role', 'slider');
  chart.setAttribute('tabindex', '0');
  chart.setAttribute('aria-valuemin', '0');
  chart.setAttribute('aria-label', 'Outdoor absolute humidity and estimated airflow with indoor reference; use arrow keys to inspect hourly values');
  const { start, end, points, indoor, low, high, achHigh } = buildAhOutlook(timeline, state.chartHours);
  const x = time => left + (time - start) / (end - start) * (right - left);
  const y = value => bottom - (value - low) / (high - low) * (bottom - top);
  const airflowBandHeight = (bottom - top) / 3;
  const ay = ach => bottom - ach / achHigh * airflowBandHeight;
  const margin = moistureMargin(state.indoorTemp, state.indoorRh, state.outdoorTemp, state.outdoorRh);
  const gradient = '<linearGradient id="ahSemantic" gradientUnits="userSpaceOnUse" x1="0" y1="'+y(indoor + margin * 1.75)+'" x2="0" y2="'+y(indoor - margin * 1.75)+'"><stop offset="0" stop-color="var(--chart-wet)"/><stop offset="0.2142857143" stop-color="var(--chart-near)"/><stop offset="0.7857142857" stop-color="var(--chart-near)"/><stop offset="1" stop-color="white"/></linearGradient>';
  const excessClip = '<clipPath id="ahExcessClip"><rect x="'+left+'" y="'+top+'" width="'+(right-left)+'" height="'+Math.max(0,y(indoor)-top)+'"/></clipPath>';
  const path = points.map((p,i) => (i ? 'L' : 'M')+x(p.time).toFixed(2)+','+y(p.value).toFixed(2)).join(' ');
  const ticks = '<path d="M'+left+' '+bottom+'H'+right+'" class="ah-grid"/>';
  const dayFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: state.timezone, weekday: 'short' });
  const clockFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: state.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const step = state.chartHours === 24 ? 6 : 12;
  const clockTicks = timeline.filter(p => p.time.getTime() > start && p.time.getTime() <= end)
    .map(p => ({ time: p.time.getTime(), clock: clockFormatter.format(p.time) }))
    .filter(p => p.clock.endsWith(':00') && Number(p.clock.slice(0,2)) % step === 0);
  const firstMidnight = clockTicks.find(p => p.clock === '00:00');
  let days = !firstMidnight || x(firstMidnight.time) > left+50 ? '<text class="chart-time-label" x="'+left+'" y="'+dayY+'">'+dayFormatter.format(start)+'</text>' : '';
  let hours = '<text class="chart-time-label" x="'+left+'" y="'+hourY+'">Now</text>';
  for (const tick of clockTicks) {
    const px = x(tick.time);
    const labelX = Math.min(px+6, right-34);
    days += '<path d="M'+px+' '+top+'V'+labelBottom+'" class="ah-day-line"/>';
    if (px >= left+50) hours += '<text class="chart-time-label" x="'+labelX+'" y="'+hourY+'">'+tick.clock.slice(0,2)+'</text>';
    if (tick.clock === '00:00') days += '<text class="chart-time-label" x="'+labelX+'" y="'+dayY+'">'+dayFormatter.format(tick.time)+'</text>';
  }
  let bars = '';
  const barHours = 2;
  for (let t = start; t < end; t += barHours*3600000) {
    const until = Math.min(end, t+barHours*3600000);
    // Midpoint samples represent each bar's interval; the cursor reads the exact selected time.
    const ach = effectiveAirExchange(weatherAtTime(timeline, new Date((t+until)/2)), state.indoorTemp).airChangesPerHour;
    const bx = x(t)+1.5, width = Math.max(1,x(until)-x(t)-3);
    bars += '<rect class="airflow-bar" x="'+bx+'" y="'+ay(ach)+'" width="'+width+'" height="'+(bottom-ay(ach))+'" rx="2"><title>Estimated airflow '+ach.toFixed(1)+' ACH</title></rect>';
    if (state.chartHours === 24 && width > 23 && bottom-ay(ach) > 16 * textScale) bars += '<text class="airflow-label" text-anchor="middle" x="'+(bx+width/2)+'" y="'+(ay(ach)+13*textScale)+'">'+ach.toFixed(1)+'</text>';
  }
  chart.innerHTML = '<defs>'+gradient+excessClip+'<clipPath id="outlookPlot"><rect x="'+left+'" y="'+top+'" width="'+(right-left)+'" height="'+(bottom-top)+'"/></clipPath></defs>'+ticks+days+'<g clip-path="url(#outlookPlot)"><path d="'+path+' L'+x(end)+' '+y(indoor)+' L'+left+' '+y(indoor)+'Z" class="ah-excess-fill" clip-path="url(#ahExcessClip)" fill="url(#ahSemantic)" opacity=".09"/>'+bars+'<path d="'+path+'" class="ah-curve"/></g>'+hours+'<path d="M'+left+' '+y(indoor)+'H'+right+'" class="ah-indoor-line"/><text class="ah-indoor-label" x="'+(left+4)+'" y="'+(y(indoor)-6)+'">Indoor '+indoor.toFixed(1)+' g/m³</text><path id="ahCursor" class="ah-cursor"/><circle id="ahDot" r="'+(6 * textScale)+'" class="ah-dot"/>';
  reading.innerHTML = '<span class="ah-reading-time"></span> · <span class="ah-reading-moisture"></span> · <span class="ah-reading-airflow"></span>';
  const readingTime = reading.querySelector('.ah-reading-time');
  const readingMoisture = reading.querySelector('.ah-reading-moisture');
  const readingAirflow = reading.querySelector('.ah-reading-airflow');
  positionAhIndoorLabel(chart, points.map(p => ({ x:x(p.time), y:y(p.value) })), y(indoor), top, bottom);
  let selected = 0;
  const maxHours = (end-start)/3600000;
  chart.setAttribute('aria-valuemax', maxHours.toFixed(2));
  function select(hours) {
    selected = clamp(hours,0,maxHours);
    state.chartSelection = selected;
    const time = start+selected*3600000;
    const weather = weatherAtTime(timeline,new Date(time));
    const value = absoluteHumidity(weather.temp,weather.rh);
    const ach = effectiveAirExchange(weather,state.indoorTemp).airChangesPerHour;
    const timeLabel = selected === 0 ? 'Now' : dayFormatter.format(time)+' '+formatShortTime(new Date(time));
    const moistureLabel = value.toFixed(1)+' g/m³';
    const airflowLabel = ach.toFixed(1)+' ACH';
    const label = timeLabel+' · '+moistureLabel+' · '+airflowLabel;
    chart.setAttribute('aria-valuenow',selected.toFixed(2));
    chart.setAttribute('aria-valuetext',label);
    chart.querySelector('#ahCursor').setAttribute('d','M'+x(time)+' '+top+'V'+bottom);
    chart.querySelector('#ahDot').setAttribute('cx',x(time));
    // Follow the displayed curve exactly between forecast samples.
    const next = Math.max(1,points.findIndex(p=>p.time>=time));
    const b=points[next], a=points[next-1];
    const fraction=b.time===a.time ? 0 : (time-a.time)/(b.time-a.time);
    const curveValue = a.value+(b.value-a.value)*fraction;
    chart.querySelector('#ahDot').setAttribute('cy',y(curveValue));
    const colorPosition = clamp((indoor+margin*1.75-curveValue)/(margin*3.5),0,1);
    const nearStart = 0.2142857143, nearEnd = 0.7857142857;
    readingTime.textContent = timeLabel;
    readingMoisture.textContent = moistureLabel;
    readingAirflow.textContent = airflowLabel;
    readingMoisture.style.color = colorPosition < nearStart
      ? `color-mix(in srgb, var(--chart-wet) ${(1-colorPosition/nearStart)*100}%, var(--chart-near))`
      : colorPosition <= nearEnd ? 'var(--chart-near)'
      : `color-mix(in srgb, var(--chart-near) ${(1-(colorPosition-nearEnd)/(1-nearEnd))*100}%, white)`;
  }
  const inspect = event => {
    const bounds=chart.getBoundingClientRect();
    select(((event.clientX-bounds.left)/bounds.width*480-left)/(right-left)*maxHours);
  };
  chart.onpointerdown = event => { chart.setPointerCapture(event.pointerId); inspect(event); };
  chart.onpointermove = event => { if(chart.hasPointerCapture(event.pointerId)||event.pointerType==='mouse') inspect(event); };
  chart.onkeydown = event => {
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    select(event.key==='Home' ? 0 : event.key==='End' ? maxHours : selected+(event.key==='ArrowRight'?1:-1));
  };
  select(state.chartSelection);
}

function positionAhIndoorLabel(chart, curve, lineY, plotTop = 14, plotBottom = 130) {
  const label = chart.querySelector('.ah-indoor-label');
  const box = label.getBBox();
  const baselineOffset = Number(label.getAttribute('y')) - box.y;
  const padding = 4; // Keep a little clear space around the text and curve.
  const lastX = Math.max(box.x, 480 - padding - box.width);
  const positions = [box.x, lastX];
  const candidates = [lineY - 6 - box.height, lineY + 6].flatMap(top => positions.map(left => {
    top = clamp(top, plotTop + padding, plotBottom - padding - box.height);
    const bounds = { left: left - padding, right: left + box.width + padding,
      top: top - padding, bottom: top + box.height + padding };
    let overlap = 0;
    // Measure curve length inside the padded label rectangle, including segments
    // whose endpoints both lie outside it.
    for (let i = 1; i < curve.length; i++) {
      const a = curve[i - 1];
      const b = curve[i];
      let enter = 0;
      let leave = 1;
      for (const [origin, delta, min, max] of [
        [a.x, b.x - a.x, bounds.left, bounds.right],
        [a.y, b.y - a.y, bounds.top, bounds.bottom],
      ]) {
        if (delta === 0) {
          if (origin < min || origin > max) leave = -1;
        } else {
          const t1 = (min - origin) / delta;
          const t2 = (max - origin) / delta;
          enter = Math.max(enter, Math.min(t1, t2));
          leave = Math.min(leave, Math.max(t1, t2));
        }
      }
      overlap += Math.max(0, leave - enter) * Math.hypot(b.x - a.x, b.y - a.y);
    }
    return { left, top, overlap };
  }));
  // Keep the label left when clear; otherwise try the chart's right edge.
  // Fall below the reference only when both upper corners are obstructed.
  const best = candidates.find(candidate => candidate.overlap === 0) ||
    candidates.reduce((best, candidate) => candidate.overlap < best.overlap ? candidate : best);
  label.setAttribute('x', best.left);
  label.setAttribute('y', best.top + baselineOffset);
}

function enableSheetDrag(dialog) {
  const header = dialog.querySelector('.section-heading, .plan-dialog-heading, .location-dialog-heading, .settings-dialog-heading');
  const handle = dialog.querySelector('.sheet-handle');
  let gesture = null;
  const reset = () => {
    gesture = null;
    dialog.style.removeProperty('transform');
    dialog.classList.remove('sheet-dragging');
  };
  [handle, header].filter(Boolean).forEach(surface => {
    surface.classList.add('sheet-drag-surface');
    surface.addEventListener('pointerdown', event => {
      if (!window.matchMedia('(max-width: 39.999rem)').matches || !event.isPrimary || event.button !== 0 ||
          event.target.closest('button, input, select, a')) return;
      gesture = { id: event.pointerId, y: event.clientY, distance: 0 };
      surface.setPointerCapture(event.pointerId);
    });
    surface.addEventListener('pointermove', event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      gesture.distance = Math.max(0, event.clientY - gesture.y);
      dialog.classList.add('sheet-dragging');
      dialog.style.transform = 'translateY(' + gesture.distance + 'px)';
    });
    surface.addEventListener('pointerup', event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const dismiss = Math.max(0, event.clientY - gesture.y) >= 120;
      reset();
      if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
      if (dismiss) dialog.close();
    });
    surface.addEventListener('pointercancel', reset);
    surface.addEventListener('lostpointercapture', reset);
  });
  dialog.addEventListener('close', reset);
}

// Ruler positions are relative to the fixed centre marker, in CSS pixels.
function rulerValueFromDrag(start, distance, min, max, step, spacing) {
  return Number(Math.min(max, Math.max(min, Math.round((start - distance / spacing * step) / step) * step)).toFixed(step < 1 ? 1 : 0));
}

function renderReadingRulers() {
  document.querySelectorAll('[data-ruler]').forEach(ruler => {
    const input = ruler.querySelector('input');
    const value = state[ruler.dataset.ruler];
    const step = Number(input.step), spacing = Number(ruler.dataset.tickSpacing);
    const majorEvery = Math.round(Number(ruler.dataset.majorInterval) / step);
    const centre = value / step;
    const radius = Math.ceil((ruler.clientWidth || 440) / (2 * spacing)) + 1;
    let ticks = '';
    for (let tick = Math.floor(centre) - radius; tick <= Math.ceil(centre) + radius; tick++) {
      const number = Number((tick * step).toFixed(1));
      if (number < Number(input.min) || number > Number(input.max)) continue;
      const major = tick % majorEvery === 0;
      ticks += '<span class="ruler-tick' + (major ? ' ruler-tick-major' : '') + '" style="left:calc(50% + ' + ((tick - centre) * spacing).toFixed(2) + 'px)">' + (major && Math.abs((tick - centre) * spacing) > 16 ? '<span>' + number + '</span>' : '') + '</span>';
    }
    ruler.querySelector('.ruler-ticks').innerHTML = ticks;
    input.setAttribute('aria-valuetext', value + ' ' + ruler.dataset.unit);
  });
  updateIndoorLastSetLabels();
}

function updateIndoorLastSetLabels() {
  const lastSet = document.querySelector('#indoorLastSet');
  const summaryLastSet = document.querySelector('#indoorSummaryLastSet');
  lastSet.hidden = !state.indoorLastSet;
  summaryLastSet.hidden = !state.indoorLastSet;
  if (!state.indoorLastSet) return;

  const minutes = Math.max(0, Math.floor((Date.now() - state.indoorLastSet) / 60_000));
  const elapsed = minutes === 0 ? 'Just now'
    : minutes < 60 ? `${minutes}m ago`
    : `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
  lastSet.textContent = elapsed;
  summaryLastSet.textContent = `· ${elapsed}`;
  const absoluteTime = new Date(state.indoorLastSet).toLocaleString();
  lastSet.title = absoluteTime;
  summaryLastSet.title = absoluteTime;
}

function bindReadingRulers() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-ruler]').forEach(ruler => {
    const dialog = ruler.closest('dialog');
    const input = ruler.querySelector('input');
    const step = Number(input.step), spacing = Number(ruler.dataset.tickSpacing);
    let gesture = null, frame = null;
    const stopCoast = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    };
    const reset = () => {
      stopCoast();
      const id = gesture?.id;
      gesture = null;
      ruler.classList.remove('is-dragging');
      if (id !== undefined && ruler.hasPointerCapture(id)) ruler.releasePointerCapture(id);
    };
    const applyDistance = (start, distance) => {
      const next = rulerValueFromDrag(start, distance, Number(input.min), Number(input.max), step, spacing);
      if (Number(input.value) !== next) {
        input.value = next;
        input.dispatchEvent(new Event('input', {bubbles:true}));
      }
      return next;
    };
    const coast = velocity => {
      if (reducedMotion.matches || Math.abs(velocity) < .25) return;
      // At most 120px of extra travel over 450ms, with no bounce or overshoot.
      const distance = Math.sign(velocity) * Math.min(120, Math.abs(velocity) * 180);
      const value = Number(input.value), started = performance.now();
      const tick = now => {
        frame = null;
        const progress = Math.min(1, Math.max(0, (now - started) / 450));
        const next = applyDistance(value, distance * (1 - Math.pow(1 - progress, 3)));
        const atLimit = distance > 0 ? next <= Number(input.min) : next >= Number(input.max);
        if (progress < 1 && !atLimit) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    ruler.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      reset();
      input.focus({preventScroll:true});
      gesture = {id:event.pointerId,x:event.clientX,y:event.clientY,value:Number(input.value),dragging:false,samples:[{x:event.clientX,time:event.timeStamp}]};
      ruler.setPointerCapture(event.pointerId);
    });
    ruler.addEventListener('pointermove', event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (!gesture.dragging && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 4) { reset(); return; }
      if (!gesture.dragging && Math.abs(dx) < 4) return;
      gesture.dragging = true;
      ruler.classList.add('is-dragging');
      gesture.samples.push({x:event.clientX,time:event.timeStamp});
      while (gesture.samples.length > 2 && gesture.samples[1].time < event.timeStamp - 80) gesture.samples.shift();
      applyDistance(gesture.value, dx);
    });
    ruler.addEventListener('pointerup', event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const first = gesture.samples[0], last = gesture.samples.at(-1);
      const elapsed = event.timeStamp - first.time;
      const velocity = gesture.dragging && event.timeStamp - last.time < 80 && elapsed > 0 && elapsed <= 160
        ? (last.x - first.x) / elapsed : 0;
      reset();
      coast(velocity);
    });
    ruler.addEventListener('pointercancel', reset);
    ruler.addEventListener('lostpointercapture', () => { if (gesture) reset(); });
    dialog.addEventListener('close', reset);
    dialog.addEventListener('pointerdown', stopCoast);
    dialog.addEventListener('keydown', stopCoast);
    document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
    reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) reset(); });
    new ResizeObserver(renderReadingRulers).observe(ruler);
  });
  [elements.indoorTempInput,elements.indoorRhInput,elements.minTempInput,elements.targetRhInput].forEach(input => {
    input.addEventListener('focus', () => input.select());
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); input.blur(); }
    });
  });
}


// Freeze only the page content: dialogs stay outside the fixed container.
function createDialogScrollLock() {
  let saved = null, viewportFrame = null;
  const root = document.documentElement, body = document.body;
  const page = document.querySelector('.app-shell');
  const remember = (element, names) => names.map(name => [name, element.style.getPropertyValue(name), element.style.getPropertyPriority(name)]);
  const restore = (element, properties) => properties.forEach(([name,value,priority]) => {
    if (value) element.style.setProperty(name,value,priority);
    else element.style.removeProperty(name);
  });
  const syncViewport = () => {
    if (!saved) return;
    const viewport = window.visualViewport;
    const height = viewport?.height || window.innerHeight;
    const top = viewport?.offsetTop || 0;
    if (!(height > 0)) return;
    root.style.setProperty('--sheet-visible-height', height + 'px');
    root.style.setProperty('--sheet-visible-bottom', (top + height) + 'px');
  };
  const release = () => {
    if (!saved || document.querySelector('dialog[open]')) return;
    window.visualViewport?.removeEventListener('resize', syncViewport);
    window.visualViewport?.removeEventListener('scroll', syncViewport);
    window.removeEventListener('resize', syncViewport);
    if (viewportFrame !== null) window.cancelAnimationFrame(viewportFrame);
    viewportFrame = null;
    const previous = saved;
    saved = null;
    restore(page, previous.page);
    restore(body, previous.body);
    restore(root, previous.root);
    root.style.setProperty('scroll-behavior','auto');
    window.scrollTo({left:previous.x,top:previous.y,behavior:'instant'});
    restore(root, previous.behavior);
  };
  const open = dialog => {
    if (dialog.open) return;
    if (!saved) {
      const bounds = page.getBoundingClientRect();
      const height = Math.max(root.scrollHeight, body.scrollHeight);
      saved = {x:window.scrollX,y:window.scrollY,
        body:remember(body,['min-height','overflow']),
        page:remember(page,['position','top','left','width','margin']),
        root:remember(root,['overflow','overscroll-behavior','--sheet-visible-height','--sheet-visible-bottom']),
        behavior:remember(root,['scroll-behavior'])};
      root.style.setProperty('overflow','hidden');
      root.style.setProperty('overscroll-behavior','none');
      root.style.setProperty('scroll-behavior','auto');
      body.style.setProperty('min-height',height+'px');
      page.style.setProperty('position','fixed');
      page.style.setProperty('top',bounds.top+'px');
      page.style.setProperty('left',bounds.left+'px');
      page.style.setProperty('width',bounds.width+'px');
      page.style.setProperty('margin','0');
      body.style.setProperty('overflow','hidden');
      window.visualViewport?.addEventListener('resize', syncViewport);
      window.visualViewport?.addEventListener('scroll', syncViewport);
      window.addEventListener('resize', syncViewport);
      syncViewport();
    }
    try {
      dialog.showModal();
      syncViewport();
      if (viewportFrame !== null) window.cancelAnimationFrame(viewportFrame);
      viewportFrame = window.requestAnimationFrame(() => { viewportFrame = null; syncViewport(); });
    }
    catch (error) { release(); throw error; }
  };
  return {open,release};
}
