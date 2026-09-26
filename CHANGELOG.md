# Changelog

All notable changes to Is it dryer out are documented here.

## v0.6.0 — Moisture Outlook - 2026-09-26

- Replaced the moisture table with outdoor and indoor cards and a semantic-colour warmed-air RH comparison, including a compact three-column mobile layout.
- Added an interactive 48-hour outdoor AH forecast with pointer and keyboard inspection, local midnight/noon labels, and extended gridlines.
- Added a dynamic indoor reference, blue–amber–red uncertainty gradient, and an outlined label that avoids the curve automatically.
- Extended the hourly weather request to 50 hours to cover the complete rolling forecast. Updated app cache revision to 131.

## v0.5.5 - 2026-09-24

### Voice interface

- Matched the Indoor readings microphone to the muted refresh-button style and moved all live waveform feedback into the voice dialog. The dialog now opens immediately when voice input is requested, including microphone preparation.
- Added concise voice examples below the status box; they disappear when speech arrives or an error is shown. The live Hearing text and final review remain in their existing states.
- Preserved the `.11` iPhone foreground-stream lifecycle and its unresolved post-release recovery risk. The `.13` release/reopen test failed on the affected iPhone, so this branch makes no capture-recovery change.
- Matched the app diagnostic build name to `v0.5.5` and synchronized app cache revision 130. No release tag was requested.

- Live voice transcript now replaces Listening in the same status box instead of appearing in a second panel. Final review behaviour is unchanged; app assets revision 129.

### v0.5.4.11-foreground-voice

- Adopted the user-approved iPhone foreground microphone retention trade-off: reuse the enabled stream across voice attempts, Apply and dialog close; cancel/reset waveform animation when not listening. Removed the retained-stream idle timeout, not the recognition duration limit.
- Release capture on backgrounding and page exit. Added no Stop/Abort/Release buttons or readiness message. Recovery after background release remains unverified; underlying Safari issue is not resolved.
- App log build matches the branch, with synchronized app cache revision 128. Diagnostic build remains .10 / revision 127.

### Diagnostic build v0.5.4.10-cleanup-audit

- Added track-state and asynchronous AudioContext closure auditing, with retry gating until successful cleanup and a pending-close warning. Diagnostic asset revision 127; production code unchanged.
- Recorded natural-completion retries that worked while the user observed the microphone indicator remaining active. These are not verified hardware-release successes.

### Diagnostic build v0.5.4.9-stop-enabled-test

- Added an opt-in staged control that keeps the waveform track enabled after manual recognition Stop, with explicit active-microphone wording and existing bounded cleanup. Abort is unchanged. Diagnostic revision 126; production code unchanged.
- Corrected navigation highlighting for staged diagnostic controls.

### Diagnostic build v0.5.4.8-staged-mic-test

- Added opt-in two-stage microphone opening and recognition startup with phase-labelled numeric probes, explicit release, and a 30-second microphone-only timeout. Diagnostic asset revision 125; production voice code is unchanged.

### Diagnostic build v0.5.4.7-audio-path-probe

- Added waveform-independent audio-level sampling and once-per-second track, audio-context, analyser-read and animation-frame logging to the diagnostic page only. Numeric summaries contain no recorded audio or transcript.
- Updated diagnostic asset revision to 124 and matched its build name to the branch. Production voice behaviour remains unchanged; iPhone validation is pending.

### Added

- Added microphone reset and held-stream modes to the voice comparison page. The reset experiment confirmed that a short `getUserMedia` stream opens normally but does not restore stuck speech recognition; the held-stream mode then completed three consecutive iPhone attempts successfully while driving a live waveform throughout recognition.
- Added a detailed iOS voice investigation record and supporting cross-browser video analysis covering the supplied Mac and iPhone test runs, Safari and Chrome behaviour, microphone-indicator observations, recovery timings, the completed reset experiment, conclusions, and related WebKit reports.

### Fixed

