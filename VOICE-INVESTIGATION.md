# iOS voice recognition investigation

This document records the investigation into repeated voice-input failures in iOS browsers and the verified application-level mitigation. The underlying platform defect is not claimed to be fixed.

**Status: Manual-stop mitigation verified in the diagnostic and implemented in the app for production-UI validation.** Build `v0.5.4.4-voice-diagnostics`, asset revision 120, completed three consecutive naturally ending held-stream diagnostic attempts and three consecutive naturally ending normal-app attempts without reloading. Build `v0.5.4.5-voice-diagnostics` then isolated the remaining manual-stop failure and verified that retaining the same live stream across manual stops keeps immediate fresh-recogniser retries working.

## Summary

On the tested iPhone, one `webkitSpeechRecognition` session succeeds and immediate later sessions fail to receive microphone audio. Failed sessions still emit `start` and `audiostart`, but do not emit `speechstart` or `result`. The physical iOS microphone indicator does not activate during these failed sessions.

On the tested iPhone, the failure occurred whether the page reused one recogniser or created a new recogniser for every attempt. A full page reload restores recognition immediately. Without a reload, recognition has repeatedly recovered after approximately one minute, after which one session succeeds and the next immediate attempt fails again.

Voice Memos continues to activate the physical microphone and record normally while browser recognition is in the failed state. This rules out a faulty device microphone and points to the browser or platform speech-recognition audio session.

The regression was introduced when v0.5.3.1 stopped opening the app's normal `getUserMedia` waveform stream on iOS. That stream had appeared optional but was also keeping the iOS audio session active while `webkitSpeechRecognition` ran. Restoring the overlap, while retaining the safer isolated-session cleanup added later, produced three consecutive successful diagnostic attempts and three consecutive successful production-app attempts without reloading.

## Tested environments

### iPhone

- Platform: iPhone
- Operating system reported by the user agent: iOS 18.7
- Browser: Safari 27.0
- WebKit user-agent version: 605.1.15
- Touch points: 5
- Secure context: yes
- Speech recognition available: yes
- Affected diagnostic build: `0.5.4+diagnostics.1`
- Verified mitigation build: `v0.5.4.4-voice-diagnostics`, asset revision 120

### Mac

- Hardware: Apple M2
- Platform reported by the browser: MacIntel
- Browser: Safari 26.6.2
- WebKit user-agent version: 605.1.15
- Touch points: 0
- Secure context: yes
- Speech recognition available: yes
- Diagnostic build: `0.5.4+diagnostics.1`

The Mac and iPhone results are not equivalent even though both user agents report WebKit 605.1.15. Speech recognition is backed by platform-native services whose lifecycle differs between macOS and iOS.

A later iPhone screen recording covers the same immediate-retry failure in both Safari and Chrome. The video report does not record exact browser version strings.

## Diagnostic pages

- `?voice-debug=1` enables the real app's privacy-safe voice lifecycle log.
- `voice-test.html?mode=reuse` repeats recordings with one recogniser object.
- `voice-test.html?mode=fresh` creates a new recogniser object for every attempt.
- `voice-test.html?mode=interrupt` records page visibility and manually marked audio interruptions.
- `voice-test.html?mode=prime` briefly opens and releases a standard `getUserMedia` microphone stream before another recognition attempt. On the affected iPhone, the stream opened normally but did not restore speech recognition.
- `voice-test.html?mode=hold` opens a standard `getUserMedia` stream before recognition, keeps it alive throughout the attempt, uses it for a live waveform and releases it only after recognition ends. Diagnostic build `0.5.4+diagnostics.3` used this mode to verify the keep-alive mitigation.

The diagnostic logs record lifecycle events and timings but never recognised speech content.

The full frame-by-frame supporting report is retained in [the iOS Web Speech microphone video analysis](tests/ios_web_speech_microphone_video_analysis.md). Its video timestamps and indicator observations are approximate rather than instrument-grade measurements.

## Results

