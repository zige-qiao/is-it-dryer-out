# Is it dryer out

## Version 0.5.2

Version 0.5.2 adds an opt-in on-device diagnostic log for investigating repeated voice-input failures on iOS.

A personal ventilation checker for estimating whether opening windows should reduce indoor humidity, and for how long.

## Using the app

- Set the indoor temperature and relative humidity.
- In supported browsers, use the microphone button to enter one or both indoor readings by voice, then review the recognised values before applying them.
- **Opening window plan** starts collapsed on mobile and tablet and expanded on desktop. Adjust the minimum temperature, target humidity, room size, or opening setup as needed.
- Read the recommendation and its forecast tiles. Each tile shows the expected opening result, outdoor temperature, outdoor relative humidity, and estimated air changes per hour for that start time.
- Use the refresh icon beside **Last checked** to request current weather again.

## How it works

- Enter indoor temperature, relative humidity, target humidity, and minimum indoor temperature manually. Voice input can update indoor temperature and humidity in browsers that provide speech recognition and microphone access.
- On every load, the app asks the browser for the current location. Use `Update` to request a fresh location check.
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

The duration is a rough planning estimate, not a measurement. Real airflow depends on the building, window geometry, doors, wind direction and pressure differences. The forecast tiles assume the current indoor readings remain unchanged until each displayed start time.

## Storage and offline use

Indoor readings, plan settings, and the most recent location are stored only in this browser. The app shell is cached for offline use, but live outdoor data and locality lookup still require a connection.

## Voice diagnostics

Add `?voice-debug=1` to the app URL to show the temporary voice diagnostics panel. It records microphone, audio-context, and speech-recognition lifecycle events without recording recognised speech content. Reproduce the issue, then use **Copy** to collect the log.

## Project information

Created by Ziggy Qiao. The app links to its [GitHub repository](https://github.com/zige-qiao/is-it-dryer-out) from the supporting footer. See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

## Release history

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
