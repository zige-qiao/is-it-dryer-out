# Is it dryer out

A personal ventilation checker that estimates whether opening your windows will reduce indoor humidity, and for roughly how long.

**[Open the app](https://zige-qiao.github.io/is-it-dryer-out/)**

It compares the amount of moisture indoors and outdoors, then uses the weather forecast and your room settings to suggest when ventilation could help.

## Get started

1. **Enter your indoor readings.** Add temperature and relative humidity from your room sensor. You can type, adjust the rulers, scan a new photo with the camera button, or use the microphone button in supported browsers. Review photo results before confirming.
2. **Choose your location.** Search for a town or UK postcode, or use your device's location.
3. **Read the recommendation.** Check the suggested opening time and the 24- or 48-hour outlook. Tap or drag the chart to inspect the forecast, with a separate Chart key accordion explaining the symbols. The 24-hour view has proportional ACH bars with numbers and wind arrows underneath; accessible inspection text includes rain details. Translucent white bars and blue hatched bands show forecast rain; it is advisory and does not change the drying recommendation.
4. **Adjust your plan.** Set your target humidity, minimum temperature, room size and window opening using the ventilation summary below the chart.

Use the refresh icon beside the location, or pull down from the top on a touch device, to update the outdoor weather. Downward pulls can start on controls, accordion headings or the chart without activating them; chart taps and horizontal drags still inspect. Open sheets and popups block pull-to-refresh. Settings has two groups: Page layout and Indoor readings. Recommendation is always shown and pinned first, including its chart and ventilation settings. Defaults below it are Indoor summary hidden, Moisture comparison shown and Supporting details shown. Show or hide these three boxes; on touch, briefly hold a dot handle before dragging, or tap for Move up/Move down text actions. Immediate swipes scroll the sheet. The dragged row follows your finger as neighbours reveal its destination; automatic scrolling only reveals clipped reorder rows. Mouse and pen dragging remain immediate. Reset beside Page layout restores this order and visibility without changing other preferences; saved relative order and visibility of the three optional boxes remain respected. The footer always remains available. Indoor readings groups launch, camera and voice visibility, still photos and Auto flash. Turning Show camera button off hides Still photos and Auto flash without changing their saved values; enabling it restores both options. Settings save immediately; Done closes the sheet. Camera entry defaults on, voice entry and still photos default off. The enabled summary has camera, optional microphone and pencil shortcuts.

## Ventilation timer

On iPhone/iPad, tap a time in either verdict line to open the timer sheet. Adjust the minutes with the ruler or typed entry, then choose Start iPhone timer. Each time retains its own meaning; the drier-air forecast window is not a recommended opening duration.

This uses one reusable Shortcut named **Ventilation Timer**, which starts the Clock timer. Open the help popup beside the timer title and choose Install Shortcut to [add the ready-made Shortcut](https://www.icloud.com/shortcuts/d16fde94799a414bb11a3a40c484f080) once; no Mac or manual action-building is needed. Starting a timer closes the sheet, then switches your iPhone to the Shortcuts app.

The user confirmed that the handoff works from Chrome, Safari and the Home Screen web app, and that the alarm worked in flight mode. The web app cannot confirm that a timer started or track its cancellation. Once started, Clock owns the alarm and works offline. See the [user guide](docs/user-guide.md#ventilation-timer) for usage and [timer development](docs/timer-development.md) for remaining test gaps.

## Recent changes

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
- [Design system](docs/design-system.md)
- [Voice investigation](docs/voice/VOICE-INVESTIGATION.md)
- [Changelog](CHANGELOG.md)

Created by Ziggy Qiao
