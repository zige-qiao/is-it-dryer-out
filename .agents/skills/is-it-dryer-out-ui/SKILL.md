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

On mobile, keep this visual order:

1. Recommendation and forecast outlook.
2. Indoor readings.
3. Opening window plan.
4. Moisture dashboard.
5. Supporting footnotes and project credit.

On wide screens, use equal-width columns. Put the recommendation, Indoor readings, and Opening window plan in the left column. Put the Moisture dashboard followed by supporting details in the right column. Keep Indoor readings and Opening window plan controls paired in two columns when space permits.

Opening window plan is expanded by default but remains collapsible. Use chevrons for all disclosures. Do not restore the removed `View plan` link while the plan remains directly after Indoor readings.

Keep Room size and Opening setup stacked. Custom room dimensions remain three columns inside Room size; custom airflow remains within Opening setup.

## Responsive Controls

- Keep Temperature and Relative humidity in two columns on mobile and desktop.
- Keep Minimum indoor temp on the left and Target indoor humidity on the right.
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
- Show time, outcome or duration, outdoor temperature, and outdoor RH, for example `21.1°C · 60% RH`.
- Keep tile accessibility labels explicit about temperature and relative humidity.
- Show `Last checked HH:MM` with a compact black refresh icon. During refresh, use `Updating outdoor...`.
- If weather loading fails, show a concise failure state and a visible retry button.
- End the dashboard with `Outdoor air RH at indoor <temperature>` and the resulting RH on the right.
- Do not add a divider below the final Absolute humidity row.
- Keep dashboard horizontal and bottom padding equal.

## Supporting Details

Keep `About these estimates` and `Why this matters` as collapsed, unframed footnotes below the dashboard. Align them to the dashboard's inner content width, separate the two rows with one thin rule, and do not add a rule before the first row.

Keep weather-source links inside `Why this matters`. Keep the final credit understated: `By Ziggy Qiao · GitHub`, linking to `https://github.com/zige-qiao/is-it-dryer-out`.

## Visual Conventions

- Page background: `#f2f0ed`.
- Avoid decorative drop shadows.
- Use black and white for ordinary control accents; reserve status colors for recommendation meaning.
- Keep verdict styling aligned without allowing borders or outlines to change card dimensions.
- Keep the recommendation's top padding compact while adding the device safe-area inset. Keep the location button un-underlined and explicitly reset its native appearance for consistent rendering across browsers.
- Keep cards restrained, with the existing small radius and border treatment.
- Use familiar icons for icon-only actions and provide accessible names and tooltips.
- Do not add explanatory feature copy to the primary interface.

Keep equivalent sections visually aligned and use the existing spacing scale consistently. Measure rendered spacing when a mismatch is being investigated.

## Weather And Persistence

Outdoor data comes from Open-Meteo. Device coordinates may be sent to BigDataCloud only to obtain a nearby locality name. Preserve the current fallback to the stored location or Sale, Greater Manchester.

Indoor readings, plan settings, and the most recent location stay in browser storage. Do not add a backend or transmit additional user data without an explicit request.

## Cache Updates

When preparing a GitHub push that changes `index.html`, `styles.css`, or `app.js`, increment the numeric cache version once, consistently in all three places:

- `styles.css?v=N` and `app.js?v=N` in `index.html`.
- The corresponding asset URLs in `service-worker.js`.
- `CACHE_NAME` in `service-worker.js`.

This prevents the installed app from showing stale UI without creating a cache revision for every local iteration.

## Verification

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

- Update both `README.md` and `CHANGELOG.md` with claims supported by the actual diff.
- Use a patch version for refinements to an already published release; do not move an existing public tag without explicit confirmation.
- Perform only the requested Git operations. Pushing a feature branch does not imply merging, tagging, or publishing a release.
- When a full release is explicitly requested, merge into `main`, run final checks, create the requested annotated version tag, and push `main` and the tag.
- Confirm the working tree is clean and `main` tracks `origin/main` before reporting completion.

Network pushes, merges, tags, or releases require an explicit user request; ordinary UI edits do not imply release authorization.
