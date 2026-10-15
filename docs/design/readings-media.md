# Indoor readings, camera and voice presentation

**Audience:** Interface and media implementers

**Status:** Current main reference for v0.7.11

**Owns:** Manual entry and camera/voice presentation, review, confirmation and feedback

**Reviewed:** 16 October 2026

[Documentation index](../index.md) · [User guide](../user-guide.md)

## Contents

- [Camera readings](#camera-readings)
- [Camera loading](#camera-loading)
- [Indoor summary](#indoor-summary)
- [Reading age](#reading-age)
- [Edit / Indoor card](#edit--indoor-card)
- [Persistence](#persistence)
- [Voice](#voice)
- [Comparison reflow](#comparison-reflow)
- [Camera capture controls](#camera-capture-controls)
- [Voice entry presentation](#voice-entry-presentation)

Manual readings save immediately. Camera readings require confirmation and voice readings require completed recognition, review and Apply. Presentation work must preserve those draft boundaries and the [microphone policy](../development/voice.md).

## Camera readings

The Indoor heading has matching camera and microphone icon buttons with 44px circular touch targets, accessible names and the existing focus conventions. Camera capture and review are alternate views in the same sheet; manual rulers are hidden until returning to manual input. A neutral circled left chevron in the 44px left header slot returns to manual input and cancels drafts. The circled X in the right slot closes the entire sheet. The title stays centred between the visible Back control and the right action group. Both camera views group a 44px question-mark help button with X on the right, with an 8px gap. Capture help contains framing/sharpness/reflection guidance; review help contains drag instructions and value correction.

Hover/focus shows the tooltip; tap toggles it; Escape or outside interaction dismisses it without consuming photo editing. Changing views closes help. Use one compact sentence below the preview: “Keep the main digits sharp and visible.” Keep detailed guidance in help.

Capture uses a 4:3 canvas live preview with a capability-dependent flash toggle and no inner guide or dimming overlay. Inside it, place 1×, 3× and 5× buttons in a bottom-centred, borderless dark translucent pill with 4px inner spacing. Buttons have at least 44px targets, native keyboard activation, visible outer focus and aria-pressed selection. Selected buttons use a light solid surface and dark text; forced colours use Highlight/HighlightText. Keep at least 8px between the zoom pill and flash. Selection updates immediately and remains interactive while camera changes coalesce; disable presets during capture and keep the shutter disabled until camera/framing settlement. Reset to 1× on retake.

Preview notifications occupy the top-centre with 12px edge spacing and compact wrapping padding. The Take photo shutter centres a decorative 20px camera icon and its label together with an 8px gap, matching Retake artwork and retaining its accessible name. Show “Capturing…” for native video-frame capture or “Hold still — taking photo…” throughout still capture. Blur only preview presentation during switching; preserve unfiltered source pixels. Preview dimensions and capture framing remain consistent. Review retains the original framed image, unit-inclusive outlines with intrinsic-width, single-line labels separated by at least 4px and kept within photo edges.

Prefer Temperature above-left and Humidity above-right, shifting or staggering full names when needed; connectors link displaced labels to their boxes. Keep labels clear of resize handles and Retake, preserve valid placement during edits, and recompute after viewport changes, normalised crop previews and side-by-side editable fields. Put the polite live reading status in a full-width box above the fields, with 12px corners/padding, a decorative 16px icon, an 8px gap and wrapping 14px text. Blue indicates processing/information, green valid values ready for review, amber missing/invalid/ambiguous readings or assignment, and red recognition failure. Use existing semantic backgrounds; ready text, icon and border use `--status-ready`: Light green #067A57 (4.78:1 against the Light --status-open-bg), with the documented Dark green override.

Green never means saved: explicit confirmation is required. Animate only processing and respect reduced motion. A borderless dark translucent camera-icon + Retake pill sits 12px from the photo’s bottom-right, with a 44px minimum target, visible keyboard focus and native Enter/Space activation. Confirm readings is the single full-width bottom action, in document flow so it cannot cover draft fields. Only camera review suppresses vertical elastic overscroll; retain overflow scrolling when content exceeds the visible viewport and keep header drag dismissal and photo editing intact.

Confirm readings persists reviewed values; disable it during gestures, processing, unresolved assignment, or incomplete/invalid drafts. Retake remains available during recognition and immediately clears the photo, boxes and drafts. Never show preset boxes on an empty photo. Move and resize detected boxes directly, or draw on empty photo space without selecting a field first. Read automatically on release or keyboard adjustment; taps and cancelled gestures preserve drafts. Units assign new boxes, with a post-draw Which reading is this? choice only when needed. Both units require tightening; unassigned boxes may be discarded. Existing boxes retain their field, and contradictory units leave it unresolved. Preserve the unaffected field and ignore stale results.

Keep scrolling available outside the photo, photo gestures separate from sheet dismissal, and focused values visible above the keyboard. Source metadata remains session-only.

Camera failures provide manual entry and retry. Permission guidance is short, expandable and distinct from device availability or recognition failure. Sheet dismissal, visible-viewport sizing, focus return and reduced-motion behaviour retain the shared conventions below.

- At 360px and below, stack the Indoor summary's age below its heading, tighten internal reading/action gaps, and retain 44px camera, microphone and pencil targets without horizontal overflow. External section spacing stays 16px.

## Camera loading

keep progress inside the disabled camera entry button, replacing its icon with a 20px spinner (static with reduced motion). Add no loading copy below the heading. On failure, restore the button and show “Camera couldn’t load. Try again or enter readings manually.” in muted 12px text below the heading actions and above manual controls, announced as a status. Clear this feedback on retry or dismissal.

## Indoor summary

hidden by default and second in the default order, so enabling it places it below the pinned Recommendation unless reordered among the optional sections, as a flat theme-panel card (white in Light) with a subtle border and 20px radius. It shows indoor temperature and RH, muted units and reading age, with a faint centred 1px divider. Matching 44px icon actions appear in camera, optional microphone, pencil order; they wrap below readings when needed. Pencil has the accessible name and tooltip “Edit indoor readings”. Camera starts the existing scanning flow immediately; the camera and microphone respect their Indoor readings Settings choices. Sheet dismissal returns focus to the opener. Existing saved summary visibility is respected.

## Reading age

after an indoor edit, show `Just now` for the first minute, `1m ago` through `59m ago`, then `1h 0m ago` and higher in both the strip and Indoor sheet. Prefix the strip age with a decorative dot; use no `set` or `Updated` label. Refresh each minute and on return to the visible page. Hide both age labels when there is no valid saved timestamp; retain the absolute device-local timestamp as a title.

## Edit / Indoor card

retain the current whole-card action. Warm the card's subtle interaction tint and the Edit pill together. Outline the card for keyboard focus, avoid a second Tab stop, and keep the pill label visible. This corrects the earlier suggestion to show feedback only on the pill.

## Persistence

manual readings and ventilation changes save immediately. The header tick closes the sheet without an additional save step. Voice uses an explicit review and Apply step.

## Voice

retain the existing recording lifecycle. Use a persistent plain prompt section above a separate neutral status/transcript panel; distinguish Ready, Listening/Hearing, review, error and unavailable through wording and controls. A moving waveform represents available audio levels, not proof of transcription. Styling must not alter microphone permissions, retained streams or iOS recovery policy.

## Comparison reflow

when the comparison container is narrower than 15rem, stack Outdoor, the transfer explanation and Indoor in their DOM order, with 16px internal gaps. This text-relative breakpoint lets enlarged readings remain intact without horizontal overflow; normal narrow layouts retain the existing comparison columns where they fit.

| State | Required communication |
|---|---|
| Saved / changed manual value | Updated number, estimate and summary; no extra success toast or save step. |

| State | Required communication |
|---|---|
| Voice unsupported / error | Manual entry remains usable; review before applying recognised values. |

### Camera capture controls

The live 4:3 preview has no inner guide or dimming overlay. Notifications are top-centred and inset 12px. Zoom presets use a borderless dark translucent pill at bottom-centre, with a solid light selected button; flash stays bottom-right with existing state styling. Controls retain 44px targets and at least 8px separation; below 360px the zoom and flash use separate bottom rows and preview height grows to avoid overlap. Retake is a borderless dark translucent camera-icon/text pill inset 12px at bottom-right on review. Zoom, inactive flash and Retake share a 65% opaque dark background (rgb(32 39 37 / 65%)); enabled labels and icons remain fully opaque, while selected zoom and active flash retain solid white backgrounds. Keyboard focus remains outlined.

Switching uses a 6px preview-only blur with a 150ms transition (no transition under reduced motion); controls and messages remain sharp. Status text uses 4px vertical and 8px horizontal padding with a 32px minimum height, and wraps without covering the flash control. Frame capture immediately announces “Capturing…”; still capture announces “Hold still — taking photo…”; the review sheet then announces “Reading numbers…”. Camera help supports an interactive Settings link focused on the default-on Auto flash switch when visible, otherwise Show camera button. The 1×, 3× and 5× buttons select an exposed telephoto camera at higher presets, with multipliers treated as approximate.

### Voice entry presentation

Voice uses the title Update by voice; returning to manual restores Indoor readings. Prompts remain visible in their own plain section above the separate surface-control status/transcription panel. The grey panel has 12px padding, 8px radius, regular UI type, main text colour and 1.45 line height. Reserve two dynamic text lines and grow for longer Hearing/Heard text. Keep proposed readings separate and require explicit Apply. Record readings uses the same full-width dark primary styling as Take photo, with microphone and label; retries say Record again. Starting and finishing use centred labels. While listening, show only a centred `--ink-on-primary` waveform (white in Light, dark ink in Dark) and name the button Stop recording; pressing it stops. Keep animation contained and respect reduced motion.

The Indoor strip is hidden by default and the Indoor sheet opens on initial Overview launch by default; opening Why directly does not open it; both are independent saved preferences in the footer Settings sheet. Edit on the strip or Indoor comparison card also opens the Indoor sheet; the strip's microphone action appears only when speech recognition is supported and starts listening from that tap. Manual values save immediately; voice values require review and Apply. Return focus to the opener for manually opened sheets, or to the location button after automatic opening.

The whole ventilation summary opens Ventilation settings, where changes persist immediately. Keep the detailed Indoor comparison card for AH and dew point context.
