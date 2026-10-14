# iOS voice recognition investigation

**Audience:** Voice maintainers and readers checking microphone evidence

**Status:** OPEN — accepted limited mitigation; background-release recovery unresolved

**Reviewed:** 14 October 2026. No new iPhone evidence was collected for this documentation reorganisation.

[Documentation index](../index.md) · [Current voice implementation and policy](../development/voice.md) · [User instructions](../guides/voice.md)

## Current handoff

The production policy retains the explicitly activated enabled microphone stream throughout the foreground iOS app session, including Stop, Apply, sheet close and recognition errors. Waveform animation stops outside an active attempt. Background/page exit releases capture; invalid resources are cleaned up. Detailed lifecycle instructions belong to the implementation reference linked above.

The user accepted the persistent amber microphone indication as a limited trade-off. Retention is not proof that Safari's underlying restart defect is fixed. Background-release recovery remains unresolved; neither JavaScript cleanup nor a fresh live/unmuted track proves usable microphone audio or hardware release.

## Evidence that governs the policy

The original .11 foreground-held device log showed repeated recognition across dialog close and manual Stop. Apply and background recovery were not isolated as successful controls. Natural-end retry successes also did not establish hardware-off/reopen cycles: the user reported that the amber indicator stayed visible.

The .10 cleanup audit awaited AudioContext closure, but manual-stop release/reopen still produced silent capture. System Stop Audio Recording could mute the waveform track while later recognition still transcribed; a flat waveform therefore did not by itself prove Web Speech had failed.

The .13 muted-meter release/reopen experiment yielded an enabled/live/unmuted track and running AudioContext but zero level probes while the user spoke, with no recognition results. **Do not reintroduce release/reopen as a recovery fix without new device evidence.** Keep its outcome in the historical record rather than treating its branch as recommended guidance.

The user-confirmed device software was iOS 27.0 / Safari 27.0. The user-agent token 18.7 is not the installed OS version. Preserve that distinction when interpreting old diagnostic logs.

## What remains unresolved

- Reliable recognition after background release and foreground return.
- A privacy-compatible lifecycle that clears the indicator and allows immediate retry on the affected device.
- The exact WebKit/hardware fault boundary and installed-iPhone coverage of related upstream fixes.
- Separate physical verification of newer presentation changes; mock and desktop UI checks cannot establish microphone recovery.

Browser speech recognition may be local or service-backed; the app does not enforce on-device recognition. The waveform meter records no audio file. Diagnostic counters measure JavaScript operations, not hardware sample freshness.

## Evidence and supporting records

- [Complete investigation chronology](../history/voice/VOICE-INVESTIGATION.md): device controls, observations, corrections and failed experiments, with original dates and build identities.
- [Historical recovery research](../history/voice/VOICE-RECOVERY-RESEARCH.md): proposals and source checks from their original period, superseded where later evidence says otherwise.
- [Unsubmitted WebKit report draft](../history/voice/WEBKIT-VOICE-BUG-DRAFT.md): pinned .9 reproduction; requires updating against later evidence before any submission. **The report remains unsubmitted.**
- [Historical screen-recording analysis](../history/voice/ios_web_speech_microphone_video_analysis.md): Safari/Chrome observations; approximate video timings remain approximate.

Read the current implementation policy first, then the specific evidence relevant to the question. Do not read historical acceptance plans as production instructions. This summary does not refresh external issue statuses or claim new device tests.

<details>
<summary>Previous section links</summary>

These links preserve earlier bookmarks. Follow the named current reference or dated record.

<a id="current-handoff--complete-layout-redesign"></a>
- [Current handoff — complete-layout-redesign](../history/voice/VOICE-INVESTIGATION.md)

<a id="historical-v055-presentation-change-recovery-remains-open"></a>
- [Historical v0.5.5 presentation change; recovery remains open](../history/voice/VOICE-INVESTIGATION.md)

<a id="system-recording-stop-and-failed-stream-reopening"></a>
- [System recording stop and failed stream reopening](../history/voice/VOICE-INVESTIGATION.md)

<a id="product-decision-and-11-implementation"></a>
- [Product decision and .11 implementation](../history/voice/VOICE-INVESTIGATION.md)

<a id="latest-natural-end-control-and-unfinished-release-audit-24-september"></a>
- [Latest natural-end control and unfinished-release audit (24 September)](../history/voice/VOICE-INVESTIGATION.md)

<a id="requirements-and-interpretation-guardrails"></a>
- [Requirements and interpretation guardrails](../history/voice/VOICE-INVESTIGATION.md)

<a id="observations-leading-to-the-probe"></a>
- [Observations leading to the probe](../history/voice/VOICE-INVESTIGATION.md)

