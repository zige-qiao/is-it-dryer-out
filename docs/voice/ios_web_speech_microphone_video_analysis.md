# iOS Web Speech / Microphone Behaviour - Detailed Video Analysis

**Source video:** `IMG_0856.MP4`
**Video duration:** 141.16 seconds (2:21.16)
**Video resolution:** 880 × 1920
**Browsers observed:** Safari and Chrome on iOS
**Test page:** `zige-qiao.github.io`
**Primary focus:** Web Speech recognition lifecycle, iOS microphone privacy indicators, browser switching, and the on-page event log.

> **Important:** Timestamps in this report are approximate to the visible video timeline. Where an event occurs over only a few frames, the time is given to the nearest useful fraction of a second rather than treated as instrument-grade timing.

---

## 1. Executive summary

The video shows a repeatable mismatch between the Web Speech API's event lifecycle and iOS's system-level microphone state.

A successful recognition attempt generally follows this sequence:

```text
recognizer created
→ start requested
→ start
→ audiostart
→ iOS amber microphone dot appears
→ speechstart
→ interim results
→ final result
→ speechend
→ end
→ amber dot disappears
```

A failed immediate restart in the **same browser** often follows a different sequence:

```text
recognizer created
→ start requested
→ start
→ audiostart
→ page says "Listening"
→ NO iOS amber microphone dot
→ NO speechstart
→ NO recognition results
→ manual stop
→ audioend
→ error=aborted
→ end
```

The key finding is therefore:

> **`audiostart` is not a reliable indication that iOS has actually re-acquired the physical microphone in this test.**

The iOS amber privacy dot is the strongest visible system-level signal. In several failed attempts, the page logs `audiostart`, but the amber dot never appears and no speech is detected.

A second strong pattern is that switching between Safari and Chrome often causes the microphone to become usable again very quickly. After several browser switches, a new attempt in the newly foregrounded browser causes the amber dot to appear almost immediately and recognition succeeds.

This suggests that the issue is probably not a simple microphone-permission problem. The behaviour is more consistent with a problem involving one or more of:

- iOS audio-session ownership
- microphone teardown/re-acquisition
- browser foreground/background lifecycle
- WebKit or browser audio capture state
- a race between the Web Speech API state and the underlying iOS audio session
- insufficient delay between one recognition session ending and another starting

The browser-switch behaviour is particularly interesting because foregrounding another browser seems to reset, release, or reinitialise something that a normal `SpeechRecognition.stop()` / `end` lifecycle does not always reset.

---

# 2. iOS indicators visible in the recording

There are several distinct indicators in the video and they should not be treated as equivalent.

## 2.1 Red status indicator around the clock

The red pill/background around the time in the top-left is the **iOS screen-recording indicator**.

It is present because the demonstration itself is being screen-recorded.

This is unrelated to whether the website currently owns the microphone.

---

## 2.2 Amber/orange dot at the top-right

The small amber/orange dot at the top-right is the important system privacy indicator.

On iOS, this is the visible indication that an application is using the microphone.

For this test, the amber dot is more useful than the page's own `audiostart` event because there are multiple occasions where:

```text
audiostart fires
BUT
the amber dot does not appear
```

and the recognition session then receives no speech.

That mismatch is one of the strongest pieces of evidence in the recording.

---

## 2.3 Safari microphone UI

Safari sometimes displays its own microphone-related UI in or around the browser chrome/address area.

This is **browser UI**, not the same thing as the iOS privacy dot.

The system amber dot should be treated as the more authoritative visible indication that iOS itself considers the microphone active.

---

## 2.4 Chrome microphone UI

Chrome shows browser-specific microphone UI as well, including a blue microphone/access banner such as:

> **Microphone access allowed**

Again, this is browser-level UI.

It can coexist with the iOS amber privacy dot, but the two represent different layers:

```text
Website / Web Speech API
        ↓
Browser state / browser permission UI
        ↓
iOS audio / privacy state
```

The video demonstrates that these layers can become out of sync.

---

# 3. High-level behaviour observed

The test alternates between Safari and Chrome while repeatedly creating new speech-recognition objects.

There are three recurring states.

## State A - fully working recognition

Typical sequence:

```text
start
audiostart
amber dot appears
speechstart
result final=false
result final=false
...
result final=true
speechend
end
```

The spoken audio is recognised normally.

---

## State B - false or incomplete "Listening" state

Typical sequence:

```text
start
audiostart
page says Listening
NO amber dot
NO speechstart
NO result
```

