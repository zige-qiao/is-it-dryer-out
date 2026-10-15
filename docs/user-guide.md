# Using Is it dryer out

[Open the app](https://zige-qiao.github.io/is-it-dryer-out/) · [Back to README](../README.md) · [All documentation](index.md)

Use this guide for everyday actions, with links to detailed controls and troubleshooting. Appearance choices described below are available in the local working tree and remain **Unreleased**.

## Get started

1. Open Indoor readings with the thermometer button. Enter temperature and relative humidity from your room sensor. Manual changes save immediately; close with the tick.
2. Select the location name and choose a town, UK postcode or current location.
3. Read the Recommendation and its suggested opening limit. Inspect the 24- or 48-hour outlook for changing outdoor conditions.
4. Open the ventilation summary below the chart to adjust your humidity target, minimum temperature, room size and window opening.

Overview contains the recommendation and optional supporting sections. Why explains the result and its assumptions. Use the bottom tabs or a horizontal swipe to switch; the separate thermometer button opens Indoor readings from either page. Settings and Refresh app are in Why's footer.

## Indoor readings and settings

Indoor readings opens automatically on initial Overview launch by default; opening Why directly does not open it. Use the rulers, arrow keys or numeric fields. A blank or out-of-range committed value restores the saved reading and shows its allowed range. A tick closes immediately saved sheets; it is not a second save action.

Settings lets you show, hide or reorder Overview's optional Indoor summary, Moisture comparison and Chart key. Recommendation is always visible and pinned first. Default optional sections are Indoor summary hidden, Moisture comparison hidden and Chart key shown. Reset restores their default layout only.

On touch, briefly hold a dot handle to reorder; swiping immediately scrolls. Keyboard users can open Move up/Move down from the handle. Indoor options independently control opening on launch and camera/voice entry visibility. Hiding camera entry preserves its saved Still photos and Auto flash choices. The thermometer button remains available when indoor boxes are hidden.

Open the ventilation summary to change minimum temperature, target humidity, room preset/dimensions and opening setup. These changes save immediately. Escape, outside tap and header controls dismiss sheets; mobile headers support drag dismissal. The Unreleased glass sheets keep their header and existing Timer Start action visible while content scrolls behind them. Camera/voice Back cancels unapplied drafts. See [readings and settings](guides/readings-and-settings.md) for detailed controls, focus and keyboard alternatives.

## Appearance

In Settings, choose System, Light or Dark. System follows the device by default; Light/Dark hold your choice. It saves immediately and survives refresh. Overview layout Reset does not reset appearance.

Dark verdict backgrounds use deeper colours while preserving their hues. Light backgrounds, verdict meanings, text, controls and the white/amber/coral chart colours stay the same. Browser toolbar and installed-app launch colours may differ from the selected theme. See [appearance details](guides/readings-and-settings.md#appearance).

## Location and weather

Select the location name to search for a town or UK postcode, choose a recent place, or use current location. Postcodes accept either case, with or without spaces; outward codes such as M1, M33 and SW1A also work.

The first visit requests device location. Later visits use the saved place; if permission is unavailable, the fallback is the last stored place or Sale, Greater Manchester. Weather starts from coordinates immediately, while Nearby location may appear during the optional name lookup. Cancelling first-launch selection still loads fallback weather.

Use the refresh icon beside the checked time or pull down from the page top to refresh weather. Sheets/popups and field editing suspend pull-to-refresh. Refresh app in Why's footer reloads the interface and follows the launch preference. See [refresh interaction details](design/layout-navigation.md#weather-refresh-interactions).

## Reading the result

The recommendation compares moisture at a shared reference temperature and accounts for reading uncertainty. Why explains the current cause and stopping limit; More detail exposes densities, outdoor RH at indoor temperature, rain/wind and model assumptions.

TARGET MET means your humidity target is already met or nearly met. OPEN WINDOWS identifies a useful drying period. KEEP CLOSED identifies an adverse limit; Why may show a later suitable time assuming unchanged indoor readings. OPEN IF NEEDED has no clear or worthwhile drying benefit; its explanation depends on the actual result.

The chart starts at 48 hours and can switch to 24. Tap, drag or hover to inspect; keyboard users use arrows and Home/End. Its curve plots actual outdoor AH; its colour separately means reliably wetter (coral), uncertain (amber) or reliably drier (white) at the indoor reference temperature. Bars show estimated air changes per hour. [Moisture and estimates](explanation/moisture-and-estimates.md) explains the difference between displayed values and colour meanings.

## How opening times are estimated

The app estimates airflow from room/opening settings, forecast wind and temperature difference, then simulates moisture and temperature. Follow the earlier relevant stopping limit and take fresh readings during ventilation. Close sooner if the room gets too cold.

Actual buildings, ongoing moisture, stored moisture in furnishings and active heating can behave differently. The app does not predict condensation on cold surfaces. Read [model assumptions and uncertainty](explanation/moisture-and-estimates.md) before relying on a precise duration.

## Ventilation timer

On iPhone/iPad, tap a dotted-underlined opening duration on Overview or Why, adjust 1–180 whole minutes and choose Start iPhone timer. Install the reusable Shortcut once before first use. The handoff closes the sheet and starts Apple's Clock timer through Shortcuts. Clock owns the alarm/cancellation; the app has no countdown and cannot confirm success.

[Timer instructions](guides/ventilation-timer.md) cover installation, audible alarms, duration meanings and recovery. [Install Ventilation Timer](timer-shortcut.html) provides the direct installation link.

## Camera readings

Open Indoor readings and choose the camera icon. Capture a sharp view of the monitor, review both values against the photo, correct uncertain fields and choose Confirm readings. Values stay provisional until confirmation.

[Camera instructions](guides/camera.md) explain zoom, frame/still capture, lighting, editable boxes, retaking and permission recovery.

## Voice input

Enable Show voice button in Settings if needed. In a supported browser, choose the microphone icon and say “21 degrees Celsius, 55 percent” or “21 and 55”. Stop recording, review the latest values and choose Apply. Return to manual to discard the draft.

On iPhone, the microphone stream remains retained while the app is foregrounded, including after Stop, Apply or sheet close; its indicator may remain visible. Backgrounding releases it, but retry recovery remains unresolved. See [voice instructions](guides/voice.md) for availability, examples and limitations.

## Data and offline use

Indoor readings, ventilation settings, display preferences and saved locations are stored in your browser. Outdoor weather and forecast data come from Open-Meteo, with forecast times shown in the location's time zone. When device location is used, coordinates are sent to BigDataCloud to obtain a nearby locality name.

The app interface is cached for offline loading. Fresh outdoor weather and location lookup still need a connection.

Photos are analysed locally; browser speech recognition may use an external service. No meter audio file is saved or uploaded by the app. [Voice details](guides/voice.md) explains that distinction. If storage is blocked, some choices remain effective only for the current page session.

## Rain on the outdoor outlook

Rain bars and hatched rain periods are advisory and do not change the drying verdict. Chart key separates Lines from Bars & markers. The 24-hour view adds known rain-spell totals; incomplete or clipped periods are marked. Read [rain and wind details](explanation/moisture-and-estimates.md#rain-on-the-outdoor-outlook).

Why's Weather data lists provider, location and last successful update, with separate pending/failure messages. Glossary defines the abbreviations; How estimates work gives limitations. These three disclosures open independently. Chart key and Why this recommendation? have permanent headings, with More detail expandable inside the latter.
