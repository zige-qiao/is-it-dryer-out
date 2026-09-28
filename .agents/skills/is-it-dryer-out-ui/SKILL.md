---
name: is-it-dryer-out-ui
description: Maintain the Is it dryer out web app's interface, wording, responsive behavior, weather states, release notes, and visual consistency. Use for UI, UX, copy, spacing, forecast, dashboard, location, caching, or release work in this repository; do not apply these conventions to unrelated projects.
---

# Is It Dryer Out UI

Maintain this small vanilla HTML, CSS, and JavaScript app as a calm decision tool. Read the current code before changing it; the code is authoritative when it differs from this guide.

## Product Intent

Help a person answer two questions quickly:

1. Will opening windows reduce indoor moisture?
2. If so, for approximately how long?

Keep the main recommendation decisive, the controls easy to adjust, and technical explanation available without dominating the page. Do not present the app as a precise airflow measurement or a guarantee.

## Approval Gate

Discuss every proposed change with the user before modifying the repository:

1. Inspect the current code or rendered interface using read-only actions.
2. Explain exactly what would change, where it would appear, and any meaningful tradeoff.
3. Wait for the user's explicit approval, such as `do`, `apply`, or `proceed`, before editing files.

Approval applies only to the change that was discussed. If the implementation reveals another material change, stop and discuss it before proceeding.

Before approval, do not edit files, run formatters that write changes, increment cache versions, or alter Git state. A request to implement a change does not also authorize a commit. Commit, branch, push, merge, tag, or release only when the user explicitly requests that Git or release action.

Read-only inspection, measurement, validation, and explanation are allowed before approval. Do not change persisted app settings merely to demonstrate a proposal.

## Files And Existing Work

Inspect only the files relevant to the requested change. Read broader context when the change crosses structural, behavioral, caching, documentation, or release boundaries.

Preserve uncommitted user changes. Use existing IDs, classes, helpers, and rendering patterns unless the requested change requires otherwise.

## Documentation Sync

During local iteration, accumulate completed changes without updating `README.md`, `CHANGELOG.md`, this skill, or cache versions after every edit. When the user requests a GitHub push, update all four once to reflect the final state being pushed:

- Update `README.md` only for durable user-facing behavior, setup, usage, or release information.
- Record notable changes in `CHANGELOG.md`; create or finalize a numbered release section only when requested.
- Update this skill only for durable product or workflow conventions that are not already obvious from the code.
- Increment the cache version consistently after the pushed code is final.

Do not document transient experiments, reverted tweaks, or implementation details likely to become stale.

## Information Hierarchy

Show the recommendation and integrated outdoor chart first, then its ventilation summary, moisture comparison cards, supporting accordions and footer. Keep the app in its centred, single-column shell on wide screens.

Indoor editing opens on every full app load and from Edit on the Indoor card. Keep temperature and humidity rulers, typed values, last-set time and voice entry in the same sheet. Values save immediately; Done closes the sheet. Speak opens voice review within that sheet; Back to manual returns to the rulers. Keep one Listening/Hearing status box and reveal the final transcript and Apply only for review. Retain the waveform inside the voice panel.

The whole ventilation summary opens Ventilation settings. Keep paired minimum-temperature and target-humidity rulers, room-size segments, the two-column opening grid, custom dimensions/airflow panels and immediate persistence without an Apply step.

## Responsive Controls

- Keep indoor rulers stacked, with visible tick alignment, typed entry and keyboard adjustment. Clamp and snap supported values without floating-point drift.
- Preserve horizontal ruler gestures without hijacking vertical scrolling. Respect reduced motion and cancel momentum on interruption, close or backgrounding.
- Keep minimum temperature and target humidity rulers paired, with compact bordered editable values and numbered major ticks. Minimum temperature uses whole degrees.
- Keep indoor rulers stacked, and give all editable numbers the same clear control border and keyboard focus treatment.
- Keep room and opening choices as accessible single-selection groups. Use a thin border at rest; use a darker, thicker border and light warm fill for selected Opening tiles. Preserve label wrapping and custom-panel scrolling.
- Sheets support Done, Escape and mobile drag-to-dismiss. Preserve scroll position, visible focus and opener focus on dismissal; adapt to the visible viewport when the keyboard opens.
- Keep the Location sheet's visible Close action on mobile, where it has no Done footer.

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
- Use the full moisture uncertainty range for amber and retain soft semantic-colour transitions.
- Keep loading and failure states clear; avoid displaying stale outdoor results as current. Preserve retry and weather refresh actions. The CHECKING label and chart skeleton use angled sweeps only while loading; reduced motion and failure are static.
- Keep Last checked with its muted refresh icon near the location. Refresh page belongs in the footer.
- Compare outdoor and indoor AH cards with warmed-outdoor RH between them. Match the outdoor card and warmed-RH value to moisture semantics.
- Keep dashboard horizontal and bottom padding equal.

## Supporting Details

Keep four unframed accordions below the dashboard in this order:

1. `Why this recommendation?`, expanded by default, with a short plain-language explanation derived from the current calculation and state.
2. `Glossary`, collapsed by default, defining AH, RH, DP, ACH, Let in and room volume.
3. `How estimates work`, collapsed by default, with concise limitations and definitions supported by the implementation.
4. `Weather data`, collapsed by default, with provider, request location, last successful update, freshness state, and source links when available.

Preserve each accordion's open or closed state during live updates; apply defaults only on initialisation. Never leave an old recommendation or location explanation visible while new weather data is loading. Use full-width clickable headings, consistent chevrons, correct expanded-state semantics, visible keyboard focus, subtle dividers, and natural mobile wrapping.

