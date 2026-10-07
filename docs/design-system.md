# Is it dryer out — design system

**Version:** 1.6 · **Updated:** 6 October 2026 · **Status:** v0.7.5

This is a reusable specification for the app. The warm-grey controls and component states were implemented in v0.7.0, the revised verdict and AH chart colours shipped in v0.7.1, and the Indoor summary strip with subsequent layout and focus refinements shipped in v0.7.2. The current shared-temperature moisture comparison and time-based chart gradient are described below. Fixed layout spacing, control/icon sizes and ordinary radii follow the 4px grid shipped in v0.7.4.1. Broader typography normalisation and new inline numeric validation remain proposals. The evidence captures in section 2 show the earlier app and are retained for comparison.

Open [the visual review board](design-system.html) for colour and state specimens. This document records the rules; the board illustrates them.

### Decision ledger

Your feedback set the warm-neutral direction, kept the AH chart's separate white/amber/coral roles, and specified the Opening border and fill change. The verdict gradients and chart amber/coral values were updated on 28 September 2026. The number-field clipping, primary-focus and angled CHECKING loading treatments are reflected in the local app. Other weather semantic colours remain as inventoried.

The 27 September instruction to apply this system authorised the displayed warm token values and visible state treatments. The local app now includes the related missing hover tokens, a 44px Refresh page target, visible mobile Location Close and a matching installed-app launch background. Typography normalisation and new inline invalid-input feedback remain separate follow-ups.

In v0.7.2, the app gained an optional compact Indoor summary above the verdict, saved display and launch preferences, pull to refresh for outdoor weather, relative reading ages and 20px outer card corners. The 24 h / 48 h choices have a 4px gap, and keyboard focus rings sit outside most visible controls. These refinements are not part of the historical v0.7.1 release record.

## 1. Purpose and principles

### Ventilation timer (v0.7.4)

Timer and Indoor sheet titles match Settings and Ventilation settings at 1.2rem, using the same inherited heading font and weight.

Inline verdict times retain the original text width and line height. The user chose original verdict spacing over 44px touch targets; targets follow the duration text rather than expanding into adjacent lines.

The timer's compact numeric field shows min beside the value, with room for three digits and an accessible duration label. Numeric ruler fields have a 52px outer height, including their border and padding. The field-to-ruler gap is 8px and the ruler-to-Start gap is 20px. There is no timing-context paragraph in the sheet. The mobile drag handle matches the other sheets. Start is the only bottom action; dismissal uses the header close control, Escape, outside tap or sheet drag.

On iPhone/iPad, each duration in the two verdict lines is an inline button with a dotted, 50%-opacity underline and distinct pressed/focus states. Qualifiers stay outside the button; combined hour/minute durations stay together. Other devices retain plain emphasized text.

The timer uses the Indoor sheet geometry and a stacked 1-180 minute ruler: 1-minute ticks, labelled 5-minute marks, and 8px spacing. Typed entry remains available. Start is disabled for empty, fractional, or out-of-range values. Draft minutes are temporary and independent of saved readings/settings; refresh does not replace edits. The verdict duration's accessible name retains its timing context. Drier-air windows are not presented as recommended opening durations; capped target estimates create a recheck reminder.

Clock owns the timer after the Shortcut handoff; the web app displays no countdown or success claim. Start closes the sheet and completes focus/scroll cleanup before launching Shortcuts, in the same activation handler. Invalid input keeps the sheet open. Closing restores the clicked duration's focus, or the verdict heading if it has been replaced, using the shared focus-return rule below. A 32px-wide, 44px-tall help control, with its visible symbol centred and 12px from the title, opens a compact setup popover with Install Shortcut, linking directly to iCloud. Its narrower width is a user-requested exception to the usual 44px target. Escape dismisses the popover before the sheet; clicking elsewhere or closing the sheet also clears it. The user confirmed timer handoffs from Chrome, Safari and the Home Screen web app, plus the airplane-mode alarm and sharing link. Fresh import and recovery/locked-phone scenarios remain separately unverified.

- Help someone decide whether opening windows reduces indoor moisture, and for approximately how long.
- Put the compact Indoor reading controls first, followed by the prominent recommendation, evidence and settings.
- Use warm neutrals for controls and structure. Reserve semantic colours for weather, moisture, and the explicitly coloured camera recognition status boxes.
- Use white surfaces, clear type, restrained borders, and no decorative shadows.
- Separate selected, pressed, focused, disabled, and loading states. Each conveys a different fact.
- Preserve familiar native interactions: labelled inputs, keyboard controls, radio groups, buttons, and disclosures.
- Make the system repeatable through named roles, not colour names or one-off selectors.

## 2. Pre-implementation review evidence and findings

This section preserves the baseline audit and its captures. Present-tense observations in the tables below describe the app **before** the warm palette pass. The local implementation status is recorded in sections 3 and 8.

Source review: `index.html`, `styles.css`, `app.js`, `manifest.webmanifest`, and the repository UI skill. Browser inspection: the local app at `http://127.0.0.1:8766/`. No readings, location, or plan selections were changed for this review.

| Step | Surface | Health and evidence |
|---|---|---|
| 1 | Ventilation settings | Clear hierarchy and native radio semantics. Selected Opening and selected Room size currently use different visual signals; no dedicated pressed state for the option tiles. [Capture](design-system-evidence/01-ventilation.png). The blue highlight on the word Opening is browser text selection, not a component colour. |
| 2 | Dashboard, chart, details and footer | Recommendation and chart are integrated; supporting controls contain mixed warm and green-grey neutrals. Refresh page is 32px high. [Capture](design-system-evidence/02-dashboard.png). |
| 3 | Indoor reading sheet | Typed fields and rulers share a clear pattern. Speak is a separate pill family; neutral values and tick styles remain hard-coded. [Capture](design-system-evidence/03-indoor.png). |
| 4 | Location picker | Search and recent-place hierarchy are clear. Recent-row and remove-button hover rules reference an unset variable. Mobile dismissal has no explicit visible Close button. [Capture](design-system-evidence/04-location.png). |
| 5 | Desktop dashboard | Current shell remains a centred single column, measured at 496 CSS px in a 1280px viewport. [Capture](design-system-evidence/05-desktop.png). |

### Baseline findings and proposed resolutions

