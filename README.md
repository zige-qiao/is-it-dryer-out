# Is it dryer out

## Version 0.1

First public release: live outdoor weather, manual indoor readings, and a forecast-based window-opening estimate that accounts for moisture, temperature, room size and opening setup.
A personal ventilation checker for estimating whether opening windows should reduce indoor humidity, and for how long.

## How it works

- Enter indoor temperature and relative humidity manually.
- On load, the app asks the browser for the current location when needed. When device location is used, its coordinates are also sent to BigDataCloud to show the nearby locality.
- The app compares indoor and outdoor water content before recommending ventilation.
- The opening plan simulates changing moisture and temperature minute by minute.
- Forecast humidity between hourly points is derived from interpolated dew point rather than interpolating relative humidity directly.
- Outdoor temperature, humidity, dew point, pressure, wind and forecast data come from Open-Meteo for the active location. Forecast times use the time zone returned with that weather data.
- Normal sensor uncertainty is included. Small moisture differences are labelled uncertain instead of being treated as reliably wetter or drier.
- The plan stops when the humidity target is reached, the minimum temperature is reached, condensation is predicted, or forecast air stops being reliably drier.

## Timing estimate

Choose a room-size preset or enter custom room dimensions. Then select an opening setup or enter a custom airflow estimate. Room volume, opening setup, forecast wind and the indoor-outdoor temperature difference are used to estimate air changes per hour.

The duration is a rough planning estimate, not a measurement. Real airflow depends on the building, window geometry, doors, wind direction and pressure differences. The forecast tiles assume the current indoor readings remain unchanged until each displayed start time.

## Storage and offline use

Settings are stored only in this browser. The app shell is cached for offline use, but live outdoor data still requires a connection.

## Possible future work

- Calibrate airflow estimates against measured changes in a specific room.
- Add richer loading and error states.
- Investigate whether Tado X readings can be accessed safely and reliably through Home Assistant/Matter or a token-protecting backend.
