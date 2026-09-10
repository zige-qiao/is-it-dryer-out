# Is it dryer out

## Version 0.3.1

Version 0.3.1 refines the opening guidance, status thresholds, and responsive controls. It adds clearer temperature and moisture limits, more precise indoor-reading controls, an update-location dialog, and improved mobile forecast navigation. Blue indicates active ventilation, green indicates that the target is met, amber indicates a limited or uncertain opportunity, and red indicates that windows should remain closed. It avoids recommending ventilation when the model predicts less than a one-percentage-point reduction in relative humidity.

A personal ventilation checker for estimating whether opening windows should reduce indoor humidity, and for how long.

## How it works

- Enter indoor temperature, relative humidity, target humidity, and minimum indoor temperature manually.
- On every load, the app asks the browser for the current location. Use `Update` to request a fresh location check.
- If location permission is unavailable, the app uses the most recently stored location, or Sale, Greater Manchester as the initial fallback.
- When device location is used, its coordinates are sent to BigDataCloud only to obtain a nearby locality name.
- The app compares indoor and outdoor water content before recommending ventilation.
- The opening plan simulates changing moisture and temperature minute by minute.
- Forecast humidity between hourly points is derived from interpolated dew point rather than interpolating relative humidity directly.
- Outdoor temperature, humidity, dew point, pressure, wind and forecast data come from Open-Meteo for the active location. Forecast times use the time zone returned with that weather data.
- Normal sensor uncertainty is included. Small moisture differences are labelled uncertain instead of being treated as reliably wetter or drier.
- A plan with an expected relative-humidity reduction of under one percentage point is shown as `WAIT` with no clear drying benefit, avoiding recommendations that would produce no visible change.
- The plan stops when the humidity target is reached, the minimum temperature is reached, condensation is predicted, or forecast air stops being reliably drier.
- Where applicable, the recommendation shows both the estimated time to its outcome and the period that outdoor air remains reliably drier. Follow the earlier limit.
- When ventilation provides useful drying but cannot reach the target, the app still recommends `OPEN WINDOWS` and shows the useful drying period and expected conditions.
- Every meaningful opening period uses the blue `OPEN WINDOWS` status. The stated time and supporting text explain whether to stop at the target, a temperature or condensation limit, a forecast change, or the point where drying becomes uncertain.

## Timing estimate

Choose a room-size preset or enter custom room dimensions. Then select an opening setup or enter a custom airflow estimate. Room volume, opening setup, forecast wind and the indoor-outdoor temperature difference are used to estimate air changes per hour.

The duration is a rough planning estimate, not a measurement. Real airflow depends on the building, window geometry, doors, wind direction and pressure differences. The forecast tiles assume the current indoor readings remain unchanged until each displayed start time.

## Storage and offline use

Indoor readings, plan settings, and the most recent location are stored only in this browser. The app shell is cached for offline use, but live outdoor data and locality lookup still require a connection.

## Release history

- `v0.3.1`: Refined ventilation status logic, location updating, reading controls, forecast navigation, and responsive usability.
- `v0.3`: Minimum meaningful humidity-improvement rule, clearer `WAIT` states, consistent open/wait/closed colours, room and opening configuration refinements, and responsive layout updates.
- `v0.2`: Automatic location refresh, location update action, refreshed app icon, and two-part ventilation timing guidance.
- `v0.1`: First public release with live outdoor weather, manual indoor readings, and forecast-based ventilation planning.

## Possible future work

- Calibrate airflow estimates against measured changes in a specific room.
- Add richer loading and error states.
- Investigate whether Tado X readings can be accessed safely and reliably through Home Assistant/Matter or a token-protecting backend.
