# Scan indoor readings with the camera

**Audience:** People using the app

**Status:** Current working-tree reference; Appearance remains Unreleased where labelled

**Owns:** Capture, review and confirm, with optional controls and recovery

**Reviewed:** 14 October 2026

[Documentation index](../index.md) · [User guide](../user-guide.md)

1. Open Indoor readings with the thermometer button and choose the camera icon.
2. Keep the monitor sharp, including the small decimal, and choose **Take photo**.
3. Compare both recognised values with the photo; correct any uncertain field.
4. Choose **Confirm readings**. Until confirmation, the saved indoor readings remain unchanged.


## Contents

- [Capture and framing](#capture-and-framing)
- [Capture modes, lighting and review](#capture-modes-lighting-and-review)
- [Feedback and recognition limits](#feedback-and-recognition-limits)
- [Permission and recovery](#permission-and-recovery)
## Capture and framing

In Indoor readings, tap the camera icon to take a new photo. The question-mark button beside **Take a photo** contains framing, sharpness and reflection guidance. Keep the monitor display visible, including the smaller temperature decimal. Recognition selects the current top readings and ignores the low and high records. The flash control is available while the camera is live if the device supports it. There is no album picker. The camera briefly waits for startup framing to settle before enabling capture; its notifications appear top-centre inside the preview. Choose **1×, 3× or 5×** in the bottom-centred preview pill; 1× uses the starting rear camera, while 3× and 5× select an explicitly identified telephoto camera when available.

Switching between 3× and 5× adjusts that camera without reopening it. The latest selection wins during rapid taps; capture waits for the selected framing. The preview image blurs during switching; buttons and status remain sharp. This is a presentation effect and never changes captured or analysed pixels. Buttons start at 1× each time you retake and support keyboard activation. These multipliers describe camera selection and framing, not a guaranteed optical ratio. Camera zoom is used where available, otherwise a digital crop enlarges existing detail. The saved photo matches the 4:3 live preview, and capture waits until changed framing has rendered. Digital zoom cannot recover missing detail.

## Capture modes, lighting and review

Choose **Take photo** to capture a fresh frame from the live camera by default, with **Capturing…** feedback. Turn on **Still photos** in Settings for an actual still photo, with **Hold still — taking photo…** feedback. Both use the settled preview framing and then show **Reading numbers…**. Auto flash defaults on and chooses lighting after sustained low light. Frame mode keeps torch where supported; brighter still-photo flash requires still-photo mode. Manual flash overrides Auto for the session. Continuous torch switches off before a still photo. Both modes temporarily disable zoom, torch and duplicate shots. Failure offers retry or manual entry without silently changing capture mode. Browser support and the still photo field of view depend on the device.

Then compare the recognised values with their straightened, contrast-normalised image crops. The large photo stays original. The question-mark button beside **Check readings** explains box editing and value correction; tap it or focus it with the keyboard to open help. Escape closes help before the sheet. Tap a value to correct it. Detected boxes include the numbers, decimal and complete °C/% unit. Drag a box to move it or a corner to resize it; release to read that region automatically. Draw directly on empty photo space to add a box. Its unit identifies the reading; if the unit is unreadable, choose the reading when asked or discard the box. A box containing both units needs tightening. Arrow keys move a focused box; Shift resizes and Alt makes smaller adjustments.

Enter or Space on the photo creates a keyboard-editable box. A blank photo shows no detected boxes or invented values. The camera-icon **Retake** pill at the bottom-right cancels recognition, clears the image and drafts, and returns to capture at 1× using the saved capture preference. It remains available when the camera entry button is hidden. Recognition stops after at most ten seconds, keeping any validated reading and leaving unresolved fields empty. Temperature can be identified beside validated humidity on the same display even when °C is unreadable, but it still needs clear integer digits, a decimal and a fractional digit. Visible °F is rejected without conversion. If one reading cannot be recognised, that field stays empty.

Small units, faint or clipped segments, reflections and conflicting processing results can leave a legible-looking reading unresolved. Try a closer, sharper photo or type the values.

## Feedback and recognition limits

The status box above the values uses blue for processing/information, green for valid values ready to review, amber when readings need attention, and red for recognition failure. Icons and wording explain each state. Green does not mean the values have been saved. **Confirm readings** saves both values and updates the recommendation. Values must be 10–45°C (at most one decimal place) and 10–90% RH (whole numbers). Before confirmation, results are drafts: Back, dismissal or leaving the app discards them. The temporary **From photo** label clears after a manual or voice update and is not retained after reload. The top-right circled tick closes the manual Indoor sheet.

Photos are analysed locally, without an image-recognition network request or model download. Blurred, tiny or conflicting digits can remain unreadable; correct them manually rather than treating a suggested value as certain. See [recognition limitations](../development/camera-recognition.md) for technical details.

## Permission and recovery

Camera access needs HTTPS or localhost. If permission is blocked, allow Camera for this website in your browser settings and retry; check device permissions if necessary. Camera-unavailable and recognition failures offer a retry or **Enter manually**. The camera stops after capture and on dismissal or backgrounding. Scanning does not change the accepted foreground microphone-retention behaviour described below.

Auto flash is on by default in Settings. It turns on preview lighting after sustained low light and requests flash for the still photo; manual flash control overrides it for the current camera session. Camera help links directly to this setting. Hold still while the photo is being taken. Preview messages sit alongside the flash button.

At 3× or above, the app selects an explicitly identified telephoto camera when available; below 3× it returns to the starting rear camera. Digital cropping supplies zoom beyond supported camera zoom. The multiplier is approximate and the phone may manage its physical lenses internally.