| Priority | Finding | Proposed resolution |
|---|---|---|
| High | `--button-hover` is unset on location recent rows, remove/clear buttons and sheet close buttons. The location status container also uses it without a shared default. | Give every control family complete state tokens; use a surface token for status containers. Include pressed and disabled states. |
| High | Pale borders alone do little to advertise editable values. The previously suggested `#D8D2CA` is only 1.50:1 against white. | Keep that colour for decorative dividers; introduce `#8D857B` for boundaries necessary to identify an input or control. |
| High | Edit's entire card is clickable through a stretched pseudo-element. Moving feedback only to the tiny pill would hide this larger interaction. | Retain whole-card activation and card-level focus/press feedback; make the pill follow the same state colours. Do not shrink the hit area as a colour cleanup. |
| Medium | Refresh page has a 32px target while most other controls have 44–48px targets. | Keep its compact appearance inside a minimum 44px hit area. |
| Medium | Opening and Room size have selection and hover styling but no explicit pressed styling. | Use the state matrix below; preserve the selected border during hover and press. |
| Medium | Font sizes range across many near-duplicates; some labels and details are 11px, and dimension inputs inherit small text. | Adopt named type roles; use 16px for typed form values and 12px as the default smallest metadata. Retain 11px only for chart axes. |
| Medium | Minor ticks and labels fade toward ruler edges. | Fade decorative ticks; keep meaningful numeric labels legible. Verify limits and narrow paired rulers. |
| Medium | Three sheets have different DOM/layout histories, and mobile close buttons are hidden. | Share sheet geometry and dismissal conventions. Show a visible Close action in Location, where there is no Done footer; keep auto-close on selection. |
| Medium | Installed-app launch background is `#EDF4F1`, while the app page is `#F2F0ED`. | Align the manifest launch background with the page when this design system is implemented. Review browser chrome separately. |
| Maintenance | CSS has repeated overrides; the UI skill still describes paired steppers and a two-column desktop layout that the current code does not use. | Consolidate active component rules after visual approval, then align documentation to actual behaviour during the release documentation pass. |

### Review limits

The listed screens were inspected and captured in this run. Custom panels, voice states, weather loading/failure, alternate verdicts, search-result/error states, reduced motion and forced colours were reviewed in source, not exercised live in this audit. No microphone or device-location permission was requested. Earlier implementation tests are not evidence of a full accessibility audit. Actual iOS keyboard behaviour, screen readers, 200% zoom, all semantic colour pairs, and physical touch devices need the acceptance checks in section 10.

## 3. Colour foundations — implemented

### Neutral role tokens

| Token | Value | Purpose |
|---|---|---|
| `--surface-page` | `#F2F0ED` | Page and installed-app launch background; retain current page colour. |
| `--surface-panel` | `#FFFFFF` | Sheets, cards, input interiors and selected segmented tabs. |
| `--surface-control` | `#F0EEEB` | Light action buttons, segmented tracks and quiet status containers. |
| `--surface-hover` | `#E6E2DD` | Hover on light controls. |
| `--surface-pressed` | `#D9D3CC` | Temporary pointer/touch press. |
| `--surface-selected` | `#F0EEEB` | Light selected Opening fill; the thicker dark border carries selection. |
| `--border-subtle` | `#D8D2CA` | Dividers and decorative panel boundaries. |
| `--border-control` | `#8D857B` | Input boundaries and other essential control edges. |
| `--ink-main` | `#403C37` | Ordinary text, icons, selected borders, major ruler marker and light-surface focus rings. |
| `--ink-muted` | `#706A63` | Labels, units, secondary text and meaningful tick labels. |
| `--ink-inverse` | `#FFFFFF` | Primary-button and recommendation text. |
| `--surface-primary` | `#202725` | Existing dark primary button, retained. |
| `--surface-primary-hover` | `#343A38` | Existing primary hover, retained. |
| `--surface-primary-pressed` | `#111714` | Existing primary press, retained. |
| `--overlay-scrim` | `rgb(0 0 0 / 40%)` | Existing modal backdrop. |

Primary colours are a deliberate retained exception to the warm-neutral conversion. Do not globally replace every dark or green-grey literal: some belong to weather semantics, chart data, or the primary-button family.

### Contrast checks

Calculated from the implemented opaque sRGB values using relative luminance:

| Foreground / background | Ratio |
|---|---:|
| Main ink / control surface | 9.45:1 |
| Muted ink / white | 5.34:1 |
| Muted ink / page background | 4.70:1 |
| Control border / white | 3.64:1 |
| Control border / control surface | 3.14:1 |
| Subtle border / white | 1.50:1 |
| White / dark primary | 15.24:1 |