Unless otherwise stated, timestamps are elapsed seconds since the relevant page loaded or its diagnostics were cleared. `Worked` means that `speechstart` and at least one `result` event were received. `Failed` means that the browser emitted `start` and `audiostart`, but no speech or result events arrived before the attempt was manually stopped.

### Mac comparison page: reused recogniser

All three attempts worked with the same recogniser object.

| Attempt | Start requested | Speech/result received | End | Outcome |
|---|---:|---:|---:|---|
| 1 | 13.571 | 22.326 | 27.885 | Worked; final result received |
| 2 | 30.777 | 33.532 | 39.090 | Worked; final result received |
| 3 | 41.443 | 44.454 | 50.454 | Worked; final result received |

### Mac real app

All three sessions worked. Each session opened a separate `getUserMedia` meter stream, detected one second of silence, stopped recognition, received a final result and released its audio resources.

| Session | Requested | Speech/result received | End | Outcome |
|---|---:|---:|---:|---|
| 1 | 14.710 | 20.010 | 22.765 | Worked |
| 2 | 24.606 | 26.884 | 29.355 | Worked |
| 3 | 31.069 | 32.879 | 35.574 | Worked |

These runs show that repeated recognition and the app's JavaScript session cleanup work on macOS Safari.

### iPhone real app before mitigation

The affected production build gave speech recognition exclusive microphone access on iOS and deliberately skipped its separate audio meter stream.

| Session | Requested | Speech/result received | End | Outcome |
|---|---:|---:|---:|---|
| 1 | 3.906 | 8.532 | 11.911 | Worked; final result received |
| 2 | 13.305 | Never | 24.474 | Failed; manual stop produced intentional `aborted` event |
| 3 | 25.242 | Never | 31.141 | Failed; manual stop produced intentional `aborted` event |

The app's stale-session protection and cleanup completed normally. Sessions 2 and 3 reached `audiostart`, but Safari never delivered speech.

### iPhone real app after mitigation

Production build `v0.5.4.4-voice-diagnostics`, asset revision 120, reproduced the held-stream lifecycle in the normal app UI. All three consecutive sessions worked without a reload.

| Session | Stream opened | Meter started | Recognition requested | Speech started | Final result | Recognition ended | Meter stopped | Outcome |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | 4.254 | 4.261 | 4.262 | 6.596 | 10.194 | 10.224 | 10.225 | Worked |
| 2 | 11.407 | 11.424 | 11.425 | 12.778 | 16.388 | 16.416 | 16.418 | Worked |
| 3 | 17.884 | 17.901 | 17.901 | 19.527 | 23.139 | 23.172 | 23.173 | Worked |

Each session opened a live, enabled and unmuted track, started recognition only after the meter was running, received interim and final results, ended normally and released its meter immediately afterward. No meter silence threshold stopped any iOS session.

### iPhone comparison page: reused recogniser

All attempts used recogniser object 1.

| Attempt | Start requested | Speech/result received | End | Outcome |
|---|---:|---:|---:|---|
| 1 | 39.360 | 43.364 | 46.508 | Worked; final result received |
| 2 | 50.576 | Never | 61.248 | Failed; manually stopped |
| 3 | 62.348 | Never | 70.435 | Failed; manually stopped |

Reusing a recogniser did not prevent the failure on the tested iPhone.

### iPhone comparison page: fresh recogniser per attempt

Attempts used recogniser objects 1, 2 and 3 respectively.

| Attempt | Start requested | Speech/result received | End | Outcome |
|---|---:|---:|---:|---|
| 1 | 1.681 | 4.269 | 8.608 | Worked; final result received |
| 2 | 11.383 | Never | 18.876 | Failed; manually stopped |
| 3 | 19.695 | Never | 27.147 | Failed; manually stopped |

Creating a new recogniser did not prevent the failure. The reused- and fresh-recogniser runs both showed the same immediate-retry failure on the tested iPhone.

### iPhone spontaneous recovery run

