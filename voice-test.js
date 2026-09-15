const BUILD = "0.5.3.2+diagnostics.1";
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const mode = new URLSearchParams(location.search).get("mode") === "fresh" ? "fresh" : "reuse";
const ui = Object.fromEntries(["build", "status", "start", "stop", "copy", "clear", "log"].map(id => [id, document.getElementById(id)]));
let startedAt = performance.now();
let attempt = 0;
let objectCount = 0;
let active = null;
let shared = null;
let requiresReload = false;
const entries = [];

function log(event, detail = {}, run = active) {
  const fields = Object.entries(detail).map(([key, value]) => `${key}=${value}`).join(" ");
  entries.push(`${((performance.now() - startedAt) / 1000).toFixed(3)}s [attempt ${run?.id || "-"}] ${event} ${fields}`.trim());
  ui.log.value = entries.join("\n");
  ui.log.scrollTop = ui.log.scrollHeight;
}

function header() {
  log("diagnostics ready", {
    build: BUILD, assetRevision: new URL(import.meta.url).searchParams.get("v"),
    mode, recognition: Boolean(Recognition), secure: window.isSecureContext,
    language: document.documentElement.lang, meter: "disabled", continuous: false,
  });
}

function controls() {
  ui.start.disabled = !Recognition || Boolean(active) || requiresReload;
  ui.stop.disabled = !active || active.stopping;
  document.querySelectorAll("nav a").forEach(link => link.setAttribute("aria-disabled", String(Boolean(active))));
}

function finish(run, timedOut = false) {
  if (active !== run) return;
  clearTimeout(run.limit);
  clearTimeout(run.cleanup);
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
  clearTimeout(run.limit);
  log("stop requested", { reason });
  ui.status.textContent = "Stopping";
  controls();
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

ui.start.addEventListener("click", () => {
  if (active || requiresReload || !Recognition) return;
  try {
    const holder = mode === "reuse" ? (shared ||= createRecognizer()) : createRecognizer();
    const run = { id: ++attempt, ...holder, results: 0, error: null, stopping: false, cleanup: null };
    active = run;
    ui.status.textContent = "Starting microphone";
    controls();
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
  if (document.hidden) stop("page hidden");
});
document.getElementById(mode).setAttribute("aria-current", "page");
ui.build.textContent = `Build ${BUILD}`;
if (!Recognition) ui.status.textContent = "Speech recognition is unavailable in this browser.";
header();
controls();
