# Design review and decisions

**Audience:** Readers investigating earlier design decisions

**Status:** Historical evidence

**Owns:** Baseline audit, decision ledger, original implementation map and revision history

**Reviewed:** 13 October 2026

[Documentation index](../index.md) · [User guide](../user-guide.md)

> Historical evidence. Instructions and “current” statements in this record describe their original period. Consult the linked current reference before implementation.

**Moved:** 13 October 2026. Original record dates and verification limits are retained. [Current guidance](../design-system.md).

### Decision ledger

On 16 October 2026, the user increased the Dark verdict lightness reduction to 16% from the original Light gradients, retaining the same hue-preserving gamut mapping and background-only scope. This supersedes the 8% trial below; release preparation remains paused.

On 15 October 2026, the user approved deepening all four Dark verdict backgrounds through an 8% reduction in OKLCH lightness, preserving hue and maximum sRGB chroma. Light backgrounds, chart and foreground colours, controls and unavailable surfaces stay unchanged. Use the explicit Dark hex endpoints in the current foundations reference; release preparation remains paused.

On 14 October 2026, after investigating the faint header join, the user approved a continuous glass background through the header until scrolling content overlaps it. The matching pinned cover then replaces the base glass in that region, returning to continuous glass above the overlap. Existing footer behaviour, tint, blur and text styling are retained.

The subsequent trial requested on 14 October 2026 raises the Light-sheet tint from 85% to 95%, retaining the pill at 55%, Dark sheet tint at 55%, 4px blur and current text styling.

The next trial requested on 14 October 2026 raises only the Light-sheet tint from 75% to 85%. The pill remains at 55%, and Dark appearance, blur and text colours retain their existing treatment.

Later on 14 October 2026, the user requested trying 75% white tint on Light-mode sheets only, retaining the pill menu at 55%. Dark sheet tint, blur and text styling remain unchanged. This supersedes the earlier Light-sheet opacity choice below; further readability changes still require approval.

On 14 October 2026, the user approved matching all five sheets to the pill's 55% tint and 4px blur in Light and Dark, removing header/footer fades, and scrolling content behind pinned headers and existing fixed footers. The base, header and footer tint occupy separate regions. The user retained current text/control styling and required approval before additional readability changes. The implementation and emulated evidence are Unreleased; physical iPhone verification is separate. See [current sheet contracts](../design/sheets-controls.md#shared-sheet-structure).

Your feedback set the warm-neutral direction, kept the AH chart's separate white/amber/coral roles, and specified the Opening border and fill change. The verdict gradients and chart amber/coral values were updated on 28 September 2026. The number-field clipping, primary-focus and angled CHECKING loading treatments are reflected in the local app. Other weather semantic colours remain as inventoried.

The 27 September instruction to apply this system authorised the displayed warm token values and visible state treatments. The local app now includes the related missing hover tokens, a 44px Refresh app target, visible mobile Location Close and a matching installed-app launch background. Typography normalisation remains a separate follow-up. The remedy plan selected restore-and-explain feedback for invalid manual entries and a 44px outdoor-refresh target.

In v0.7.2, the app gained an optional compact Indoor summary above the verdict, saved display and launch preferences, pull to refresh for outdoor weather, relative reading ages and 20px outer card corners. The 24 h / 48 h choices have a 4px gap, and keyboard focus rings sit outside most visible controls. These refinements are not part of the historical v0.7.1 release record.

## 2. Pre-implementation review evidence and findings

This section preserves the baseline audit and its captures. Present-tense observations in the tables below describe the app **before** the warm palette pass. The local implementation status is recorded in sections 3 and 8.

Source review: `index.html`, `styles.css`, `app.js`, `manifest.webmanifest`, and the repository UI skill. Browser inspection: the local app at `http://127.0.0.1:8766/`. No readings, location, or plan selections were changed for this review.