The browser/page thinks recognition has entered the audio phase, but the OS does not visibly indicate microphone use.

The attempt eventually has to be manually stopped.

The log then commonly shows:

```text
stop requested reason=manual
audioend
error=aborted
end
```

---

## State C - recovery after browser switching

After switching from Safari to Chrome, or Chrome to Safari, the newly foregrounded browser often recovers microphone access very quickly.

Typical sequence:

```text
switch browser
foreground target browser
start recognition
audiostart
amber dot appears almost immediately
speechstart follows
recognition succeeds
```

This recovery is not absolutely guaranteed, especially earlier in the video, but it becomes a strong repeated pattern in the second half.

---

# 4. Detailed chronological timeline

## 0:00 - Control Centre visible

The recording begins with iOS Control Centre open.

### Visible state

- Screen recording is active.
- No amber microphone dot is visible.
- The red screen-recording indicator is present.

### Interpretation

At this point, the system does not visibly show the browser using the microphone.

---

## ~0:01 - Control Centre closes, Safari is visible

Safari is open on the test page.

The page is labelled along the lines of:

> **New recognizer each time / Audio interruption test**

The test is in a ready state.

### Microphone

- No amber dot.

---

# 5. Safari - first attempt

## ~0:02 - Start is pressed

A new speech-recognition object is created.

The visible log records the initial request.

Approximate sequence:

```text
recognizer created
start requested
```

---

## ~0:02-0:04 - Initial microphone permission prompt

iOS/Safari presents a permission prompt:

> **"zige-qiao.github.io" Would Like to Access the Microphone**

`Allow` is selected.

This is the first-run permission flow.

---

## ~0:04 - microphone activates

The page changes to a microphone-starting/listening state.

### Important system behaviour

The **amber microphone dot appears at roughly 0:04.5**.

Safari also presents its own microphone-related browser UI.

### Log

The visible log shows:

```text
start
audiostart
```

### Interpretation

For this attempt, all layers agree:

```text
Web Speech API says audio started
+
Safari shows microphone UI
+
iOS amber dot appears
```

This is a genuine microphone acquisition.

---

## ~0:05-0:12 - speech is recognised

The page enters:

> **Listening**

and then:

> **Speech received**

### Log behaviour

The log shows:

```text
speechstart
result ... final=false
result ... final=false
...
result ... final=true
```

### Microphone

The amber dot remains visible.

---

## ~0:12-0:13 - recognition completes

The state changes to:

> **Recognition completed**

### Log

The attempt ends with the expected lifecycle:

```text
speechend
end
```

### Microphone

The amber dot remains briefly, then the microphone session appears to release.

This first Safari attempt behaves normally.

---

# 6. Safari - immediate second attempt fails

## ~0:14 - Start is pressed again

A **new recogniser** is created rather than reusing the previous one.

The log indicates a second object/attempt.

### Very important transition

The previous amber dot disappears around this point.

The new attempt logs:

```text
start requested
start
audiostart
```

The page says:

> **Listening**

However:

> **the amber microphone dot does not return.**

---

## ~0:15-0:22 - stuck in Listening

The page remains in a listening state.

But the following events do **not** appear:

```text
speechstart
result
```

### System indicator

- No amber dot.

### Interpretation

This is the first clear example of the Web Speech API lifecycle diverging from the iOS microphone state.

The browser dispatches:

```text
audiostart
```

but the operating system does not visibly show active microphone use.

No speech reaches the recognition pipeline.

---

## ~0:22-0:24 - manually stopped

The user stops the attempt.

The page reports:

> **No speech detected**

The log shows a sequence similar to:

```text
stop requested reason=manual
audioend
error=aborted
end
```

### Key point

The attempt did not fail immediately with a microphone permission error.

Instead, it entered a nominal listening/audio state and then produced nothing.

That makes the failure look less like denied permission and more like a failed capture-session acquisition.

---

# 7. First Safari → Chrome switch

## ~0:25 - app switcher opens

The iOS app switcher is opened.

Safari and Chrome are both visible with the test page open.

Chrome is selected.

### Safari log

Safari records a page lifecycle event similar to:

```text
visibility state=hidden
```

This confirms that the browser switch is being reflected in the page visibility lifecycle.

---

# 8. Chrome - first attempt succeeds

## ~0:26 - Chrome becomes foreground browser

Chrome shows its own instance of the test page.

The Chrome log is independent from Safari's log.

The page is ready.

---

## ~0:27-0:29 - Start and microphone permission

Start is pressed.

Chrome presents a microphone permission request similar to:

> **Allow "zige-qiao.github.io" to use your microphone?**