Keep Open-Meteo attribution and the `Source documentation` and `View weather data` links inside `Weather data`. Keep the final credit outside the accordions and understated: `By Ziggy Qiao · GitHub`, linking to `https://github.com/zige-qiao/is-it-dryer-out`.

## Visual Conventions

- Use the neutral roles in `styles.css` and the written [design system](../../../docs/design-system.md): warm page and light-control surfaces, white panels, warm ink and two border strengths. Keep the launch background aligned with the page.
- Keep the AH chart's white/amber/coral line colours separate from recommendation verdict and moisture-comparison semantics.
- Give light controls consistent rest, hover, pressed and focus states; keep the primary Done action dark. Essential input boundaries need the stronger control-border role.
- Avoid decorative drop shadows.
- Use warm neutrals for ordinary control accents; reserve status colours for weather and moisture meaning.
- Keep verdict styling aligned without allowing borders or outlines to change card dimensions.
- Keep the recommendation and chart visually integrated, with a restrained neutral ventilation-summary footer.
- Keep the recommendation's top padding compact while adding the device safe-area inset. Keep the location button un-underlined and explicitly reset its native appearance for consistent rendering across browsers.
- Keep cards restrained, with the existing small radius and border treatment.
- Use familiar icons for icon-only actions and provide accessible names and tooltips.
- Do not add explanatory feature copy to the primary interface.

Keep equivalent sections visually aligned and use the existing spacing scale consistently. Measure rendered spacing when a mismatch is being investigated.

## Weather And Persistence

Current voice-policy override (v0.5.4.11): on iOS, after explicit user voice activation retain the enabled stream for the entire foreground session, including completion, manual Stop, Apply, dialog close and recognition errors. Reset/cancel waveform animation outside active attempts and restart it when reusing the meter. No retained idle timeout, new buttons, release warning or readiness copy. Release on hidden/pagehide and clean up invalid/unusable resources. The user accepts the persistent amber dot; background-release recovery remains unresolved. The .12 UI change that hid a muted waveform was rejected and reverted. The .13 iPhone test found that releasing the system-muted track and opening a fresh stream yielded zero audio levels and stopped transcription, so do not use that strategy as a recovery without new evidence. Earlier natural-end/dialog-close/30-second release policies are historical; see VOICE-INVESTIGATION.md.

Outdoor data comes from Open-Meteo. Device coordinates may be sent to BigDataCloud only to obtain a nearby locality name. Preserve the current fallback to the stored location or Sale, Greater Manchester.

UK location search accepts complete postcodes with or without spaces and case-insensitive outward codes such as `M1`, `M33`, and `SW1A`.

Indoor readings, plan settings, and the most recent location stay in browser storage. Do not add a backend or transmit additional user data without an explicit request.

Voice input, when supported by the browser, updates indoor temperature and relative humidity only. Keep a review step before applying values and allow immediate manual stop. On desktop, start speech recognition without waiting for the optional adaptive microphone meter and retain one-second meter-based silence detection. On iOS, prepare the standard microphone meter before starting a fresh one-shot recognition session, use the meter for the real dialog waveform, and let WebKit end recognition after speech. Keep that enabled stream throughout the foreground session, including manual Stop, natural completion, Apply, dialog close and recognition errors; stop the waveform animation between attempts without implying hardware capture has stopped. Release on hidden/pagehide and clean up invalid resources. The amber indicator may persist: this is an explicitly accepted trade-off, not a fix to the underlying WebKit issue. The `.13` release/reopen test made both the meter and transcription silent, so do not introduce it as recovery without new device evidence. If the meter is unavailable, allow recognition to continue with the meterless listening-outline pulse. Isolate each recognition session and ensure stale callbacks cannot stop a newer session. Do not infer a single unlabelled integer when it is valid for both temperature and humidity; two unlabelled values such as “21 and 55” can be inferred when their ranges distinguish them. Keep temporary on-device diagnostics behind an explicit query flag and avoid logging recognised speech content.

## Cache Updates

When preparing a GitHub push that changes `index.html`, `styles.css`, or `app.js`, increment the numeric cache version once, consistently in all three places:

- `styles.css?v=N` and `app.js?v=N` in `index.html`.
- The corresponding asset URLs in `service-worker.js`.
- `CACHE_NAME` in `service-worker.js`.

This prevents the installed app from showing stale UI without creating a cache revision for every local iteration.

## Verification

For cleanup audits, distinguish requesting AudioContext closure from its promise settling and from the user observing microphone-indicator clearance. Gate capture reopening on successful tracked-resource cleanup; do not infer hardware release from JavaScript completion alone.

Diagnostic controls that retain enabled capture after recognition Stop must explicitly tell the user the microphone is still active, provide release after end, and retain timeout/background cleanup. Do not label retained capture as microphone-off.

When isolating capture from recognition startup, label microphone-only and recognition phases explicitly, reset measurement windows at the transition, and provide release/cancellation during asynchronous microphone preparation as well as after opening.

For audio-path diagnostics, distinguish track liveness, successful analyser reads, measured sound levels, and waveform rendering. A live track or advancing read counter alone does not establish usable or fresh microphone audio. Keep numeric probes independent of animation, exclude audio/transcript content, and release probe timers with microphone resources.

Verify in proportion to the change while iterating:

- For copy changes, inspect the affected rendered state.
- For layout or styling changes, inspect the affected viewport and include narrow mobile and wide desktop when responsive behavior could change.
- For JavaScript changes, run `node --check app.js`.
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
