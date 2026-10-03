# Is it dryer out

A personal ventilation checker that estimates whether opening your windows will reduce indoor humidity, and for roughly how long.

**[Open the app](https://zige-qiao.github.io/is-it-dryer-out/)**

It compares the amount of moisture indoors and outdoors, then uses the weather forecast and your room settings to suggest when ventilation could help.

## Get started

1. **Enter your indoor readings.** Add temperature and relative humidity from your room sensor. You can type, adjust the rulers, or use voice input in supported browsers.
2. **Choose your location.** Search for a town or UK postcode, or use your device's location.
3. **Read the recommendation.** Check the suggested opening time and the 24- or 48-hour outlook. Tap or drag the chart to inspect the forecast.
4. **Adjust your plan.** Set your target humidity, minimum temperature, room size and window opening using the ventilation summary below the chart.

Use the refresh icon beside the location, or pull down from the top on a touch device, to update the outdoor weather. The footer Settings button controls the optional Indoor summary and whether readings open on launch.

## A few things to know

Opening times are estimates: actual airflow depends on your room, windows and the weather. Small moisture differences may be too uncertain to justify opening.

The moisture cards and chart show actual absolute humidity. Their colours compare indoor and outdoor air at the same temperature, matching the ventilation estimate.

Readings and preferences are saved in your browser. The interface can load offline after caching, but fresh weather needs an internet connection.

On iPhone, voice input may keep the microphone indicator on while the app remains in the foreground. See the [user guide](docs/user-guide.md) for voice behaviour, data services and detailed instructions.

## Development and documentation

### Ventilation timer (local development)

On iPhone/iPad, tap a time in either verdict line to open the timer sheet. Adjust the minutes with the ruler or typed entry, then choose Start iPhone timer. Each time retains its own meaning; the drier-air forecast window is not a recommended opening duration.

This uses one reusable Shortcut named **Ventilation Timer**, which starts the Clock timer. An automated installer build is prepared; signing, the install link, and real-device verification are pending. See [timer development](docs/timer-development.md). Users will add the ready-made Shortcut once rather than build its actions. The web app cannot confirm that a timer started or track its cancellation. Once started, Clock owns the alarm and works offline.

Built with HTML, CSS and native JavaScript modules. No build step or dependency installation is needed. With Node.js 24 or later, run:

```sh
node --test tests/*.test.cjs
```

- [Development guide](docs/development.md) — local serving, modules, tests and caching
- [Design system](docs/design-system.md)
- [Voice investigation](docs/voice/VOICE-INVESTIGATION.md)
- [Changelog](CHANGELOG.md)

Created by Ziggy Qiao.
