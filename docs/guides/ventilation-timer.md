# Use an iPhone ventilation timer

**Audience:** People using the app

**Status:** Current main reference; appearance and uniform glass sheets on the separate `dark-mode` branch remain Unreleased where labelled

**Owns:** Shortcut installation, durations, handoff and Clock ownership

**Reviewed:** 14 October 2026

[Documentation index](../index.md) · [User guide](../user-guide.md)

1. Install the reusable [Ventilation Timer Shortcut](../timer-shortcut.html) once and keep its name unchanged.
2. Tap a dotted-underlined opening duration on iPhone/iPad.
3. Adjust the minutes and choose **Start iPhone timer**.
4. Check Clock after the first handoff; Clock owns the timer, alarm and cancellation.


## Contents

- [Durations and handoff](#durations-and-handoff)
- [Install once](#install-once)
- [Check Clock and recover](#check-clock-and-recover)
## Durations and handoff

On iPhone/iPad, tap an opening duration on Overview or Why, including More detail, to open the timer sheet. Eligible durations show a dotted underline. Adjust the whole minutes with the ruler, arrow keys or numeric field (1-180 minutes), then choose **Start iPhone timer**. Timer adjustments are temporary and do not change your saved indoor readings or ventilation settings. The header and Start action stay visible while content scrolls behind their glass backgrounds; the last control can scroll clear of Start. Closing returns focus to the duration you opened; if a live update removes it, focus returns to that page’s recommendation heading. Clock times and hourly weather periods do not open timers.

## Install once

Before the first use, open the help popup beside the timer title and choose **Install Shortcut** to [add Ventilation Timer](https://www.icloud.com/shortcuts/d16fde94799a414bb11a3a40c484f080). Add it once and keep its name unchanged; the app passes a different duration each time. Starting a timer closes the sheet before switching to Shortcuts, which starts Apple's Clock timer. There is no automatic return to the originating browser or Home Screen app. If you cancel the handoff, the sheet stays closed.

The two verdict times can mean different things. A period of reliably drier outdoor air is not a recommendation to keep the windows open for that entire period. A capped estimate of more than three hours opens a 180-minute recheck reminder. Other platforms retain plain duration text.

## Check Clock and recover

Clock owns the alarm and cancellation after the handoff. The web app shows no countdown and cannot confirm that the timer started; check Clock after the first handoff and choose an audible timer sound rather than Stop Playing. The user confirmed the handoff from Safari and the Home Screen web app, and an alarm in flight mode. See [timer development](../history/timer-development.md) for test evidence and remaining gaps.

If the Shortcut is missing or renamed, install it from the shared link and restore its exact name, Ventilation Timer. If you cancel a handoff, the app sheet stays closed: reopen an eligible duration to try again. The app cannot detect installation or guarantee an automatic return to the originating browser/Home Screen app. Locked-phone and fresh-import verification remain separate device checks in the evidence record.