`Allow` is selected.

---

## ~0:29 - microphone becomes active

The **amber iOS microphone dot appears at approximately 0:29.1**.

The Chrome log records:

```text
start
audiostart
```

Chrome also later shows browser-specific microphone permission UI.

---

## ~0:30 - Chrome permission banner

Chrome displays a blue message:

> **Microphone access allowed**

A browser microphone indicator is also visible.

### Important distinction

The Chrome banner is browser-specific.

The amber dot is the OS privacy signal.

For this successful attempt, both agree that the microphone is active.

---

## ~0:32-0:39 - speech recognition succeeds

The page changes to:

> **Speech received**

The log records:

```text
speechstart
result ... final=false
...
result ... final=true
```

The amber dot remains visible throughout active capture.

---

## ~0:39-0:40 - Chrome attempt completes

The recognition completes.

The log reaches:

```text
speechend
end
```

The amber dot disappears around the end of this process, approximately 0:40.

---

# 9. Chrome - immediate second attempt fails

## ~0:40 - another recogniser is started

A second Chrome recognition attempt starts immediately.

The log again records:

```text
recognizer created
start requested
start
audiostart
```

The page displays:

> **Listening**

### But:

- the amber dot does not return
- no `speechstart` occurs
- no recognition results arrive

This is highly similar to the Safari second-attempt failure.

---

## ~0:41-0:47 - stuck

Chrome remains nominally listening.

No actual speech-recognition progress is visible.

### This creates an important cross-browser pattern

Safari:

```text
first attempt works
immediate next attempt does not acquire real mic
```

Chrome:

```text
first attempt works
immediate next attempt does not acquire real mic
```

That makes the issue less likely to be a one-off Safari UI problem.

---

## ~0:48 - manually stopped

The failed Chrome attempt is stopped.

The log shows the familiar abort sequence:

```text
stop requested reason=manual
audioend
error=aborted
end
```

The page reports:

> **No speech detected**

---

# 10. Chrome → Safari switch

## ~0:49-0:50

The app switcher is opened.

Safari is selected.

Chrome is backgrounded.

### Page lifecycle

The browsers add visibility events as their foreground/background state changes.

---

# 11. Safari - third attempt still fails

## ~0:51

A fresh Safari recognition attempt is started.

The log again reaches:

```text
start requested
start
audiostart
```

The page says:

> **Listening**

### However

- no amber dot appears
- no `speechstart`
- no recognition results

This is important because it shows that:

> **simply switching browsers is not a guaranteed immediate fix in every instance.**

The later part of the recording shows a much stronger recovery-after-switch pattern, but this early switch does not immediately restore Safari.

---

## ~0:52-0:59

Safari remains stuck in the listening state.

The attempt is eventually manually stopped.

The log again ends with:

```text
stop requested reason=manual
audioend
error=aborted
end
```

---

# 12. ~1:01-1:03 - Control Centre check

Control Centre is opened.

### Important observation

There is **no amber microphone dot** visible.

This gives additional evidence that the failed Safari attempt was not actually holding an iOS microphone session, despite having emitted `audiostart`.

This is one of the stronger corroborating observations in the video.

---

# 13. ~1:04-1:06 - another browser switch

The app switcher is used again.

The test moves back towards Chrome.

More `visibility state=...` entries are added to the logs.

---

# 14. Chrome - later attempt / transition period

## ~1:09

Another Chrome recognition attempt begins.

The page reaches a listening state and the log shows:

```text
start
audiostart
```

The microphone state during this section is less cleanly separated than the earlier attempts because the user subsequently moves between apps.

---

## ~1:17

Chrome shows a microphone-access message.

The app switcher is opened soon afterwards.

### Important lifecycle behaviour

Chrome's attempt is later stopped as a consequence of the page becoming hidden.

The log records behaviour resembling:

```text
stop requested reason=page hidden
audioend
error=aborted
end
```

### Why this matters

The test code appears to react explicitly to page visibility changes.

Switching browsers therefore does not merely wait for time to pass - it can also trigger real lifecycle code and browser-level audio-session changes.

This makes app switching a meaningful state transition rather than just a passive delay.

---

# 15. Safari - strong recovery after switch

## ~1:19-1:21

Safari is foregrounded again.

A fresh recognition attempt begins.

### Critical observation

The amber microphone dot appears at approximately **1:21.5**, very shortly after the new Safari attempt starts.

The log shows:

```text
start
audiostart
```

and this time the system microphone genuinely activates.

---

## ~1:24 onward

Safari changes to:

> **Speech received**

The log records:

```text
speechstart
result ... final=false
...
```

Recognition is working again.

---

## ~1:29-1:30

The attempt completes successfully.

The log reaches:

```text
result ... final=true
speechend
end
```

### Interpretation

This is one of the clearest recovery examples:

```text
other browser was active
→ switch to Safari
→ create recogniser
→ actual microphone comes back quickly
→ speech works
```

---

# 16. Safari → Chrome - another rapid recovery

## ~1:35

The app switcher is opened.

Chrome is brought to the foreground.

---

## ~1:38

A new Chrome recognition attempt starts.

The amber dot is visible / active in association with the working microphone state.

The log records:

```text
start
audiostart
```

---

## ~1:41-1:45

Chrome reaches:

> **Speech received**

The log shows multiple interim recognition results:

```text
speechstart
result ... final=false
result ... final=false
...
```

Chrome's microphone banner also appears.

---

## ~1:46-1:47

The Chrome attempt completes successfully.

The log reaches:

```text
result ... final=true
speechend
end
```

This is another example where switching to the other browser is followed by a successful real microphone session.

---

# 17. ~1:48-1:50 - iOS privacy inspection

Control Centre is pulled down while microphone activity is still relevant.

The amber dot remains visible.

An orange Chrome-related privacy control is visible.

The privacy panel is then opened.

### Particularly important evidence

iOS explicitly identifies recent/current microphone usage.

The panel shows entries along the lines of:

- **Safari - Microphone, recently**
- **Chrome / zige-qiao.github.io - Microphone**

Under the audio/video section it indicates:

> **zige-qiao.github.io in Chrome**

and the microphone mode is shown as:

> **Standard**

### Why this matters

This is direct system-level evidence that iOS itself associates Chrome/the website with a real microphone session during a successful attempt.

It also provides a useful contrast with the failed `audiostart` attempts, where the amber dot never appeared.

---

# 18. Chrome → Safari - successful recovery again

## ~1:52-1:54

The app switcher is opened.

Safari is selected.

Visibility events are added to the browser logs.

---

## ~1:55

Safari begins another fresh recognition attempt.

There is a brief interruption/change in the amber indicator around this transition, after which the microphone becomes active again.

---

## ~1:56-2:01

Safari progresses normally:

```text
Listening
→ Speech received
```

The log includes:

```text
speechstart
result ... final=false
...
```

The amber dot remains visible during active microphone use.

---

## ~2:02

The recognition completes successfully.

The final lifecycle includes:

```text
result ... final=true
speechend
end
```

The amber dot disappears shortly afterwards, around 2:02.

---

# 19. Safari - immediate retry fails again

## ~2:02-2:06

Another Safari attempt is started soon after the successful one.

The page again reaches a nominal recognition state.

The log reports the early lifecycle, including `audiostart`.

### But again

- the amber dot does not appear
- no real speech is recognised
- the attempt ends as a no-speech/failed attempt

This reinforces the repeated same-browser pattern:

```text
successful recognition
→ clean end
→ immediate new recogniser
→ page thinks audio started
→ OS microphone does not actually reactivate
```

---

# 20. Safari → Chrome - very fast microphone recovery

## ~2:07

The app switcher is opened.

Chrome is selected.

---

## ~2:08

Chrome starts a new recognition attempt.

### Strong timing observation

The amber microphone dot appears at approximately **2:08.6**, less than a second after the new attempt begins.

This is one of the clearest examples of the "switch browser, microphone comes back quickly" behaviour.

---

## ~2:11-2:14

Chrome reaches:

> **Speech received**

The log records:

```text
speechstart
result ... final=false
...
```

The amber dot remains visible.

---

## ~2:15

Recognition completes normally.

The log reaches:

```text
result ... final=true
speechend
end
```

The amber dot disappears at around **2:15.1**.

---

# 21. Chrome - immediate sixth attempt fails

## ~2:16

Chrome immediately starts another recognition attempt.

The log reports:

```text
start
audiostart
```

The page says:

> **Listening**

### But

- the amber dot does not return
- there is no `speechstart`
- there are no recognition results

This is arguably the clearest single demonstration of the bug because it happens immediately after a fully successful Chrome attempt.

---

## ~2:16-2:20

The page remains stuck in Listening.

There is no evidence of actual microphone acquisition.

---

## ~2:20-2:21

The attempt is manually stopped.

The final visible log includes approximately:

```text
152.110s [attempt 6] stop requested reason=manual
152.115s audioend
152.146s error ... error=aborted
152.146s end
```

