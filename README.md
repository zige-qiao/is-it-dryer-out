# Is it dryer out

A personal ventilation checker that estimates whether opening your windows will reduce indoor humidity, and for roughly how long.

**[Open the app](https://zige-qiao.github.io/is-it-dryer-out/)**

It compares the amount of moisture indoors and outdoors, then uses the weather forecast and your room settings to suggest when ventilation could help.

## Get started

1. **Enter your indoor readings.** Add temperature and relative humidity from your room sensor. You can type, adjust the rulers, scan a new photo with the camera button, or use the microphone button in supported browsers. Review photo results before confirming.
2. **Choose your location.** Search for a town or UK postcode, or use your device's location.
3. **Read the recommendation.** Check the suggested opening time and the 24- or 48-hour outlook.
4. **Adjust your plan.** Set your target humidity, minimum temperature, room size and window opening using the ventilation summary below the chart.

## Basic actions

Switch between Overview and Why with the bottom tabs or a horizontal swipe. The thermometer button opens Indoor readings from either page.

Open Settings from the Why footer to show, hide or reorder Overview sections and adjust Indoor reading options. Changes save immediately.

On iPhone/iPad, tap an eligible opening duration to open the timer. See the [user guide's timer section](docs/user-guide.md#ventilation-timer) for Shortcut setup and full instructions.

## Recent changes

- [Unreleased](CHANGELOG.md#unreleased): more reliable location startup and voice review, explanatory feedback for rejected manual entries, and a taller weather-refresh target with its compact width retained.

- [v0.7.9](CHANGELOG.md#v079---settings-chart-and-ventilation-refinements---2026-10-12) refines Settings and Chart key, adds persistent Indoor access and Why timers, and improves sheet and voice controls. Refresh app matches the light Settings control; Chart key uses shorter rain and wind labels.

- [v0.7.8](CHANGELOG.md#v078---pill-tabs-and-frosted-sheet-headers---2026-10-10) adds Overview/Why pill tabs, swipe navigation, Settings in Why's footer, saved Chart key layout preferences and sheet-coloured headers with a graduated blur fade confined to content within each sheet.

- [v0.7.7](CHANGELOG.md#v077---page-layout-and-sheet-refinements---2026-10-09): pinned Recommendation, saved optional layouts, plain-language explanations, advisory rain/wind chart details, clearer supporting sections, stationary sheet headers and actions, safer touch gestures and deliberate Settings reordering. Diagnostic tools now live in `diagnostics/`; old page links still work.

- [v0.7.6](CHANGELOG.md#v076---drying-guidance-and-reliability---2026-10-07): recognise moisture removal when cooling masks the RH drop, show the next suitable opening time for KEEP CLOSED, shorten supporting verdict copy, expand minimum temperature to 8–28°C and target humidity to 35–65%, improve camera-loading cancellation and retries, and handle blocked storage and stalled weather requests.

- [v0.7.5](CHANGELOG.md): on-device camera readings, frame/still capture, zoom presets, grouped Settings and stronger safeguards against historical LCD readings. See the [release notes](CHANGELOG.md).

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
- [User guide](docs/user-guide.md)
- [Design system](docs/design-system.md)
- [Voice investigation](docs/voice/VOICE-INVESTIGATION.md)
- [Changelog](CHANGELOG.md)

Created by Ziggy Qiao
