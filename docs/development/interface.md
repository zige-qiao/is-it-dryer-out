# Interface implementation

**Audience:** JavaScript maintainers

**Status:** Current main reference for v0.7.11

**Owns:** UI controller coordination, preferences, appearance, gestures, startup and recovery

**Reviewed:** 16 October 2026

[Documentation index](../index.md) · [User guide](../user-guide.md)

## Contents

- [Appearance](#appearance)
- [Location and reading recovery](#location-and-reading-recovery)
- [View navigation](#view-navigation)

The entry point wires features together; controllers own their private resources. Read the matching [design contracts](../design-system.md) for visible behaviour and this reference for implementation ownership.

`src/ui/explanation.js` derives one set of facts for the recommendation overview and More detail disclosure, then renders them without changing plan outcomes. It owns disclosure visibility and focus return while preserving the native open state. Weather state records `outdoorWindAvailable` independently of the numeric airflow fallback so explanatory copy can distinguish missing speed from calm conditions. Neither field is persisted as a new preference.

Settings reordering shares the dialog gesture guard's private pointer-eligibility callback through `app.js`; a touch stopping momentum cannot arm a hold. The layout controller owns its 300ms touch hold timer, 8px movement threshold and cancellation cleanup. Handles permit native vertical scrolling and pinch zoom. A scoped non-passive `touchmove` listener prevents native panning only after a hold is armed; changing `touch-action` during a gesture would not affect that gesture. Early movement cancels the hold permanently, and active drag edge scrolling remains enabled. Mouse/pen dragging and keyboard move menus retain their existing behaviour. The decorative drag preview is inert, aria-hidden and stripped of identifiers.

Measure untransformed row geometry once per drag and adjust for body scroll offsets; move neighbours with transforms without mutating the real order until drop. Edge scrolling gates on hidden movable-row extents, excluding pinned Recommendation and unrelated Settings content. Use 24px edge zones below the actual header and clear of pinned footer actions, resettable 200ms dwell, a quadratic proximity ramp capped at 160px/second, and clamp to the remaining hidden extent. Position hysteresis is 8px; ease-out settling is 160ms and disabled for reduced motion. Web Animations and preview layers are cancelled and removed when another interaction or sheet lifecycle change interrupts settling.

The shared `.white-sheet` dialogs keep a stationary flex shell, their existing native `.sheet-body` scroller and any existing fixed footer. `src/ui/sheet-chrome.js` privately enhances browsers supporting standard or Safari-prefixed backdrop blur. Measure both header and footer heights into `--sheet-header-height` and `--sheet-footer-height`; negative header/footer margins extend the body behind them. Body padding preserves a 16px initial gap and clears the last control by 16px above an existing footer. Focus scroll padding clears each pinned height plus 20px.

The shell's base pseudo-element supplies `--sheet-frosted-surface` and 4px blur continuously through the header and body until content overlaps the header. The controller compares the measured top of visible, non-decorative body regions with the header bottom, excluding hidden/empty regions and 1px accessibility text. Its private `has-header-overlap` class activates the header's matching glass and moves the base top to the measured header height in the same update, preventing double tint. Returning above the boundary restores continuous glass. Recalculate on scroll, content/mode changes and resize even without a replacement scrollbar, and clear the overlap class on close and forced-colour changes. The existing fixed Timer footer keeps its own glass. All five sheets use a sheet-local 95% white tint in Light and the pill's 55% tint in Dark, without doubled tint, fades, masked layers or an ancestor backdrop filter. The pill remains at 55% in both themes. Rounded overflow clipping retains the shell's corners. Opaque unsupported-blur fallback surfaces use `--surface-panel`.

Scrollbar replacement is separate from glass support. Only add `has-sheet-scrollbar` and hide the native scrollbar after creating the replacement for browsers supporting `scrollbar-width: none`. The decorative, aria-hidden 4px rail starts 4px below the header and ends 4px above the existing footer or body bottom, with a 24px minimum thumb. It maps the full native scroll range using the unobscured viewport height. Other blur-capable browsers retain glass and native scrollbar track insets. Mouse thumb dragging and track paging target the existing body; touch, wheel and keyboard scrolling stay native. The labelled body region is keyboard-focusable.

One queued animation frame batches scroll, resize and content changes; observe header, footer, body, shell and body children to account for text, keyboard and safe-area changes. Dismissal, interruption and backgrounding cancel pending work and capture. Unsupported browsers retain the original opaque layout and native scrollbar; forced colours use system surfaces and native scrollbars. Timer's existing footer overlaps the scroller; other sheets do not gain a footer. Dialog viewport tracking observes editable focus and actual viewport reduction to remove only bottom safe-area padding, ignoring pinch zoom and restoring prior styles on release. Help sizing clears visible footers. No theme preference or public interface changes are introduced.

Keep this module in the offline cache graph.

The dialog helpers own opener-focus snapshots and synchronous focus return. Sheet activation records whether the opener had visible keyboard focus; dismissal prepares its styling before native focus restoration, then consumes the saved return target so a queued close event cannot overwrite later keyboard interaction. Timer initialisation precedes shared event binding so Escape dismisses its open help popup before the sheet. Start completes dismissal and scroll cleanup synchronously before the Shortcut URL handoff.

## Appearance

The saved UI preferences include `theme: 'system' | 'light' | 'dark'`, defaulting to `system`; unknown values fall back to System. A small inline bootstrap before the stylesheet reads that value defensively, resolves device preference, and sets `html[data-theme]` and `color-scheme` before first paint. The imported theme controller binds native Appearance radios, persists changes through existing storage, observes the device media query while System is selected, and resynchronises on visible/`pageshow` return. Explicit Light or Dark remains stable. Overview layout Reset preserves theme and all existing non-layout preferences.

CSS role tokens cover neutral and feedback surfaces. Dark verdict backgrounds use precomputed hex endpoints from the [16% relative OKLCH lightness reduction](../design/foundations.md#a-recommendation-and-integrated-chart-surface), with no runtime colour conversion, overlay or brightness filter; Light verdict backgrounds, chart data colours and original media pixels retain their existing treatment. The static HTML theme-colour and manifest launch/chrome colours remain unchanged. The theme module belongs in the service worker's complete production graph; a local iteration does not increment the cache version.

## Location and reading recovery

Device coordinates start weather immediately using “Nearby location”. The optional locality lookup has a five-second fetch-and-decoding deadline and supports cancellation. Selection generations reject superseded results even when two selections share coordinates. Name-only updates persist the current location and matching recent place without clearing weather, restarting a request or changing weather timestamps. First-launch cancellation starts fallback weather once; successful/manual selection resolves startup before its automatic sheet close.

The typed-value binder owns rejection feedback for indoor readings, plan targets, custom dimensions and airflow. Invalid committed entries restore the saved value without saving, using permanent polite status nodes associated through `aria-describedby`. Feedback clears on a new input event, a paired ruler/stepper adjustment or sheet close. Numeric snapping and valid-input persistence remain unchanged. Restored fields are valid, so rejection feedback does not leave `aria-invalid="true"` on them.

The shared document-level gesture activation guard is installed once alongside focus tracking in `src/ui/dialogs.js`. It observes all pointer movement and captured nested scroll events, suppresses compatibility clicks after movement/cancellation, and protects touches that stop actual scrolling. It leaves native scrolling and component pointer handlers intact; keyboard and assistive click activation bypass the pointer guard. Test both directions and a fresh tap after cancellation when adding interactive controls.

Page layout preferences are normalised by `src/ui/page-layout.js`; its controller moves existing section nodes and owns Settings drag/keyboard ordering, a shared nonmodal text menu, pointer tap/drag discrimination and viewport-safe menu placement. On Overview, Recommendation is always visible and pinned first, followed by hidden Indoor summary and Moisture comparison, and shown Chart key by default; saved relative order and visibility of the three optional sections are preserved. Pull-to-refresh derives following nodes from Overview’s order and uses a private overlay lock; chart touch handlers defer inspection until gesture direction is known.

The shell stays concealed until initial preferences have been applied so its first visible paint uses the saved order and visibility. The camera loader keeps module availability separate from pending activation: closing Indoor readings, backgrounding/page exit or starting voice cancels the pending tap. Successful loading is retained without activating an obsolete request.

## View navigation

`src/ui/page-navigation.js` owns the Overview/Why hash routes, history, private per-view scroll positions, temporary inert slide previews and touch gestures. `app.js` wires chart redraw, Overview-only pull-to-refresh and the shared dialog gesture-click guard. The two views remain mounted and render from the same state; navigation never requests weather. Why contains the recommendation explanation and references, plus the existing Settings-sheet opener and utility footer. Saved Supporting details visibility/order now applies to Chart key only; Why is independent. Unknown hashes default to Overview; direct Why entry skips the automatic Indoor sheet. Tab clicks, taps and keyboard activation pass `animate: false`, cancelling any ongoing slide and switching immediately.

Swipes cache width and motion preference per gesture, coalesce movement into one inner-track transform write per animation frame and prepare the inert incoming preview offscreen at eligible touch-down, before horizontal recognition, so its layout is not added to the first drag frame. Tab-bar translucency and blur remain enabled throughout preparation, dragging and settling. The viewport stage stays stationary for clipping. Pull-to-refresh defers card measurements and follower styles until downward intent; horizontal rejection and ordinary taps do not measure or paint a zero-distance pull. Chart resize observation ignores zero widths while Overview is hidden, retaining the last visible width so revealing an unchanged swipe preview does not rebuild the SVG.

Real visible width changes still redraw it. Track layer hints start at eligible touch start and clear on rejected intent, release or cancellation; only settling uses page-level hints. Overlay lifecycle events cancel gestures; start/release retain authoritative overlay checks, avoiding queries in the move handler. Release and interruption cancel queued painting, and settling begins from the last painted position. Motion classes are cleared together with layer hints and previews; they do not disable tab-bar blur. Release transfers the shared track offset into page animations within one task. Slow final travel towards the neighbour must exceed half the stage width captured at touch-down.

Deliberate flicks also commit with at least 48px travel and velocity >=0.5px/ms towards the neighbour. Private sampling retains at most 32 positions within the final 100ms, including release; a gesture consistently uses valid event timestamps or the injected monotonic clock when initial event timing is unavailable. Invalid or zero-duration timing, a pause exhausting the window, or reversed last non-zero movement cannot qualify as a flick. Slow releases at or below halfway return. The bar uses 55%-opaque white with persistent 4px standard and Safari-prefixed blur and an opaque unsupported-blur fallback. Swipes retain direct finger tracking and use 360ms settling with cubic-bezier(0.3, 0.45, 0.4, 1) for completion and cancellation; browser history behaviour is unchanged.

Page controls and the tab bar allow swipes; the chart and open sheets/popups retain their existing gesture owners.

The shell owns the shared 16px page-section gap. Components have no outer vertical margins; internal spacing stays local.

The chart-key alignment helper in `src/ui/page-layout.js` measures the original ventilation summary separator, changing only the legend’s columns. Resize and mutation observers plus font/viewport events schedule one animation frame; hidden sections and wrapped summary groups use the normal CSS split. Shared event binding starts this page-lifetime helper without changing saved layout preferences.

Outdoor data comes from Open-Meteo. Device coordinates may be sent to BigDataCloud only to obtain a nearby locality name. Preserve the current fallback to the stored location or Sale, Greater Manchester.

UK location search accepts complete postcodes with or without spaces and case-insensitive outward codes such as `M1`, `M33`, and `SW1A`.