The page ends in:

> **No speech detected**

---

# 22. Attempt-level pattern summary

The exact attempt numbering is browser-local in the page log, but the overall visible behaviour can be summarised as follows.

## Safari

| Approx. attempt | Result | Amber dot | `audiostart` | `speechstart` / results | Notes |
|---|---|---:|---:|---:|---|
| First | Success | Yes | Yes | Yes | Initial permission flow |
| Immediate next | Fail | No | Yes | No | Classic false-listening state |
| After early switch back | Fail | No | Yes | No | Shows switching is not always sufficient |
| Later after browser lifecycle changes | Success | Yes | Yes | Yes | Fast recovery |
| Later post-switch | Success | Yes | Yes | Yes | Repeated recovery pattern |
| Immediate retry after success | Fail | No | Yes | No | Same-browser failure returns |

## Chrome

| Approx. attempt | Result | Amber dot | `audiostart` | `speechstart` / results | Notes |
|---|---|---:|---:|---:|---|
| First | Success | Yes | Yes | Yes | Initial permission flow |
| Immediate next | Fail | No | Yes | No | Mirrors Safari |
| Mid-video attempt | Interrupted/backgrounded | Mixed | Yes | Incomplete | Page-hidden lifecycle involved |
| Post-switch attempt | Success | Yes | Yes | Yes | Recovery |
| Later post-switch attempt | Success | Yes | Yes | Yes | Very fast mic reacquisition |
| Immediate next | Fail | No | Yes | No | Strong final reproduction |

---

# 23. Strongest findings

## Finding 1 - `audiostart` does not prove the iOS microphone is actually active

This is the most significant finding.

There are several failed attempts where the log reports:

```text
start
audiostart
```

and the page says:

> Listening

but:

- the iOS amber privacy dot is absent
- `speechstart` never fires
- no interim results arrive
- no final result arrives

This suggests the Web Speech event model has advanced further than the underlying iOS audio capture state.

---

## Finding 2 - the amber dot correlates strongly with actual successful recognition

Whenever the microphone clearly works, the amber dot is present.

Successful pattern:

```text
amber dot appears
→ speechstart
→ results
```

Failed pattern:

```text
no amber dot
→ no speechstart
→ no results
```

Within this video, the amber dot is therefore a much better visible proxy for genuine capture than `audiostart`.

---

## Finding 3 - immediate same-browser retries are unusually failure-prone

Both Safari and Chrome show essentially the same behaviour:

```text
successful recognition
→ end
→ immediately create/start another recogniser
→ audiostart fires
→ actual mic does not reacquire
```

This cross-browser repetition is important.

It suggests the issue may exist below the browser-specific UI layer.

---

## Finding 4 - switching between Safari and Chrome often restores the mic very quickly

In the later half of the recording, this becomes very noticeable.

Examples include approximately:

- Chrome → Safari around **1:19-1:21**
- Safari → Chrome around **1:35-1:38**
- Chrome → Safari around **1:52-1:56**
- Safari → Chrome around **2:07-2:09**

In several of these cases, the microphone becomes active almost immediately after starting recognition in the newly foregrounded browser.

The ~2:08 Chrome recovery is especially clear because the amber dot appears in under roughly one second.

---

## Finding 5 - browser switching is not a guaranteed fix

The earlier Chrome → Safari switch at approximately **0:50-0:51** does not immediately restore microphone operation in Safari.

Therefore the rule is not simply:

```text
switch browser = always fixed
```

A more accurate description is:

> Browser foreground/background transitions appear to make successful re-acquisition substantially more likely, especially once the previous capture state has had time or lifecycle events to release.

---

## Finding 6 - foreground/background lifecycle may be part of the recovery mechanism

When switching browsers, the page logs visibility changes.

At least one recognition attempt is explicitly terminated with a reason related to the page becoming hidden:

```text
stop requested reason=page hidden
```

This matters because switching browsers introduces more than a time delay.

It may trigger:

- page visibility changes
- browser suspension/resumption
- audio-session interruption
- capture release
- WebKit media-session state changes
- iOS process/audio routing changes

Any one of these could be involved in the recovery.

---

# 24. Unusual patterns

## 24.1 Successful end appears capable of "poisoning" the next attempt

One of the strangest behaviours is that an attempt can complete perfectly:

```text
speechstart
results
final result
speechend
end
```

and yet the **very next new recogniser** in the same browser can fail to obtain real microphone input.

Normally, one might expect a clean `end` to leave the browser ready for the next capture.

That is not consistently happening here.

---

