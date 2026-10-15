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

Open Settings from the Why footer to show, hide or reorder Overview sections, adjust Indoor reading options, and choose System, Light or Dark appearance. System follows your device by default. Changes save immediately.

On iPhone/iPad, tap an eligible opening duration to open the timer. See the [user guide's timer section](docs/user-guide.md#ventilation-timer) for Shortcut setup and full instructions.

## Recent changes

- [Unreleased](CHANGELOG.md#unreleased): saved System, Light and Dark appearance, matching glass sheets with pinned actions, deeper Dark-mode verdict backgrounds, shorter fresh weather status, and documentation organised by task for people and agents.
- [v0.7.10](CHANGELOG.md#v0710---chart-and-input-reliability-refinements---2026-10-13): chart legend refinements, more reliable location startup and voice review, inline guidance for rejected values, and a taller compact weather-refresh target.

See the [full changelog](CHANGELOG.md) for all releases and detailed notes.

## Development and documentation

Built with HTML, CSS and native JavaScript modules. No build step or dependency installation is needed. With Node.js 24 or later, run:

```sh
node --test tests/*.test.cjs
npm run docs:check
```

- [User guide](docs/user-guide.md) — everyday actions and detailed help
- [Camera instructions](docs/guides/camera.md) — capture, review and confirm
- [Documentation index](docs/index.md) — tasks, ownership and evidence
- [Developer quick start](docs/development.md) — local serving, architecture and checks
- [Design system](docs/design-system.md)
- [Voice investigation](docs/voice/VOICE-INVESTIGATION.md)
- [Changelog](CHANGELOG.md)

Created by Ziggy Qiao
