# Voice implementation and microphone policy

**Audience:** Voice maintainers

**Status:** Current main reference for v0.7.11

**Owns:** Command parsing, review isolation and the production microphone lifecycle

**Reviewed:** 16 October 2026

[Documentation index](../index.md) · [User guide](../user-guide.md)

## Contents

- [Production microphone lifecycle](#production-microphone-lifecycle)
- [Controller and parser boundaries](#controller-and-parser-boundaries)
- [Verification boundaries](#verification-boundaries)

Read this policy before changing recognition or microphone teardown. Then read the [current investigation](../voice/VOICE-INVESTIGATION.md) for issue status and device evidence. Historical experiments do not override the accepted foreground policy.

Voice results remain provisional while recognition is listening or stopping. Only completed recognition creates an Apply draft; new results, cancellation and invalid review clear obsolete drafts. Parser routes share field exclusions, preserve signs and accept adjacent temperature units. The existing foreground iOS microphone retention is unchanged.

## Production microphone lifecycle

Voice input updates indoor temperature and RH only. Keep review before Apply, immediate manual Stop, session isolation, and the meterless fallback. On desktop, recognition must not wait for its optional meter. On iOS, prepare the standard meter before a fresh recognition attempt and retain its enabled stream after explicit voice activation throughout the foreground session, including Stop, Apply, sheet close, and recognition errors. Stop waveform animation outside active attempts; release capture on hidden/pagehide and clean up invalid resources. The persistent amber indicator is an accepted trade-off; background-release recovery remains unresolved. Do not reintroduce the rejected release-and-reopen recovery without new device evidence. Read [VOICE-INVESTIGATION.md](../voice/VOICE-INVESTIGATION.md) for experiments and diagnostic rules when working on voice or microphone lifecycle.

## Controller and parser boundaries

`src/voice/parser.js` parses temperature/RH commands independently of the DOM. Keep latest corrections, negated instructions and negative-value rejection; do not turn a negative spoken temperature into a positive reading. Voice changes only indoor temperature and relative humidity.

`createVoiceController` in `src/voice/controller.js` owns recogniser attempts, timers, meter resources and draft review. Keep a fresh recogniser for an attempt, session isolation and rejection of late callbacks. The existing 30-second recognition watchdog is independent of foreground stream retention; it is not a retention expiry timer.

On desktop, recognition starts without waiting for the optional meter. On iOS, prepare the standard meter before fresh recognition and reuse the accepted enabled foreground stream. Manual Stop finishes promptly; cancellation discards drafts. Neither errors nor Stop/Apply/sheet close are a request to implement a hardware release/reopen recovery. Invalid resources and hidden/pagehide cleanup still release capture.

The app's review UI offers Apply only after recognition completes. A moving waveform is audio-level feedback, not proof of successful transcription; the meterless fallback stays available. Stop animation outside active attempts. Review/Apply must preserve the latest valid correction and never commit obsolete or incomplete drafts.

## Verification boundaries

Use direct parser and lifecycle tests for JavaScript ownership. Use the current investigation for original device observations. A live/unmuted track, running AudioContext, `audiostart` event or resolved cleanup promise cannot prove usable samples, hardware microphone release or successful background recovery. Do not claim speech is entirely local: browser recognition may use an external service.
