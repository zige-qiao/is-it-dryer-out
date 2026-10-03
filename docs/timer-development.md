# Timer installer preparation

The web-app UI is implemented, but the install artifact and iPhone verification are pending.

`scripts/build-timer-shortcut.py` generates a property-list Shortcut with input validation and Clock's Start Timer action. It does not require the user to construct actions. Only whole-number text from 1 through 180 is accepted. The Shortcut receives minutes from the web app; it does not fetch weather, upload readings, or wait in the background.

Apple's supported `shortcuts sign` command requires macOS. The **Build Ventilation Timer installer** GitHub Actions workflow runs when its workflow or generator changes are pushed to `ventilation-timer-ios`, or through a manual dispatch. It prepares and signs the file, then uploads it as an artifact. It does not publish the site or modify Git. Signing on a hosted runner has not been verified and may require an interactive Apple environment. Do not treat a generated unsigned file as installable.

After a requested push and workflow run, download the signed artifact, verify its import and actions on iPhone, and host the signed file with the app or provide a real iCloud sharing link. Set `TIMER_SHORTCUT_INSTALL_URL` in `src/ui/timer.js` to the verified installer location. The existing Install Shortcut action shows the pending-installation page until then.

Validate different durations, empty/fractional/out-of-range input, cancelled handoffs, missing Shortcut, Safari and Home Screen launches, and an audible alarm with the phone locked and offline. Verify the Shortcut is named Ventilation Timer. Only then remove the pending-installation statements in the README and design-system documentation.