This longer fresh-recogniser run showed that recognition can recover without a page reload. Each attempt used a newly created recogniser.

| Attempt | Start requested | Speech/result received | End | Outcome |
|---|---:|---:|---:|---|
| 1 | 5.178 | Never | 15.285 | Failed |
| 2 | 157.586 | 161.351 | 164.696 | Worked |
| 3 | 169.042 | Never | 173.656 | Failed |
| 4 | 174.596 | Never | 177.981 | Failed |
| 5 | 230.275 | 232.350 | 236.945 | Worked |
| 6 | 239.776 | Never | 243.866 | Failed |
| 7 | 260.542 | Never | 265.253 | Failed |
| 8 | 272.181 | Never | 274.390 | Failed |
| 9 | 285.706 | Never | 288.590 | Failed |
| 10 | 446.628 | 452.353 | 455.964 | Worked |
| 11 | 461.573 | Never | 466.734 | Failed |
| 12 | 611.495 | 613.778 | 618.117 | Worked |
| 13 | 621.249 | Never | 626.209 | Failed |

The browser logged several `visibility` transitions during this run. The tester reported remaining on the page and not intentionally switching to another app, so the visibility records are not treated as the recovery trigger. Recovery also occurred after long visible idle periods.

Successful attempts were consistently followed by failed immediate retries. Longer idle periods preceded later successes, but their duration varied; this run alone does not establish an exact recovery timeout.

### iPhone controlled timing and stop-method run

This six-attempt fresh-recogniser run compared immediate retries, approximately one-minute recovery intervals and automatic versus manual stopping.

| Attempt | Start requested | Speech detected | End | Stop behaviour | Outcome |
|---|---:|---:|---:|---|---|
| 1 | 5.749 | 9.652 | 13.522 | Automatic completion | Worked; final result received |
| 2 | 17.761 | Never | 25.092 | Manual stop after failure | Failed |
| 3 | 67.319 | 70.842 | 73.747 | Manual stop during active recognition | Worked; interim results received |
| 4 | 80.036 | Never | 85.108 | Manual stop after failure | Failed |
| 5 | 136.503 | 139.500 | 143.841 | Automatic completion | Worked; final result received |
| 6 | 149.630 | Never | 155.548 | Manual stop after failure | Failed |

The successful attempts began at 5.749, 67.319 and 136.503 seconds: gaps of 61.570 and 69.184 seconds. Immediate attempts after each success failed.

The tester also observed:

- After attempts 1 and 5 completed automatically, the iOS microphone indicator remained lit until another session started.
- When attempt 3 was stopped manually, the microphone indicator disappeared immediately.
- Attempt 4 still failed even though manual stopping had cleared the indicator.

This distinguishes two behaviours: automatic completion can leave the visible microphone indicator active, but clearing that indicator manually does not reset the speech service or make the next attempt work.

### iPhone microphone reset experiment

The reset control successfully opened one live `getUserMedia` audio track on every use, held it for approximately 400 milliseconds and released it. Four consecutive resets were followed by attempt 7, and two further resets were followed by attempt 8.

| Attempt | Resets before attempt | Last reset released | Start requested | Audio started | Speech/result received | End | Outcome |
|---|---:|---:|---:|---:|---:|---:|---|
| 7 | 4 | 124.419 | 125.532 | 125.572 | Never | 129.283 | Failed; manually stopped |
| 8 | 2 | 132.136 | 133.040 | 133.082 | Never | 137.279 | Failed; manually stopped |

Both recognition attempts reached `start` and `audiostart` but produced no `speechstart` or `result`. Their later `aborted` errors were the expected result of manually stopping the failed attempts. Repeatedly opening and releasing a normal microphone stream therefore did not recover the stuck speech-recognition session.

### iPhone cross-browser video run

A 141-second screen recording shows the failure in both Safari and Chrome on iOS. The first permitted attempt in each browser succeeded: the iOS amber microphone indicator appeared, followed by `speechstart` and recognition results. An immediate retry in the same browser then emitted `start` and `audiostart` while the amber indicator remained absent and no speech events or results arrived.

