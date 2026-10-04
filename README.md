# Is it dryer out

A personal ventilation checker that estimates whether opening your windows will reduce indoor humidity, and for roughly how long.

**[Open the app](https://zige-qiao.github.io/is-it-dryer-out/)**

It compares the amount of moisture indoors and outdoors, then uses the weather forecast and your room settings to suggest when ventilation could help.

## Get started

1. **Enter your indoor readings.** Add temperature and relative humidity from your room sensor. You can type, adjust the rulers, scan a new photo with the camera button, or use the microphone button in supported browsers. Review photo results before confirming.
2. **Choose your location.** Search for a town or UK postcode, or use your device's location.
3. **Read the recommendation.** Check the suggested opening time and the 24- or 48-hour outlook. Tap or drag the chart to inspect the forecast.
4. **Adjust your plan.** Set your target humidity, minimum temperature, room size and window opening using the ventilation summary below the chart.

Use the refresh icon beside the location, or pull down from the top on a touch device, to update the outdoor weather. The footer Settings button controls the optional Indoor summary and whether readings open on launch.

## A few things to know

Opening times are estimates: actual airflow depends on your room, windows and the weather. Small moisture differences may be too uncertain to justify opening.

The moisture cards and chart show actual absolute humidity. Their colours compare indoor and outdoor air at the same temperature, matching the ventilation estimate.

Readings and preferences are saved in your browser. The interface can load offline after caching, but fresh weather needs an internet connection.

Camera scanning reads the current top numbers on the supported segmented LCD monitor; it ignores low/high records. Camera images stay on-device and are discarded after review. Local OCR assets prepare on first use and support subsequent offline scanning. Camera access requires HTTPS (or localhost for development). See the [camera instructions](docs/user-guide.md#camera-readings) for correction and recovery.

On iPhone, voice input may keep the microphone indicator on while the app remains in the foreground. See the [user guide](docs/user-guide.md) for voice behaviour, data services and detailed instructions.

## Ventilation timer

On iPhone/iPad, tap a time in either verdict line to open the timer sheet. Adjust the minutes with the ruler or typed entry, then choose Start iPhone timer. Each time retains its own meaning; the drier-air forecast window is not a recommended opening duration.

This uses one reusable Shortcut named **Ventilation Timer**, which starts the Clock timer. Open the help popup beside the timer title and choose Install Shortcut to [add the ready-made Shortcut](https://www.icloud.com/shortcuts/d16fde94799a414bb11a3a40c484f080) once; no Mac or manual action-building is needed. Starting a timer closes the sheet, then switches your iPhone to the Shortcuts app.

The user confirmed that the handoff works from Chrome, Safari and the Home Screen web app, and that the alarm worked in airplane mode. The web app cannot confirm that a timer started or track its cancellation. Once started, Clock owns the alarm and works offline. See the [user guide](docs/user-guide.md#ventilation-timer) for usage and [timer development](docs/timer-development.md) for remaining test gaps.

## Recent changes

- [v0.7.4](CHANGELOG.md#v074---ventilation-timer---2026-10-03): iPhone ventilation timers from verdict times, adjustable minutes and one reusable Shortcut.
- [v0.7.3.1](CHANGELOG.md): refined moisture estimates, forecast colours and pull-to-refresh feedback; reorganised the app into native modules.
- [v0.7.3](CHANGELOG.md): improved iPhone forecast-curve rendering and chart focus behaviour.

See the [full changelog](CHANGELOG.md) for all releases and detailed notes.

## Development and documentation

Built with HTML, CSS and native JavaScript modules. No build step or dependency installation is needed. With Node.js 24 or later, run:

```sh
node --test tests/*.test.cjs
```

- [Development guide](docs/development.md) — local serving, modules, tests and caching
- [Design system](docs/design-system.md)
- [Voice investigation](docs/voice/VOICE-INVESTIGATION.md)
- [Changelog](CHANGELOG.md)

Created by Ziggy Qiao.
