# Sheets and controls

**Audience:** Interface implementers

**Status:** Current working-tree reference; Appearance remains Unreleased where labelled

**Owns:** Sheet chrome, focus, dismissal, rulers, input recovery and control states

**Reviewed:** 14 October 2026

[Documentation index](../index.md) · [User guide](../user-guide.md)

## Contents

- [Ventilation timer (v0.7.4)](#ventilation-timer-v074)
- [Control geometry](#control-geometry)
- [Shared sheet and responsive rules](#shared-sheet-and-responsive-rules)
- [Component contracts and state matrix](#component-contracts-and-state-matrix)
- [State rules](#state-rules)
- [Shared sheet structure](#shared-sheet-structure)
- [Rulers](#rulers)
- [Ranges](#ranges)
- [Room size](#room-size)
- [Opening](#opening)
- [Settings scrolling and exit](#settings-scrolling-and-exit)
- [Location sizing and keyboard](#location-sizing-and-keyboard)
- [Location](#location)
- [Manual input rejection and outdoor refresh](#manual-input-rejection-and-outdoor-refresh)

Use the shared sheet and control contracts before changing any individual sheet. Immediately saved settings use a header tick; dismissal and draft cancellation have different meanings. The state matrix describes Light appearance; Dark overrides use the roles in [Foundations](foundations.md).

## Ventilation timer (v0.7.4)

Timer and Indoor sheet titles match Settings and Ventilation settings at 1.2rem, using the same inherited heading font and weight.

Inline verdict times retain the original text width and line height. The user chose original verdict spacing over 44px touch targets; targets follow the duration text rather than expanding into adjacent lines.

The timer's compact numeric field shows min beside the value, with room for three digits and an accessible duration label. Numeric ruler fields have a 52px outer height, including their border and padding. The field-to-ruler gap is 8px and the ruler-to-Start gap is 20px. There is no timing-context paragraph in the sheet. The mobile drag handle matches the other sheets. Start is the only bottom action; dismissal uses the header close control, Escape, outside tap or sheet drag.

On iPhone/iPad, eligible opening durations in Overview’s verdict lines and Why’s main rows and More detail are shared inline buttons with a dotted underline. Overview keeps its 50%-opacity white underline and white focus ring; Why uses dark text, underline and focus ring on its light surface. Qualifiers stay outside the button; combined hour/minute durations stay together. Only 1–180 whole minutes are interactive; other devices and unsupported durations retain plain emphasised text. Clock times and hourly weather periods remain plain text.

The timer uses the Indoor sheet geometry and a stacked 1-180 minute ruler: 1-minute ticks, labelled 5-minute marks, and 8px spacing. Typed entry remains available. Start is disabled for empty, fractional, or out-of-range values. Draft minutes are temporary and independent of saved readings/settings; refresh does not replace edits. The duration's accessible name retains its timing context. Drier-air windows are not presented as recommended opening durations; capped target estimates create a recheck reminder.

Clock owns the timer after the Shortcut handoff; the web app displays no countdown or success claim. Start closes the sheet and completes focus/scroll cleanup before launching Shortcuts, in the same activation handler. Invalid input keeps the sheet open. Closing restores the clicked duration's focus, or the recommendation heading on its originating page if it has been replaced, using the shared focus-return rule below. A 32px-wide, 44px-tall help control, with its visible symbol centred and 12px from the title, opens a compact setup popover with Install Shortcut, linking directly to iCloud. Its narrower width is a user-requested exception to the usual 44px target. Escape dismisses the popover before the sheet; clicking elsewhere or closing the sheet also clears it.

The user confirmed timer handoffs from Chrome, Safari and the Home Screen web app, plus the flight-mode alarm and sharing link. Fresh import and recovery/locked-phone scenarios remain separately unverified.

## Control geometry

- Forecast range tabs: use a 6px inner radius for selected, hover and pressed surfaces, inside an 8px outer track. This is an explicit user-selected exception to the 4px grid. Preserve 44px targets and the existing outer focus ring.

- Control radius: 12px for fields and option tiles; 12px for main action buttons and custom panels; 8px for compact icon feedback; pill radius for short secondary actions.

- Current surface radius: 20px for the Indoor summary strip, verdict and its footer, and moisture comparison panel; 16px for the inner Outdoor and Indoor comparison cards; 24px for sheets.

- Borders: 1px ordinary, including unselected Opening options; 2px for selected options. Compensate padding by 1px when the border grows so selection never shifts dimensions or content. Keyboard focus is a separate 2px ring with a 2px clear gap **outside** the visible control. Use main ink on light surfaces and white on the coloured verdict. The ventilation summary and dashboard explainer headings keep their wider horizontal focus shapes so text and chevrons have breathing room.

- Targets: at least 44 × 44px; primary actions at least 48px high. Compact visual pills may sit within a larger hit area. Room options use 60px minimum height; Opening tiles retain 64px.

- Numeric ruler and custom dimension/airflow fields have 52px outer height with border-aware inner inputs. Ruler value inputs cannot shrink and reserve 4px beyond their character width; paired Ventilation fields and the Indoor RH field are 100px wide so two-digit readings and their units fit without clipping. The Indoor temperature field is 128px wide with 8px horizontal padding and a compact 3.5ch-plus-4px input for readings such as 32.0. RH ticks use 16px spacing and target-RH ticks use 12px; temperature and timer spacing stays unchanged. The settings switch is 48 × 28px with a 20px thumb, 4px outer-edge insets and 20px travel. The timer help symbol is 20px inside its retained 32 × 44px target; compensate its centring inset to give a 12px visible title-to-symbol gap.

## Shared sheet and responsive rules

- Sheets become centred dialogs from 40rem (640px); mobile uses bottom sheets. Preserve the existing visible-viewport/keyboard adjustment and 90% maximum-height behaviour.

- Indoor rulers stay stacked. Ventilation rulers stay paired. Room choices stay in four columns; Opening choices in two. Wrap labels and allow height to grow.

- At severe text enlargement, allow choice grids and dimensions to stack rather than clip. This is an accessibility fallback, not a default mobile redesign.

- Three room dimensions share one panel; show calculated volume on a full-width row. Custom airflow may wrap its value below the label.

- Keep content scrolling inside sheets, prevent background scroll, preserve scroll position on close, and return focus to the opener. All five sheets restore focus quietly unless the opener had visible keyboard focus when activated; typing inside a touch-opened sheet does not change that decision. Subsequent keyboard interaction restores normal focus styling. Keep the same rule for direct outlines and compound card, summary and Location indicators. Automatically focused headings have no outline; replaced openers and automatic launch use their existing quiet fallback targets.

- Keep neutral circular SVG header controls visible at all widths, with a title aligned left without Back and centred between the visible controls with Back that prefers word-boundary wrapping, allowing an individual word to break only when it cannot fit beside the fixed controls. Settings, manual Indoor readings and Ventilation settings use a circled tick at the top right and no Done footer. Location and Timer use a circled X; Timer retains Start iPhone timer. Camera and voice use a circled left chevron to return to manual input and a circled X to dismiss the whole sheet, cancelling unapplied drafts. Group camera, voice and tick on the right in the same title row with equal 8px gaps; group help with close in subviews. Preserve outside-tap dismissal, Escape, mobile drag dismissal, frosted scrolling headers and focus return.

- Control transitions: 120ms; sheet/disclosure transitions: 160ms. Reduced motion removes cosmetic transitions and ruler momentum. Keep physical gesture response immediate.

## Component contracts and state matrix

### State rules

**Universal gesture rule:** swiping or dragging must not also activate a tap action, anywhere in the app. Apply this to upward, downward, horizontal and diagonal movement on page controls, sheets, sticky headers/footers, switches, links and disclosures. Observe pointer movement without disabling controls or preventing native scrolling. At 8 CSS pixels of total movement, or pointer cancellation, suppress the gesture's resulting click, even if it returns to its starting point. A touch that stops active scrolling must not activate the underlying control; use actual scroll events, not cancellation alone, to identify momentum. The next settled tap works normally. Keyboard, assistive-technology and programmatic activations remain available.

Preserve each component's intentional gestures: chart inspection, ruler adjustments, camera cropping, reordering and sheet/pull dismissal. Future interactive components inherit this shared rule rather than adding separate swipe-to-click behaviour.

| Family | Rest | Hover | Pressed | Selected / focused |
|---|---|---|---|---|
| Light secondary actions | Control surface + main ink | Hover surface | Pressed surface | 2px main-ink outer focus ring, 2px clear gap. |
| Ghost/icon action: close, clear, remove, recent rows | Transparent + main/muted ink | Hover surface | Pressed surface | Same focus ring; accessible name required. |
| Primary: Apply, Take photo, Record readings, Use current location | Retained dark primary + white | Retained primary hover | Retained primary pressed | On white sheets, a 2px main-ink outer focus ring with a 2px clear gap. On dark semantic panels, use a white outer ring with the same gap. |
| Room size segment | Transparent on control-surface track | Hover surface | Pressed surface | White selected surface, 2px main-ink border and 700-weight name; independent outer focus ring above adjacent options. |
| Opening tile | White + 1px control border | Hover surface | Pressed surface | Light `#F0EEEB` fill, 2px main-ink border and 700-weight name. |
| Editable value / ruler | White + control border | Keep stable | Native editing / adjustment | Main-ink outer ring around value and unit together, or around the complete visible ruler outside its side fade. |
| Chart range | Translucent white track on semantic panel, 4px between the 24 h and 48 h tabs | Selected hover surface `#E6E2DD` | Selected pressed surface `#D9D3CC` | Light selected tab with dark `#403C37` text in both themes; independent white outer focus ring. |

Precedence: disabled blocks hover and press; pressed overrides hover fill; selected border and weight persist; keyboard focus overlays all enabled states. Use native `disabled`, checked radio state and `aria-pressed` where appropriate. Do not implement a toggle by changing colours alone.

Disabled controls use 45% opacity on the complete control, no hover/press animation, and a default cursor. Loading additionally exposes busy/status text; a disabled appearance alone does not explain an in-progress operation. Do not hide a focused action without moving focus deliberately.

## Shared sheet structure

All five shared `.white-sheet` dialogs retain a stationary flex shell, header, existing native body scroller and any existing fixed footer. Use 20px horizontal header padding, 8px control gaps, a minimum 44px title/action row and normal word wrapping with an emergency break for a word wider than its available title column. Headings use min(1.2rem, 28px) to retain legible whole words beside the fixed single-row controls at enlarged text sizes; body text continues to scale. Mobile has a 36px handle area; desktop hides it and adds 20px top padding.

With backdrop blur support, every sheet uses 4px blur with white at 95% in Light and `rgba(36,34,31,.55)` in Dark. The navigation pill retains its 55% tint in both themes. The base glass covers only the middle region; the header and existing footer supply their own matching glass. Rounded shell clipping retains corners without creating an ancestor backdrop boundary. This lets the page show through the middle and scrolling sheet content blur behind pinned areas, with one tint per area and no header or footer fades. Inner controls retain their current surfaces, colours and typography; do not apply ancestor opacity or filters.

Extend the native body viewport underneath both pinned areas. Measured header and footer heights compensate the body's padding: header height plus 16px at the start and footer height plus 16px at the end where a footer exists. Sheets without a footer retain their 24px plus safe-area bottom padding. Focus scroll padding clears each pinned height plus 20px. Keep the scrollbar in the unobscured region: where `scrollbar-width: none` is supported, replace it with a stationary, aria-hidden rail from 4px below the header to 4px above the footer or body bottom. Its rounded 4px thumb has a 24px minimum height and appears only with overflow. Size it using the unobscured viewport and map it to the full native scroll range. Mouse dragging and track clicks scroll the real body; touch momentum, wheel and keyboard scrolling remain native. Glass styling works independently of scrollbar replacement; retain native scrollbar track insets otherwise. The labelled body region is keyboard-focusable.

Resize/content observation and one animation frame update both pinned heights, including viewport, keyboard and safe-area changes; close and interruption cancel frames and capture. Unsupported-blur browsers retain solid panel surfaces, the original body placement and native scrollbars. Forced colours disable glass, using opaque system surfaces and native scrollbars. Timer alone retains a fixed footer with its existing Start action and 24px plus safe-area padding. Settings, Indoor, Ventilation and Location do not gain footers; Indoor camera/voice actions remain in their existing body positions. Preserve dismissal, focus return, reordering and camera gestures/resources.

The glass treatment is Unreleased. The requested 95% Light-sheet tint retains existing foreground colours. Sampled Light-mode normal text in the glass-sheet browser fixture clears the 4.5:1 target, with a minimum of 4.88:1; this is rendered fixture evidence rather than a complete audit of every possible state. Any additional readability adjustment requires the user's approval before implementation.

Help panels are absolute overlays anchored to the stationary header, inset 20px on each side, and clear visible footer actions. Opening help must not change header height or blur controls. Verify coloured content and text behind the actual header, including wrapped titles and large text; report installed iPhone Home Screen evidence separately from desktop and Safari tabs.

## Rulers

fixed centre marker, labelled major ticks, native range semantics and direct numeric entry. Horizontal adjustment yields to vertical scrolling. Cancel momentum on new interaction, close or backgrounding. Show number + unit as one field. Draw keyboard focus outside the ruler so its edge fade cannot obscure the ring.

## Ranges

indoor temperature 10–32°C in 0.1°C steps; indoor humidity 20–90% in 1% steps; minimum indoor temperature 8–28°C in 1°C steps; target humidity 35–65% in 1% steps. Min-temperature and target fields stay the same width. Saved fractional minimum temperatures round to whole degrees.

## Room size

30 / 50 / 80 m³ and Custom. Custom reveals dimensions and calculated volume; keep values when switching away. Room-size options are a single native radio group.

## Opening

slightly open / one window / cross-ventilation / custom airflow. Show `Est. … air changes/hr` beside or below the heading. Custom airflow reveals one labelled input. Current weather adjustments remain part of the calculation, including custom airflow.

## Settings scrolling and exit

uses the shared shell and frosted header, with a header tick and no footer. Reordering edge scrolling and menu dismissal observe the options body. Keep the existing dismissal and focus-return behaviour.

## Location sizing and keyboard

remove reserved result height; idle, pending, failure, empty, results and recent states fit their actual content, with results in the shared body. Mobile sheets follow visualViewport height and offset. An editable-focused viewport reduction from the unobscured baseline removes only the bottom safe-area addition until recovery; pinch zoom does not trigger this rule. Preserve normal padding and native keyboard accessory controls; use no guessed keyboard offsets.

## Location

search, recent places, remove action, current-location action, pending/error/retry and empty-results states share the same tokens. Selecting a place closes the sheet. Removing a recent place must remain a separate 44px action. Keep the circled X visible on mobile and desktop Location.

| State | Required communication |
|---|---|
| Invalid numeric input | Restore the saved valid value without saving; show inline range guidance in a polite status node, and clear it when editing resumes or the sheet closes. |

| State | Required communication |
|---|---|
| Search empty / no match / error | Distinct messages; keep search editable and recovery available. |

| Area | Current implementation | Recorded rule / remaining decision |
|---|---|---|
| Invalid / empty inputs | On committed change, blank, nonnumeric or out-of-range input returns to the saved value with inline range guidance. Reading fields retain their existing snapping. | Use a permanent polite, atomic status node linked through `aria-describedby`. Restore without saving or changing calculations; restored fields remain valid. Clear feedback when editing resumes, a paired ruler/stepper changes, or the sheet closes. Keep normal focus behaviour. The restore-and-explain interaction was selected during the remedy plan; see the visual board specimen. |

| Area | Current implementation | Recorded rule / remaining decision |
|---|---|---|
| Focus and modal dismissal | Native dialogs focus the heading on entry and return to the opener quietly, preserving an indicator only if it was visible at activation. Escape, outside-start-and-end clicks and mobile sheet drag dismiss. Neutral circular header controls remain visible at every width: a tick for immediately saved sheets and an X for dismissal; a left chevron returns camera/voice to manual input. | Treat entry focus, Tab containment, dismissal and return focus as part of the sheet contract. No background interaction while open. Never interpret dismissal as cancelling already-persisted manual edits. |

| Area | Current implementation | Recorded rule / remaining decision |
|---|---|---|
| Live announcements | Entire recommendation and estimate use polite live regions; voice/location statuses also announce updates. | Test for repeated or competing announcements while dragging, searching or refreshing. Announce meaningful settled changes; do not announce every decorative animation frame. Any throttling change needs interaction testing rather than a CSS fix. |

### Manual input rejection and outdoor refresh

Rejected typed values show “Enter a value between [minimum] and [maximum]. Saved value restored.” with the field's units. Use the existing muted ink and UI text size, 1.4 line height, normal weight and wrapping. In ruler controls, feedback follows the ruler with an 8px gap so the paired Ventilation tracks keep their alignment. Dimension feedback follows its field with an 8px total gap; custom airflow feedback occupies a full row. Empty status nodes remain visually hidden and available for polite announcements, with no layout space. Do not colour or outline a restored valid field as invalid. Keep dimensional labels and inputs aligned at the top when only one field has feedback.

Sheet header refinement: group camera, voice and tick on the right in that order with equal 8px gaps, omitting hidden controls. All header actions use camera-style filled 44px circles and 20px SVGs with 1.8 strokes. Settings uses a white fill against its warm surface; other sheets use surface-control, with shared hover, pressed and focus styles. Keep buttons in one row; left-align the title without Back and centre it between the visible Back and right action group. Centre buttons vertically against the full title/subtitle block, or just the title when no subtitle is visible. Indoor’s saved timestamp stays below the manual title. Voice examples remain in a plain section above the separate grey live status/transcription box.
