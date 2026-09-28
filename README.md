# Is it dryer out

## v0.7.1 — Forecast and reading refinements

This update opens Indoor readings when the app loads, starts the outlook at 48 hours, and refines the verdict and chart colours. The selected chart dot and g/m³ reading follow the line colour.

A personal ventilation checker for estimating whether opening windows should reduce indoor humidity, and for how long.

## Using the app

- Read the recommendation and its outdoor outlook, which starts at **48 h**. Switch between **24 h** and **48 h**; the line shows outdoor absolute humidity against your indoor reference, and bars show estimated airflow in ACH. Drag, hover, or use arrow keys to inspect values; Home/End select the endpoints. Both views use the same 48-hour data for their scales.
- Compare outdoor and indoor AH in the moisture cards. **Let in** shows outdoor RH once warmed to your indoor temperature. Colours indicate drier, uncertain, or wetter conditions.
- The Indoor readings sheet opens when the app loads so you can enter the current readings. Open it again with **Edit** on the Indoor card. Drag the temperature and humidity rulers, use arrow keys, or tap a number to type. Values save immediately; **Done** closes the sheet. A last-set time appears after readings are updated.
- In supported browsers, select **Speak** inside Indoor readings. Live Hearing text replaces Listening in the status box. Review the recognised values and select **Apply**, or return **Back to manual**.
- Open the ventilation summary below the chart to change minimum temperature, target humidity, room size, or opening setup. Room and opening choices use single-selection groups; Custom reveals room dimensions or airflow. Changes save immediately; **Done** closes the settings.
- Select the location name to search for a town or postcode, use the device location, or choose a recent place. The mobile location sheet has a visible **Close** button.
- Select the refresh icon beside **Last checked** for fresh weather. **Refresh page** in the footer reloads the page.
- Open **Why this recommendation?**, **Glossary**, **How estimates work**, or **Weather data** for explanations, definitions and source details.

Sheets support Escape and mobile drag-to-dismiss, preserve the page's scroll position, and follow the visible viewport when the keyboard opens.

The [design system](docs/design-system.md) records the app's warm-neutral roles and component states. The AH forecast line keeps its distinct white, amber, and coral scale; recommendation and moisture-card colours remain semantic.

## How it works

Current iPhone voice policy (established in `v0.5.4.11-foreground-voice` and unchanged in this branch): after the first user-requested voice attempt, keep the microphone stream enabled throughout the foreground session, including natural completion, manual Stop, Apply and dialog close. The amber indicator may remain on. Transcription ends separately; the waveform is reset and its animation cancelled between attempts. No new Stop/Abort/Release controls or readiness message are added. Backgrounding or leaving releases capture; restarting after that release remains an unresolved platform risk. No audio file is saved or uploaded by the meter; browser speech recognition may use an external service.

- Enter indoor temperature, relative humidity, target humidity, and minimum indoor temperature manually. Voice input can update indoor temperature and humidity in browsers that provide speech recognition and microphone access. On iPhone, the dialog waveform uses a standard microphone stream to keep the iOS audio session available during recognition and between foreground attempts.
- On first use, the app asks the browser for the current location. Afterward it uses the saved location; select the location name and **Use current location** to request a fresh device-location check.
- Location search accepts UK postcodes with or without spaces, regardless of letter case, and outward codes such as `M1`, `M33`, or `SW1A`.
- If location permission is unavailable, the app uses the most recently stored location, or Sale, Greater Manchester as the initial fallback.
- When device location is used, its coordinates are sent to BigDataCloud only to obtain a nearby locality name.
- The app compares indoor and outdoor water content before recommending ventilation.
- The opening plan simulates changing moisture and temperature minute by minute.
- Forecast humidity between hourly points is derived from interpolated dew point rather than interpolating relative humidity directly.
- Outdoor temperature, humidity, dew point, pressure, wind and forecast data come from Open-Meteo for the active location. Forecast times use the time zone returned with that weather data.
- Normal sensor uncertainty is included. Small moisture differences are labelled uncertain instead of being treated as reliably wetter or drier.
- A plan with an expected relative-humidity reduction of under one percentage point is labelled `OPEN IF NEEDED`: brief ventilation may be useful for fresh air, but it may not reduce humidity.
- The plan stops when the humidity target is reached, the minimum temperature is reached, condensation is predicted, or forecast air stops being reliably drier.
- Where applicable, the recommendation shows both the estimated time to its outcome and the period that outdoor air remains reliably drier. Follow the earlier limit.
- When ventilation provides useful drying but cannot reach the target, the app still recommends `OPEN WINDOWS` and shows the useful drying period and expected conditions.
- Every meaningful opening period uses the blue `OPEN WINDOWS` status. The stated time and supporting text explain whether to stop at the target, a temperature or condensation limit, a forecast change, or the point where drying becomes uncertain. Harmful conditions continue to use `KEEP CLOSED`.

## Timing estimate

