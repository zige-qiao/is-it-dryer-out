# Foundations

**Audience:** Designers and interface implementers

**Status:** Current working-tree reference; Appearance remains Unreleased where labelled

**Owns:** Theme roles, semantic palettes, typography, spacing and formatting

**Reviewed:** 14 October 2026

[Documentation index](../index.md) · [User guide](../user-guide.md)

## Contents

- [Colour foundations — implemented](#colour-foundations--implemented)
- [Appearance — Unreleased](#appearance--unreleased)
- [Light neutral role tokens](#light-neutral-role-tokens)
- [Contrast checks](#contrast-checks)
- [Semantic colours — current implementation](#semantic-colours--current-implementation)
- [Typography — proposed normalisation](#typography--proposed-normalisation)
- [Shared scale](#shared-scale)
- [Links](#links)
- [Icons](#icons)
- [Formatting, accessibility and maintenance contracts](#formatting-accessibility-and-maintenance-contracts)



## Colour foundations — implemented

### Appearance — Unreleased

Settings ends with Appearance after Indoor readings. Its native single-selection group contains System, Light and Dark, saves immediately, and uses System by default. System follows device appearance changes and resynchronises on foreground return. Explicit Light or Dark stays selected independently of the device. Overview layout Reset preserves appearance. Resolve the saved preference before the stylesheet and entry module run, so the shell and automatically opened Indoor sheet start in the chosen theme.

Keep the existing light palette. Dark uses warm neutral roles below; geometry, typography, data and media lifecycle remain unchanged.

| Role | Dark value |
| --- | --- |
| Page / Settings surface | `#171614` |
| Panel / ordinary sheet | `#24221F` |
| Translucent content panel | `rgba(36,34,31,.9)` |
| Control / selected | `#302D28` |
| Hover / pressed | `#3B3731` / `#49433B` |
| Subtle / essential control border | `#4F4941` / `#A29A90` |
| Main / muted ink | `#F1EDE6` / `#BBB3A8` |
| Primary / hover / pressed | `#D9D6CF` / `#EBE7DF` / `#C4BEB4` |
| Ink on primary | `#24221F` |
| Pill / all sheet glass | `rgba(36,34,31,.55)` with 4px blur |
| Modal scrim | Black at 60% |
| Drier / information | `#89C7F5` on `#193144` |
| Wetter / error | `#FFB49F` on `#42251F` |
| Uncertain / attention | `#EDD27A` on `#3E3317` |
| Ready / success | `#7CDDB7` on `#1D372E` |

Inverse ink remains white. Dark primary buttons, their waveform and the Indoor dock use dark ink on the light primary surface; checked switch thumbs follow the same ink. Bright feedback circles use dark glyphs. Preserve existing verdict gradients, unavailable-panel surface and chart curve colours. Selected 24/48 h chart tabs remain light with dark ink (`#403C37`) in both themes; their hover and pressed surfaces stay `#E6E2DD` and `#D9D3CC`.

Sheet glass uses white at 95% with 4px blur in Light, and the dark glass value above in Dark. The pill retains its 55% tint and 4px blur in both themes. Unsupported-blur fallbacks use opaque panel surfaces. Header, middle and existing footer glass occupy separate regions, with no fades or doubled tint. Content panels retain 90% opacity, with the existing white light-theme value. Camera photos, video, recognition pixels and chart semantics are never inverted. Forced colours retain system surfaces and native controls; custom Settings switches use Canvas/ButtonText while off and Highlight/HighlightText while on, with visible thumb and focus. Appearance's pressed fill takes precedence over hover while keeping the selected border. HTML browser theme colour and manifest colours remain static; browser toolbar and installed-app launch appearance need not match the selected theme.

Do not claim iPhone Safari/Home Screen appearance or real microphone/camera verification from emulation.

### Light neutral role tokens

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

The numeric foreground/fill table below records Light appearance. Dark uses the `--windows`, `--closed` and `--caution` role overrides documented under Appearance; comparison conditions and meanings are unchanged. Verdict gradients and chart curve colours remain the same in both themes.

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
| Voice listening/transcript panels | `--surface-control` with `--ink-main` | Current neutral feedback; theme role values vary by appearance. Prompts stay separate; success still requires review/Apply. |
| Voice waveform | `currentColor` inside the primary recording action | Light uses a white waveform; Dark uses primary-action dark ink. Activity is not proof of transcription or saving. |
| Location pending/error messages | Shared neutral role/control tokens | Errors are communicated in text. The effective button token is defined; the earlier unset-token finding is historical. Do not invent new semantic red/green states. |

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

## Typography — proposed normalisation

Keep the existing font stack: Inter if available locally, then system UI, Segoe UI and sans-serif. No new font download is needed. Values below are CSS px equivalents at a 16px root; encode reusable type tokens in rem.

| Role | Size / line height | Weight | Use |
|---|---|---|---|
| Reading | 34 / 1.1 | 700 | Editable indoor and ventilation readings. |
| Indoor summary reading | 22 / 1.2; 20 at 360px and below | 700 | Temperature and RH in the top strip. |
| Verdict | 32 / 1.1; 24 on narrow screens | 700 | Main recommendation; allow wrapping. |
| Metric | 28 / 1.1 | 700 | Moisture card values; 24 for narrower cards. |
| Supporting accordion heading (implemented) | 16 / 1.4 | 700 | Shared supporting-section heading role; native summaries retain the same type open or closed. Permanent headings do not imply toggle semantics. `--font-section-title: 1rem`. |
| Sheet title | 20 / 1.25 | 700 | All sheet headings. |
| Body / typed form value | 16 / 1.5 | 400; 700 for values | Prose and standard form inputs. |
| Control / section label | 14 / 1.4 | 400; 650 for actions/headings | Buttons, option names and section labels. |
| Metadata | 12 / 1.4 | 400 | Units, timestamps, subtitles. |
| Chart annotation | 11 / 1.3 | 400 | Deliberate compact-chart exception. |

Use tabular numerals for changing readings, estimates and timestamps. Keep units visually secondary but semantically included in labels. The Indoor strip uses 12px muted units and an 11px uppercase category label, matching the Indoor comparison card. Use sentence case elsewhere; uppercase is reserved for the main verdict and short card/category labels. Keep explanatory copy out of primary controls.

### Shared scale

- Fixed spacing and layout dimensions follow a 4px grid. Shared spacing tokens cover 4, 8, 12, 16, 20, 24 and 32px; larger dimensions remain multiples of 4. Round to nearest, with halfway magnitudes rounded upward; preserve negative signs and keep positive spacing at least 4px.

- Grid exceptions: typography/line height/letter spacing; thin borders, dividers, ruler markers, graphic strokes and focus-ring geometry; circular/pill radii; screen-reader hiding geometry; fluid/text-relative dimensions, safe areas, chart data and animation-driven waveform heights, and gesture/viewport positions. Border compensation and centring calculations may use smaller inner offsets to achieve grid-aligned outer geometry.

- No decorative shadows. A selection edge or focus ring is an interaction signal, not elevation.

## Links

distinguish inline links with underlining; standalone named source links may use weight plus underline on interaction. Keep browser destinations explicit.

## Icons

reuse the existing simple line icons, currentColor, consistent 2px strokes where applicable, normally 16–20px inside a 44px target. Hide decorative icons from assistive technology; name icon-only buttons.

## Formatting, accessibility and maintenance contracts

Implemented behaviour and remaining proposals are distinguished in the tables. Recording a proposed rule does not approve a behaviour change. Read the corresponding current code before implementing it.

| Area | Current implementation | Recorded rule / remaining decision |
|---|---|---|
| Number precision | `formatTemp()` always produces one decimal; minimum-temperature summary strips `.0`. RH rounds to an integer; AH and estimated ACH use one decimal. | Use one decimal for measured/projected temperature and AH; whole degrees for the minimum-temperature setting wherever mentioned; whole RH; one-decimal estimated ACH. Strip unnecessary `.0` from room volume/airflow. Formatting must not change the underlying calculation. Normalising the minimum-temperature wording is proposed. |

| Area | Current implementation | Recorded rule / remaining decision |
|---|---|---|
| Units, durations and missing values | UI uses °C, %, m³, m³/h and g/m³; an unused `formatMoisture()` helper still contains `g/m3`. Durations use min and hr; missing data uses `--`. | Keep units attached to their number across wrapping. Standardise display units as above, use `--` only for unavailable values, never for zero. Keep `Est.`/`About`/`Up to` qualifiers. Do not treat the unused helper as a visible bug. |

| Area | Current implementation | Recorded rule / remaining decision |
|---|---|---|
| Time and locale | Forecast/weather times use en-GB, 24-hour format and location timezone. The Indoor strip and sheet show elapsed time from the saved device-local edit timestamp; its absolute time is available as a title. | Forecast times are local to the selected location; indoor edit age uses the device clock. Test long ages, narrow widths and day/date rollover. No translated interface or alternative unit system is implied by this system. |

| Area | Current implementation | Recorded rule / remaining decision |
|---|---|---|
| Theme and browser chrome | Saved System, Light or Dark; resolved `color-scheme` follows the selected theme. Manifest launch stays `#F2F0ED`; HTML/manifest theme colour stays `#10231F`. | Appearance is independent of Overview layout Reset. Preserve semantic verdict/chart colours and original camera pixels. Static browser/launch colours and favicon identity remain outside appearance selection. Forced colours use their existing accessibility override. |

| Area | Current implementation | Recorded rule / remaining decision |
|---|---|---|
| Token handoff and visual regression | The app's role tokens live in `styles.css`; the standalone board still embeds illustrative styles. Its screenshots are historical pre-implementation evidence. | Keep board values aligned with the app tokens whenever roles change. A shared token source for the standalone board remains future maintenance work. Record reference views for each state family and compare them when changing tokens. |
