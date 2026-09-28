# Draft — reopened microphone yields silence after manual SpeechRecognition.stop()

> Historical, unsubmitted draft, preserved 27 September 2026. This reproduction describes the pinned `.9` diagnostic. The hosted page and current release helper have since changed: `.10` added cleanup-completion auditing. See the [current investigation](../../VOICE-INVESTIGATION.md) for that later evidence. External issue statuses below are historical.

Not submitted. Prepared 22 September 2026 from user-supplied device logs. Proposed component: WebRTC / media capture; maintainers may route differently.

## Environment

iPhone, user-confirmed iOS 27.0, Safari Version/27.0; HTTPS; recognition language en-GB, continuous=false, interimResults=true. Exact phone model and OS build unavailable. UA contains iPhone OS 18_7 and AppleWebKit/605.1.15; these are not proof of installed OS/build. No media playback is needed in the reproduction.

## Reproduction

Existing diagnostic: https://zige-qiao.github.io/is-it-dryer-out/voice-test.html?mode=track-pause&staged=1&stopTrack=enabled

Confirm build v0.5.4.9-stop-enabled-test, assetRevision=126, staged=true, stopTrack=enabled. Mutable hosted URL; source is pinned at https://github.com/zige-qiao/is-it-dryer-out/tree/76c732b (voice-test.html and voice-test.js).

1. From a working initial page, Open microphone: getUserMedia({audio:true}), connect its source to waveform and independent probe analysers. Speak and verify changing numeric levels.
2. Start a fresh webkitSpeechRecognition object and verify speech/results.
3. While speaking, call recognition.stop(). Do not disable or stop the getUserMedia track. Wait for recognition end.
4. Continue speaking: retained capture can still report changing sound levels. Pause and resume speech to confirm responsiveness.
5. Release microphone: disconnect the source, stop all tracks, close the AudioContext. Observe microphone indicator clearing.
6. Without reloading, request a new microphone stream and create a new AudioContext/source/analysers. Speak before starting recognition again.

Expected: reopened microphone supplies sound, then recognition works again.

Actual: new track reports live/enabled/unmuted; AudioContext reports running; analyser reads and waveform callbacks advance, with no read exceptions. RMS and peak remain zero to six decimals. Subsequent recognition emits start/audiostart but no speech/results during the observed interval.

## Evidence

Three supplied stop-enabled runs show silent reopening. Strongest phase-isolation run: Stop 33.054s, end 33.098s (final result received), Release 47.933s, reopened microphone ready 53.394s. Five zero microphone-only reports precede recognition start 58.550s. Waiting ~15 seconds after end before releasing did not prevent failure.

Another run shows changing retained RMS at 15.292–18.305s after recognition ended 14.237s, Release 18.377s, then three zero microphone-only reports after reopening. Thus retained capture need not fail at Stop.

Third run: end 11.446s, varying post-end levels, intentional speech pause at ~18–22s, strong sound resumes at 23.654–25.663s without restart. Release 26.222s; new stream ready 27.864s; zero audio thereafter. Its pre-recognition observation window was only ~1.5s, shorter than the other two runs. The user confirmed the pause was intentional: repeated tiny levels must not be described as a frozen stream.

Positive controls: three microphone-only attempts/two release-reopen cycles all supplied sound, and user confirmed the amber dot cleared at every release. One staged natural-recognition completion/reopen also succeeded. Recogniser construction occurred in microphone-only controls but recognition was never started.

## Limits and implementation details

Numeric logging only; no audio file or transcript content stored by the diagnostic. Counters measure JS calls, not fresh hardware samples. These tests cannot locate the fault between Web Audio graph, capture backend and OS session. The current release helper calls AudioContext.close() without awaiting settlement; several-second delays still failed, but explicit close-completion instrumentation remains a useful control. No independent recorder or loopback capture has verified the reopened stream outside Web Audio.

All three failure runs leave the getUserMedia track enabled at manual Stop. Track disabling is therefore not necessary. Earlier Abort failures used a different track-pause control; do not claim this exact no-disable Abort sequence was tested. No claim of failure frequency beyond these supplied runs, or of all iPhone models being affected.

## Related, not established duplicates

- https://bugs.webkit.org/show_bug.cgi?id=317741 — speech capture audio-session activation; fixed on WebKit main.
- https://bugs.webkit.org/show_bug.cgi?id=317747 — active microphone/session lifetime; fixed on main.
- https://bugs.webkit.org/show_bug.cgi?id=321436 — recognition failure after media playback; NEW at research check. Our reproduction does not require playback and measures silent getUserMedia before recognition restarts.

Please advise whether the shared capture-session teardown/restart path is covered by an existing issue. No claim is made that the above fixes are absent from or included in this installed iPhone build.
