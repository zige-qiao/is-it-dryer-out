# Is it dryer out

## Version 0.5.4

Version 0.5.4 moves ventilation settings into a shared dialog below the outlook, adds plain-language recommendation explanations, and makes weather-source and refresh status easier to inspect.

A personal ventilation checker for estimating whether opening windows should reduce indoor humidity, and for how long.

## Using the app

During voice input, live “Hearing: …” text replaces “Listening…” in the same status box. The final transcript and review step appear after completion.

Diagnostic build `v0.5.4.13-muted-meter-reopen-test` (app asset 131) tested a fresh waveform stream after iOS muted the retained track. On the affected iPhone, the new stream reported live, enabled and unmuted but measured zero audio for more than 11 seconds while the user spoke; that attempt and two retries also produced no transcription. The test branch remains on GitHub for analysis, but Pages was returned to `main` and this reopening strategy should not be used as a recovery.

- Set the indoor temperature and relative humidity.
- In supported browsers, use the microphone button to enter one or both indoor readings by voice, then review the recognised values before applying them.
- Use the compact ventilation summary below the outlook to open **Ventilation settings**. Changes to minimum temperature, target humidity, room size, or opening setup save immediately and update the outlook without an Apply step. On mobile, minimum temperature and target humidity remain side by side.
- Read the recommendation and its forecast tiles. Each tile shows the expected opening result, outdoor temperature, outdoor relative humidity, and estimated air changes per hour for that start time.
- Use the refresh icon beside **Last checked** to request current weather again.
- Open **Why this recommendation?** for the calculation-specific explanation, **How estimates work** for modelling limitations, and **Weather data** for the provider, request location, update status, and source links.

## How it works

Current iPhone voice policy (`v0.5.4.11-foreground-voice`, app asset 128): after the first user-requested voice attempt, keep the microphone stream enabled throughout the foreground session, including natural completion, manual Stop, Apply and dialog close. The amber indicator may remain on. Transcription ends separately; the waveform is reset and its animation cancelled between attempts. No new controls or readiness message are added. Backgrounding or leaving releases capture; restarting after that release is still an unresolved platform risk. No audio file is saved or uploaded by the meter; browser speech recognition may use an external service. This supersedes the older 30-second/dialog-bounded retention description below.

- Enter indoor temperature, relative humidity, target humidity, and minimum indoor temperature manually. Voice input can update indoor temperature and humidity in browsers that provide speech recognition and microphone access. On iPhone, the live waveform uses a standard microphone stream to keep the iOS audio session available. Natural completion releases it; manual stop retains it for an immediate retry with a fresh recogniser, for no longer than 30 seconds and only while the voice dialog remains open.
- On every load, the app asks the browser for the current location. Use `Update` to request a fresh location check.
- Location search accepts UK postcodes with or without spaces, regardless of letter case, and outward codes such as `M1`, `M33`, or `SW1A`.
- If location permission is unavailable, the app uses the most recently stored location, or Sale, Greater Manchester as the initial fallback.
- When device location is used, its coordinates are sent to BigDataCloud only to obtain a nearby locality name.
- The app compares indoor and outdoor water content before recommending ventilation.
- The opening plan simulates changing moisture and temperature minute by minute.
- Forecast humidity between hourly points is derived from interpolated dew point rather than interpolating relative humidity directly.
- Outdoor temperature, humidity, dew point, pressure, wind and forecast data come from Open-Meteo for the active location. Forecast times use the time zone returned with that weather data.
- Normal sensor uncertainty is included. Small moisture differences are labelled uncertain instead of being treated as reliably wetter or drier.
- A plan with an expected relative-humidity reduction of under one percentage point is labelled `OPEN IF NEEDED`: brief ventilation may be useful for fresh air, but it may not reduce humidity.
- The plan stops when the humidity target is reached, the minimum temperature is reached, condensation is predicted, or forecast air stops being reliably drier.
- Where applicable, the recommendation shows both the estimated time to its outcome and the period that outdoor air remains reliably drier. Follow the earlier limit.
- When ventilation provides useful drying but cannot reach the target, the app still recommends `OPEN WINDOWS` and shows the useful drying period and expected conditions.
- Every meaningful opening period uses the blue `OPEN WINDOWS` status. The stated time and supporting text explain whether to stop at the target, a temperature or condensation limit, a forecast change, or the point where drying becomes uncertain. Harmful conditions continue to use `KEEP CLOSED`.