- Restored the live iPhone voice waveform and made the production lifecycle match the held-stream diagnostic that succeeded three times without a reload: recognition starts after the stream is ready, the meter only drives the waveform, WebKit ends the one-shot attempt without meter-based silence timers, a 30-second watchdog remains available, and the stream is released after recognition ends. This reverses the v0.5.3.1 assumption that the extra stream competed with speech recognition; device testing instead showed that its overlap keeps the iOS audio session available for immediate retries.
- Verified the held-stream lifecycle for naturally completed iOS recognition in two independent 3/3 sequences: the standalone diagnostic and the normal production UI. A later manual-stop sequence reopened the investigation because the next recognition attempt reached `audiostart` but heard no speech.
- Added a persistent-stream manual-stop control that retains the same live microphone track and waveform after `recognition.stop()`, reuses them for the next fresh recogniser, and identifies itself as `v0.5.4.5-voice-diagnostics`.
- Applied the successful persistent-stream control to the iPhone app UI: manual stop now retains the local waveform stream for fresh-recogniser retries, including consecutive stops, while natural completion, dialog close, apply, page hiding, failures, and a 30-second timeout release it.

## v0.5.4 - 2026-09-16

### Added

- Added a shared `Ventilation settings` dialog opened from a live summary below the forecast outlook; changes save immediately and update the recommendation and forecasts.
- Added calculation-specific, plain-language recommendation explanations for successful, uncertain, limited-benefit, loading, failed-refresh, and retained-data states.
- Added a dedicated weather-data accordion with provider attribution, request location, last successful update status, and source links.

### Changed

- Reorganised dashboard details into `Why this recommendation?`, `How estimates work`, and `Weather data`, while preserving each disclosure state during live updates.
- Refined the outlook footer, accordions, refresh control, listening state, safe-area spacing, and narrow-screen ventilation controls.
- Shortened the single-opening label to `One window open` in the summary while retaining the full control label in ventilation settings.
- Kept minimum indoor temperature and target indoor humidity controls side by side in the mobile ventilation-settings dialog.
- Tightened the outlook footer's text-to-chevron spacing so decimal temperature values are less likely to wrap on narrow screens.
- Shortened timed recommendation copy and placed durations first to keep verdicts compact on mobile.

### Fixed

- Prevented stale weather requests and explanations from being presented after the selected location changes.
- Distinguished failed refresh attempts from the last successful weather update when retained data remains visible.

## v0.5.3.3 - 2026-09-15

### Added

- Added an audio-interruption mode to voice diagnostics with before/after markers and visibility-event logging; the mode leaves recognition running when the page is hidden and retains the 30-second safety limit.
- Added browser, available operating-system, and WebKit version details to copied voice logs without including speech transcripts.

## v0.5.3.2 - 2026-09-15

### Added

- Added a separate voice comparison page for repeated recordings with a reused or newly created recognizer.
- Added embedded build identification and asset revision to copied diagnostics, including after clearing logs.
- Comparison logs identify recognizer objects, attempts, events, and safety timeouts without including recognised speech.

## v0.5.3.1 - 2026-09-15

### Changed

- Speech recognition now starts immediately instead of waiting for the optional microphone-level stream.
- Desktop voice input uses an adaptive noise floor for its waveform and one-second silence detection.
- iOS gives speech recognition exclusive microphone access; its flat waveform and pulsing outline indicate listening without opening a competing audio stream.

### Fixed

- Isolated each recording session so delayed callbacks and audio cleanup cannot affect a later attempt.
- Added startup, final-result, and maximum-duration safeguards so stalled recognition sessions finish predictably without discarding a valid result.
- Voice resources are released when the page is backgrounded or the device is locked.

## v0.5.3 - 2026-09-14

### Changed

- Voice input now detects one continuous second of silence from real microphone levels instead of relying on inconsistent browser `speechend` events.
- Recognition is asked to stop before its microphone meter is released, with fallback cleanup when a browser does not emit `end`.
- iOS uses one-shot speech recognition while other browsers retain continuous recognition.

### Fixed

- Intentional iOS `aborted` events no longer replace an otherwise valid result with an error.

## v0.5.2 - 2026-09-14

### Added

- Added an opt-in `?voice-debug=1` diagnostics panel for capturing microphone-track, AudioContext, and speech-recognition lifecycle events directly on iOS.
- Added Copy and Clear controls for collecting diagnostic logs without including recognised speech content.

## v0.5.1 - 2026-09-14

### Added

- Added case-insensitive UK postcode and outward-code search, including compact postcodes without spaces and partial areas such as `M1`, `M33`, and `SW1A`.
- Added explicit busy-state semantics to the recommendation and moisture dashboard while outdoor weather is updating.

### Changed

- Refined weather loading with a neutral recommendation state, aligned forecast skeleton rows, tighter forecast-tile corners, and clearer plan status copy.
- Reworked the no-data state with neutral messaging, static outlook placeholders, a compact top-right retry control, and consistent dashboard and plan status text.

### Fixed

