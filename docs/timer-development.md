# Timer installer preparation

The web-app UI is implemented, but the install artifact and iPhone verification are pending.

`scripts/build-timer-shortcut.py` generates a property-list Shortcut with input validation and Clock's Start Timer action. It does not require the user to construct actions. Only whole-number text from 1 through 180 is accepted. The Shortcut receives minutes from the web app; it does not fetch weather, upload readings, or wait in the background.

Apple's supported `shortcuts sign` command requires macOS. The **Build Ventilation Timer installer** GitHub Actions workflow runs when its workflow or generator changes are pushed to `ventilation-timer-ios`, or through a manual dispatch. It attempts to sign the file, then uploads it as an artifact on success. It does not publish the site or modify Git. Do not treat a generated unsigned file as installable.

## Signing test result

On 2026-10-03, [run 37143389908](https://github.com/zige-qiao/is-it-dryer-out/actions/runs/37143389908) generated the source successfully but failed signing on the hosted macOS 15 runner: `Error: In order to do this, you must be signed into iCloud.` No install artifact was produced. Retrying the same hosted environment cannot resolve this account requirement. Sign on a trusted Mac already signed into iCloud; do not put Apple account credentials into the workflow. The Shortcut actions and iPhone handoff remain unverified.

After a requested push and workflow run, download the signed artifact, verify its import and actions on iPhone, and host the signed file with the app or provide a real iCloud sharing link. Set `TIMER_SHORTCUT_INSTALL_URL` in `src/ui/timer.js` to the verified installer location. The existing Install Shortcut action shows the pending-installation page until then.

Validate different durations, empty/fractional/out-of-range input, cancelled handoffs, missing Shortcut, Safari and Home Screen launches, and an audible alarm with the phone locked and offline. Verify the Shortcut is named Ventilation Timer. Only then remove the pending-installation statements in the README and design-system documentation.