The clearest pair occurs near the end of the recording. A Chrome attempt at approximately 2:08–2:15 activated the amber indicator and completed normally. Its immediate retry at approximately 2:16 emitted `audiostart` but showed no amber indicator, `speechstart` or result before manual stopping.

Later Safari-to-Chrome and Chrome-to-Safari transitions were often followed by successful microphone acquisition in the newly foregrounded browser, sometimes in under one second. An earlier switch back to Safari did not recover immediately, so browser switching is not a reliable fix. The recording does not isolate whether recovery comes from elapsed time, page visibility changes, browser backgrounding, audio-session interruption or a combination of those effects.

### Page reload control

Three separate first attempts, each preceded by a page reload, all worked. A full document reload therefore resets the failed state immediately on the tested device.

### Device microphone control

Voice Memos successfully recorded audio and activated the iOS microphone indicator while browser recognition was otherwise failing. The phone's microphone hardware and system-level microphone permission were therefore working.

## Findings

The evidence supports these conclusions:

1. The failure was reproduced in Safari and Chrome on the tested iPhone; it was not reproduced in Safari on the tested Mac.
2. The production app is not required to reproduce it. The minimal comparison page fails with the audio meter disabled and no transcript handling.
3. Changing whether recogniser objects were reused did not prevent the failure on the tested iPhone.
4. A browser's `audiostart` event is not reliable evidence that the physical iPhone microphone has activated; the failed video attempts showed no iOS amber microphone indicator.
5. Manual `stop()` releases the visible microphone indicator but does not reset the underlying speech service.
6. A normal `getUserMedia` stream can open and release while speech recognition remains stuck, and repeated microphone resets do not restore it.
7. The failed state can recover after approximately one minute without a reload, although longer and shorter recovery periods have also been observed.
8. A full page reload reliably restores the next recognition attempt.
9. The physical microphone remains healthy and available to other iOS applications.
10. Foregrounding another browser often preceded fast recovery in the video, but switching browsers was not consistently sufficient and the recording does not separate lifecycle effects from elapsed time.
11. Keeping a standard microphone stream active throughout recognition produced three consecutive successful diagnostic attempts without a reload on the affected iPhone.
12. Applying the same lifecycle in the normal app UI produced another three consecutive successful attempts without a reload.

The most likely cause is a browser or iOS speech-recognition audio-session lifecycle defect below the JavaScript API. This is an inference from the recorded behaviour, not direct access to browser or operating-system internals.

## Regression history and engineering conclusion

The earliest `voice-input` branch already opened `getUserMedia`, started the real waveform and then started speech recognition while the stream remained live. That ordering unintentionally protected the iOS audio session. The early implementation nevertheless had real cleanup weaknesses: it used continuous recognition, relied on a one-second `speechend` timer, stored voice state globally and released the meter before asking recognition to stop.

Later versions correctly introduced fresh recognisers, stale-callback guards, one-shot iOS recognition and recognition-first cleanup. The v0.5.3.1 refactor then made a separate assumption: because the waveform stream and Web Speech both used the microphone, the stream might be competing with recognition. It therefore started recognition immediately and explicitly skipped the meter on iOS. The waveform disappeared, and the first-attempt-works/immediate-retry-fails behaviour became reproducible.

The experiments distinguish the cause from coincidence:

- Reusing or recreating recogniser objects did not change the failure.
- A 400-millisecond `getUserMedia` reset that ended before recognition did not recover it.
- Keeping the same kind of stream active during recognition succeeded three times in the standalone diagnostic.
- Moving that exact held-stream lifecycle into the app succeeded another three times.

The evidence therefore supports this application-level explanation: removing the stream exposed an iOS/WebKit audio-session lifecycle defect; the stream was not competing with recognition on the tested device but keeping the shared audio session available. This does not prove the inaccessible WebKit internals, but the overlap is the only tested variable that consistently separates failure from repeated success.