- Fixed the weather retry control remaining visible after outdoor data was successfully refreshed.
- Fixed subsequent iOS voice sessions failing to receive microphone input by safely reusing audio resources and ignoring stale speech-recognition callbacks.

## v0.5 - 2026-09-14

### Added

- Added optional voice entry for indoor temperature and relative humidity, with live microphone-level feedback and a review step before applying recognised readings.
- Added estimated air changes per hour to each forecast tile and accessible forecast description.
- Added quiet loading placeholders to the forecast outlook while outdoor conditions are being checked.

### Changed

- Simplified voice parsing to indoor readings and added support for labelled phrases, units, corrections, reversed value order, and unlabelled values that can be inferred safely from their valid ranges.
- Voice recording can be stopped manually or after one second of silence; valid readings can be applied as soon as they are recognised, while errors appear in the transcript panel.
- Opening window plan now starts collapsed below the desktop breakpoint and expanded on desktop, while preserving a manual choice for the current browser session.
- Reworked the recommendation into an overlapping coloured verdict panel and separately outlined forecast outlook.
- Detached the voice control from the Indoor readings heading flow so both input sections keep consistent vertical spacing.

## v0.4.2 - 2026-09-13

### Changed

- Aligned the visible heading-to-control gap in Indoor readings and Opening window plan at 12px.
- Matched the opening-plan bottom padding to the dashboard conclusion spacing.
- On wide layouts, moved Opening window plan into the left working column and grouped Moisture dashboard with supporting details in the right column.
- Made the two desktop layout columns equal width.
- Tightened the verdict card's safe-area-aware top spacing and shortened the fallback ventilation guidance.

### Fixed

- Removed the location underline and reset its native button appearance for consistent rendering across browsers.

## v0.4.1 - 2026-09-13

### Changed

- Opening window plan now opens by default while remaining collapsible.
- Reordered plan controls so **Minimum indoor temp** appears before **Target indoor humidity**.
- Simplified the dashboard conclusion to `Outdoor air RH at indoor 22.5°C` with the resulting RH shown beside it.
- Removed the final table divider, tightened the summary-row spacing, and restored the dashboard's matching bottom padding.

## v0.4 - 2026-09-13

### Added

- Forecast tiles now show outdoor relative humidity alongside temperature, for example `21.1°C · 60% RH`.
- A compact project credit and GitHub link now appear below the supporting details.
- The weather refresh control now uses a dedicated refresh icon with an accessible label and keyboard focus state.

### Changed

- Reworked the mobile flow so **Indoor readings** is followed directly by **Opening window plan**, then the moisture dashboard.
- Made **Opening window plan** a collapsed-by-default disclosure. Its paired controls remain visible together when expanded, including on narrow mobile screens.
- Kept indoor temperature and relative humidity in two columns on mobile. Matching plan controls use the same compact, stable value-field layout.
- Replaced ambiguous no-drying-benefit recommendation states with `OPEN IF NEEDED`. The supporting copy now explains that short ventilation can provide fresh air without necessarily reducing humidity.
- Renamed forecast states for clarity: `Uncertain` replaces `Wait`, and `Little benefit` replaces `Too small`.
- Moved timing assumptions and moisture/data-source explanation out of primary cards into an unframed supporting-details footer beneath the dashboard.
- Replaced accordion plus/minus controls with chevrons and aligned the footer with dashboard content.
- Shortened the live weather status to `Updating outdoor...` while keeping the last-check time concise.

### Removed

- Removed the mobile **View plan** link because the opening-plan section now follows the indoor readings directly.
- Removed duplicated explanation content from the recommendation and dashboard cards.

### Fixed

- Reduced narrow-screen stepper button width while retaining a 44px control height, preventing temperature values from being clipped.
- Tightened the collapsed opening-plan header so its vertical spacing matches the nearby input card rhythm.

## v0.3.2

- Automatic location checks, town and postcode search, clearer weather-retry handling, consolidated opening outlook, unified controls, responsive layout refinements, and visual polish.

## v0.3.1

- Refined ventilation status logic, location updating, reading controls, forecast navigation, and responsive usability.

## v0.3

- Minimum meaningful humidity-improvement rule, clearer `WAIT` states, consistent open/wait/closed colours, room and opening configuration refinements, and responsive layout updates.

## v0.2

- Automatic location refresh, location update action, refreshed app icon, and two-part ventilation timing guidance.

## v0.1

- First public release with live outdoor weather, manual indoor readings, and forecast-based ventilation planning.