Choose a room-size preset or enter custom room dimensions. Then select an opening setup or enter a custom airflow estimate. Room volume, opening setup, forecast wind and the indoor-outdoor temperature difference are used to estimate air changes per hour.

The duration is a rough planning estimate, not a measurement. Real airflow depends on the building, window geometry, doors, wind direction and pressure differences. Forecast estimates assume the current indoor readings remain unchanged until each displayed start time.

## Storage and offline use

Indoor readings, plan settings, and the most recent location are stored only in this browser. The app shell is cached for offline use, but live outdoor data and locality lookup still require a connection.

## Voice diagnostics

The [voice investigation](VOICE-INVESTIGATION.md) is the canonical record for current policy, device evidence and unresolved recovery failures. It links to archived research, the unsubmitted WebKit report draft and supporting video analysis.

The standalone diagnostic page remains build `v0.5.4.10-cleanup-audit`, asset 127. Use `voice-test.html?mode=track-pause&staged=1&stopTrack=enabled` for the microphone-only / recognition / release control. Cleanup logs distinguish stopped tracks from AudioContext closure; successful JavaScript cleanup does not prove that the microphone indicator cleared. Older build descriptions in the investigation are historical, not the expected build at today's hosted URL.

Add `?voice-debug=1` to the app URL for temporary lifecycle logging and **Copy**. These logs contain no recognised speech content. The foreground microphone retention policy above remains a mitigation; reopening after release is unresolved.

## Development checks

No dependency installation is required. With a recent Node.js, run `node --check app.js`, `node --check service-worker.js`, and `node --test tests/*.test.cjs`. In restricted environments that cannot spawn test workers, use `node --test --test-isolation=none tests/*.test.cjs`. Run `git diff --check` before pushing. Automated checks do not replace browser and iPhone verification.

## Project information

Created by Ziggy Qiao. The app links to its [GitHub repository](https://github.com/zige-qiao/is-it-dryer-out) from the supporting footer. See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

## Release history

- `v0.7.1`: Default 48-hour outlook and Indoor readings sheet on load; faster chart loading sweep; refined verdict and AH chart colours with matching inspection dot and moisture reading; app shell cache revision 134.
- `v0.7.0`: Integrated recommendation and 24/48-hour outlook, indoor and ventilation sheets with ruler and custom controls, location and modal refinements, warm-neutral design system, and release cache revision 133.
- `v0.6.0`: Moisture comparison cards and interactive 48-hour AH outlook.
- `v0.5.5`: Refresh-style voice entry button, immediate voice dialog, dialog-only waveform, and concise spoken-reading examples; iPhone voice capture policy unchanged.
- `v0.5.4`: Shared ventilation-settings dialog, calculation-specific recommendation explanations, clearer weather provenance, and refined responsive accessibility.
- `v0.5.3.3`: Browser and WebKit identification plus bounded audio-interruption testing for voice diagnostics.
- `v0.5.3.1`: Immediate recognition startup, isolated recording sessions, adaptive desktop silence detection, and an iOS microphone-conflict workaround.
- `v0.5.3`: Microphone-level silence detection, graceful recognition shutdown, and one-shot iOS recognition with diagnostics retained for verification.
- `v0.5.2`: Opt-in on-device voice diagnostics for investigating repeated iOS recording failures.
- `v0.5.1`: Reliable repeated voice sessions on iOS, UK postcode-area search, and refined outdoor-data loading and failure states.
- `v0.5`: Optional voice entry for indoor readings, forecast ACH estimates, responsive plan disclosure, loading placeholders, and a separated verdict and outlook layout.
- `v0.4.2`: Balanced desktop columns, aligned panel spacing, cleaner location rendering, and more compact fallback guidance.
- `v0.4.1`: Default-expanded opening plan, minimum-temperature-first controls, and a compact outdoor-RH dashboard conclusion.
- `v0.4`: Mobile-first information flow, collapsible opening-plan controls, clearer no-drying-benefit guidance, forecast relative humidity, refined refresh control, and a supporting-details footer.
- `v0.3.2`: Automatic location checks, town and postcode search, clearer weather-retry handling, consolidated opening outlook, unified controls, responsive layout refinements, and visual polish.
- `v0.3.1`: Refined ventilation status logic, location updating, reading controls, forecast navigation, and responsive usability.
- `v0.3`: Minimum meaningful humidity-improvement rule, clearer `WAIT` states, consistent open/wait/closed colours, room and opening configuration refinements, and responsive layout updates.
- `v0.2`: Automatic location refresh, location update action, refreshed app icon, and two-part ventilation timing guidance.
- `v0.1`: First public release with live outdoor weather, manual indoor readings, and forecast-based ventilation planning.

## Possible future work

- Calibrate airflow estimates against measured changes in a specific room.
- Investigate whether Tado X readings can be accessed safely and reliably through Home Assistant/Matter or a token-protecting backend.