| Step | Surface | Health and evidence |
|---|---|---|
| 1 | Ventilation settings | Clear hierarchy and native radio semantics. Selected Opening and selected Room size currently use different visual signals; no dedicated pressed state for the option tiles. [Capture](../design-system-evidence/01-ventilation.png). The blue highlight on the word Opening is browser text selection, not a component colour. |
| 2 | Dashboard, chart, details and footer | Recommendation and chart are integrated; supporting controls contain mixed warm and green-grey neutrals. Refresh app is 32px high. [Capture](../design-system-evidence/02-dashboard.png). |
| 3 | Indoor reading sheet | Typed fields and rulers share a clear pattern. Speak is a separate pill family; neutral values and tick styles remain hard-coded. [Capture](../design-system-evidence/03-indoor.png). |
| 4 | Location picker | Search and recent-place hierarchy are clear. Recent-row and remove-button hover rules reference an unset variable. Mobile dismissal has no explicit visible Close button. [Capture](../design-system-evidence/04-location.png). |
| 5 | Desktop dashboard | Current shell remains a centred single column, measured at 496 CSS px in a 1280px viewport. [Capture](../design-system-evidence/05-desktop.png). |

### Baseline findings and proposed resolutions

| Priority | Finding | Proposed resolution |
|---|---|---|
| High | `--button-hover` is unset on location recent rows, remove/clear buttons and sheet close buttons. The location status container also uses it without a shared default. | Give every control family complete state tokens; use a surface token for status containers. Include pressed and disabled states. |
| High | Pale borders alone do little to advertise editable values. The previously suggested `#D8D2CA` is only 1.50:1 against white. | Keep that colour for decorative dividers; introduce `#8D857B` for boundaries necessary to identify an input or control. |
| High | Edit's entire card is clickable through a stretched pseudo-element. Moving feedback only to the tiny pill would hide this larger interaction. | Retain whole-card activation and card-level focus/press feedback; make the pill follow the same state colours. Do not shrink the hit area as a colour cleanup. |
| Medium | Refresh app has a 32px target while most other controls have 44–48px targets. | Keep its compact appearance inside a minimum 44px hit area. |
| Medium | Opening and Room size have selection and hover styling but no explicit pressed styling. | Use the state matrix below; preserve the selected border during hover and press. |
| Medium | Font sizes range across many near-duplicates; some labels and details are 11px, and dimension inputs inherit small text. | Adopt named type roles; use 16px for typed form values and 12px as the default smallest metadata. Retain 11px only for chart axes. |
| Medium | Minor ticks and labels fade toward ruler edges. | Fade decorative ticks; keep meaningful numeric labels legible. Verify limits and narrow paired rulers. |
| Medium | Three sheets have different DOM/layout histories, and mobile close buttons are hidden. | Share sheet geometry and dismissal conventions. Show a visible Close action in Location, where there is no Done footer; keep auto-close on selection. |
| Medium | Installed-app launch background is `#EDF4F1`, while the app page is `#F2F0ED`. | Align the manifest launch background with the page when this design system is implemented. Review browser chrome separately. |
| Maintenance | CSS has repeated overrides; the UI skill still describes paired steppers and a two-column desktop layout that the current code does not use. | Consolidate active component rules after visual approval, then align documentation to actual behaviour during the release documentation pass. |

### Review limits

The listed screens were inspected and captured in this run. Custom panels, voice states, weather loading/failure, alternate verdicts, search-result/error states, reduced motion and forced colours were reviewed in source, not exercised live in this audit. No microphone or device-location permission was requested. Earlier implementation tests are not evidence of a full accessibility audit. Actual iOS keyboard behaviour, screen readers, 200% zoom, all semantic colour pairs, and physical touch devices need the acceptance checks in section 10.

## 8. Implementation map and remaining work

1. The main stylesheet now defines the warm role tokens and maps the existing `--bg`, `--panel`, `--ink`, `--muted`, `--line` and button-family variables to them. Essential input boundaries use the stronger control-border role.
2. Neutral actions, options, fields/rulers, location/voice surfaces and footer interactions use those roles. Recommendation and AH chart semantic colours remain separate.
3. The manifest launch colour matches the page. Outer focus rings, Opening selection and loading sweeps are implemented. The Indoor summary and related refinements shipped in v0.7.2.
4. Future work: consolidate any obsolete component rules after checking remaining users. Treat broader typography/geometry normalisation and inline numeric validation as separate reviews.
5. A requested push or release remains the trigger for repository release documentation and cache-version work.

## Revision log

