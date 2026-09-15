# Changelog

All notable changes to Is it dryer out are documented here.

## Unreleased

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