## 24.2 No immediate microphone error is thrown

The failed attempts do not simply report something like:

```text
not-allowed
audio-capture
permission-denied
```

Instead they reach:

```text
audiostart
```

and remain nominally listening.

This makes the failure more unusual because the Web Speech layer appears unaware that useful microphone input is absent.

---

## 24.3 `audioend` can appear after a session that seemingly never had real OS microphone ownership

On failed attempts, stopping the recogniser still generates:

```text
audioend
```

even though the amber dot never appeared.

This suggests `audiostart` / `audioend` are tracking the Web Speech recogniser's logical audio phase, not necessarily the physical iOS microphone session.

---

## 24.4 App switching may be forcing a deeper reset than stopping recognition

Calling stop/end inside one browser is often insufficient.

Moving the browser into the background and foregrounding another browser appears more effective.

That points towards a state that exists outside the lifetime of the individual JavaScript `SpeechRecognition` object.

---

## 24.5 The issue affects both Safari and Chrome

This is significant on iOS because both browsers ultimately rely heavily on Apple's browser/audio platform stack.

The fact that similar symptoms occur in both browsers weakens explanations that depend purely on Chrome's page UI or purely on Safari's page UI.

---

# 25. Likely technical interpretation

The recording is most consistent with some kind of microphone/audio-session teardown or re-acquisition problem.

A plausible conceptual model is:

```text
Web Speech recogniser A
        ↓
gets real microphone
        ↓
recognition succeeds
        ↓
recogniser A ends
        ↓
Web Speech API reports clean end
        ↓
underlying iOS/browser audio session is not yet fully reusable
        ↓
recogniser B is created immediately
        ↓
Web Speech state machine advances
        ↓
"audiostart" fires
        ↓
but physical microphone is not successfully reacquired
        ↓
no amber dot
        ↓
no speechstart
        ↓
no results
```

Then:

```text
browser is backgrounded
        ↓
visibility / interruption / audio lifecycle executes
        ↓
audio ownership is released or reset more fully
        ↓
other browser is foregrounded
        ↓
new recogniser starts
        ↓
iOS grants actual microphone capture
        ↓
amber dot appears
        ↓
speech recognition succeeds
```

---

# 26. Leading hypotheses

These are hypotheses supported by the visible behaviour, not proven root causes.

## Hypothesis A - microphone teardown race

The previous recognition finishes, but the underlying iOS audio capture session has not finished releasing when the next recogniser starts.

An immediate restart lands in a bad transitional state.

### Why it fits

- immediate same-browser retry often fails
- switching browsers naturally adds time
- later attempts after lifecycle transitions often succeed
- the API can say `audiostart` before the OS microphone is truly active

---

## Hypothesis B - stale Web Speech / WebKit audio-session state

The speech recogniser may mark itself as having entered the audio phase while the underlying AVAudioSession or capture object remains stale or unavailable.

### Why it fits

The exact mismatch:

```text
audiostart = yes
amber dot = no
speech = no
```

suggests state disagreement between layers.

---

## Hypothesis C - foreground/background transition resets audio ownership

Putting a browser into the background may trigger a deeper release of capture resources.

Foregrounding the other browser then starts with a cleaner audio state.

### Why it fits

The second half contains multiple successful recoveries immediately following browser switches.

---

## Hypothesis D - elapsed time is partially responsible

The apparent benefit from browser switching may partly be the delay introduced by:

- opening app switcher
- waiting for animations
- foregrounding another app
- pressing Start

The actual fix could be "wait long enough after end", rather than "switch browser".

### Why this remains possible

The early switch back to Safari does not immediately fix the issue.

This suggests timing and lifecycle may both matter.

---

## Hypothesis E - both timing and lifecycle are required

This may be the best combined explanation.

For example:

```text
recognition end
+
minimum release delay
+
foreground/background audio-session transition
=
reliable reacquisition
```

The video does not isolate these variables, so a controlled test is required.

---

# 27. What the recording does NOT suggest

## Not simply a microphone permission denial

Permissions are explicitly granted.

Successful sessions occur repeatedly afterwards.

---

## Not simply a broken microphone

The physical microphone clearly works repeatedly.

---

## Not simply a speech-content problem

On the failed attempts there is no `speechstart` at all.

The failure occurs before speech recognition meaningfully begins.

---

## Not a single-browser-only problem

Both Safari and Chrome exhibit the same basic immediate-retry failure.

---

## Not merely the page failing to render an indicator

The iOS system amber dot itself changes, and Control Centre confirms real microphone use during successful periods.