The production solution combines the useful original ordering with the safer later architecture:

1. Create an isolated, fresh one-shot recogniser for each iOS attempt.
2. Open a normal audio-only `getUserMedia` stream and start the real waveform before recognition.
3. Keep that stream active for the entire recognition attempt.
4. Use the meter only for visual feedback on iOS; do not let it impose silence timers.
5. Let WebKit finish after speech, with a 30-second watchdog and manual stop still available.
6. Release the meter only after recognition emits `end`, or during bounded error cleanup.

The held iOS stream must be treated as functional lifecycle infrastructure, not as an optional visual enhancement. Removing it, delaying it until after recognition starts or releasing it before recognition ends would discard the condition verified by both successful tests.

## Resolution status

The held-stream mitigation is resolved for attempts that WebKit ends naturally. It restored reliable repeated iPhone voice input on the tested device by holding a standard microphone stream throughout each one-shot Web Speech attempt. It also restored the real waveform while retaining isolated sessions, stale-callback protection, bounded cleanup and a 30-second safety limit.

The conclusion is supported by two independent 3/3 sequences without reloads: first in the minimal held-stream diagnostic and then in the normal production UI. The earlier failure reproduced when the stream was absent, while a stream released before recognition did not help. Overlap between the standard stream and speech recognition is therefore the verified application condition.

The manual-stop failure was caused by releasing the keep-alive stream immediately after the stopped Web Speech session, not by `recognition.stop()` alone. In the failing sequence, attempt 4 heard speech and was stopped manually; attempt 5 opened another healthy held stream and reached `start` and `audiostart`, but never reached `speechstart` or produced a result.

Build `v0.5.4.5-voice-diagnostics` added `mode=hold-persist` as the decisive control. It kept the exact `getUserMedia` track, AudioContext and waveform alive after a manual stop and reused them for the next fresh recogniser. An initial manual-stop-to-natural-completion pair worked. A stronger four-attempt sequence then produced: manual stop and retain; successful reuse followed by another manual stop and retain; successful reuse followed by natural completion and release; and a successful new stream after that natural completion. Every attempt reached `speechstart` and produced results.

This establishes the required lifecycle: retain the local stream across one or more manual stops, reuse it with each fresh recogniser, and release it once WebKit completes naturally. The production app now applies that lifecycle. It also releases the retained stream when the dialog closes, readings are applied, the page is hidden, recognition fails, cleanup times out, or the retained state reaches 30 seconds. The microphone indicator and live waveform may therefore remain active briefly after manual stop, but Web Speech has stopped and no audio is stored or transmitted by the app.

## Related WebKit reports

