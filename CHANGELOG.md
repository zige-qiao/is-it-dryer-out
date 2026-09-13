# Changelog

All notable changes to Is it dryer out are documented here.

## Unreleased

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