## Timing estimate

Choose a room-size preset or enter custom room dimensions. Then select an opening setup or enter a custom airflow estimate. Room volume, opening setup, forecast wind and the indoor-outdoor temperature difference are used to estimate air changes per hour.

The duration is a rough planning estimate, not a measurement. Real airflow depends on the building, window geometry, doors, wind direction and pressure differences. The forecast tiles assume the current indoor readings remain unchanged until each displayed start time.

## Storage and offline use

Indoor readings, plan settings, and the most recent location are stored only in this browser. The app shell is cached for offline use, but live outdoor data and locality lookup still require a connection.

## Voice diagnostics

Build `v0.5.4.10-cleanup-audit` (diagnostic asset 127, `cleanupAudit=close-v1`) logs stopped track states and audio-context close requests, completion or failure. Reopening is blocked until closure succeeds; a five-second warning reports pending closure without bypassing it. Use the staged stop-enabled test to compare natural completion with manual Stop followed by Release. Report the amber indicator separately: closed JavaScript resources do not prove system microphone use has ended. Production voice behaviour is unchanged.

The `v0.5.4.9-stop-enabled-test` control (revision 126) is at `voice-test.html?mode=track-pause&staged=1&stopTrack=enabled`. It changes only manual Stop: the waveform track stays enabled through recognition end, until explicit Release microphone, the 30-second retained timeout, or existing cleanup. Open microphone, speak, start recognition, manually Stop while speaking, wait for end, release, then reopen without reloading. Compare microphone-only levels. Abort still disables the track. This is a diagnostic control, not a production fix.

For the two-stage control, open `voice-test.html?mode=track-pause&staged=1` (build `v0.5.4.8-staged-mic-test`, asset revision 125). Tap **Open microphone**, speak for five seconds, then **Start recognition** and speak again. Stop or Abort, release the microphone, and repeat without reloading. Logs label `microphone-only`, `recognition`, and `retained` phases. Release is available during microphone preparation and the microphone-only phase; that phase has a 30-second safety timeout. This isolates whether silence precedes recognition startup. Production app behaviour is unchanged.

The `v0.5.4.7-audio-path-probe` diagnostic build adds independent numeric audio measurements to held-stream modes, without changing the production app. Open `voice-test.html?mode=track-pause` and confirm `assetRevision=124 audioProbe=levels-v1` (these fields appear separately in the header). Establish a working baseline, then test Stop or Abort, Release microphone, and Start again. Speak for five seconds and copy the log before stopping. Once-per-second `audio probe` entries report track/context state, successful analyser-read counts, waveform-frame counts, and maximum RMS/peak levels. Reads count JavaScript analyser calls, not proof of fresh hardware samples; a running context with zero levels supports but does not prove an upstream capture failure. The probe stores no audio or speech content and stops when its stream is released.

Open `voice-test.html?mode=reuse` to test reusing a recogniser, or `voice-test.html?mode=fresh` to create a new one for each attempt. Run three recordings per mode without reloading between attempts, copy the log, then switch modes (which reloads the page). Use `voice-test.html?mode=interrupt` to mark an external audio interruption while recognition is active. That mode does not stop recognition just because this page is hidden; iOS may still suspend it, and the attempt is limited to 30 seconds. Use `voice-test.html?mode=prime` to repeat the completed microphone-reset experiment: on the tested iPhone, its normal microphone stream opened and released successfully but did not restore speech recognition. Use `voice-test.html?mode=hold` to keep that stream alive throughout each recognition attempt and display its live microphone level. Use `voice-test.html?mode=hold-persist` for the manual-stop control: stop the first attempt manually, then start a second attempt and let it finish naturally. That mode retains and reuses the same live microphone stream between those attempts. Logs include browser, available OS and WebKit versions, microphone-stream lifecycle, visibility, and recognition events, never speech content. Build identification also remains in the app's normal diagnostic logs after Clear.

