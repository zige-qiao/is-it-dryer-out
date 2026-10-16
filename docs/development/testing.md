# Testing and verification

**Audience:** Maintainers

**Status:** Current main reference for v0.7.11

**Owns:** Runnable checks, fixtures and the limits of automated/device evidence

**Reviewed:** 16 October 2026

[Documentation index](../index.md) · [User guide](../user-guide.md)

## Contents

- [Node checks](#node-checks)
- [Browser and offline checks](#browser-and-offline-checks)
- [Page spacing regression](#page-spacing-regression)
- [Fixtures and private evidence](#fixtures-and-private-evidence)
- [Verification still outstanding](#verification-still-outstanding)
- [Acceptance checklist for implementation](#acceptance-checklist-for-implementation)
- [Phone previews](#phone-previews)
- [Proportionate verification](#proportionate-verification)

Choose checks in proportion to the change. Keep automated results, desktop emulation and user-confirmed physical observations distinct. Missing hardware verification is not an instruction to change production behaviour.

## Node checks

Use Node.js 24 or later; CommonJS test files use its native `require()` support for synchronous ES modules.

```sh
node --check app.js
node --check service-worker.js
node --test tests/*.test.cjs
```

`npm test` is an optional shorthand. Where test-worker creation is restricted, run `node --test --test-isolation=none tests/*.test.cjs`. No package installation or lockfile is needed.

For documentation changes, run `npm run docs:check`. The check is offline and dependency-free; [documentation maintenance](../documentation.md#update-and-verify) owns its scope and compatibility rules. The normal Node suite also checks the repository's documentation contract. Regression tests for the checker run with `node --test --test-isolation=none tests/docs-check.test.cjs`.

Tests import the production functions and controller factories rather than extracting function source. Shared browser fakes live under `tests/helpers/`. The standalone diagnostic still runs its entire script in a VM sandbox. Calculation fixtures preserve outputs captured from the pre-refactor implementation; do not regenerate them just to make a changed formula pass.

## Browser and offline checks

With Playwright available on `NODE_PATH`, run `node tests/dark-mode.browser.cjs http://127.0.0.1:8776/` against an independent local preview. It uses isolated profiles, mocked weather, blocked service workers and screenshots under ignored `work/page-layout/dark-mode/`. The acceptance checks cover delayed-module first paint, system/override changes and foreground recovery, saved choice/Reset independence, native keyboard radios, rendered light/dark surfaces and contrast, exact theme-specific verdict gradients from [Foundations](../design/foundations.md#a-recommendation-and-integrated-chart-surface), including the 16% Dark base palette and additional 5% first-stop reduction in both themes, with unchanged chart colours, all four verdict backgrounds at mobile/desktop widths and 100%/200% text, plus initial loading and both-range loading/failure/recovery with exact neutral gradients, narrow placeholder bars, secondary-line alignment, preserved chart height, reduced motion and forced colours, all sheets, and mocked media presentation. Service-worker-enabled offline loading is a separate integration check. Emulated browsers cannot establish iPhone Safari/Home Screen chrome, keyboard behaviour or actual media capture.

Run `node tests/theme-offline.browser.cjs http://127.0.0.1:8776/` for the separate service-worker-enabled check. It installs and activates the cache in an isolated context, selects Dark, reloads offline, and verifies the saved choice, cached stylesheet and theme module without browser runtime errors. It does not establish installed iPhone launch-screen behaviour.

The cache tests verify local imports, cycles, module loading without browser side effects, complete precaching, root/subdirectory paths, offline resource failures and activation cleanup. Also smoke-test the actual browser: initial Indoor sheet, chart inspection/range switch, location recovery, preferences, refresh and dialogs at mobile and desktop widths. Mocked media tests cannot establish real iPhone audio capture or microphone-indicator behaviour; use the [voice investigation](../voice/VOICE-INVESTIGATION.md) for device verification.

Run `node tests/glass-sheets.browser.cjs http://127.0.0.1:8776/` for glass-sheet geometry and material checks at 320, 390, 640 and 1280px in both themes and 100%/200% text. It verifies continuous header/body glass before overlap, header-cover activation when content crosses the 16px gap, restoration on return, header/footer overlap, undoubled tint, absent fades, last-control focus clearance, native-scrollbar independence, opaque fallback and forced colours. Screenshots and a report-only sampled contrast review go under ignored `work/glass-sheets/`. Contrast findings require review and, under the current user requirement, approval before additional text styling changes; passing geometry does not establish passing readability. `tests/sheet-headers.browser.cjs` adds camera/voice presentation and simulated keyboard/safe-area checks; emulation is not physical iPhone verification.

## Page spacing regression

With Playwright available, run `node tests/page-spacing.browser.cjs http://127.0.0.1:8780/` against an independent local preview. The browser check uses an isolated profile and mocked weather to measure all 384 valid configurations: 6 optional-section orders × 8 visibility combinations × 4 widths (320, 390, 768 and 1280px) × 2 text sizes (100% and 200%), with Recommendation always shown and pinned first. It also checks content/weather states, integrated Recommendation geometry, and settled touch refresh/cancellation, and saves representative screenshots under ignored `work/page-layout/spacing/`.

## Fixtures and private evidence

Copy the supplied monitor photo locally to tests/fixtures/camera-monitor.jpg (ignored), then open tests/camera-recognition.html on the local server: expect 22.3°C/59%, excluding records, and no values/regions on blank input.

Private capture media and annotations stay under ignored work paths. Read [camera evidence](../history/camera-device-evidence.md) only for the relevant device/fixture question; fixture success is not proof of physical capture or complete angle/distance coverage.

## Verification still outstanding

The existence of a rule is not proof of its implementation. Before calling the system complete, verify real iOS keyboard behaviour, zoom/reflow, forced colours, reduced motion, screen-reader announcements, every semantic background/line pairing, and loading/error/empty/disabled states. Formal contrast checks across all four gradients remain an explicit verification task.

## Acceptance checklist for implementation

- [ ] 320, 390, 640 and 1280px widths; 200% text/zoom; no clipped labels or horizontal scrolling.
- [ ] Whole sheet reachable with mobile keyboard open; Header tick/X reachable; focus returns and page scroll is restored.
- [ ] Every family shows rest, hover, pressed, keyboard focus, disabled, selected where applicable, and loading/error where applicable.
- [ ] Hover never erases selection; press never shifts geometry; hidden radios have visible keyboard focus on their label tiles.
- [ ] Normal text contrast checked at actual surfaces; essential borders/markers checked; pale decorative borders never serve as the only necessary cue.
- [ ] All actions have a minimum 44px target or a documented exception; no overlapping targets.
- [ ] Ruler drag, keyboard, typed values, limits, labels and cancellation checked in both sheets.
- [ ] Presets and custom panels checked in every combination; values survive switching, close/reopen and reload.
- [ ] Dashboard loading, failure, retry, all verdicts and 24/48h states checked without presenting stale data as current.
- [ ] Location idle/search/results/empty/error/retry and recent-removal checked.
- [ ] Voice Ready/Listening/review/error/unavailable checked on supported devices without changing lifecycle policy.
- [ ] Reduced motion, forced colours, screen-reader names and radio/disclosure semantics checked.
- [ ] Relevant JavaScript tests and syntax checks pass if logic changes; visual checks for styling-only changes.
- [ ] Documentation and specimens match the approved implementation before any requested release.

## Phone previews

When providing a UI preview, always include a clickable link the user can open on their iPhone. Discover the current LAN address and verify the preview server is reachable on it; say when the phone must share the computer's Wi-Fi and the computer must remain running. Serve local previews with Cache-Control: no-store and a fresh asset URL when replacing an older cached preview; verify the browser loaded the current stylesheet. Prefer an existing HTTPS preview when available. Do not present a localhost-only link as the phone preview.

## Proportionate verification

For microphone diagnostics, use the [voice investigation](../voice/VOICE-INVESTIGATION.md). A live track or completed JavaScript cleanup does not prove usable audio or that the device's microphone indicator has cleared.

Verify in proportion to the change while iterating:

- For copy changes, inspect the affected rendered state.
- For layout or styling changes, inspect the affected viewport and include narrow mobile and wide desktop when responsive behaviour could change.
- For JavaScript changes, syntax-check the entry point and changed modules, then run the relevant imported-module tests with Node.js 24 or later. For structural changes, run `node --test tests/*.test.cjs`, or add `--test-isolation=none` when test-worker creation is restricted.
- Check `service-worker.js` only when its code or cache references change.
- Measure rendered gaps, dimensions, clipping, or overflow when those properties are affected or under investigation.
- Restore test-only UI states before finishing when appropriate.

Before a GitHub push, run the complete relevant regression pass and `git diff --check` once.

Do not claim visual verification if the live page was unavailable or stale.