- 1.7 v0.7.7 release, 9 October 2026: recorded pinned page layouts, plain-language supporting details, rain/wind chart annotations and label clearance, stationary sheet bodies/fades/actions, swipe protection, deliberate Settings reordering and UK English conventions.

- 1.6 local trial, 4 October 2026: aligned fixed spacing, control/icon dimensions and ordinary radii to a 4px grid, documented thin-stroke and fluid-geometry exceptions, and aligned ruler fields and switch outer geometry.
- 1.5 v0.7.4 release, 3 October 2026: recorded clickable verdict durations, timer ruler and compact help popup, approved spacing and typography, and user-confirmed Safari/Home Screen timer handoffs.
- 1.4 update, 30 September 2026: aligned card and chart colour semantics with shared-temperature moisture comparison and the time-based forecast gradient.
- 1.3 v0.7.3 release, 29 September 2026: recorded the iPhone chart curve rendering and pointer versus keyboard focus behaviour.
- 1.2 v0.7.2 release, 29 September 2026: recorded the Indoor controls, layered pull to refresh, updated checked-time label and release status; retained historical v0.7.1 evidence.
- 1.1 local update, 28 September 2026: documented the unpublished Indoor summary strip, manual sheet opening, relative reading age, current outer/inner radii, 24 h / 48 h spacing and outer keyboard focus pattern. Kept v0.7.1 and historical captures as records of their time.
- 1.0 v0.7.1 preparation, 28 September 2026: updated the release status and 48-hour default specimens; retained the current palette and earlier audit history.
- 1.0 local palette update, 28 September 2026: matched all four verdict gradients and the chart's amber/coral stops to the current preview. The selected dot and g/m³ reading follow the curve colour.
- 1.0 release preparation, 28 September 2026: aligned this system with the v0.7.0 app source and retained the pre-implementation captures as historical evidence.
- 1.0 local implementation, 27 September 2026: applied warm neutral roles and states to the app, retained weather and AH semantics, added the angled loading sweeps and related control usability fixes. Updated the board to distinguish current specimens from historical evidence. No release or cache-version change.
- 0.9 draft, 27 September 2026: separated user-directed design choices from the remaining palette sign-off and clarified that implementation is a later step with recommended default scope. Preview/spec only; app unchanged.
- 0.8 draft, 27 September 2026: proposed an angled sweep for CHECKING and the chart skeleton in the loading specimen, with static reduced-motion and failure states. Preview/spec only; app unchanged.
- 0.7 draft, 27 September 2026: added visual specimens for all current AH chart layers and the loading skeleton, alongside their colour roles. Preview/spec only; app unchanged.
- 0.6 draft, 27 September 2026: replaced the primary button specimen's white inset focus line with a distinct dark outer ring and clear gap on white sheets. Preview/spec only; app unchanged.
- 0.5 draft, 27 September 2026: widened the numeric text area inside the preview's fixed 88px editable fields to prevent digit clipping. Preview only; app unchanged.
- 0.4 draft, 27 September 2026: Opening options use 1px unselected borders and 2px selected borders, with lighter #F0EEEB selected fill and stable geometry. Preview/spec only; app unchanged.
- 0.3 draft, 27 September 2026: added precision/unit/time conventions, invalid-input and announcement gaps, complete modal focus contract, light-theme/browser-chrome boundaries, and the shared-token/visual-regression handoff. App unchanged.
- 0.2 draft, 27 September 2026: added the complete semantic-role inventory, active green TARGET MET, independent verdict/comparison/curve mapping, condensation and unavailable-data accents, chart overlays, feedback panels, legacy-only rules and semantic visual specimens. Corrected the incomplete verdict list. App unchanged.
- 0.1 draft, 27 September 2026: current-app audit; proposed warm neutrals, full state matrix, reusable component/geometry rules, contrast checks and implementation acceptance checklist. No application styling changed.

## Earlier generalised recommendation wording

The prior repository skill specified the following general OPEN IF NEEDED wording. It is preserved as earlier guidance; the current renderer has conditional secondary lines, documented in [Recommendation/chart](../design/recommendation-chart.md). Do not apply this historical pair to every outcome.

- Primary: `No clear drying benefit.`
- Secondary: `Open briefly for fresh air; humidity may not fall.`