<a id="v0547-audio-path-probe-asset-124"></a>
- [v0.5.4.7-audio-path-probe, asset 124](../history/voice/VOICE-INVESTIGATION.md)

<a id="v0548-staged-mic-test-asset-125-recognition-and-capture-separated"></a>
- [v0.5.4.8-staged-mic-test, asset 125: recognition and capture separated](../history/voice/VOICE-INVESTIGATION.md)

<a id="v0548-microphone-only-releasereopen-control"></a>
- [v0.5.4.8 microphone-only release/reopen control](../history/voice/VOICE-INVESTIGATION.md)

<a id="completed-control-v0549-stop-enabled-test-asset-126"></a>
- [Completed control: v0.5.4.9-stop-enabled-test, asset 126](../history/voice/VOICE-INVESTIGATION.md)

<a id="device-outcomes-and-correction-of-an-earlier-interpretation"></a>
- [Device outcomes and correction of an earlier interpretation](../history/voice/VOICE-INVESTIGATION.md)

<a id="historical-record-interpret-alongside-current-handoff"></a>
- [Historical record (interpret alongside current handoff)](../history/voice/VOICE-INVESTIGATION.md)

<a id="summary"></a>
- [Summary](../history/voice/VOICE-INVESTIGATION.md)

<a id="tested-environments"></a>
- [Tested environments](../history/voice/VOICE-INVESTIGATION.md)

<a id="iphone"></a>
- [iPhone](../history/voice/VOICE-INVESTIGATION.md)

<a id="mac"></a>
- [Mac](../history/voice/VOICE-INVESTIGATION.md)

<a id="diagnostic-pages"></a>
- [Diagnostic pages](../history/voice/VOICE-INVESTIGATION.md)

<a id="results"></a>
- [Results](../history/voice/VOICE-INVESTIGATION.md)

<a id="mac-comparison-page-reused-recogniser"></a>
- [Mac comparison page: reused recogniser](../history/voice/VOICE-INVESTIGATION.md)

<a id="mac-real-app"></a>
- [Mac real app](../history/voice/VOICE-INVESTIGATION.md)

<a id="iphone-real-app-before-mitigation"></a>
- [iPhone real app before mitigation](../history/voice/VOICE-INVESTIGATION.md)

<a id="iphone-real-app-after-mitigation"></a>
- [iPhone real app after mitigation](../history/voice/VOICE-INVESTIGATION.md)

<a id="iphone-comparison-page-reused-recogniser"></a>
- [iPhone comparison page: reused recogniser](../history/voice/VOICE-INVESTIGATION.md)

<a id="iphone-comparison-page-fresh-recogniser-per-attempt"></a>
- [iPhone comparison page: fresh recogniser per attempt](../history/voice/VOICE-INVESTIGATION.md)

<a id="iphone-spontaneous-recovery-run"></a>
- [iPhone spontaneous recovery run](../history/voice/VOICE-INVESTIGATION.md)

<a id="iphone-controlled-timing-and-stop-method-run"></a>
- [iPhone controlled timing and stop-method run](../history/voice/VOICE-INVESTIGATION.md)

<a id="iphone-microphone-reset-experiment"></a>
- [iPhone microphone reset experiment](../history/voice/VOICE-INVESTIGATION.md)

<a id="iphone-cross-browser-video-run"></a>
- [iPhone cross-browser video run](../history/voice/VOICE-INVESTIGATION.md)

<a id="page-reload-control"></a>
- [Page reload control](../history/voice/VOICE-INVESTIGATION.md)

<a id="device-microphone-control"></a>
- [Device microphone control](../history/voice/VOICE-INVESTIGATION.md)

<a id="findings"></a>
- [Findings](../history/voice/VOICE-INVESTIGATION.md)

<a id="regression-history-and-engineering-conclusion"></a>
- [Regression history and engineering conclusion](../history/voice/VOICE-INVESTIGATION.md)

<a id="resolution-status"></a>
- [Resolution status](../history/voice/VOICE-INVESTIGATION.md)

<a id="related-webkit-reports"></a>
- [Related WebKit reports](../history/voice/VOICE-INVESTIGATION.md)

<a id="microphone-reset-experiment"></a>
- [Microphone reset experiment](../history/voice/VOICE-INVESTIGATION.md)

<a id="held-microphone-experiment"></a>
- [Held microphone experiment](../history/voice/VOICE-INVESTIGATION.md)

<a id="track-pause-experiment--pending-device-validation"></a>
- [Track pause experiment — pending device validation](../history/voice/VOICE-INVESTIGATION.md)

<a id="privacy"></a>
- [Privacy](../history/voice/VOICE-INVESTIGATION.md)

</details>
