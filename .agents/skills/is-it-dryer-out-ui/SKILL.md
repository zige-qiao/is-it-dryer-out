---
name: is-it-dryer-out-ui
description: Maintain the Is it dryer out app's UI, copy, weather states, voice flow, documentation, and releases. Use only for this repository.
---

# Is It Dryer Out UI

Maintain this small vanilla HTML, CSS, and JavaScript app as a calm decision tool. Read the current code before changing it; the code is authoritative when it differs from this guide.

## Product Intent

Help a person answer two questions quickly:

1. Will opening windows reduce indoor moisture?
2. If so, for approximately how long?

Keep the main recommendation decisive, the controls easy to adjust, and technical explanation available without dominating the page. Do not present the app as a precise airflow measurement or a guarantee.

## Working with the user

Apply clearly requested, small, reversible UI edits directly, without a separate approval step. Discuss choices that are unclear, consequential, or materially expand the request before making those changes. A request to edit does not also request a commit, branch, push, merge, tag, or release; perform those operations only when requested.

When providing a UI preview, always include a clickable link the user can open on their iPhone. Discover the current LAN address and verify the preview server is reachable on it; say when the phone must share the computer's Wi-Fi and the computer must remain running. Prefer an existing HTTPS preview when available. Do not present a localhost-only link as the phone preview.

## Files And Existing Work

Inspect only the files relevant to the requested change. Read broader context when the change crosses structural, behavioral, caching, documentation, or release boundaries.

Preserve uncommitted user changes. Use existing IDs, classes, helpers, and rendering patterns unless the requested change requires otherwise.

The root `app.js` owns state, DOM lookup and feature wiring. Native modules under `src/domain/`, `src/services/`, `src/ui/` and `src/voice/` own calculations, external/browser services, interface features and voice respectively. Read the [architecture guide](../../../docs/development.md) before changes crossing these boundaries. Keep calculations independent of the DOM, controller resources private, and cross-feature callbacks wired through the entry point. Tests import modules and controllers directly; do not reintroduce function-source extraction.

## Where rules belong

| File | Owns |
|---|---|
| This skill | How to work on the app, decisions that are easy to break, verification, and documentation routing. |
| [Written design system](../../../docs/design-system.md) and [visual board](../../../docs/design-system.html) | Current layout, tokens, component states, responsive behavior, and visual examples. |
| [README](../../../README.md) | Durable user-facing behavior, setup, usage, and published release information. |
| [CHANGELOG](../../../CHANGELOG.md) | Notable changes under **Unreleased** until published; numbered release history stays historical. |
| [Voice investigation](../../../docs/voice/VOICE-INVESTIGATION.md) | Experiments, rejected approaches, device evidence, and unresolved microphone behavior. |

At the end of a change, check whether a durable visual or interaction rule belongs in the design system, user-facing behavior needs the README, or a notable change needs the changelog. Update this skill only when the way we work or a critical product constraint changes. Follow an explicit documentation request immediately; otherwise consolidate routine documentation during local iteration and reconcile it before a requested push. Do not record transient experiments or rewrite historical release notes as current behavior.

## Information Hierarchy

Keep the compact Indoor summary first and the verdict prominent beneath it. Follow the [design system](../../../docs/design-system.md) for page order and layout.

The Indoor strip is hidden by default and the Indoor sheet opens on full page load by default; both are independent saved preferences in the footer Settings sheet. Edit on the strip or Indoor comparison card also opens the Indoor sheet; the strip's microphone action appears only when speech recognition is supported and starts listening from that tap. Manual values save immediately; voice values require review and Apply. Return focus to the opener for manually opened sheets, or to the location button after automatic opening.

The whole ventilation summary opens Ventilation settings, where changes persist immediately. Keep the detailed Indoor comparison card for AH and dew point context.

## Responsive Controls

- Keep indoor rulers stacked and ventilation rulers paired. Preserve typed entry, keyboard adjustment, snapping, and horizontal gestures without hijacking vertical scrolling. Cancel momentum on interruption, close, or backgrounding.
- Keep room and opening choices as accessible single-selection groups. Sheets support Done, Escape, and mobile drag-to-dismiss; preserve scroll position, visible focus, and opener focus. Adapt to the visible viewport when the keyboard opens.
- Hide all sheet header close buttons below 640px and retain them on larger screens; preserve existing Done actions, outside-tap dismissal, Escape and mobile drag dismissal. Restore opener focus quietly unless it had visible keyboard focus when activated, even if the user typed inside the sheet. Follow the [design system](../../../docs/design-system.md) for exact breakpoints, dimensions, time labels, radii, and focus treatment.

## Recommendation Language

Use these main verdicts:

- `TARGET MET` when the current indoor humidity is at or near the target.
- `OPEN WINDOWS` when ventilation provides a meaningful drying period.
- `KEEP CLOSED` when outdoor air would worsen indoor moisture or another harmful limit applies.
- `OPEN IF NEEDED` when there is no clear drying benefit but brief ventilation may still help with fresh air.

For `OPEN IF NEEDED`, use:

- Primary: `No clear drying benefit.`
- Secondary: `Open briefly for fresh air; humidity may not fall.`

When displaying forecast outcomes, use `Uncertain` instead of `Wait` and `Little benefit` instead of `Too small`. Do not introduce `Slow drying` unless the product logic and tile timing semantics are reconsidered together. Preserve the established closed-window wording unless the user explicitly asks to change it.

## Forecast And Dashboard

