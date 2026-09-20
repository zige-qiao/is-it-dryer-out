# iOS voice recognition investigation

This document records the investigation into repeated voice-input failures in iOS Safari. It is an evidence log, not a claim that the underlying WebKit defect has been fixed.

## Summary

On the tested iPhone, one `webkitSpeechRecognition` session succeeds and immediate later sessions fail to receive microphone audio. Failed sessions still emit `start` and `audiostart`, but do not emit `speechstart` or `result`. The physical iOS microphone indicator does not activate during these failed sessions.

On the tested iPhone, the failure occurred whether the page reused one recogniser or created a new recogniser for every attempt. A full page reload restores recognition immediately. Without a reload, recognition has repeatedly recovered after approximately one minute, after which one session succeeds and the next immediate attempt fails again.

Voice Memos continues to activate the physical microphone and record normally while Safari recognition is in the failed state. This rules out a faulty device microphone and points to WebKit's internal speech-recognition audio session.

## Tested environments

### iPhone

- Platform: iPhone
- Operating system reported by the user agent: iOS 18.7
- Browser: Safari 27.0
- WebKit user-agent version: 605.1.15
- Touch points: 5
- Secure context: yes
- Speech recognition available: yes
- Diagnostic build: `0.5.4+diagnostics.1`

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

## Diagnostic pages

- `?voice-debug=1` enables the real app's privacy-safe voice lifecycle log.
- `voice-test.html?mode=reuse` repeats recordings with one recogniser object.
- `voice-test.html?mode=fresh` creates a new recogniser object for every attempt.
- `voice-test.html?mode=interrupt` records page visibility and manually marked audio interruptions.
- `voice-test.html?mode=prime` briefly opens and releases a standard `getUserMedia` microphone stream before another recognition attempt. This experimental mode is included in diagnostic build `0.5.4+diagnostics.2` but has not yet been tested on the affected iPhone.

The diagnostic logs record lifecycle events and timings but never recognised speech content.

## Results

All timestamps are elapsed seconds since the relevant page loaded or its diagnostics were cleared. `Worked` means that `speechstart` and at least one `result` event were received. `Failed` means that Safari emitted `start` and `audiostart`, but no speech or result events arrived before the attempt was manually stopped.

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

### iPhone real app

The real app gives speech recognition exclusive microphone access on iOS and deliberately skips its separate audio meter stream.

| Session | Requested | Speech/result received | End | Outcome |
|---|---:|---:|---:|---|
| 1 | 3.906 | 8.532 | 11.911 | Worked; final result received |
| 2 | 13.305 | Never | 24.474 | Failed; manual stop produced intentional `aborted` event |
| 3 | 25.242 | Never | 31.141 | Failed; manual stop produced intentional `aborted` event |

The app's stale-session protection and cleanup completed normally. Sessions 2 and 3 reached `audiostart`, but Safari never delivered speech.

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

### Page reload control

Three separate first attempts, each preceded by a page reload, all worked. A full document reload therefore resets the failed state immediately on the tested device.

### Device microphone control

Voice Memos successfully recorded audio and activated the iOS microphone indicator while Safari recognition was otherwise failing. The phone's microphone hardware and system-level microphone permission were therefore working.

## Findings

The evidence supports these conclusions:

1. The failure is specific to iOS Safari on the tested device; it was not reproduced on macOS Safari.
2. The production app is not required to reproduce it. The minimal comparison page fails with the audio meter disabled and no transcript handling.
3. Changing whether recogniser objects were reused did not prevent the failure on the tested iPhone.
4. Safari's `audiostart` event is not reliable evidence that the physical iPhone microphone has activated.
5. Manual `stop()` releases the visible microphone indicator but does not reset the underlying speech service.
6. The failed state can recover after approximately one minute without a reload, although longer and shorter recovery periods have also been observed.
7. A full page reload reliably restores the next recognition attempt.
8. The physical microphone remains healthy and available to other iOS applications.

The most likely cause is a WebKit speech-recognition audio-session lifecycle defect below the JavaScript API. This is an inference from the recorded behaviour, not direct access to WebKit's internal state.

## Related WebKit reports

- [WebKit bug 317741: Speech recognition microphone source should make sure to keep its audio session active while capturing](https://bugs.webkit.org/show_bug.cgi?id=317741) was resolved as fixed in WebKit upstream in June 2026.
- [WebKit bug 321436: SpeechRecognition stops producing results after audio/video playback on iOS Safari](https://bugs.webkit.org/show_bug.cgi?id=321436) remains open. Its visible failure mode closely matches this investigation: recognition appears to start but produces no result, and plain Safari may not activate the system microphone indicator.
- [WICG Speech API issue 96](https://github.com/WICG/speech-api/issues/96) contains related discussion about iOS audio-session interruption and restarting recognition.

The app's minimal reproduction does not require audio or video playback, so its evidence may represent a broader trigger than WebKit bug 321436 currently describes.

## Pending microphone reset experiment

The local diagnostics page now includes `mode=prime`. The **Reset microphone** control:

1. Requests a normal audio-only `getUserMedia` stream.
2. Holds it for 400 milliseconds.
3. Stops every audio track.
4. Allows the tester to start speech recognition again manually.

This tests whether a standard microphone stream can force WebKit to rebuild or re-prime its audio session without a page reload. It is an experiment, not a production fix. The result should be interpreted as follows:

- If the physical microphone activates and the next recognition attempt works immediately, the app may be able to recover WebKit's audio session programmatically.
- If the stream activates but recognition still fails, `getUserMedia` and `webkitSpeechRecognition` are using independently stuck lifecycle state.
- If the stream itself cannot activate, the failure affects WebKit microphone capture more broadly than speech recognition.

## Privacy

The diagnostics intentionally omit recognised transcript text. The recorded evidence contains browser details, event names, object and attempt numbers, relative timings, microphone track state and user observations only.