- [WebKit bug 317741: Speech recognition microphone source should make sure to keep its audio session active while capturing](https://bugs.webkit.org/show_bug.cgi?id=317741) was resolved as fixed in WebKit upstream in June 2026.
- [WebKit bug 321436: SpeechRecognition stops producing results after audio/video playback on iOS Safari](https://bugs.webkit.org/show_bug.cgi?id=321436) remains open. Its visible failure mode closely matches this investigation: recognition appears to start but produces no result, and plain Safari may not activate the system microphone indicator.
- [WICG Speech API issue 96](https://github.com/WICG/speech-api/issues/96) contains related discussion about iOS audio-session interruption and restarting recognition.

The app's minimal reproduction does not require audio or video playback, so its evidence may represent a broader trigger than WebKit bug 321436 currently describes.

## Microphone reset experiment

The local diagnostics page now includes `mode=prime`. The **Reset microphone** control:

1. Requests a normal audio-only `getUserMedia` stream.
2. Holds it for 400 milliseconds.
3. Stops every audio track.
4. Allows the tester to start speech recognition again manually.

The affected iPhone successfully opened and released the standard microphone stream six times. The two subsequent recognition attempts still failed to receive speech. This shows that microphone capture through `getUserMedia` remains available while `webkitSpeechRecognition` is stuck, and that priming the microphone this way does not reset the speech-recognition lifecycle state. The reset technique should not be promoted into the production voice flow as a recovery mechanism.

## Held microphone experiment

The earlier production implementation kept a separate `getUserMedia` stream alive while speech recognition was running and used it to drive the live waveform on iPhone. That behaviour was removed in v0.5.3.1 when iOS speech recognition was given exclusive microphone access. The tester's observation that the iPhone waveform worked before that change creates a separate audio-session hypothesis: an already-active standard microphone stream may have kept the shared iOS audio session alive during recognition.

Diagnostic build `0.5.4+diagnostics.3` added `mode=hold` to reproduce the earlier concurrency without changing the production voice path. Each attempt opened one audio-only stream, left its track live while a fresh recogniser ran, displayed the measured level and released the track after the recogniser ended. This differed materially from the completed reset experiment, which released the stream before recognition started.

The affected iPhone completed all three consecutive held-stream attempts without a reload:

| Attempt | Stream opened | Recognition requested | Speech started | Final result | Recognition ended | Stream released | Outcome |
|---|---:|---:|---:|---:|---:|---:|---|
| 1 | 15.885 | 15.903 | 17.531 | 22.567 | 22.602 | 22.603 | Worked |
| 2 | 26.115 | 26.135 | 28.212 | 33.501 | 33.530 | 33.532 | Worked |
| 3 | 36.692 | 36.709 | 38.782 | 44.067 | 44.096 | 44.097 | Worked |

Each stream opened live, enabled and unmuted. Each fresh recogniser then reached `start`, `audiostart`, `speechstart`, multiple interim results and a final result before ending normally. The stream was released immediately after the corresponding recognition `end` event.

The contrast with `mode=prime` isolates the important condition: merely opening and releasing `getUserMedia` before recognition did not recover the speech service, while overlapping the standard stream with recognition worked repeatedly. This strongly supports the audio-session keep-alive hypothesis on the tested device.

Production build `v0.5.4.4-voice-diagnostics` mirrors the successful held-stream lifecycle in the app UI on iOS. It prepares the real microphone meter before starting a fresh one-shot recogniser, uses the same waveform calculation without meter-based silence stopping, lets WebKit end the attempt after speech, applies the same 30-second safety limit and releases the stream after `end`. If the meter cannot open, recognition retains the meterless fallback rather than becoming unavailable.

## Track pause experiment — pending device validation

Branch and diagnostic build: `v0.5.4.6-track-pause-test`; mode: `track-pause`.

The production revision 122 logs reproduce failure after manual stop followed by dialog closure and stream release. They do not establish that release after Apply or the idle timeout is safe. Earlier statements that the manual-stop problem was fully resolved were too strong.

This experiment disables the existing held track on Stop or Abort, then re-enables that same track for a fresh recognition attempt. Stop requests completion; Abort discards the attempt. The waveform must become still immediately for both actions. Retaining a disabled track does not prove that the browser has released the hardware microphone; observe the iPhone microphone indicator separately. No production voice behaviour changes in this branch experiment.

Device protocol, without reload between attempts:

1. Start and speak, tap Stop while speaking, and record whether the waveform stops and the system microphone indicator changes.
2. Start again within 30 seconds. Confirm track reuse and re-enable in the log, then check that speech results arrive.
3. Tap Abort while speaking, observe the same indicators, then retry. Confirm that the aborted attempt's later results are ignored.
4. Let the next attempt complete naturally, then start another attempt to test release and reopening.
5. Separately test explicit microphone release, page hiding, and expiry of the disabled-track idle timeout before retrying. These release paths remain unverified recovery boundaries.

Pass criteria include successful retries after Stop and Abort, no moving waveform while paused, and acceptable device microphone behaviour. Automated tests only verify the JavaScript lifecycle; they cannot establish WebKit recovery or hardware capture state.

## Privacy

The diagnostics intentionally omit recognised transcript text. The recorded evidence contains browser details, event names, object and attempt numbers, relative timings, microphone track state and user observations only.
