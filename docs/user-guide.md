# Using Is it dryer out

[Open the app](https://zige-qiao.github.io/is-it-dryer-out/) · [Back to README](../README.md)

## Indoor readings and settings

Indoor readings opens on each full page load by default. Enter temperature and relative humidity using the rulers, arrow keys or numeric fields. Manual changes save immediately; **Done** closes the sheet. Use **Edit** on the Indoor card to reopen it.

The footer Settings button controls two saved preferences: **Show Indoor summary** is off by default, and **Open Indoor readings on launch** is on by default. The optional summary shows temperature, humidity, reading age, Edit and a microphone button where supported.

Open the ventilation summary below the chart to set minimum indoor temperature, target humidity, room size and window opening. Choose a room preset or enter custom dimensions; custom airflow is also available. These settings save immediately.

Sheets can be closed with Escape or their close controls; mobile sheets also support dragging down to dismiss. The supporting **Why this recommendation?**, **Glossary**, **How estimates work** and **Weather data** sections explain the current result and terminology.

## Location and weather

Select the location name to search for a town or UK postcode, choose a recent place, or select **Use current location**. Postcodes accept either case, with or without spaces; outward codes such as `M1`, `M33` and `SW1A` also work.

On first use, the app requests device location. Later visits use the saved location. If permission is unavailable, it uses the last stored location or Sale, Greater Manchester as the initial fallback.

Use the refresh icon beside the checked time, or pull down from the page top on a touch device, to update outdoor weather. Pulls starting on buttons, links, form controls, the chart or rulers are ignored. **Refresh page** in the footer reloads the app and follows the launch preference.

## Reading the result

The recommendation compares indoor and outdoor water content, accounting for uncertainty in the readings. Absolute humidity (AH) expresses that water content in grams per cubic metre. The **Let in** value estimates outdoor relative humidity after that air warms to the current indoor temperature.

The outlook starts at 48 hours and can switch to 24 hours. The curve shows outdoor AH against the indoor reference, and the bars show estimated air changes per hour (ACH). Both ranges use the same 48-hour scales. Tap, drag or hover to inspect values; keyboard users can use arrow keys and Home/End.

## How opening times are estimated

Room volume, opening setup, forecast wind and the indoor–outdoor temperature difference determine estimated airflow. The app then simulates moisture and temperature minute by minute. Between hourly forecast points, humidity is derived from interpolated dew point.

The estimate stops when the humidity target or minimum temperature is reached, condensation is predicted, or outdoor air stops being reliably drier. When both an estimated outcome time and a reliably drier period are shown, follow the earlier limit.

Useful drying can produce **OPEN WINDOWS** even when the target cannot be reached. An expected humidity reduction below one percentage point produces **OPEN IF NEEDED**: ventilation might still help with fresh air, but may not meaningfully reduce humidity. Harmful conditions produce **KEEP CLOSED**; small differences within the uncertainty margin do not establish a drying benefit.

These are planning estimates, not measurements. Actual airflow depends on the building, window geometry, doors, wind and pressure differences. Forecast recommendations assume the current indoor readings remain unchanged until each displayed start time.

## Voice input

In supported browsers, choose **Speak** in Indoor readings or the optional summary's microphone button. Say, for example, “21 degrees, 55 percent” or “21 and 55”. Review the recognised changes and select **Apply**, or return **Back to manual**.

On iPhone, the app retains the microphone stream after a voice attempt while it remains in the foreground, including after Stop, Apply or closing the sheet. The microphone indicator may remain on, although transcription and waveform animation end separately. Leaving or backgrounding the app releases capture; reliable restarting after release remains unresolved.

The waveform meter does not save or upload an audio file. Browser speech recognition may use an external service. See the [voice investigation](voice/VOICE-INVESTIGATION.md) for device evidence and diagnostic instructions.

## Data and offline use

Indoor readings, ventilation settings, display preferences and saved locations are stored in your browser. Outdoor weather and forecast data come from Open-Meteo, with forecast times shown in the location's time zone. When device location is used, coordinates are sent to BigDataCloud to obtain a nearby locality name.

The app interface is cached for offline loading. Fresh outdoor weather and location lookup still need a connection.