Add `?voice-debug=1` to the app URL to show the temporary voice diagnostics panel. It records microphone, audio-context, and speech-recognition lifecycle events without recording recognised speech content. Reproduce the issue, then use **Copy** to collect the log.

On iOS, the live waveform stream is also an audio-session keep-alive. Earlier diagnostics removed that stream under the assumption that it competed with speech recognition; the first attempt then worked while immediate retries emitted `audiostart` without activating the physical microphone. A short microphone reset did not help, but keeping the normal stream open throughout recognition succeeded repeatedly. A later control showed that releasing it immediately after manual stop caused the remaining failure, while retaining and reusing the same stream supported two consecutive manual stops, a naturally completed retry, and a subsequent newly opened stream. The app therefore retains the local stream and waveform after manual stop, reuses them for a fresh recogniser, and releases them after natural completion, dialog close, apply, page hiding, failure, or a 30-second timeout.

The [iOS voice recognition investigation](VOICE-INVESTIGATION.md) contains the consolidated device-test record, event timings, regression history, verified natural-completion and manual-stop mitigations, and related WebKit reports. The supporting [video analysis](tests/ios_web_speech_microphone_video_analysis.md) documents the Safari and Chrome screen recording in detail.

## Project information

Created by Ziggy Qiao. The app links to its [GitHub repository](https://github.com/zige-qiao/is-it-dryer-out) from the supporting footer. See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

## Release history

- `v0.5.4`: Shared ventilation-settings dialog, calculation-specific recommendation explanations, clearer weather provenance, and refined responsive accessibility.
- `v0.5.3.3`: Browser and WebKit identification plus bounded audio-interruption testing for voice diagnostics.
- `v0.5.3.1`: Immediate recognition startup, isolated recording sessions, adaptive desktop silence detection, and an iOS microphone-conflict workaround.
- `v0.5.3`: Microphone-level silence detection, graceful recognition shutdown, and one-shot iOS recognition with diagnostics retained for verification.
- `v0.5.2`: Opt-in on-device voice diagnostics for investigating repeated iOS recording failures.
- `v0.5.1`: Reliable repeated voice sessions on iOS, UK postcode-area search, and refined outdoor-data loading and failure states.
- `v0.5`: Optional voice entry for indoor readings, forecast ACH estimates, responsive plan disclosure, loading placeholders, and a separated verdict and outlook layout.
- `v0.4.2`: Balanced desktop columns, aligned panel spacing, cleaner location rendering, and more compact fallback guidance.
- `v0.4.1`: Default-expanded opening plan, minimum-temperature-first controls, and a compact outdoor-RH dashboard conclusion.
- `v0.4`: Mobile-first information flow, collapsible opening-plan controls, clearer no-drying-benefit guidance, forecast relative humidity, refined refresh control, and a supporting-details footer.
- `v0.3.2`: Automatic location checks, town and postcode search, clearer weather-retry handling, consolidated opening outlook, unified controls, responsive layout refinements, and visual polish.
- `v0.3.1`: Refined ventilation status logic, location updating, reading controls, forecast navigation, and responsive usability.
- `v0.3`: Minimum meaningful humidity-improvement rule, clearer `WAIT` states, consistent open/wait/closed colours, room and opening configuration refinements, and responsive layout updates.
- `v0.2`: Automatic location refresh, location update action, refreshed app icon, and two-part ventilation timing guidance.
- `v0.1`: First public release with live outdoor weather, manual indoor readings, and forecast-based ventilation planning.

## Possible future work

- Calibrate airflow estimates against measured changes in a specific room.
- Investigate whether Tado X readings can be accessed safely and reliably through Home Assistant/Matter or a token-protecting backend.
