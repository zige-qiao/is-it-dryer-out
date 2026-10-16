# Recommendation and forecast chart

**Audience:** Interface and explanation implementers

**Status:** Current main reference for v0.7.11

**Owns:** Verdict copy, chart interaction, data states, rain/wind and supporting detail presentation

**Reviewed:** 16 October 2026

[Documentation index](../index.md) · [User guide](../user-guide.md)

## Contents

- [AH chart](#ah-chart)
- [Weather check status](#weather-check-status)
- [Accordions](#accordions)
- [Secondary disclosures](#secondary-disclosures)
- [Explainer order](#explainer-order)
- [Explainer language](#explainer-language)
- [Explanation row icons](#explanation-row-icons)
- [Supporting detail patterns](#supporting-detail-patterns)
- [Data and content states](#data-and-content-states)
- [Conditional verdict copy](#conditional-verdict-copy)
- [Advisory rain overlay](#advisory-rain-overlay)
- [Implementation boundaries](#implementation-boundaries)
- [Forecast outcome vocabulary](#forecast-outcome-vocabulary)

Plan outcomes, present moisture comparison and chart curve colours are independent systems. Ready verdict backgrounds use the latest first-stop 5% lightness refinement over the existing palette, with the Dark base palette retaining its 16% reduction; see the exact endpoints in [foundations](foundations.md#a-recommendation-and-integrated-chart-surface); chart colours and foreground styling stay independent of that background adjustment. Preserve the conditional wording below rather than applying one OPEN IF NEEDED secondary line to every outcome. Physical semantic-colour and accessibility acceptance remains separate from source checks.

Keep the dashed Indoor reference continuous and at least 4 CSS pixels clear of its label and below the rain-total text. Measure rain and Indoor text after scaling; expand the upper AH bound to the smallest whole g/m³ that provides the required top headroom, without reducing the full-48-hour base upper bound or changing the lower bound. Use the same text budget in 24h and 48h, even though 48h hides rain totals. Recompute from base bounds on every update so padding does not accumulate. Keep chart height and rain-total positions unchanged; place Indoor text above or below the reference with existing curve and rain-label collision handling. Loading/failure placeholders retain a clear, continuous reference too. While weather is unavailable, position the real indoor AH reference on a stable indoor-only fallback range of 0–60 g/m³ (the configured indoor limits rounded up to the next ten). Temperature and RH edits move the line and update its label; reuse the existing clearance helper. Decorative outdoor shapes do not establish outdoor readings or an ACH estimate. Ready charts retain their full-forecast scales.

## AH chart

render the forecast curve as one continuous high-resolution bitmap at its normal display size so its semantic colours persist through iPhone scroll and zoom. Taps and horizontal touch drags inspect values without a browser tap flash or chart outline; downward pulls at page top refresh weather. Mouse inspection is unchanged. Keyboard focus remains visible as an outer ring, and arrow keys plus Home/End continue to inspect values.

## Weather check status

show `Just now` for 60 seconds after a successful outdoor update, then `Checked HH:mm` in the selected location's time zone. Recalculate on return to the tab. Keep `Updating…` and `Update failed` distinct, and retain full timestamps in Weather data.

## Accordions

Native disclosure summaries use full-width headings with a 48px minimum target, `--font-section-title: 1rem` (16px at a 16px root), 1.4 line height, weight 700 and `--ink-main`, identical open and closed. Apply the shared heading roles to supporting sections. Chart key on Overview and Why this recommendation? on Why have permanent headings; Glossary, How estimates work and Weather data use native disclosures. Permanent headings are not toggle actions and have no disclosure chevron. Wrap native summaries naturally and keep their far-right chevron in currentColor; preserve the outer keyboard focus treatment. Content labels, detail paragraph labels and glossary abbreviations stay bold in main ink at existing body size; expansions and prose stay regular and muted. Chart categories remain smaller and muted, weather links stay underlined at body size, and More detail keeps the secondary disclosure treatment. Use one chevron convention, subtle dividers and no card frame. Preserve open states through updates. The recommendation explanation remains visible. More detail, Glossary, How estimates work and Weather data start collapsed and preserve their independent disclosure states through updates.

## Secondary disclosures

use native details/summary for supporting content such as More detail. The summary is left-aligned and content-width, with regular-weight underlined text at the surrounding body size and a vertically centred chevron in a 1rem square immediately beside it, separated by an 8px layout gap. Use a centred SVG mask so rotation does not shift its alignment; point down when closed and up when open. Keep a minimum 44px target, maximum width of the container, wrapping at enlarged text, and a 2px outer keyboard focus ring with a 2px gap. Use 8px internal spacing. Reserve bold full-width rows and far-right chevrons for main accordions; scope their styling to direct summaries so nested disclosures retain this secondary treatment. Each chevron follows only its own disclosure state.

The parent continues to own spacing between page sections.

## Explainer order

Overview owns the always-expanded `Chart key`. Why owns the permanent `Why this recommendation?` heading, followed by `Glossary`, `How estimates work`, then `Weather data`. More detail remains expandable within the explanation. The first explains the live calculation; the glossary defines AH, RH, DP, ACH, Let in and room volume; Weather data contains provider, request location, freshness, attribution and source links. Keep the final `By Ziggy Qiao · GitHub` credit outside the accordions, with Settings and Refresh app as footer actions.

## Explainer language

Why this recommendation? uses normally no more than five short labelled rows, with normal body type, bold labels/key facts, labels on their own line with an 8px gap before the explanation, and 16px between entries without dividers. On Apple mobile devices, every eligible opening duration in Why's main rows and More detail uses Overview's shared dotted-underlined timer button; on other devices or outside 1–180 whole minutes, retain plain emphasis. Use the theme's main ink for text, underline and focus rings on Why's surface (dark ink in Light, light ink in Dark); hover and pressed states use the page's control surfaces. Forecast clock times and hourly weather periods remain text. Restore focus to the opener, falling back to the Why heading if live updates remove it.

Keep Why self-contained: use the same formatted plan durations as Overview for timed stopping advice, diminishing drying benefit and the drier-air window. Preserve immediate-limit and cold-room reversal wording. Explain causes and actions without repeating other verdict targets or settings; explicitly name Overview when referring to its chart. Confident moisture differences use approximate percentages at a shared temperature; uncertain differences make no confident drier/wetter claim. Distinguish changing outdoor weather, diminishing benefit, immediate/timed temperature or saturation limits, cold-room warming/reversal, slow progress and cooling-hidden moisture removal.

Keep stopping instructions, heavy-rain advice, incomplete coverage and future-opening assumptions visible. Weather facts never override closed or target-met outcomes. Show temperature changes only when useful and absent from verdict lines, including warming and cooling; omit changes rounding to zero. A native More detail disclosure contains densities, warmed RH, rain amounts/chance, wind speed, model assumptions and limitations. Start it collapsed, preserve its open state during updates, and hide it with stale advice during loading/failure; return focus to the page heading if focused detail becomes hidden. Scope each disclosure chevron to its own open state. General limitations also belong in How estimates work. Preserve verdict templates and calculations.

## Explanation row icons

Recommendation overview rows use decorative 20px outline SVG category icons with muted colour, 1.2px strokes and rounded ends. Use droplets for moisture/drying/condensation, a thermometer for temperature, a cloud for changing weather, cloud/rain for rain, wind lines for wind, a clock for longer time or future opportunity, and a question-mark circle for neutral fallback. Keep the complete stroke inside the 20px viewBox, with at least 0.5px of painted-edge clearance; verify path bounds plus half the stroke width. Each row has a fixed 20px icon column and flexible text column separated by `--space-8`; centre the icon against the first text line and wrap text beneath its label.

Keep existing body typography and bold labels on their own line, with 8px before the explanation and 16px between entries; do not add dividers or borders between explanation entries. Icons are `aria-hidden="true"`, nonfocusable and have no tooltip; wording conveys all meaning. Do not add icons to the accordion heading, More detail, or unavailable-weather messages. Parent-owned page spacing remains unchanged.

## Supporting detail patterns

semantic Weather data metadata uses Provider, Location and Last update rows with aligned columns and a 16px horizontal gap; below 20rem of available width stack labels above values with 8px gaps. Last update always means the last successful fetch; use Not available yet before the first success, with separate pending/failure messages. Source links wrap together, remain underlined and have decorative arrows, 44px targets and 2px focus rings. Glossary uses semantic stacked definitions: bold abbreviation and muted expansion on the first line, then definition after 8px, with 16px between entries and no internal dividers.

More detail retains its compact treatment; labelled paragraphs use Moisture, Drier-air window, Rain, Wind and Model assumptions, hiding each entire entry when unavailable.

## Data and content states

The prepared v0.7.11 loading/checking and NO DATA backgrounds use the same neutral gradient in both themes. Both render 24 narrow decorative ACH placeholders (17 units wide, every 20 units in the 480-unit SVG), independent of the saved range. Keep range-specific chart height and restore the selected range’s real bars and inspection after recovery. Loading reserves one secondary-text line with a centred 12px bar, a 4px summary-line gap and 12px before the chart divider; NO DATA keeps its real explanatory text. See [the exact palette](foundations.md#a-recommendation-and-integrated-chart-surface) for reversed verdict stops.

| State | Required communication |
|---|---|
| Loading outdoor data | Clear checking message, non-data placeholders, disabled chart inspection, indoor readings retained. |

| State | Required communication |
|---|---|
| Outdoor request failed | Explicit unavailable message and retry; never show old outdoor results as current. |

| State | Required communication |
|---|---|
| Ready | Local-time labels, timestamp, forecast horizon and inspectable chart values. |

| State | Required communication |
|---|---|
| Uncertain / little benefit | Text explanation and existing amber semantics; avoid inventing a precise duration. |

Maintain existing main verdicts: TARGET MET, OPEN WINDOWS, KEEP CLOSED, OPEN IF NEEDED, plus Checking and NO DATA for unavailable weather. Keep uncertainty language, estimate qualifiers, local times and unit notation consistent: °C, %, m³, m³/h, air changes/hr. Explain ACH in the glossary rather than adding technical copy to every control.

Outdoor weather refresh uses a 32px-wide, 44px-high target with its existing 16px icon and compact hover/pressed/focus surface. Its compact width is a deliberate exception to the general 44px target rule to preserve room for the location and last-checked text in the mobile header. Keep targets clear of neighbouring controls; allow long location names to wrap the header when needed.

### Conditional verdict copy

When outdoor air is not clearly drier, TARGET MET uses “Your humidity target is met.”

Second explanations use the current shared-temperature moisture comparison and plan outcome, independently of chart inspection. Drier-air limited benefit uses “Drier out, but little drying benefit expected.” Cooling uses “Drier out, but limited benefit as the room cools.” only when projected temperature falls, projected vapour pressure evaluated at the original indoor temperature produces at least the minimum noticeable RH reduction, and projected RH at the cooler temperature does not.

For drier air, TARGET MET uses “Drier out, but your humidity target is met.” and below-minimum KEEP CLOSED uses “Drier out, but ventilation would cool it further.” Uncertain OPEN IF NEEDED uses “Open for fresh air; drying benefit is uncertain.” Where no clear drying benefit is expected and outdoor air is not clearly drier, use “Open for fresh air, humidity may not fall.” Immediate temperature and condensation limits use “Opening would cool the room too much.” and “Opening may increase condensation risk.” regardless of moisture comparison. Remaining copy, headlines, primary lines, colours and durations are unchanged.

### Advisory rain overlay

In the 24-hour view, measured, collision-free rain-spell totals overlay the top of the rain bars inside the plot; the 48-hour view omits these labels. Rain bars descend through the top third, using a 48-hour scale shared by both range views (rounded up to at least 1 mm/h). Both views use proportional ACH bars in the bottom third, sharing the same height scale without a minimum-height floor. A separate 34 CSS-pixel strip below the plot holds ACH numbers and small filled SVG wind arrows; time labels follow below the strip. Loading and failure retain the selected range’s geometry. Arrows point with the wind; bearings in titles and accessible inspection text identify where it comes from. Missing directions and calm wind omit arrows.

Pale blue full-height bands have 6.5% opacity and sparse 17% hatching; the humidity curve, indoor reference and inspection cursor remain above these layers. Rain bars use an unoutlined white fill at approximately 22% opacity, matching ACH bars so the verdict background shows through; the Chart key uses matching muted grey fills for rain amount and estimated ACH, with paired narrow rain bars and a single wider ACH bar. The band tint and hatching retain their strength through the top 35% of the plot, then fade smoothly to transparent at the bottom; hourly rain bars retain their original intensity.

The Chart key on Overview is an always-expanded two-column card using the existing panel/dashboard card surface, subtle border, 20px radius and 16px padding. Keep the ventilation summary’s original natural flex layout, spacing, separator and arrow placement. When its two groups share one row, measure the separator’s centre and align only the chart-key divider to that coordinate. Recalculate with batched animation frames after summary text changes, observed size changes, font loading and Overview/chart-key visibility changes. If the summary groups wrap onto separate rows or either section is hidden, clear the measured track and use the normal responsive split. Its accessible name and Settings label remain Chart key, with no visible overall heading.

Lines and Bars & markers use existing muted uppercase category headings, equal minmax(0, 1fr) columns above 480px viewport width and 40%/60% columns (minmax(0, 2fr) / minmax(0, 3fr)) at 480px or less, a 12px gap and a subtle vertical divider with 12px inset. Entries use a fixed 20px symbol column, an 8px text gap and 12px row spacing. Lines shows Indoor AH, a small Outdoor AH group label, then Drier, Uncertain and Wetter with the chart line shapes and semantic colours. Bars & markers shows Rain amount (1-hour bars), Rain period (Shaded hours), Est. ACH (2-hour bars) and Wind (Blows towards). Rain amount uses two parallel 7px-wide bars, 8px tall on the left and 12px tall on the right, separated by 2px and aligned at the top to match the descending chart bars; Est.

ACH uses one 16 × 12px bar. Both use the same solid muted grey fill without an outline and 2px corners matching the chart bars. In forced-colour mode, both use CanvasText. Rain-period shading remains square-edged. These symbols preserve chart geometry and hatching but use neutral role tokens; the actual wind-arrow path is reused. A shared note follows a horizontal divider with 16px spacing: Line colour shows the drying benefit of ventilation. ≥ means the rain-spell total is incomplete. Retain both columns at narrow widths and enlarged text, allowing wrapping without horizontal overflow. Preserve saved layout order and visibility, weather-independent availability, chart inspection and calculations.

## Implementation boundaries

The main verdicts remain TARGET MET, OPEN WINDOWS, KEEP CLOSED and OPEN IF NEEDED. The renderer also contains a defensive WAIT fallback for an unclassified plan status; that fallback is not a new standard verdict or an instruction to change product wording. Consult `src/ui/recommendation.js` and its copy tests for conditional secondary lines.

## Forecast outcome vocabulary

When displaying forecast outcomes, use `Uncertain` instead of `Wait` and `Little benefit` instead of `Too small`. Do not introduce `Slow drying` unless the product logic and tile timing semantics are reconsidered together. Preserve the established closed-window wording unless the user explicitly asks to change it.
