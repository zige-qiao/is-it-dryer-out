# Update readings by voice

**Audience:** People using the app

**Status:** Current working-tree reference; Appearance remains Unreleased where labelled

**Owns:** Availability, speech examples, recording, review and microphone limitations

**Reviewed:** 14 October 2026

[Documentation index](../index.md) · [User guide](../user-guide.md)

1. Enable **Show voice button** in Settings if needed, then select the microphone icon in a supported browser.
2. Say “21 degrees Celsius, 55 percent” or “21 and 55”.
3. Stop recording and review the latest values.
4. Use **Apply** to save the reviewed readings, or return to manual input to discard the draft.

Voice changes remain provisional while recording. Stop recording and review the latest readings before using **Apply**. You can say “21 degrees Celsius, 55 percent”; instructions not to change a reading are respected, and negative indoor readings are rejected.


## Contents

- [Examples and review](#examples-and-review)
- [Microphone indication and recovery](#microphone-indication-and-recovery)
- [Privacy and evidence](#privacy-and-evidence)
## Examples and review

In supported browsers, choose the microphone icon in Indoor readings or the optional summary. Say, for example, “21 degrees, 55 percent” or “21 and 55”. The sheet is titled **Update by voice**. Examples stay visible in their own section above the grey live/final transcription box. The full-width recording button matches **Take photo**; its centred white waveform appears while recording, and tapping it stops recording. Review the recognised changes and select **Apply**, or use the top-left circled chevron to return to manual readings and discard the draft. The top-right circled X dismisses the sheet without applying the draft.

## Microphone indication and recovery

On iPhone, the app retains the microphone stream after a voice attempt while it remains in the foreground, including after Stop, Apply or closing the sheet. The microphone indicator may remain on, although transcription and waveform animation end separately. Leaving or backgrounding the app releases capture; reliable restarting after release remains unresolved.

## Privacy and evidence

The waveform meter does not save or upload an audio file. Browser speech recognition may use an external service. See the [voice investigation](../voice/VOICE-INVESTIGATION.md) for device evidence and diagnostic instructions.

If the microphone button is unavailable, use manual readings. Its visibility preference is independent of browser support. A recognition error does not authorise applying an incomplete draft; review the completed latest readings or return to manual. The app does not have a verified release/reopen recovery for the affected iPhone.
