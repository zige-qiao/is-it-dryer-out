# Ventilation timer setup and device evidence

The web-app UI uses the [shared Ventilation Timer Shortcut](https://www.icloud.com/shortcuts/d16fde94799a414bb11a3a40c484f080). It was created manually on the user's iPhone after the signing experiment below failed. Install Shortcut opens that iCloud link directly. The unused Python generator and macOS signing workflow were removed on 2026-10-07.

The web app passes whole-number minutes from 1 through 180 to the shared Shortcut, which starts a Clock timer. This installation route requires no generated installer or GitHub signing workflow.

## Signing test result

On 2026-10-03, [run 37143389908](https://github.com/zige-qiao/is-it-dryer-out/actions/runs/37143389908) generated the source successfully but failed signing on the hosted macOS 15 runner: `Error: In order to do this, you must be signed into iCloud.` No install artifact was produced. The abandoned generator produced a property-list Shortcut with input validation and Clock's Start Timer action; its workflow attempted to sign it using `shortcuts sign`. This experiment never produced a verified installer. The app uses the separate iPhone-created Shortcut shared through iCloud.

## Device evidence

On 2026-10-03 the user confirmed that launching from the iPhone browser started the correct duration in Clock, and that the alarm worked in airplane mode. Screenshots identify Chrome as the calling browser. The user subsequently confirmed that timer launches also work from Safari and the Home Screen web app. The iCloud record was checked and its name is Ventilation Timer. Fresh import from the shared link, multiple different durations, locked-phone delivery, cancelled handoffs and missing-Shortcut recovery are not yet confirmed. Removal of the temporary diagnostic input alert from the shared Shortcut has not been independently checked.

Remaining device checks are different durations using the same Shortcut, invalid Shortcut input, cancelled handoffs, missing Shortcut, fresh import, and an audible alarm with the phone locked and offline. Web-app validation of empty/fractional/out-of-range minutes, refresh preservation, keyboard adjustment, focus return and sheet dismissal has passed automated checks. Preserve the name Ventilation Timer.

## v0.7.4 pre-release verification

On 2026-10-03, all 109 automated tests passed, including timer validation and handoff URL encoding, ruler interaction/cancellation, dialog scroll locking, weather recovery and complete offline import-graph coverage. Syntax checks passed for all 22 JavaScript files, and `git diff --check` reported no whitespace errors.

Windows Edge browser checks passed at 320, 390, 640 and 1280px for dashboard/chart rendering, chart keyboard inspection, sheet opening/dismissal, weather failure/recovery and documentation rendering. Timer-specific checks at 320, 390 and 1280px passed for spacing, tooltip bounds, focus restoration, drag dismissal, typed/ruler input and refresh preservation. The weather fixtures included a rendered, nonblank forecast curve. A fresh real service-worker installation cached all 26 app assets and reloaded the module graph offline.

These checks are browser emulation, not additional physical iPhone tests. The user-confirmed Safari and Home Screen handoffs are recorded above. The v0.7.4 release uses synchronised cache revision 140; the cache checks are rerun after the publishing bump.

## Return-to-app experiment

An `x-success` callback to the current web address was considered and removed before device testing. Reopening a URL cannot guarantee return to the originating Chrome tab, Safari tab or Home Screen app, which is the user's requirement. Keep the existing plain handoff rather than redirecting into a potentially different browser. No automatic-return behavior is enabled.

## Dismissal refinement (shipped in v0.7.4.1)

Start now closes the timer sheet before the existing URL handoff. All five sheets share quiet focus return for touch-opened sheets, retaining an indicator only if the opener had visible keyboard focus at activation. All header close buttons are hidden below 640px; existing Done buttons and mobile drag dismissal remain.

Local Windows Edge checks passed at 320, 390, 639, 640 and 1280px, covering 205 activation/dismissal combinations plus typed/ruler entry, help Escape, short/cancelled drags, refresh preservation, replaced openers and subsequent keyboard navigation. A separate normal-desktop check passed for the four non-timer sheets and plain verdict durations. These are emulated checks, not physical iPhone confirmation of the updated Start-dismiss flow. At the time of these checks, version v0.7.4 and cache revision 140 remained unchanged and the refinement was unpublished. It subsequently shipped in v0.7.4.1; the current v0.7.5 app uses cache revision 162.
