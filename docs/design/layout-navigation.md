# Layout and navigation

**Audience:** Interface implementers

**Status:** Current working-tree reference; Appearance remains Unreleased where labelled

**Owns:** Overview/Why hierarchy, saved layout, navigation, reordering and page spacing

**Reviewed:** 14 October 2026

[Documentation index](../index.md) · [User guide](../user-guide.md)

## Contents

- [Two-view navigation](#two-view-navigation)
- [Responsive rules](#responsive-rules)
- [Settings](#settings)
- [Pull to refresh](#pull-to-refresh)
- [Layout controls](#layout-controls)
- [Weather refresh interactions](#weather-refresh-interactions)

Recommendation is always visible and pinned first. Overview owns the recommendation/chart and optional supporting boxes; Why owns the explanation and reference disclosures. Use the sections below for detailed layout contracts.

## Two-view navigation

Overview contains the recommendation/chart, optional Indoor summary, moisture comparison and Chart key. Why presents “Why this recommendation?” as a permanent heading, keeps More detail expandable, and follows with Glossary, How estimates work and Weather data. Settings, Refresh app and the author/GitHub credit live only in Why’s footer; credit is left-aligned and vertically centred with the action group. Settings uses a 44px outlined circle (1px subtle border, existing 20px cog); Refresh app uses a full-height 44px transparent pill with a 1px subtle outline, dark semibold text and 16px horizontal padding, matching Settings. Keep an 8px gap between actions and move them together to a right-aligned second row when needed, with 12px between footer rows.

Preserve the shared 2px outer keyboard focus ring, warm neutral hover/pressed colours and existing actions. Settings keeps its existing sheet and immediate saving. The old Supporting details layout key now controls Chart key only, retaining saved order/visibility; Why is always available.

A floating bottom control group appears at every width, centred in the viewport, up to 306px wide. Overview and Why share a two-item navigation pill up to 240px wide, with a separate 58 × 58px circular icon-only Indoor action on its right and an 8px gap. Both surfaces share the border and frosting; the Indoor circle centres vertically against the navigation pill. Keep 48px-high navigation targets, labels under 20px icons, and a neutral selected page pill. Indoor uses a 24px thermometer using `--ink-on-primary` (white in Light) with a 1.2px rendered stroke inside a 42px primary-surface inner disc, surrounded by an 8px theme-panel ring in the 58px outer circle matching the pill’s height.

It retains an accessible Indoor name and tooltip, and opens manual Indoor readings from either page, retaining the active route and restoring focus on dismissal. It remains available when optional Indoor sections are hidden. At narrow widths shrink the navigation pill while retaining the separate action; labels use min(.75rem, 16px) and all controls remain on one row. Use the theme-aware 55%-opaque `--surface-frosted` surface with 4px backdrop blur (standard and Safari-prefixed), a border and no decorative shadow. Keep blur throughout touch preparation, dragging and settling; unsupported blur uses opaque `--surface-panel`, and forced colours retain system surfaces. Leave only the bottom safe-area clearance and reserve 92px plus safe area below page content. Dialogs remain above the bar.

Routes are #overview and #why, with missing/unknown hashes repaired to Overview. Both views stay mounted and share live state; inactive views are hidden and inert. Preserve each view’s session scroll position and browser history. Auto-open Indoor readings only on initial Overview launch.

One-finger swipes anywhere on the pages or tab bar move left from Overview to Why and right back, without wrapping, including buttons, links, disclosures, selected text and blank background. Only the chart and its descendants are excluded on the page; sheets/popups retain their own gestures while open. Do not reserve screen-edge strips; native browser gestures retain precedence through cancellation. Require 12px horizontal intent, exceeding vertical movement by 1.5×; Slow drags commit only when final release travel towards the neighbour exceeds half the stage width captured at touch-down. A deliberate flick also commits with at least 48px travel and release velocity of at least 0.5px/ms towards the neighbour.

Calculate velocity from at most 32 timestamped positions in the final 100ms, including release. Use valid event timestamps throughout a gesture, or the injected monotonic clock when initial event timing is missing; invalid or zero-duration timing cannot qualify. A pause exhausting the window or reversed last non-zero movement prevents the flick exception. Slow releases exactly halfway or retreating below halfway return. Tab clicks, taps and keyboard activation switch immediately and cancel any ongoing slide. An inner page track moves both views with one transform write per animation frame, using the latest finger position and width measured once per gesture.

Prepare its transform layer hint at eligible touch start and clear it on rejection, cancellation or release; page-level hints apply only during settling. Incoming previews are positioned offscreen and made visible but inert at eligible touch-down, before horizontal recognition. This gives the browser time to lay out incoming content before dragging. The tab bar retains its translucent backing and blur throughout preparation, dragging and settling; a tap or rejected gesture clears preparation. Queued paints are cancelled on release or interruption; settling starts from the last painted position, with final finger travel deciding commitment.

Dragging follows the finger directly; on release, transfer the track offset into page animations in the same task and settle over 360ms with cubic-bezier(0.3, 0.45, 0.4, 1), without bounce; reduced motion switches immediately. Browser Back/Forward retains its existing slide behaviour. Each sliding view spans the viewport and carries its own content gutters; clip at screen edges, avoiding stationary blank strips during a swipe. Use the shared gesture-click guard. Vertical gestures retain scrolling and Overview-only pull-to-refresh; the fixed tab bar never moves with the pull. Cancel swipes on multitouch, resize, backgrounding and overlays.

### Responsive rules

- Preserve the centred single content column, maximum 31rem (496px) including 12px side gutters. The page stage spans the viewport so swipe clipping reaches its edges; each view owns the responsive horizontal padding that keeps its content centred.

- Page and reading order follows the saved Overview layout order. Recommendation is always visible and pinned first, including its chart and ventilation summary. On Overview, defaults below it are hidden Indoor summary, hidden Moisture comparison and shown Chart key. Why has the recommendation explanation and the three reference accordions; it is independent of these layout preferences. The other three boxes remain reorderable; migrate older layouts by retaining their relative order and visibility. Credit and footer actions are last on Why only. Hidden boxes occupy no space and leave the reading order.

- Apply top safe-area spacing to the page shell so it protects whichever visible section comes first.

- The parent owns spacing between sections; components own internal spacing. Each page view uses `gap: var(--page-section-gap)`, where `--page-section-gap: var(--space-16)` is 16px at every width and text size. Every direct page box and the footer has zero outer vertical margins; preserve horizontal insets and internal padding. Hidden sections create no gaps; Recommendation remains visible even when all optional sections are hidden. Do not add order-specific margins or adjacency selectors. Recommendation keeps its chart and ventilation summary integrated. Keep 20px internal panel/sheet padding; use 16px at 320px widths if needed, and 8px between related controls.

## Settings

a 44px cog in Why’s footer opens a bottom sheet on mobile and centred dialog on desktop. Use three expanded groups: Overview layout, Indoor readings and Appearance (Unreleased). Separate groups by 16px. Group headings are 16px semibold; theme-panel cards with 20px corners use 16px horizontal padding, subtle dividers, regular-weight row labels, shared 8px internal row gaps and 56px minimum rows. Controls have at least 44px targets and 2px outer focus rings. Defaults are Recommendation (always shown, pinned first, including chart/ventilation settings), Indoor summary (hidden), Moisture comparison (hidden), Chart key (shown; retains the former Supporting details visibility key and order position). Preserve saved relative order and visibility of the three optional boxes.

Recommendation reserves the empty 44px handle column so its regular label aligns with the optional rows. A decorative muted 20px lock with 1.5px strokes is centred in the 48px switch column; keep Always shown · Pinned first as visually hidden screen-reader text. Add no switch, handle or tab stop; normalise its existing visibility key to true. Credit and footer actions remain last on Why. Switches save immediately; their tracks/thumbs use the current theme roles; Light has a neutral off track and dark on track with white thumbs, while Dark uses its documented primary-action/thumb overrides. Indoor readings contains Open on launch (on), Show camera button (on), Still photos (off) and Auto flash (on) nested with a subtle left rule and 8px internal gaps, then Show voice button (off).

Turning Show camera button off hides the entire nested options group, removing its space, keyboard stops and accessibility presence; retain saved Still photos and Auto flash values and restore them on enabling. If focus would become hidden, return it to Show camera button. Still photos help says Can capture more detail; may take longer. Auto flash help says Turns on lighting in low light. The camera-help Settings link focuses Auto flash when visible, otherwise Show camera button, without enabling the shortcut. Use the shared sheet header and viewport rules. The header tick closes without an extra save step; preserve existing dismissal and opener focus. The persistent thermometer button opens Indoor readings from either page; Settings has no duplicate edit action.

## Pull to refresh

a deliberate downward drag at page scroll position zero reveals three dots and a cue inside Recommendation, on its continuous theme-panel backing. Cue text uses `--ink-main`; active dots use `--ink-muted`, inactive dots `--border-subtle`. Dot row and success/failure icon have equal 24px height. The cue has 76px minimum height and grows with text. Preserve resistance approaching half the coloured card height, the full-cue activation threshold, 450ms settling and 1.4-second result display; reduced motion settles immediately. The coloured verdict/chart slides over the stationary ventilation strip. After its bottom passes the strip’s resting bottom, translate the strip and every following visible shell child, including Indoor summary and the footer, by that excess distance.

Measure fractional rendered geometry and recalculate during loading, recovery and resizing. Keep exactly 16px between the resulting Recommendation bottom and following sections. Normal taps retain their actions; recognise pulls after 12px downward, vertically dominant movement and suppress the resulting click. Chart taps and horizontal touch drags inspect, downward pulls refresh without changing selection. All open sheets, camera/timer help, the reorder menu and native popovers block refresh. Opening one cancels a gesture and clears its visuals; an active request finishes without resurrecting pull feedback. Expanded page accordions and More detail are not popups. Active editing, multitouch, cancellation and backgrounding remain protected.

## Layout controls

the group header places an underlined Reset at the right, with accessible name Reset Overview layout and a 44px target; wrap rather than squeeze the header. Reset restores layout order and visibility only. The three movable rows have 44px transparent dot handles with no visible arrow buttons; moves cannot cross the pinned Recommendation. On touch, hold the handle for 300ms, then move at least 8px to drag; mouse and pen drag immediately after 8px. An early 8px movement in any direction cancels reordering for that entire touch and permits native vertical scrolling and pinch zoom. A touch stopping scroll momentum cannot arm or open the menu. Before arming, the handle uses the subtle hover surface.

At 300ms, darken the grip and softly highlight the entire row without resizing; releasing without dragging clears it without opening the menu. Suppress compatibility clicks after holds, swipes and cancelled drags. Cancel timers, capture and feedback on additional pointers, native cancellation, Escape, dismissal, backgrounding or viewport changes; scrolling cancels a pending hold while active edge scrolling continues. Prevent native long-press selection/callouts only on handles. Handle help reads “Tap for move options; touch and hold to drag”. During dragging, a full-opacity inert preview follows the finger vertically at its original offset, clipped to the scrolling body clear of header/footer fades.

Keep real controls and order unchanged; shift neighbours over 160ms ease-out to leave a measured row-height gap, without an insertion line. Use untransformed midpoints with 8px hysteresis; account for varying heights and scroll offsets. Automatic scrolling only reveals offscreen movable rows; a fully visible reorder list never scrolls into unrelated settings. Use the actual body bottom clear of the footer fade and top below the overlaid header, with 24px activation zones and a continuous 200ms dwell. Increase speed smoothly with edge proximity, capped at 160px/second using elapsed frame time, and clamp each step to the remaining hidden row extent.

Stop when destinations are visible, the pointer leaves the zone, direction changes or dragging ends; leaving and returning requires a fresh dwell. Save once on drop and settle over 160ms; roll back on Escape or cancellation. Menu moves use the same 160ms position treatment. Reduced motion removes transitions while preserving direct finger tracking. Dismissal, backgrounding, viewport changes or a new interaction clear previews and interrupted animations. Decorative previews have no IDs, focus stops or accessible controls; forced colours delineate the gap and preview. Tap or keyboard-activate a handle for a nonmodal Move up/Move down text menu, clamped inside the visible dialog.

Disable boundary actions; keyboard arrows/Home/End navigate the menu, Tab returns to row controls, and Escape closes the menu before the sheet. Moves retain handle focus and announce position. Close on selection, outside interaction, scrolling, reset or sheet dismissal; preserve outside-control focus and restore hidden menu focus on viewport changes. Hidden boxes stay reorderable. Repair partial saved orders in default order, ignore unknown/duplicate IDs, and preserve explicit saved visibility; blocked storage retains session choices. Move existing DOM nodes before first paint and preserve chart handlers and accordion state. The parent owns page-section spacing.

## Weather refresh interactions

Use the refresh icon beside the checked time, or pull down from the page top on a touch device, to update outdoor weather. A deliberate downward pull can start on buttons, links, accordion headings or the chart without activating them. Chart taps and horizontal drags still inspect the forecast. The coloured card slides over the ventilation strip, and everything below follows without overlap. Pull-to-refresh is unavailable while any sheet or popup is open, or while editing a field. If a sheet opens during a pull, the pull is cancelled; an already-started weather request can finish without showing pull feedback over the sheet. **Refresh app** in the footer reloads the app and follows the launch preference.