Use at least 4.5:1 for normal text. Where a boundary or graphic is necessary to identify a control/state, check at least 3:1 against adjacent colours. Decorative dividers need not carry that job. These are pair checks, not a compliance certificate. Sources: [W3C text contrast](https://www.w3.org/TR/wcag/#contrast-minimum) and [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/understanding/non-text-contrast.html).

### Semantic colours — current implementation

There are three independent decisions: **plan outcome**, **current moisture comparison**, and **forecast moisture difference**. Never apply one colour state globally. A green TARGET MET recommendation may coexist with a blue Outdoor card; a red temperature-limited recommendation may also coexist with blue, drier outdoor air. Both are valid.

The following inventory is source-verified in `planTone()`, `renderRecommendation()`, `compareMoisture()`, `render()`, `renderAhChart()` and the final effective CSS rules. Alternate outcomes are source-verified, not newly exercised with live weather. The review board shows illustrative specimens, not captured alternate app states.

#### A. Recommendation and integrated chart surface

All gradients run at 145 degrees. These apply to the whole verdict panel, including its chart; the ventilation-summary footer remains neutral.

| Meaning / actual state | Current colour | Exact condition and displayed intent |
|---|---|---|
| Target satisfied (`open`) | `#025446` → `#137738` | `target-met`: **TARGET MET**, at or near the target, no ventilation needed now. Green is active, not unused. |
| Useful ventilation (`windows`) | `#214487` → `#056B97` | `good` and `slow`; also `forecast-limit`, `settling`, `too-cold` or `condensation` with a truthy `minutes ?? limitMinutes`. Normally **OPEN WINDOWS**, with duration/limit text. |
| Unsafe or adverse now (`closed`) | `#7B242E` → `#9E441D` | `below-minimum`, `wetter`, and `too-cold`/`condensation` without useful time. **KEEP CLOSED**. |
| Uncertain / no useful window (`caution`) | `#633F03` → `#756202` | Remaining plan outcomes, including uncertainty and forecast/settling outcomes without time. Usually **OPEN IF NEEDED**. |
| No current outdoor data (no tone class) | Solid `#10231F` | **Checking** while pending; **NO DATA** on failure. All previous verdict tone classes are removed. |

Panel base text is `#F9FFFC`; primary explanation and chart reading are `#FFFFFF`; secondary explanation is white at 78%; location metadata is white at 74%. These light-on-colour roles are separate from warm-grey text on white sheets. Keep white focus rings and translucent control feedback on the coloured panel.

Suggested semantic aliases for later implementation: `--verdict-target-start/end`, `--verdict-ventilate-start/end`, `--verdict-closed-start/end`, `--verdict-caution-start/end`, and `--verdict-unavailable`. Values stay as above. In particular, do not alias the no-data background to warm `--ink-main` and unintentionally recolour the whole unavailable panel.

#### B. Outdoor card and “Let in” humidity

The Outdoor and Indoor cards display absolute humidity at each reading's actual temperature. Their colour state is independent of the plan verdict: express both readings as vapour density at the indoor temperature, then compare that difference with its calculated uncertainty margin. At a shared air pressure, this has the same ordering as the humidity ratio used by the ventilation model. The displayed AH numbers can therefore have a different ordering from the colour state when temperatures differ.

| Comparison / class | Foreground | Card fill | Condition |
|---|---|---|---|
| Drier (`lower`) | `#1769AA` | `#E2F1FB` | Difference exceeds the positive margin. |
| Wetter (`higher`) | `#A23B2A` | `#FFE8DF` | Difference is below the negative margin. |
| Uncertain (`near`) | `#8A6700` | `#FFF3C4` | Difference lies within or on the margin. |

The card border is its foreground colour mixed at **18% with transparent**. The Outdoor heading, AH value/unit and temperature/RH/dew-point details inherit that foreground. The adjacent **Let in percentage** uses the same foreground, without a tinted background; its label and explanatory text remain neutral. The Indoor card remains neutral.

**Condensation risk** beneath Let in uses `#A23B2A` independently when calculated warmed RH is at least 100%; the visible percentage is capped at 100%. Never hide this risk by colouring it from the uncertainty state.

Existing tokens for these roles are `--windows/--windows-bg`, `--closed/--closed-bg` and `--caution/--caution-bg`. Future aliases may be `--moisture-drier-*`, `--moisture-wetter-*`, `--moisture-uncertain-*`, plus `--risk-text`; preserve their independent selection logic.

#### C. Chart curve and supporting layers

The AH line remains its own semantic colour family, separate from both the recommendation backgrounds and comparison-card foreground colours. Its amber and coral stops were lightened with the verdict palette update on 28 September 2026. This is not a claim that every contrast pairing has been formally validated.

| Element | Effective colour / opacity | Meaning |
|---|---|---|
| Wetter end of forecast AH curve | `#FFB3A8` (`--chart-wet`) | Outdoor air reliably wetter at the indoor reference temperature. |
| Full uncertainty interval | `#FFD27A` (`--chart-near`) | Moisture difference within ± the calculated margin at the indoor reference temperature. |
| Drier end of forecast AH curve | `#FFFFFF` | Outdoor air reliably drier at the indoor reference temperature. |
| Indoor reference line / label | White at 70% / white | Dashed comparison reference, not a forecast series. |
| Airflow bars / values | `#FFFFFF38` (about 22%) / white | Estimated ACH; bars do not encode wet/dry categories. |
| Time/axis text | `#FFFFFFD9` (about 85%) | Supporting annotations. |
| Grid / day separators | `#FFFFFF16` (about 9%) / `#FFFFFF4D` (about 30%) | Structure only. |
| Inspection cursor / point | White at 65% / curve colour with `#233D4E` outline | Selected forecast time; the point follows the curve gradient. |
| Selected moisture reading | Curve colour at the selected point | The g/m³ value follows the line; time and ACH stay white. |
| Chart top divider | `#FFFFFF40` (about 25%) | Separation within the same coloured surface. |

The curve height still plots actual outdoor AH against the actual indoor AH reference. Its colour is evaluated separately at each forecast time by comparing vapour density at the indoor temperature, using that time's calculated uncertainty margin. The gradient runs left to right through forecast time, with smooth transitions between sampled colours. Amber covers the full ±margin interval; coral and white blend outside it. The selected point and g/m³ reading use the curve colour at that time. Colour need not follow the curve's vertical position relative to the dashed indoor line when air temperatures differ.

The chart uses brighter colours than the pale comparison cards because it sits on the dark recommendation surface. Do not substitute `#1769AA`, `#8A6700` or `#A23B2A` for these chart strokes. Contrast against each verdict gradient still needs rendering checks; this document does not claim all semantic combinations pass.

The review board includes an illustrative full chart, with the forecast curve, indoor reference, airflow bars and values, local-time labels, grid and day separators, and inspection cursor shown together. It illustrates the time-based colour progression and the current loading skeleton. The values in the specimen are examples, not a live forecast or an extra chart legend.

#### D. Loading, unavailable data and feedback

| Place / state | Colour | Rule |
|---|---|---|
| Failed weather timestamp/status | `#FFAB99` | Readable error accent on the dark no-data panel; distinct from moisture-risk red. |
| Outdoor values and Let in unavailable | `#899493` | Neutral unavailable values, displayed as `--`; previous comparison classes are removed. |
| Skeleton bars / labels / day separators | `#FFFFFF0D` (about 5%) / `#FFFFFF1A` (about 10%) / `#FFFFFF1A` | Placeholders only; never data or a verdict. |
| Skeleton indoor reference / label | White at 35% / `#FFFFFFA6` (about 65%) | The retained actual indoor reference is subdued. |
| Shimmer | White peak opacity 5.5% | Loading only; absent after failure and disabled for reduced motion. |
| Loading secondary-line placeholder | `#FFFFFF1A` | Neutral content placeholder. |
| Disabled chart-range controls | Control at 45% opacity | Disabled interaction, not an uncertainty colour. |
| Voice listening/transcript panels | `#F1F4F3` with muted text `#5D6F69` | Current neutral feedback; no dedicated red error or green success variant. Proposed warm surface can replace these neutrals. |
| Voice waveform | `#111A17` at 72% opacity | Current activity indicator; activity is not success. |
| Location pending/error messages | Muted `#5D6F69`; status fill currently references unset `--button-hover` | Current errors are communicated in text. Correct the neutral token gap; do not silently invent semantic red/green states. |

**Loading motion:** `CHECKING` has a diagonal light sweep (110° gradient, 2.4-second pass), and the chart skeleton's faint sweep is tilted about 18° with a 1.6-second pass. Both animate only while loading. The label remains steady text for assistive technology; the moving highlight is decorative. Failure has no sweep. Reduced motion shows a static white `CHECKING` label and no shimmer.

#### E. Legacy styles, not active system components

`forecast-pill.tone-*` rules remain in CSS but the current HTML/renderer does not create forecast pills. Their legacy fills are green `#DFF8ED`, blue `#E2F1FB`, amber `#FFF3C4`, red `#FFE8DF`; border colours are respectively `rgba(8,127,91,.28)`, `rgba(23,105,170,.28)`, `rgba(138,103,0,.28)` and `rgba(162,59,42,.25)`. `--status-open: #087F5B` and its pale-green fill belong to this older family. Do not confuse those legacy pale-green pills with the **active green TARGET MET gradient**.

Likewise, `.comparison-value` pill treatments and earlier stand-alone chart colours are superseded/not used by the present dashboard. `--open: #111A17` is a near-black control/waveform colour despite its name, not the green target-met semantic colour. Keep an explicit migration map instead of treating every token named “open” as success.

#### Semantic system rules

- Preserve each surface's independent state calculation and visible wording; never use colour as the only explanation.
- Keep semantic roles separate from action roles: green does not mean a selected button, red does not mean every disabled control, and amber does not mean loading.
- Verify green, blue, red, amber, loading and failure recommendation surfaces; then all three Outdoor/Let in states and the independent condensation warning.
- Check mixed valid combinations, including green target-met + blue drier comparison and red temperature limit + blue drier comparison.
- Keep the 24/48-hour control's own selected/focus states legible on every verdict background.

## 4. Typography — proposed normalisation

Keep the existing font stack: Inter if available locally, then system UI, Segoe UI and sans-serif. No new font download is needed. Values below are CSS px equivalents at a 16px root; encode reusable type tokens in rem.

| Role | Size / line height | Weight | Use |
|---|---|---|---|
| Reading | 34 / 1.1 | 700 | Editable indoor and ventilation readings. |
| Indoor summary reading | 22 / 1.2; 20 at 360px and below | 700 | Temperature and RH in the top strip. |
| Verdict | 32 / 1.1; 24 on narrow screens | 700 | Main recommendation; allow wrapping. |
| Metric | 28 / 1.1 | 700 | Moisture card values; 24 for narrower cards. |
| Sheet title | 20 / 1.25 | 700 | All sheet headings. |
| Body / typed form value | 16 / 1.5 | 400; 700 for values | Prose and standard form inputs. |
| Control / section label | 14 / 1.4 | 400; 650 for actions/headings | Buttons, option names and section labels. |
| Metadata | 12 / 1.4 | 400 | Units, timestamps, subtitles. |
| Chart annotation | 11 / 1.3 | 400 | Deliberate compact-chart exception. |

Use tabular numerals for changing readings, estimates and timestamps. Keep units visually secondary but semantically included in labels. The Indoor strip uses 12px muted units and an 11px uppercase category label, matching the Indoor comparison card. Use sentence case elsewhere; uppercase is reserved for the main verdict and short card/category labels. Keep explanatory copy out of primary controls.

## 5. Geometry, layout and motion

### Camera readings

The Indoor heading has matching camera and microphone icon buttons with 44px circular touch targets, accessible names and the existing focus conventions. Camera capture and review are alternate views in the same sheet; manual rulers and Done are hidden until returning to manual input. Back remains visible during scanning, including on narrow phones: a transparent chevron/text action with 14px text, a 44px minimum height and visible keyboard focus. Both camera views have a 44px question-mark help button beside the title. Capture help contains framing/sharpness/reflection guidance; review help contains drag instructions and value correction. Hover/focus shows the tooltip; tap toggles it; Escape or outside interaction dismisses it without consuming photo editing. Changing views closes help. Use one compact sentence below the preview: “Keep the main digits sharp and visible.” Keep detailed guidance in help.

Capture uses a 4:3 canvas live preview with a capability-dependent flash toggle and no inner guide or dimming overlay. Inside it, place 1×, 3× and 5× buttons in a bottom-centred, borderless dark translucent pill with 4px inner spacing. Buttons have at least 44px targets, native keyboard activation, visible outer focus and aria-pressed selection. Selected buttons use a light solid surface and dark text; forced colours use Highlight/HighlightText. Keep at least 8px between the zoom pill and flash. Selection updates immediately and remains interactive while camera changes coalesce; disable presets during capture and keep the shutter disabled until camera/framing settlement. Reset to 1× on retake. Preview notifications occupy the top-centre with 12px edge spacing and compact wrapping padding. The Take photo shutter centres a decorative 20px camera icon and its label together with an 8px gap, matching Retake artwork and retaining its accessible name. Show “Capturing…” for native video-frame capture or “Hold still — taking photo…” throughout still capture. Blur only preview presentation during switching; preserve unfiltered source pixels. Preview dimensions and capture framing remain consistent. Review retains the original framed image, unit-inclusive outlines with intrinsic-width, single-line labels separated by at least 4px and kept within photo edges. Prefer Temperature above-left and Humidity above-right, shifting or staggering full names when needed; connectors link displaced labels to their boxes. Keep labels clear of resize handles and Retake, preserve valid placement during edits, and recompute after viewport changes, normalised crop previews and side-by-side editable fields. Put the polite live reading status in a full-width box above the fields, with 12px corners/padding, a decorative 16px icon, an 8px gap and wrapping 14px text. Blue indicates processing/information, green valid values ready for review, amber missing/invalid/ambiguous readings or assignment, and red recognition failure. Use existing semantic backgrounds; ready text, icon and border use semantic green #067A57 (4.78:1 against --status-open-bg). Green never means saved: explicit confirmation is required. Animate only processing and respect reduced motion. A borderless dark translucent camera-icon + Retake pill sits 12px from the photo’s bottom-right, with a 44px minimum target, visible keyboard focus and native Enter/Space activation. Confirm readings is the single full-width bottom action, in document flow so it cannot cover draft fields. Only camera review suppresses vertical elastic overscroll; retain overflow scrolling when content exceeds the visible viewport and keep header drag dismissal and photo editing intact.

Confirm readings persists reviewed values; disable it during gestures, processing, unresolved assignment, or incomplete/invalid drafts. Retake remains available during recognition and immediately clears the photo, boxes and drafts. Never show preset boxes on an empty photo. Move and resize detected boxes directly, or draw on empty photo space without selecting a field first. Read automatically on release or keyboard adjustment; taps and cancelled gestures preserve drafts. Units assign new boxes, with a post-draw Which reading is this? choice only when needed. Both units require tightening; unassigned boxes may be discarded. Existing boxes retain their field, and contradictory units leave it unresolved. Preserve the unaffected field and ignore stale results. Keep scrolling available outside the photo, photo gestures separate from sheet dismissal, and focused values visible above the keyboard. Source metadata remains session-only.

Camera failures provide manual entry and retry. Permission guidance is short, expandable and distinct from device availability or recognition failure. Sheet dismissal, visible-viewport sizing, focus return and reduced-motion behaviour retain the shared conventions below.

### Shared scale

- Fixed spacing and layout dimensions follow a 4px grid. Shared spacing tokens cover 4, 8, 12, 16, 20, 24 and 32px; larger dimensions remain multiples of 4. Round to nearest, with halfway magnitudes rounded upward; preserve negative signs and keep positive spacing at least 4px.
- Grid exceptions: typography/line height/letter spacing; thin borders, dividers, ruler markers, graphic strokes and focus-ring geometry; circular/pill radii; screen-reader hiding geometry; fluid/text-relative dimensions, safe areas, chart data and animation-driven waveform heights, and gesture/viewport positions. Border compensation and centring calculations may use smaller inner offsets to achieve grid-aligned outer geometry.
- Forecast range tabs: use a 6px inner radius for selected, hover and pressed surfaces, inside an 8px outer track. This is an explicit user-selected exception to the 4px grid. Preserve 44px targets and the existing outer focus ring.
- Control radius: 12px for fields and option tiles; 12px for main action buttons and custom panels; 8px for compact icon feedback; pill radius for short secondary actions.
- Current surface radius: 20px for the Indoor summary strip, verdict and its footer, and moisture comparison panel; 16px for the inner Outdoor and Indoor comparison cards; 24px for sheets.
- Borders: 1px ordinary, including unselected Opening options; 2px for selected options. Compensate padding by 1px when the border grows so selection never shifts dimensions or content. Keyboard focus is a separate 2px ring with a 2px clear gap **outside** the visible control. Use main ink on light surfaces and white on the coloured verdict. The ventilation summary and dashboard explainer headings keep their wider horizontal focus shapes so text and chevrons have breathing room.
- Targets: at least 44 × 44px; primary actions at least 48px high. Compact visual pills may sit within a larger hit area. Room options use 60px minimum height; Opening tiles retain 64px.
- Numeric ruler and custom dimension/airflow fields have 52px outer height with border-aware inner inputs. Ruler value inputs cannot shrink and reserve 4px beyond their character width; paired Ventilation fields and the Indoor RH field are 100px wide so two-digit readings and their units fit without clipping. The Indoor temperature field is 128px wide with 8px horizontal padding and a compact 3.5ch-plus-4px input for readings such as 32.0. RH ticks use 16px spacing and target-RH ticks use 12px; temperature and timer spacing stays unchanged. The settings switch is 48 × 28px with a 20px thumb, 4px outer-edge insets and 20px travel. The timer help symbol is 20px inside its retained 32 × 44px target; compensate its centring inset to give a 12px visible title-to-symbol gap.
- No decorative shadows. A selection edge or focus ring is an interaction signal, not elevation.

### Responsive rules

- Preserve the current centred single-column app shell, maximum 31rem (496px). The old two-column instruction is not current implementation and is not proposed here.
- Page and reading order when enabled: Indoor summary strip; recommendation with integrated outdoor chart; ventilation-summary footer; moisture comparison; supporting explainers; page footer. Hide the strip entirely from layout and reading order when its preference is off. Keep the recommendation visually prominent.
- Apply top safe-area spacing to the page shell so it protects the Indoor strip.
- Keep 20px internal panel/sheet padding; use 16px at 320px widths if needed. Use 16px section spacing and 8px between related controls.
- Sheets become centred dialogs from 40rem (640px); mobile uses bottom sheets. Preserve the existing visible-viewport/keyboard adjustment and 90% maximum-height behaviour.
- Indoor rulers stay stacked. Ventilation rulers stay paired. Room choices stay in four columns; Opening choices in two. Wrap labels and allow height to grow.
- At 360px and below, stack the Indoor summary's age below its heading, tighten the reading/action gaps, and retain 44px Edit and microphone targets without horizontal overflow.
- At severe text enlargement, allow choice grids and dimensions to stack rather than clip. This is an accessibility fallback, not a default mobile redesign.
- Three room dimensions share one panel; show calculated volume on a full-width row. Custom airflow may wrap its value below the label.
- Keep content scrolling inside sheets, prevent background scroll, preserve scroll position on close, and return focus to the opener. All five sheets restore focus quietly unless the opener had visible keyboard focus when activated; typing inside a touch-opened sheet does not change that decision. Subsequent keyboard interaction restores normal focus styling. Keep the same rule for direct outlines and compound card, summary and Location indicators. Automatically focused headings have no outline; replaced openers and automatic launch use their existing quiet fallback targets.
- Hide all sheet header close buttons below 640px; retain 44px close controls on larger screens. Keep existing Done actions, outside-tap dismissal, Escape and mobile drag dismissal. Do not add bottom close actions to Settings, Location or Timer. Preserve header spacing when hiding controls.
- Control transitions: 120ms; sheet/disclosure transitions: 160ms. Reduced motion removes cosmetic transitions and ruler momentum. Keep physical gesture response immediate.

## 6. Component contracts and state matrix

### State rules

| Family | Rest | Hover | Pressed | Selected / focused |
|---|---|---|---|---|
| Light action: Speak, Refresh page, secondary actions | Control surface + main ink | Hover surface | Pressed surface | 2px main-ink outer focus ring, 2px clear gap. |
| Ghost/icon action: close, clear, remove, recent rows | Transparent + main/muted ink | Hover surface | Pressed surface | Same focus ring; accessible name required. |
| Primary: Done, Apply, Use current location | Retained dark primary + white | Retained primary hover | Retained primary pressed | On white sheets, a 2px main-ink outer focus ring with a 2px clear gap. On dark semantic panels, use a white outer ring with the same gap. |
| Room size segment | Transparent on control-surface track | Hover surface | Pressed surface | White selected surface, 2px main-ink border and 700-weight name; independent outer focus ring above adjacent options. |
| Opening tile | White + 1px control border | Hover surface | Pressed surface | Light `#F0EEEB` fill, 2px main-ink border and 700-weight name. |
| Editable value / ruler | White + control border | Keep stable | Native editing / adjustment | Main-ink outer ring around value and unit together, or around the complete visible ruler outside its side fade. |
| Chart range | Translucent white track on semantic panel, 4px between the 24 h and 48 h tabs | White 10% overlay | White 18% overlay | White selected tab with dark text; independent white outer focus ring around the active tab. |

Precedence: disabled blocks hover and press; pressed overrides hover fill; selected border and weight persist; keyboard focus overlays all enabled states. Use native `disabled`, checked radio state and `aria-pressed` where appropriate. Do not implement a toggle by changing colours alone.

Disabled controls use 45% opacity on the complete control, no hover/press animation, and a default cursor. Loading additionally exposes busy/status text; a disabled appearance alone does not explain an in-progress operation. Do not hide a focused action without moving focus deliberately.

### Specific behaviours

- **AH chart:** render the forecast curve as one continuous high-resolution bitmap at its normal display size so its semantic colours persist through iPhone scroll and zoom. Tapping and dragging inspect values without a browser tap flash or chart outline. Keyboard focus remains visible as an outer ring, and arrow keys plus Home/End continue to inspect values.
- **Camera loading:** keep progress inside the disabled camera entry button, replacing its icon with a 20px spinner (static with reduced motion). Add no loading copy below the heading. On failure, restore the button and show “Camera couldn’t load. Try again or enter readings manually.” in muted 12px text below the heading actions and above manual controls, announced as a status. Clear this feedback on retry or dismissal.
- **Indoor summary:** an optional flat white card with a subtle border and 20px radius sits above the verdict. It shows indoor temperature and RH with muted °C / % RH units and a faint, vertically centred 1px divider. Edit opens the existing Indoor sheet; the separate microphone button appears only when speech recognition is available and opens its voice view from one tap. Keep the detailed Indoor comparison card for AH and dew point. The strip is hidden by default.
- **Settings:** a 44px cog beside Refresh page opens a bottom sheet on mobile and centred dialog on desktop. Its switches save immediately in browser storage, grouped as Indoor readings (Open Indoor readings on launch: on; Show Indoor summary: off), Input buttons (Show camera button: on; Show voice button: off), and Camera (Use still photos: off; Auto flash: on). All groups are expanded on a warm grey sheet, separated by 16px. Section headings use 16px semibold text with 8px spacing above white cards. Cards have 20px corners and 16px horizontal padding; inset separators appear between rows, with none above the first row. Rows have a 48px minimum and no gaps; labels wrap. Still-photo explanatory text stays beneath its option inside the Camera card, before the Auto flash separator, and is associated with its switch. Auto flash has the description “Automatically turns on lighting in low light.” beneath its row, associated using aria-describedby. Missing or invalid saved voice visibility uses off; valid saved choices remain unchanged. Launch means a full page load. A manually opened sheet returns focus to its opener; the automatically opened Indoor sheet focuses the location button on close. Settings returns focus to the cog. The camera-help shortcut focuses Auto flash and scrolls its row into view on short screens. Let the footer credit and actions wrap without clipping at narrow widths.
- **Pull to refresh:** a downward drag from the top of the touch page reveals three dots and a cue on the same continuous white backing as the ventilation footer. Cue text uses `--ink-main` (#403C37); active dots use `--ink-muted` (#706A63), and inactive dots use `--border-subtle` (#D8D2CA). The success icon stays green and the failure icon stays red. Give the dot row and result icon the same 24px height so the text keeps a fixed vertical position through pulling, updating and either result; the cue remains 76px high. Dots light in sequence, with `Keep pulling` changing to `Release to re-check` once the full cue is visible. The optional Indoor summary, cue and footer stay still while the verdict slides over the footer with resistance from the start, approaching half its rendered height. Once the verdict crosses the footer's lower border, the moisture comparison and all following content move by the excess distance, keeping the footer-to-next-card gap. A sufficient pull refreshes outdoor weather once without reloading the page; on release, the verdict settles to the full cue height through the request and brief result, then springs closed. Keep the success or failure icon visible until the return completes, then reset to three dots. Short, horizontal, interrupted, busy, interactive-control, chart and open-sheet gestures do not trigger refresh. The Indoor summary scrolls normally outside this gesture; reduced motion closes and resets together without a spring or dot pulse. Native-browser gesture suppression is best effort on iOS Safari, so retain the refresh buttons.
- **Reading age:** after an indoor edit, show `Just now` for the first minute, `1m ago` through `59m ago`, then `1h 0m ago` and higher in both the strip and Indoor sheet. Prefix the strip age with a decorative dot; use no `set` or `Updated` label. Refresh each minute and on return to the visible page. Hide both age labels when there is no valid saved timestamp; retain the absolute device-local timestamp as a title.
- **Weather check status:** show `Checked just now` for 60 seconds after a successful outdoor update, then `Checked HH:mm` in the selected location's time zone. Recalculate on return to the tab. Keep `Updating…` and `Update failed` distinct, and retain full timestamps in Weather data.
- **Edit / Indoor card:** retain the current whole-card action. Warm the card's subtle interaction tint and the Edit pill together. Outline the card for keyboard focus, avoid a second Tab stop, and keep the pill label visible. This corrects the earlier suggestion to show feedback only on the pill.
- **Rulers:** fixed centre marker, labelled major ticks, native range semantics and direct numeric entry. Horizontal adjustment yields to vertical scrolling. Cancel momentum on new interaction, close or backgrounding. Show number + unit as one field. Draw keyboard focus outside the ruler so its edge fade cannot obscure the ring.
- **Ranges:** indoor temperature 10–32°C in 0.1°C steps; indoor humidity 20–90% in 1% steps; minimum indoor temperature 16–26°C in 1°C steps; target humidity 40–65% in 1% steps. Min-temperature and target fields stay the same width. Saved fractional minimum temperatures round to whole degrees.
- **Room size:** 30 / 50 / 80 m³ and Custom. Custom reveals dimensions and calculated volume; keep values when switching away. Room-size options are a single native radio group.
- **Opening:** slightly open / one window / cross-ventilation / custom airflow. Show `Est. … air changes/hr` beside or below the heading. Custom airflow reveals one labelled input. Current weather adjustments remain part of the calculation, including custom airflow.
- **Persistence:** manual readings and ventilation changes save immediately. Done closes the sheet; it is not an Apply or Save step. Voice uses an explicit review and Apply step.
- **Location:** search, recent places, remove action, current-location action, pending/error/retry and empty-results states share the same tokens. Selecting a place closes the sheet. Removing a recent place must remain a separate 44px action. Propose a visible Close action on mobile Location.
- **Voice:** retain the existing recording lifecycle. Use neutral status/transcript panels; distinguish Ready, Listening/Hearing, review, error and unavailable through wording and controls. A moving waveform represents available audio levels, not proof of transcription. Styling must not alter microphone permissions, retained streams or iOS recovery policy.
- **Accordions:** full-width 48px headings, one chevron convention, subtle dividers, no card frame. Preserve open states through updates. Default only the recommendation explanation open.
- **Explainer order:** `Why this recommendation?` (open initially), `Glossary`, `How estimates work`, then `Weather data`. The first explains the live calculation; the glossary defines AH, RH, DP, ACH, Let in and room volume; Weather data contains provider, request location, freshness, attribution and source links. Keep the final `By Ziggy Qiao · GitHub` credit outside the accordions, with Settings and Refresh page as footer actions.
- **Links:** distinguish inline links with underlining; standalone named source links may use weight plus underline on interaction. Keep browser destinations explicit.
- **Icons:** reuse the existing simple line icons, currentColor, consistent 2px strokes where applicable, normally 16–20px inside a 44px target. Hide decorative icons from assistive technology; name icon-only buttons.

## 7. Data and content states

| State | Required communication |
|---|---|
| Loading outdoor data | Clear checking message, non-data placeholders, disabled chart inspection, indoor readings retained. |
| Outdoor request failed | Explicit unavailable message and retry; never show old outdoor results as current. |
| Ready | Local-time labels, timestamp, forecast horizon and inspectable chart values. |
| Uncertain / little benefit | Text explanation and existing amber semantics; avoid inventing a precise duration. |
| Saved / changed manual value | Updated number, estimate and summary; no extra success toast or save step. |
| Invalid numeric input | Retain the last valid value under existing behaviour. If recovery is revised later, add inline text; never use colour alone. |
| Search empty / no match / error | Distinct messages; keep search editable and recovery available. |
| Voice unsupported / error | Manual entry remains usable; review before applying recognised values. |

Maintain existing main verdicts: TARGET MET, OPEN WINDOWS, KEEP CLOSED, OPEN IF NEEDED, plus Checking and NO DATA for unavailable weather. Keep uncertainty language, estimate qualifiers, local times and unit notation consistent: °C, %, m³, m³/h, air changes/hr. Explain ACH in the glossary rather than adding technical copy to every control.

## 8. Implementation map and remaining work

1. The main stylesheet now defines the warm role tokens and maps the existing `--bg`, `--panel`, `--ink`, `--muted`, `--line` and button-family variables to them. Essential input boundaries use the stronger control-border role.
2. Neutral actions, options, fields/rulers, location/voice surfaces and footer interactions use those roles. Recommendation and AH chart semantic colours remain separate.
3. The manifest launch colour matches the page. Outer focus rings, Opening selection and loading sweeps are implemented. The Indoor summary and related refinements shipped in v0.7.2.
4. Future work: consolidate any obsolete component rules after checking remaining users. Treat broader typography/geometry normalisation and inline numeric validation as separate reviews.
5. A requested push or release remains the trigger for repository release documentation and cache-version work.

## 9. Maintaining the system

- The implemented neutral palette and state rules are approved for the local app. Product CSS and behaviour remain authoritative for the running build.
- Keep proposals marked as such and record approved changes in the revision log. Do not promote unaccepted alternatives to rules.
- New components select a family and role tokens first. Any new token must have a use case that an existing token cannot express.
- Add exceptions to the relevant section with a reason, not as an unexplained late stylesheet override.
- Update the spec and visual specimens together when a rule changes; record screenshots only after the implementation is verified.
- Keep semantic weather colours, voice lifecycle policies and model calculations out of neutral-theme refactors.
- Git and cache-version work is handled during release preparation, separate from design-system iteration.

### Remaining contracts added in the completeness review

These close documentation gaps. Proposed behaviour remains subject to review; no new app behaviour is approved by recording it here.

| Area | Current implementation | Recorded rule / remaining decision |
|---|---|---|
| Number precision | `formatTemp()` always produces one decimal; minimum-temperature summary strips `.0`. RH rounds to an integer; AH and estimated ACH use one decimal. | Use one decimal for measured/projected temperature and AH; whole degrees for the minimum-temperature setting wherever mentioned; whole RH; one-decimal estimated ACH. Strip unnecessary `.0` from room volume/airflow. Formatting must not change the underlying calculation. Normalising the minimum-temperature wording is proposed. |
| Units, durations and missing values | UI uses °C, %, m³, m³/h and g/m³; an unused `formatMoisture()` helper still contains `g/m3`. Durations use min and hr; missing data uses `--`. | Keep units attached to their number across wrapping. Standardise display units as above, use `--` only for unavailable values, never for zero. Keep `Est.`/`About`/`Up to` qualifiers. Do not treat the unused helper as a visible bug. |
| Time and locale | Forecast/weather times use en-GB, 24-hour format and location timezone. The Indoor strip and sheet show elapsed time from the saved device-local edit timestamp; its absolute time is available as a title. | Forecast times are local to the selected location; indoor edit age uses the device clock. Test long ages, narrow widths and day/date rollover. No translated interface or alternative unit system is implied by this system. |
| Invalid / empty inputs | On committed change, blank, nonnumeric or out-of-range input silently returns to the last valid value. Reading fields snap to their increment. There is no shared inline validation component or `aria-invalid` treatment. | Preserve current behaviour until reviewed. Recommended follow-up: explain rejected values with inline text linked to the field; specify when it appears/clears and how it is announced. An error border alone is insufficient. This interaction needs approval and a specimen before implementation. |
| Focus and modal dismissal | Native dialogs focus the heading on entry and return to the opener quietly, preserving an indicator only if it was visible at activation. Escape, outside-start-and-end clicks and mobile sheet drag dismiss. Header close controls appear from 640px; existing Done actions remain. | Treat entry focus, Tab containment, dismissal and return focus as part of the sheet contract. No background interaction while open. Never interpret dismissal as cancelling already-persisted manual edits. |
| Live announcements | Entire recommendation and estimate use polite live regions; voice/location statuses also announce updates. | Test for repeated or competing announcements while dragging, searching or refreshing. Announce meaningful settled changes; do not announce every decorative animation frame. Any throttling change needs interaction testing rather than a CSS fix. |
| Theme and browser chrome | `color-scheme: light`; page and manifest launch `#F2F0ED`; HTML/manifest theme colour `#10231F`. | This is a light-theme system. Dark browser chrome is retained. Forced colours are an accessibility override, not a designed dark theme. App icon/favicon identity remains outside the neutral recolour. |
| Token handoff and visual regression | The app's role tokens live in `styles.css`; the standalone board still embeds illustrative styles. Its screenshots are historical pre-implementation evidence. | Keep board values aligned with the app tokens whenever roles change. A shared token source for the standalone board remains future maintenance work. Record reference views for each state family and compare them when changing tokens. |

### Verification still outstanding

The existence of a rule is not proof of its implementation. Before calling the system complete, verify real iOS keyboard behaviour, zoom/reflow, forced colours, reduced motion, screen-reader announcements, every semantic background/line pairing, and loading/error/empty/disabled states. Formal contrast checks across all four gradients remain an explicit verification task.

## 10. Acceptance checklist for implementation

- [ ] 320, 390, 640 and 1280px widths; 200% text/zoom; no clipped labels or horizontal scrolling.
- [ ] Whole sheet reachable with mobile keyboard open; Done/Close reachable; focus returns and page scroll is restored.
- [ ] Every family shows rest, hover, pressed, keyboard focus, disabled, selected where applicable, and loading/error where applicable.
- [ ] Hover never erases selection; press never shifts geometry; hidden radios have visible keyboard focus on their label tiles.
- [ ] Normal text contrast checked at actual surfaces; essential borders/markers checked; pale decorative borders never serve as the only necessary cue.
- [ ] All actions have a minimum 44px target or a documented exception; no overlapping targets.
- [ ] Ruler drag, keyboard, typed values, limits, labels and cancellation checked in both sheets.
- [ ] Presets and custom panels checked in every combination; values survive switching, close/reopen and reload.
- [ ] Dashboard loading, failure, retry, all verdicts and 24/48h states checked without presenting stale data as current.
- [ ] Location idle/search/results/empty/error/retry and recent-removal checked.
- [ ] Voice Ready/Listening/review/error/unavailable checked on supported devices without changing lifecycle policy.
- [ ] Reduced motion, forced colours, screen-reader names and radio/disclosure semantics checked.
- [ ] Relevant JavaScript tests and syntax checks pass if logic changes; visual checks for styling-only changes.
- [ ] Documentation and specimens match the approved implementation before any requested release.

## Revision log

- 1.6 local trial, 4 October 2026: aligned fixed spacing, control/icon dimensions and ordinary radii to a 4px grid, documented thin-stroke and fluid-geometry exceptions, and aligned ruler fields and switch outer geometry.
- 1.5 v0.7.4 release, 3 October 2026: recorded clickable verdict durations, timer ruler and compact help popup, approved spacing and typography, and user-confirmed Safari/Home Screen timer handoffs.
- 1.4 update, 30 September 2026: aligned card and chart colour semantics with shared-temperature moisture comparison and the time-based forecast gradient.
- 1.3 v0.7.3 release, 29 September 2026: recorded the iPhone chart curve rendering and pointer versus keyboard focus behavior.
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

### Camera capture controls

The live 4:3 preview has no inner guide or dimming overlay. Notifications are top-centred and inset 12px. Zoom presets use a borderless dark translucent pill at bottom-centre, with a solid light selected button; flash stays bottom-right with existing state styling. Controls retain 44px targets and at least 8px separation; below 360px the zoom and flash use separate bottom rows and preview height grows to avoid overlap. Retake is a borderless dark translucent camera-icon/text pill inset 12px at bottom-right on review. Zoom, inactive flash and Retake share a 65% opaque dark background (rgb(32 39 37 / 65%)); enabled labels and icons remain fully opaque, while selected zoom and active flash retain solid white backgrounds. Keyboard focus remains outlined. Switching uses a 6px preview-only blur with a 150ms transition (no transition under reduced motion); controls and messages remain sharp. Status text uses 4px vertical and 8px horizontal padding with a 32px minimum height, and wraps without covering the flash control. Frame capture immediately announces “Capturing…”; still capture announces “Hold still — taking photo…”; the review sheet then announces “Reading numbers…”. Camera help supports an interactive Settings link focused on the default-on Auto flash switch. The 1×, 3× and 5× buttons select an exposed telephoto camera at higher presets, with multipliers treated as approximate.

### Conditional verdict copy

Second explanations use the current shared-temperature moisture comparison and plan outcome, independently of chart inspection. Drier-air limited benefit uses “Drier out, but little drying benefit expected.” Cooling uses “Drier out, but limited benefit as the room cools.” only when projected temperature falls, projected vapour pressure evaluated at the original indoor temperature produces at least the minimum noticeable RH reduction, and projected RH at the cooler temperature does not.

For drier air, TARGET MET uses “Drier out, but your humidity target is already met.” and below-minimum KEEP CLOSED uses “Drier out, but opening would cool the room further.” Uncertain OPEN IF NEEDED uses “Open for fresh air; drying benefit is uncertain.” Immediate temperature and condensation limits use “Opening would cool the room too much.” and “Opening may increase condensation risk.” regardless of moisture comparison. Remaining copy, headlines, primary lines, colours and durations are unchanged.