---

# 28. Recommended controlled experiments

The next tests should try to separate **time delay** from **browser lifecycle reset**.

## Test 1 - delayed restart in the same browser

After a successful `end`, retry at fixed delays:

```text
0 ms
100 ms
250 ms
500 ms
750 ms
1 s
1.5 s
2 s
3 s
5 s
10 s
```

Record for each attempt:

- recogniser creation timestamp
- `start()` timestamp
- `start`
- `audiostart`
- visually observed amber-dot onset
- `speechstart`
- first result
- final result
- `speechend`
- `audioend`
- `end`
- error, if any

### Purpose

Determine whether the problem disappears above a particular cooldown threshold.

---

## Test 2 - switch browser immediately versus wait

Compare:

### Condition A

```text
Safari success
→ immediately start Safari again
```

### Condition B

```text
Safari success
→ wait 2 seconds
→ start Safari again
```

### Condition C

```text
Safari success
→ switch to Chrome
→ immediately start Chrome
```

### Condition D

```text
Safari success
→ switch to Chrome
→ wait 2 seconds
→ start Chrome
```

Repeat enough times to get a meaningful success rate.

---

## Test 3 - background and return to the SAME browser

This is particularly important.

Instead of switching to another browser:

```text
Safari success
→ open app switcher
→ return to Safari
→ start again
```

If that fixes the problem, the important mechanism is probably the background/foreground lifecycle rather than inter-browser ownership.

---

## Test 4 - lock/unlock screen between attempts

Try:

```text
successful recognition
→ lock
→ unlock
→ same browser
→ start recognition
```

If this consistently resets the microphone, it further implicates iOS audio-session lifecycle.

---

## Test 5 - explicitly delay after `audioend` versus after `end`

Measure separate cooldowns based on:

```text
audioend + delay
```

and:

```text
end + delay
```

This may reveal which Web Speech event most closely corresponds to the useful release point.

---

## Test 6 - log `visibilitychange`

Log exact high-resolution timestamps for:

```javascript
document.visibilityState
visibilitychange
pagehide
pageshow
freeze
resume
focus
blur
```

where supported.

Then correlate these with mic recovery.

---

## Test 7 - log all SpeechRecognition events

Capture every available event:

```text
start
audiostart
soundstart
speechstart
result
speechend
soundend
audioend
nomatch
error
end
```

The distinction between `soundstart` and `speechstart` may be particularly useful.

---

## Test 8 - capture `performance.now()` deltas

All log entries should use monotonic high-resolution time.

For example:

```text
T+0.000 start() called
T+0.014 start
T+0.035 audiostart
T+0.421 iOS amber dot visually appears
T+1.312 soundstart
T+1.438 speechstart
```

The amber dot still has to be observed visually, but everything else can be timestamped programmatically.

---

# 29. Suggested pass/fail definition

For future tests, do not classify an attempt as successful merely because `audiostart` fires.

A better definition would be:

## Capture acquired

At least one of:

```text
iOS amber dot appears
soundstart occurs
speechstart occurs
recognition result arrives
```

## Fully successful

```text
amber dot
+
speechstart
+
at least one result
```

## Suspected false-audiostart failure

```text
audiostart
+
no amber dot
+
no soundstart/speechstart
+
no results
```

---

# 30. Suggested machine-readable attempt log

For debugging, each recogniser attempt could produce data such as:

```json
{
  "browser": "Safari",
  "attempt": 7,
  "recognizerCreated": 12345.100,
  "startRequested": 12345.150,
  "startEvent": 12345.170,
  "audioStart": 12345.190,
  "amberDotObserved": false,
  "soundStart": null,
  "speechStart": null,
  "firstResult": null,
  "finalResult": null,
  "audioEnd": 12352.400,
  "error": "aborted",
  "end": 12352.430,
  "visibilityAtStart": "visible",
  "previousAttemptEndedAgoMs": 210
}
```

Then compare success against:

```text
previousAttemptEndedAgoMs
browser foreground duration
visibility transitions
previous browser
previous attempt outcome
```

---

# 31. Most useful comparison from the recording

The strongest direct A/B-like comparison occurs near the end.

## Chrome successful attempt

Around **2:08-2:15**:

```text
switch to Chrome
→ start
→ amber dot appears ~2:08.6
→ speechstart
→ interim results
→ final result
→ speechend
→ end
→ amber dot disappears ~2:15.1
```

## Chrome immediate retry

Around **2:16-2:21**:

