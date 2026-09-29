# Voice recovery research — 22 September 2026

> Historical research, preserved 27 September 2026. The proposals and acceptance criteria below reflect 22 September, not the current implementation plan. The later foreground microphone retention policy was accepted, the cleanup-completion experiment was run, and single-box Listening / Hearing was implemented. See the [current investigation](VOICE-INVESTIGATION.md) for the latest device evidence. External issue statuses below were checked on the original research date only.

## Outcome

Updated after all three `.9` stop-enabled runs. Capture remained responsive after manual Stop in the clearest controls, but release/reopen failed 3/3. In run C the user intentionally paused then resumed speech: repeated tiny levels were silence, not evidence of stuck capture. Full chronology and timing are in [VOICE-INVESTIGATION.md](VOICE-INVESTIGATION.md). Microphone-only release/reopen succeeded twice with the amber dot clearing each time. Do not repeat the retracted “Stop necessarily kills the retained stream” inference.

No verified browser recovery currently satisfies all requirements: immediate Stop/Abort, microphone indicator clearing, and successful immediate retry without reloading or switching apps. The following are ranked diagnostic experiments, not production fixes.

The device logs establish repeated failure after both Stop and Abort followed by full stream release. Retaining an enabled or disabled track allowed retries, but the persistent microphone indicator failed the user's expectation. A final result following Stop did not make subsequent release safe. A roughly ten-second post-release gap also failed in one run.

## Verified upstream evidence

- [WebKit bug 317741](https://bugs.webkit.org/show_bug.cgi?id=317741) landed as 315887@main on 26 June 2026. The [patch](https://github.com/WebKit/WebKit/commit/2f88bc0b118178fdb588f9143366246f09e21eb8) describes missing audio-session activation for speech recognition compared with getUserMedia. This supports the keep-alive hypothesis, but does not identify our manual-stop reproduction as the same defect.
- [WebKit bug 317747](https://bugs.webkit.org/show_bug.cgi?id=317747) landed as 316394@main on 2 July 2026 and addresses microphone capture whose WebProcess audio session does not stay active.
- [Technology Preview 248](https://webkit.org/blog/18162/release-notes-for-safari-technology-preview-248/) lists the range 315567–316817, encompassing both commits. That macOS preview evidence does not establish inclusion in any particular iPhone build.
- The [Safari 27.0 release article](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/) does not explicitly name these speech/audio-session fixes. Their absence from the article does not establish that they are absent from the release. Installed-device inclusion remains unverified.
- [Bug 321436](https://bugs.webkit.org/show_bug.cgi?id=321436) remains NEW at this check. It concerns recognition failing after media playback. Its trigger differs from our reproduction, which needs no playback; reported timing/priming workarounds are not proof of recovery for our case.
- [Mozilla's iOS tracking issue](https://github.com/mozilla-mobile/firefox-ios/issues/29263) documents freezing the user-agent OS component at 18_7. Our parsed `osVersion=18.7` must be treated as a user-agent token, not verified installed iOS. Record the actual version and build from Settings before reasoning about shipped fixes.

## Ranked test plan

### 0. Baseline established; remaining limits

Accept the user's confirmed **iOS 27.0**; exact OS build is unavailable and must not be inferred from the UA. Do not ask the user repeatedly for it. Baselines now include successful microphone-only release/reopen, a natural completion/reopen success, and three stop-enabled/release failures. Keep Abort separate: the new `.9` evidence is manual Stop, not a newly verified Abort control.

### 1. AudioSession configuration, if exposed

The [Audio Session specification](https://www.w3.org/TR/audio-session/) exposes a writable `type`, read-only `state`, and state-change events. It offers no explicit reset or deactivate method. Feature-detect `navigator.audioSession` and record its state/type transitions first.

Selected next candidate, NOT implemented: compare default `auto` with explicit `play-and-record` before user-requested capture, restoring the original type only after full cleanup. Preserve the `.9` staged Stop→end→explicit Release sequence in both arms so immediate-release timing is not another variable. Release must stop every track immediately, await/log AudioContext.close settlement, and prevent reopening while cleanup is pending. Add that same cleanup instrumentation to both arms; if the baseline then recovers, investigate cleanup settlement separately instead of attributing success to AudioSession configuration. Log feature availability, type/state transitions, context state/currentTime and close completion. Unsupported API or rejected assignment must be reported, not silently treated as a successful intervention.

Important limitation from the specification: `auto` already derives `play-and-record` for an active microphone. Explicit assignment may therefore change nothing. This is a bounded category-lifecycle hypothesis, not a reset API or guaranteed fix. Do not toggle to playback while live tracks exist: the draft's microphone integration can end tracks when type is neither auto nor play-and-record. No playback, silent oscillator, hidden retained capture or app-switch/reload recovery is allowed. First test one matched baseline/intervention pair; stop on failure and retain evidence. Repeated Stop and Abort acceptance runs come only after a promising initial result. No production rollout without separate approval and validation.

### 2. Disposable same-origin recognition document

Only after the first experiment fails, test recognition and its microphone inside a same-origin iframe with a visible user-operated Start control. On Stop/Abort, release every track and destroy that document; create a new document on the next Start. Preserve the top-level app and its state. This is document replacement, not a full app reload, and remains an experimental architectural change.

Confidence is low: [current WebKit SpeechRecognition source](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/speech/SpeechRecognition.cpp) registers through the page's recognition connection and checks frame validity/microphone permission. Recreating a frame may clear document resources without resetting the shared backend. Reject this route if first-start permission/activation fails or the microphone persists after destruction. Do not evade permission restrictions.

### 3. Upstream report prepared now

See [WEBKIT-VOICE-BUG-DRAFT.md](WEBKIT-VOICE-BUG-DRAFT.md): concise manual Stop reproduction, positive controls, exact source revision and limitations. Prepared locally, not submitted. The existing diagnostic is a reproducible test page, not yet a separately reduced single-file testcase. There is no evidence-backed browser workaround meeting all requirements, rather than proof that none can exist.

## Source recheck after .9 results

On 22 September 2026, bugs [317741](https://bugs.webkit.org/show_bug.cgi?id=317741) and [317747](https://bugs.webkit.org/show_bug.cgi?id=317747) remain RESOLVED FIXED with the commits noted above; neither report establishes our manual Stop→release→silent getUserMedia reproduction as fixed. [321436](https://bugs.webkit.org/show_bug.cgi?id=321436) remains NEW and requires media playback in its reproduction, unlike ours. The [Audio Session working draft](https://www.w3.org/TR/audio-session/) documents category selection and state observation, not an explicit reset method. Searches did not establish an exact upstream match or a verified recovery for this device. Do not infer shipped iPhone fix coverage from WebKit main commits.

## Acceptance and stopping criteria

For each candidate, complete at least five Stop/retry pairs and five Abort/retry pairs, plus natural completion, dialog-close, Apply-equivalent teardown and background cleanup checks. Retry in 1–3 seconds, without reload or app switch as recovery. Require speech results, correct review values, stationary waveform after Stop/Abort, and the current microphone indicator clearing; retain observer timing rather than inferring hardware state from JavaScript alone. Abort must discard late results. A single success is preliminary evidence, not resolution. Save failure logs immediately rather than adding automatic restart loops.

No production recognition or deployment changes were made for this research. The separate single-box Listening → Hearing proposal is straightforward in the current app: interim results currently update voiceTranscript while voiceStatus still displays Listening. It should be implemented and verified separately from recovery experiments.
