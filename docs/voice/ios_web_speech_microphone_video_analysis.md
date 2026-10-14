# iOS Web Speech / Microphone Behaviour - Detailed Video Analysis

This historical record now lives in [the preserved record](../history/voice/ios_web_speech_microphone_video_analysis.md). Original dates, quotations, observations and uncertainty are retained.

For current implementation, read [voice policy](../development/voice.md) and [the current investigation](VOICE-INVESTIGATION.md). Historical proposals do not override the accepted foreground microphone policy.

<details>
<summary>Previous section links</summary>

These links preserve earlier bookmarks. Follow the named current reference or dated record.

<a id="1-executive-summary"></a>
- [1. Executive summary](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="2-ios-indicators-visible-in-the-recording"></a>
- [2. iOS indicators visible in the recording](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="21-red-status-indicator-around-the-clock"></a>
- [2.1 Red status indicator around the clock](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="22-amberorange-dot-at-the-top-right"></a>
- [2.2 Amber/orange dot at the top-right](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="23-safari-microphone-ui"></a>
- [2.3 Safari microphone UI](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="24-chrome-microphone-ui"></a>
- [2.4 Chrome microphone UI](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="3-high-level-behaviour-observed"></a>
- [3. High-level behaviour observed](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="state-a---fully-working-recognition"></a>
- [State A - fully working recognition](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="state-b---false-or-incomplete-listening-state"></a>
- [State B - false or incomplete "Listening" state](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="state-c---recovery-after-browser-switching"></a>
- [State C - recovery after browser switching](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="4-detailed-chronological-timeline"></a>
- [4. Detailed chronological timeline](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="000---control-centre-visible"></a>
- [0:00 - Control Centre visible](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="visible-state"></a>
- [Visible state](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="interpretation"></a>
- [Interpretation](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="001---control-centre-closes-safari-is-visible"></a>
- [~0:01 - Control Centre closes, Safari is visible](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="microphone"></a>
- [Microphone](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="5-safari---first-attempt"></a>
- [5. Safari - first attempt](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="002---start-is-pressed"></a>
- [~0:02 - Start is pressed](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="002-004---initial-microphone-permission-prompt"></a>
- [~0:02-0:04 - Initial microphone permission prompt](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="004---microphone-activates"></a>
- [~0:04 - microphone activates](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="important-system-behaviour"></a>
- [Important system behaviour](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="log"></a>
- [Log](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="interpretation-1"></a>
- [Interpretation](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="005-012---speech-is-recognised"></a>
- [~0:05-0:12 - speech is recognised](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="log-behaviour"></a>
- [Log behaviour](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="microphone-1"></a>
- [Microphone](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="012-013---recognition-completes"></a>
- [~0:12-0:13 - recognition completes](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="log-1"></a>
- [Log](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="microphone-2"></a>
- [Microphone](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="6-safari---immediate-second-attempt-fails"></a>
- [6. Safari - immediate second attempt fails](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="014---start-is-pressed-again"></a>
- [~0:14 - Start is pressed again](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="very-important-transition"></a>
- [Very important transition](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="015-022---stuck-in-listening"></a>
- [~0:15-0:22 - stuck in Listening](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="system-indicator"></a>
- [System indicator](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="interpretation-2"></a>
- [Interpretation](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="022-024---manually-stopped"></a>
- [~0:22-0:24 - manually stopped](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="key-point"></a>
- [Key point](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="7-first-safari--chrome-switch"></a>
- [7. First Safari → Chrome switch](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="025---app-switcher-opens"></a>
- [~0:25 - app switcher opens](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="safari-log"></a>
- [Safari log](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="8-chrome---first-attempt-succeeds"></a>
- [8. Chrome - first attempt succeeds](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="026---chrome-becomes-foreground-browser"></a>
- [~0:26 - Chrome becomes foreground browser](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="027-029---start-and-microphone-permission"></a>
- [~0:27-0:29 - Start and microphone permission](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="029---microphone-becomes-active"></a>
- [~0:29 - microphone becomes active](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="030---chrome-permission-banner"></a>
- [~0:30 - Chrome permission banner](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="important-distinction"></a>
- [Important distinction](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="032-039---speech-recognition-succeeds"></a>
- [~0:32-0:39 - speech recognition succeeds](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="039-040---chrome-attempt-completes"></a>
- [~0:39-0:40 - Chrome attempt completes](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="9-chrome---immediate-second-attempt-fails"></a>
- [9. Chrome - immediate second attempt fails](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="040---another-recogniser-is-started"></a>
- [~0:40 - another recogniser is started](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="but"></a>
- [But:](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="041-047---stuck"></a>
- [~0:41-0:47 - stuck](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="this-creates-an-important-cross-browser-pattern"></a>
- [This creates an important cross-browser pattern](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="048---manually-stopped"></a>
- [~0:48 - manually stopped](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="10-chrome--safari-switch"></a>
- [10. Chrome → Safari switch](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="049-050"></a>
- [~0:49-0:50](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="page-lifecycle"></a>
- [Page lifecycle](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="11-safari---third-attempt-still-fails"></a>
- [11. Safari - third attempt still fails](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="051"></a>
- [~0:51](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="however"></a>
- [However](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="052-059"></a>
- [~0:52-0:59](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="12-101-103---control-centre-check"></a>
- [12. ~1:01-1:03 - Control Centre check](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="important-observation"></a>
- [Important observation](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="13-104-106---another-browser-switch"></a>
- [13. ~1:04-1:06 - another browser switch](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="14-chrome---later-attempt--transition-period"></a>
- [14. Chrome - later attempt / transition period](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="109"></a>
- [~1:09](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="117"></a>
- [~1:17](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="important-lifecycle-behaviour"></a>
- [Important lifecycle behaviour](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="why-this-matters"></a>
- [Why this matters](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="15-safari---strong-recovery-after-switch"></a>
- [15. Safari - strong recovery after switch](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="119-121"></a>
- [~1:19-1:21](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="critical-observation"></a>
- [Critical observation](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="124-onward"></a>
- [~1:24 onward](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="129-130"></a>
- [~1:29-1:30](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="interpretation-3"></a>
- [Interpretation](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="16-safari--chrome---another-rapid-recovery"></a>
- [16. Safari → Chrome - another rapid recovery](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="135"></a>
- [~1:35](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="138"></a>
- [~1:38](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="141-145"></a>
- [~1:41-1:45](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="146-147"></a>
- [~1:46-1:47](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="17-148-150---ios-privacy-inspection"></a>
- [17. ~1:48-1:50 - iOS privacy inspection](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="particularly-important-evidence"></a>
- [Particularly important evidence](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="why-this-matters-1"></a>
- [Why this matters](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="18-chrome--safari---successful-recovery-again"></a>
- [18. Chrome → Safari - successful recovery again](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="152-154"></a>
- [~1:52-1:54](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="155"></a>
- [~1:55](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="156-201"></a>
- [~1:56-2:01](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="202"></a>
- [~2:02](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="19-safari---immediate-retry-fails-again"></a>
- [19. Safari - immediate retry fails again](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="202-206"></a>
- [~2:02-2:06](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="but-again"></a>
- [But again](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="20-safari--chrome---very-fast-microphone-recovery"></a>
- [20. Safari → Chrome - very fast microphone recovery](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="207"></a>
- [~2:07](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="208"></a>
- [~2:08](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="strong-timing-observation"></a>
- [Strong timing observation](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="211-214"></a>
- [~2:11-2:14](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="215"></a>
- [~2:15](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="21-chrome---immediate-sixth-attempt-fails"></a>
- [21. Chrome - immediate sixth attempt fails](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="216"></a>
- [~2:16](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="but-1"></a>
- [But](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="216-220"></a>
- [~2:16-2:20](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="220-221"></a>
- [~2:20-2:21](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="22-attempt-level-pattern-summary"></a>
- [22. Attempt-level pattern summary](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="safari"></a>
- [Safari](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="chrome"></a>
- [Chrome](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="23-strongest-findings"></a>
- [23. Strongest findings](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="finding-1---audiostart-does-not-prove-the-ios-microphone-is-actually-active"></a>
- [Finding 1 - `audiostart` does not prove the iOS microphone is actually active](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="finding-2---the-amber-dot-correlates-strongly-with-actual-successful-recognition"></a>
- [Finding 2 - the amber dot correlates strongly with actual successful recognition](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="finding-3---immediate-same-browser-retries-are-unusually-failure-prone"></a>
- [Finding 3 - immediate same-browser retries are unusually failure-prone](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="finding-4---switching-between-safari-and-chrome-often-restores-the-mic-very-quickly"></a>
- [Finding 4 - switching between Safari and Chrome often restores the mic very quickly](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="finding-5---browser-switching-is-not-a-guaranteed-fix"></a>
- [Finding 5 - browser switching is not a guaranteed fix](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="finding-6---foregroundbackground-lifecycle-may-be-part-of-the-recovery-mechanism"></a>
- [Finding 6 - foreground/background lifecycle may be part of the recovery mechanism](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="24-unusual-patterns"></a>
- [24. Unusual patterns](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="241-successful-end-appears-capable-of-poisoning-the-next-attempt"></a>
- [24.1 Successful end appears capable of "poisoning" the next attempt](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="242-no-immediate-microphone-error-is-thrown"></a>
- [24.2 No immediate microphone error is thrown](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="243-audioend-can-appear-after-a-session-that-seemingly-never-had-real-os-microphone-ownership"></a>
- [24.3 `audioend` can appear after a session that seemingly never had real OS microphone ownership](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="244-app-switching-may-be-forcing-a-deeper-reset-than-stopping-recognition"></a>
- [24.4 App switching may be forcing a deeper reset than stopping recognition](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="245-the-issue-affects-both-safari-and-chrome"></a>
- [24.5 The issue affects both Safari and Chrome](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="25-likely-technical-interpretation"></a>
- [25. Likely technical interpretation](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="26-leading-hypotheses"></a>
- [26. Leading hypotheses](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="hypothesis-a---microphone-teardown-race"></a>
- [Hypothesis A - microphone teardown race](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="why-it-fits"></a>
- [Why it fits](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="hypothesis-b---stale-web-speech--webkit-audio-session-state"></a>
- [Hypothesis B - stale Web Speech / WebKit audio-session state](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="why-it-fits-1"></a>
- [Why it fits](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="hypothesis-c---foregroundbackground-transition-resets-audio-ownership"></a>
- [Hypothesis C - foreground/background transition resets audio ownership](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="why-it-fits-2"></a>
- [Why it fits](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="hypothesis-d---elapsed-time-is-partially-responsible"></a>
- [Hypothesis D - elapsed time is partially responsible](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="why-this-remains-possible"></a>
- [Why this remains possible](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="hypothesis-e---both-timing-and-lifecycle-are-required"></a>
- [Hypothesis E - both timing and lifecycle are required](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="27-what-the-recording-does-not-suggest"></a>
- [27. What the recording does NOT suggest](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="not-simply-a-microphone-permission-denial"></a>
- [Not simply a microphone permission denial](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="not-simply-a-broken-microphone"></a>
- [Not simply a broken microphone](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="not-simply-a-speech-content-problem"></a>
- [Not simply a speech-content problem](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="not-a-single-browser-only-problem"></a>
- [Not a single-browser-only problem](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="not-merely-the-page-failing-to-render-an-indicator"></a>
- [Not merely the page failing to render an indicator](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="28-recommended-controlled-experiments"></a>
- [28. Recommended controlled experiments](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="test-1---delayed-restart-in-the-same-browser"></a>
- [Test 1 - delayed restart in the same browser](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="purpose"></a>
- [Purpose](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="test-2---switch-browser-immediately-versus-wait"></a>
- [Test 2 - switch browser immediately versus wait](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="condition-a"></a>
- [Condition A](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="condition-b"></a>
- [Condition B](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="condition-c"></a>
- [Condition C](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="condition-d"></a>
- [Condition D](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="test-3---background-and-return-to-the-same-browser"></a>
- [Test 3 - background and return to the SAME browser](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="test-4---lockunlock-screen-between-attempts"></a>
- [Test 4 - lock/unlock screen between attempts](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="test-5---explicitly-delay-after-audioend-versus-after-end"></a>
- [Test 5 - explicitly delay after `audioend` versus after `end`](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="test-6---log-visibilitychange"></a>
- [Test 6 - log `visibilitychange`](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="test-7---log-all-speechrecognition-events"></a>
- [Test 7 - log all SpeechRecognition events](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="test-8---capture-performancenow-deltas"></a>
- [Test 8 - capture `performance.now()` deltas](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="29-suggested-passfail-definition"></a>
- [29. Suggested pass/fail definition](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="capture-acquired"></a>
- [Capture acquired](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="fully-successful"></a>
- [Fully successful](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="suspected-false-audiostart-failure"></a>
- [Suspected false-audiostart failure](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="30-suggested-machine-readable-attempt-log"></a>
- [30. Suggested machine-readable attempt log](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="31-most-useful-comparison-from-the-recording"></a>
- [31. Most useful comparison from the recording](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="chrome-successful-attempt"></a>
- [Chrome successful attempt](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="chrome-immediate-retry"></a>
- [Chrome immediate retry](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="32-why-the-browser-switch-recovery-matters"></a>
- [32. Why the browser-switch recovery matters](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="33-potential-bug-statement"></a>
- [33. Potential bug statement](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="34-short-reproduction-sequence"></a>
- [34. Short reproduction sequence](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="35-evidence-hierarchy-from-this-recording"></a>
- [35. Evidence hierarchy from this recording](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="strongest-evidence"></a>
- [Strongest evidence](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="intermediate-evidence"></a>
- [Intermediate evidence](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="weakest-evidence"></a>
- [Weakest evidence](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="36-final-conclusions"></a>
- [36. Final conclusions](../history/voice/ios_web_speech_microphone_video_analysis.md)

<a id="37-condensed-diagnostic-signature"></a>
- [37. Condensed diagnostic signature](../history/voice/ios_web_speech_microphone_video_analysis.md)

</details>