```text
same Chrome tab/browser
→ new recogniser
→ start
→ audiostart
→ page says Listening
→ NO amber dot
→ NO speechstart
→ NO results
→ manual stop
→ audioend
→ error=aborted
→ end
```

This pair is particularly valuable because:

- it is the same browser
- it happens within seconds
- one attempt demonstrably owns the microphone
- the following attempt claims `audiostart`
- the following attempt demonstrably does not show OS microphone ownership

This is probably the cleanest visual reproduction of the underlying problem in the entire video.

---

# 32. Why the browser-switch recovery matters

The browser-switch result changes the likely diagnosis.

If the microphone simply required a long arbitrary timeout every time, switching browsers should not systematically help.

If the problem were pure site permission, switching browsers would not produce this specific success/failure sequence either.

Instead, the data suggests a resource/lifecycle problem.

A useful mental model is:

```text
SpeechRecognition object lifecycle
≠
browser audio-capture lifecycle
≠
iOS microphone / AVAudioSession lifecycle
```

The test shows these layers can temporarily disagree.

---

# 33. Potential bug statement

A concise technical bug description based on this video would be:

> On iOS, after a successful Web Speech `SpeechRecognition` session ends, immediately creating and starting a new recogniser in the same browser can dispatch `start` and `audiostart` and leave the page in a Listening state without actually reacquiring the system microphone. During the failed state the iOS amber microphone privacy indicator is absent, `speechstart` does not fire, and no recognition results are produced. Backgrounding/switching browsers often allows the next recognition session to reacquire the microphone almost immediately.

---

# 34. Short reproduction sequence

A minimal reproduction based on the strongest behaviour in the video:

1. Open the test page in Safari or Chrome on iOS.
2. Grant microphone permission.
3. Create a new `SpeechRecognition`.
4. Start recognition.
5. Speak.
6. Confirm:
   - amber dot appears
   - `speechstart` fires
   - recognition results arrive
7. Allow recognition to complete and emit `end`.
8. Immediately create a second new `SpeechRecognition`.
9. Start it.
10. Observe that it may emit:
    - `start`
    - `audiostart`
11. Observe:
    - no amber dot
    - no `speechstart`
    - no recognition results
12. Stop the attempt.
13. Switch to the other browser.
14. Start recognition there.
15. Observe that the amber dot often reappears very quickly and recognition works again.

---

# 35. Evidence hierarchy from this recording

When judging whether the microphone really started, the signals in this video should be weighted roughly as follows.

## Strongest evidence

1. **iOS amber privacy dot**
2. `speechstart`
3. actual recognition results

## Intermediate evidence

4. `soundstart`, if logged
5. browser microphone UI / permission banners

## Weakest evidence

6. `audiostart`
7. page text saying **Listening**

The surprising part of this recording is that the bottom two can occur without the top three.

---

# 36. Final conclusions

The recording demonstrates a reproducible iOS speech-recognition failure mode in which the browser's Web Speech API appears to enter the audio/listening phase without actually obtaining an active system microphone session.

The strongest evidence is the repeated combination:

```text
audiostart
+
Listening
+
NO amber dot
+
NO speechstart
+
NO results
```

The problem occurs in both Safari and Chrome.

Immediate retries in the same browser are particularly prone to this failed state.

By contrast, changing browser foreground state - especially switching between Safari and Chrome - often allows the microphone to reactivate much more quickly. In the later part of the video this recovery happens repeatedly and, in at least one case, the amber dot returns in well under a second after the new attempt starts.

The behaviour therefore points more strongly towards an iOS/browser audio-session teardown or ownership problem than towards ordinary microphone permission failure or speech-recognition failure.

The main unresolved question is whether browser switching is itself the key recovery mechanism, or whether it merely introduces enough delay and lifecycle activity for the previous iOS audio session to be fully released.

The next most useful experiment is therefore a controlled comparison of:

```text
same-browser immediate retry
same-browser delayed retry
background/foreground same browser
switch browser immediately
switch browser after controlled delay
```

with the amber privacy dot treated as an independent system-level signal rather than relying on `audiostart` alone.

---

# 37. Condensed diagnostic signature

If this needs to be recognised quickly in future recordings or logs, the characteristic signature is:

```text
WORKING:
start
→ audiostart
→ 🟠 iOS mic indicator
→ speechstart
→ result
→ end

BROKEN:
start
→ audiostart
→ no 🟠
→ no speechstart
→ no result
→ manual abort

RECOVERY OFTEN OBSERVED:
background/switch browser
→ foreground browser
→ start
→ 🟠 appears quickly
→ speech works
```

That is the central finding from the video.