- Keep the outdoor outlook inside the recommendation, defaulting to 48 h with 24 h / 48 h controls, an AH line, indoor reference and estimated ACH bars. Derive both views' scales from the same 48-hour forecast and stop at available coverage.
- Preserve pointer and keyboard inspection, local-time labels and a readable indoor reference label that avoids the curve. The selected dot and g/m³ reading follow the curve colour at the inspected point.
- Plot actual outdoor AH against the actual indoor AH reference, but colour each forecast time using a shared-temperature moisture comparison and its uncertainty margin. Use the full uncertainty range for amber and retain soft semantic-colour transitions across time.
- Keep loading and failure states clear; avoid displaying stale outdoor results as current. Preserve retry and weather refresh actions. The CHECKING label and chart skeleton use angled sweeps only while loading; reduced motion and failure are static.
- Pulling down at the page top on touch devices refreshes outdoor weather without reloading the page. Keep the existing refresh controls as alternatives.
- Keep Last checked with its muted refresh icon near the location. Refresh page belongs in the footer.
- Show actual AH in the outdoor and indoor cards with warmed-outdoor RH between them. The outdoor card and warmed-RH colour use the shared-temperature moisture comparison, so do not infer their colour solely from the ordering of the displayed AH values.

## Supporting Details

Keep the four explainers in the order and presentation specified by the [design system](../../../docs/design-system.md). Preserve each open state during live updates, apply defaults only on initialisation, and never show an old recommendation or location explanation as current while weather reloads.

## Visual Conventions

- Use the roles and component specifications in [the design system](../../../docs/design-system.md). Keep the AH chart's white/amber/coral line colours distinct from verdict and moisture-comparison semantics.
- Keep selected, pressed, and keyboard-focused states distinct. Follow the design system's outer focus rule and its wider focus shapes for the ventilation summary and dashboard explainers.
- Keep the recommendation and chart integrated, with a neutral ventilation-summary footer. Avoid decorative shadows and unnecessary explanatory copy in the primary interface.
- Preserve accessible names for icon-only actions and reduced-motion behavior. Measure rendered spacing when a mismatch is being investigated.

## Weather And Persistence

Outdoor data comes from Open-Meteo. Device coordinates may be sent to BigDataCloud only to obtain a nearby locality name. Preserve the current fallback to the stored location or Sale, Greater Manchester.

UK location search accepts complete postcodes with or without spaces and case-insensitive outward codes such as `M1`, `M33`, and `SW1A`.

Indoor readings, plan settings, and the most recent location stay in browser storage. Do not add a backend or transmit additional user data without an explicit request.

Voice input updates indoor temperature and RH only. Keep review before Apply, immediate manual Stop, session isolation, and the meterless fallback. On desktop, recognition must not wait for its optional meter. On iOS, prepare the standard meter before a fresh recognition attempt and retain its enabled stream after explicit voice activation throughout the foreground session, including Stop, Apply, sheet close, and recognition errors. Stop waveform animation outside active attempts; release capture on hidden/pagehide and clean up invalid resources. The persistent amber indicator is an accepted trade-off; background-release recovery remains unresolved. Do not reintroduce the rejected release-and-reopen recovery without new device evidence. Read [VOICE-INVESTIGATION.md](../../../docs/voice/VOICE-INVESTIGATION.md) for experiments and diagnostic rules when working on voice or microphone lifecycle.

## Cache Updates

When preparing a GitHub push that changes `index.html`, `styles.css`, `app.js`, or production modules under `src/`, increment the numeric cache version once, consistently in all three places:

- `styles.css?v=N` and `app.js?v=N` in `index.html`.
- The corresponding asset URLs in `service-worker.js`.
- `CACHE_NAME` in `service-worker.js`.

This prevents the installed app from showing stale UI without creating a cache revision for every local iteration.

Keep every production module in the service worker's `APP_FILES` list. Imported module URLs remain relative and unversioned; the new cache revision refreshes the complete graph. Deploy the root assets and `src/` together. Missing resources must never fall back to HTML unless the request is a navigation.

## Verification

For microphone diagnostics, use the [voice investigation](../../../docs/voice/VOICE-INVESTIGATION.md). A live track or completed JavaScript cleanup does not prove usable audio or that the device's microphone indicator has cleared.

Verify in proportion to the change while iterating:

- For copy changes, inspect the affected rendered state.
- For layout or styling changes, inspect the affected viewport and include narrow mobile and wide desktop when responsive behavior could change.
- For JavaScript changes, syntax-check the entry point and changed modules, then run the relevant imported-module tests with Node.js 24 or later. For structural changes, run `node --test tests/*.test.cjs`, or add `--test-isolation=none` when test-worker creation is restricted.
- Check `service-worker.js` only when its code or cache references change.
- Measure rendered gaps, dimensions, clipping, or overflow when those properties are affected or under investigation.
- Restore test-only UI states before finishing when appropriate.

Before a GitHub push, run the complete relevant regression pass and `git diff --check` once.

Do not claim visual verification if the live page was unavailable or stale.

## Releases

When the user requests a release:

- For a user-specified version branch, use the exact requested branch name and make the app diagnostic build name match it; do not substitute the default `codex/` prefix.
- Update both `README.md` and `CHANGELOG.md` with claims supported by the actual diff.
- Use a patch version for refinements to an already published release; do not move an existing public tag without explicit confirmation.
- Perform only the requested Git operations. Pushing a feature branch does not imply merging, tagging, or publishing a release.
- When a full release is explicitly requested, merge into `main`, run final checks, create the requested annotated version tag, and push `main` and the tag.
- Confirm the working tree is clean and `main` tracks `origin/main` before reporting completion.

Network pushes, merges, tags, or releases require an explicit user request; ordinary UI edits do not imply release authorization.
