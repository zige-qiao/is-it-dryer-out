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

Voice listening uses one status box: replace Listening with live Hearing text and keep the separate transcript panel hidden until final review or an error.
Keep the Indoor readings microphone visually matched to the muted refresh action. Open the voice dialog immediately when that microphone is activated; show the live waveform only inside the dialog. Place short example phrases below the status box while awaiting speech, then hide them when speech arrives or an error is shown.

On mobile, keep this visual order:

1. Recommendation and forecast outlook.
2. Indoor readings.
3. Moisture dashboard.
4. Supporting details and project credit.

On wide screens, use equal-width columns. Put the recommendation and Indoor readings in the left column. Put the Moisture dashboard followed by supporting details in the right column.

Keep the shared ventilation-plan summary directly below the forecast tiles as the outlook footer. The whole summary row opens the `Ventilation settings` dialog and remains available during weather loading and errors. Show the current minimum temperature, target humidity, room size, and opening setup; keep the text-to-chevron gap compact, and allow the two content groups to wrap naturally without shrinking the text. Keep forecast tiles read-only because one shared plan applies to every outlook hour.

Keep all plan controls in the dialog and update saved settings, the summary, and forecasts immediately without an Apply button. Provide a top-right close button, Escape-to-close, visible focus states, and return focus to the summary trigger when the dialog closes. Keep Room size and Opening setup stacked. Custom room dimensions remain three columns inside Room size; custom airflow remains within Opening setup.

## Responsive Controls

- Keep Temperature and Relative humidity in two columns on mobile and desktop.
- Keep Minimum indoor temp and Target indoor humidity in two columns on mobile and desktop, with Minimum indoor temp on the left.
- Use unified minus/value/plus fields for all four paired controls.
- On narrow screens, use 36px-wide minus/plus buttons while retaining 44px height.
- Keep values and units inside the central field and prevent digits from clipping.
- Keep sliders the same width as their associated steppers.

## Recommendation Language

Use these main verdicts:

- `OPEN WINDOWS` when ventilation provides a meaningful drying period.
- `KEEP CLOSED` when outdoor air would worsen indoor moisture or another harmful limit applies.
- `OPEN IF NEEDED` when there is no clear drying benefit but brief ventilation may still help with fresh air.

For `OPEN IF NEEDED`, use:

- Primary: `No clear drying benefit.`
- Secondary: `Open briefly for fresh air; humidity may not fall.`

Forecast tiles use `Uncertain` instead of `Wait` and `Little benefit` instead of `Too small`. Do not introduce `Slow drying` unless the product logic and tile timing semantics are reconsidered together. Preserve the established closed-window wording unless the user explicitly asks to change it.

## Forecast And Dashboard

- Keep forecast tiles inside the recommendation card.
- Show time, outcome or duration, outdoor temperature, outdoor RH, and the forecast-specific estimated airflow, for example `21.1°C · 60% RH` followed by `~1.6 ACH`.
- Keep tile accessibility labels explicit about temperature, relative humidity, and estimated air changes per hour.
- While weather is loading, preserve the outlook height with quiet skeleton tiles that are hidden from assistive technology and respect reduced-motion preferences.
- Keep checking and no-data states neutral dark so status colours remain reserved for actual ventilation verdicts. On failure, retain static outlook placeholders, use concise `NO DATA` messaging, and keep retry actions out of the verdict's vertical content flow.
- Show `Last checked HH:MM` with a compact muted-grey refresh icon and a comfortable touch target. During refresh, use `Updating outdoor...`.
- If weather loading fails, show a concise failure state and a visible retry button.
- Use outdoor and indoor AH cards with warmed-outdoor RH between them. Match the outdoor card and warmed-RH value to the moisture comparison semantic colours.
- Below a divider, show the interactive 48-hour outdoor AH chart. Keep the dynamic indoor reference, full uncertainty amber band with soft colour transitions, abbreviated midnight/noon labels and extended gridlines. Give the indoor label a white halo and choose above/below placement to minimise curve overlap.
- Keep dashboard horizontal and bottom padding equal.

## Supporting Details

Keep three unframed accordions below the dashboard in this order:

1. `Why this recommendation?`, expanded by default, with a short plain-language explanation derived from the current calculation and state.
2. `How estimates work`, collapsed by default, with concise limitations and definitions supported by the implementation.
3. `Weather data`, collapsed by default, with provider, request location, last successful update, freshness state, and source links when available.

Preserve each accordion's open or closed state during live updates; apply defaults only on initialisation. Never leave an old recommendation or location explanation visible while new weather data is loading. Use full-width clickable headings, consistent chevrons, correct expanded-state semantics, visible keyboard focus, subtle dividers, and natural mobile wrapping.

Keep Open-Meteo attribution and the `Source documentation` and `View weather data` links inside `Weather data`. Keep the final credit outside the accordions and understated: `By Ziggy Qiao · GitHub`, linking to `https://github.com/zige-qiao/is-it-dryer-out`.

## Visual Conventions

- Page background: `#f2f0ed`.
- Avoid decorative drop shadows.
- Use black and white for ordinary control accents; reserve status colors for recommendation meaning.
- Keep verdict styling aligned without allowing borders or outlines to change card dimensions.
- Present the coloured verdict above a neutral forecast outlook with a 12px overlap. The outlook keeps side and bottom borders, square top corners, rounded bottom corners, and enough top padding to separate its tiles from the verdict edge.
- Keep the recommendation's top padding compact while adding the device safe-area inset. Keep the location button un-underlined and explicitly reset its native appearance for consistent rendering across browsers.
- Keep cards restrained, with the existing small radius and border treatment.
- Use familiar icons for icon-only actions and provide accessible names and tooltips.
- Do not add explanatory feature copy to the primary interface.

Keep equivalent sections visually aligned and use the existing spacing scale consistently. Measure rendered spacing when a mismatch is being investigated.

## Weather And Persistence

Current voice-policy override (v0.5.4.11): on iOS, after explicit user voice activation retain the enabled stream for the entire foreground session, including completion, manual Stop, Apply, dialog close and recognition errors. Reset/cancel waveform animation outside active attempts and restart it when reusing the meter. No retained idle timeout, new buttons, release warning or readiness copy. Release on hidden/pagehide and clean up invalid/unusable resources. The user accepts the persistent amber dot; background-release recovery remains unresolved. The .12 UI change that hid a muted waveform was rejected and reverted. The .13 iPhone test found that releasing the system-muted track and opening a fresh stream yielded zero audio levels and stopped transcription, so do not use that strategy as a recovery without new evidence. This replaces the older natural-end/dialog-close/30-second release policy described historically below.

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
