# Architecture and development

The app is static HTML, CSS and native JavaScript modules. It needs no dependency installation, framework or build step. Serve the repository root over HTTP; `file://` cannot load the module graph reliably. Deploy the root files **and `src/`** together, including when hosting under a repository subdirectory.

## Source layout

| Location | Responsibility |
| --- | --- |
| `app.js` | Initial state, DOM lookup, feature wiring, startup and page lifecycle |
| `src/config.js` | Defaults, endpoints, storage keys, calculation constants and diagnostic build identity |
| `src/domain/` | Humidity physics, forecast interpolation and ventilation estimates |
| `src/services/` | Browser storage, geocoding and weather requests |
| `src/ui/` | Formatters, recommendation/dashboard rendering, chart, controls, dialogs, location sheet, events and pull-to-refresh |
| `src/voice/` | Pure command parsing and recognition/microphone lifecycle controller |
| `src/camera/` | Camera lifecycle, review drafts, local pixel geometry, units, normalization and worker analysis |
| `vendor/tesseract/` | Pinned browser OCR runtime, embedded WebAssembly cores and English recognition data |
| `tests/` | Node tests, browser fakes and pre-refactor calculation fixtures |
| `docs/voice/` | Current investigation, historical research and supporting analysis |

Domain functions receive readings/settings explicitly and do not access the DOM or mutate app state. Controllers receive state, elements and callbacks through their factory arguments. The optional second argument supplies browser APIs for isolated tests; production uses `globalThis`. Request identifiers, timers and microphone sessions belong to their controller closures.

Cross-feature callbacks are wired in `app.js`, avoiding circular imports. Browser listeners and timers start only during explicit initialisation, not module import. The root stylesheet and public asset names remain unchanged. The standalone `voice-test.html` / `voice-test.js` diagnostic remains independent of production voice code and retains its historical build identity.

The dialog helpers own opener-focus snapshots and synchronous focus return. Sheet activation records whether the opener had visible keyboard focus; dismissal prepares its styling before native focus restoration, then consumes the saved return target so a queued close event cannot overwrite later keyboard interaction. Timer initialisation precedes shared event binding so Escape dismisses its open help popup before the sheet. Start completes dismissal and scroll cleanup synchronously before the Shortcut URL handoff.

## Run locally

Use an existing static HTTP server rooted at this directory. For example, if Python is installed:

```sh
python -m http.server 8766 --bind 127.0.0.1
```

Open `http://127.0.0.1:8766/`. The server must serve `.js` files with a JavaScript MIME type. Reload after source edits. Live weather and location search require a network connection.

## Verification

Use Node.js 24 or later; CommonJS test files use its native `require()` support for synchronous ES modules.

```sh
node --check app.js
node --check service-worker.js
node --test tests/*.test.cjs
```

`npm test` is an optional shorthand. Where test-worker creation is restricted, run `node --test --test-isolation=none tests/*.test.cjs`. No package installation or lockfile is needed.

Tests import the production functions and controller factories rather than extracting function source. Shared browser fakes live under `tests/helpers/`. The standalone diagnostic still runs its entire script in a VM sandbox. Calculation fixtures preserve outputs captured from the pre-refactor implementation; do not regenerate them just to make a changed formula pass.

The cache tests verify local imports, cycles, module loading without browser side effects, complete precaching, root/subdirectory paths, offline resource failures and activation cleanup. Also smoke-test the actual browser: initial Indoor sheet, chart inspection/range switch, location recovery, preferences, refresh and dialogs at mobile and desktop widths. Mocked media tests cannot establish real iPhone audio capture or microphone-indicator behaviour; use the [voice investigation](voice/VOICE-INVESTIGATION.md) for device verification.

## Offline cache and releases

Camera modules use the controller/environment-injection pattern. Capture preserves the complete visible frame, accounting for centred object-fit: cover. The crop editor draws unassigned boxes directly and supports pointer/touch movement, corner resizing and keyboard adjustments. Completed changes re-read only the affected region; taps/cancels preserve drafts. Unit symbols assign new boxes, with explicit assignment/discard fallback. The retake icon is excluded from crop pointer handling. Drafts never change app state before confirmation. saveIndoorReadings('photo') preserves the stored JSON shape and sets temporary source metadata.

recognition.js bounds input to 800 pixels and dispatches analysis.js through a local module worker, with a 15-second timeout. Cancellation terminates the worker and settles obsolete requests. A cooperative fallback yields between bounded stages where Worker is unavailable; worker errors leave manual entry available. geometry.js proposes raw stroke rotations within ±25°, supports shear only with consistent edge votes, and optionally rectifies LCD quadrilaterals. Screen edges are not mandatory. image.js supplies shared illumination/contrast normalization, components, and pixel crops. units.js checks degree/C and percent stroke geometry independently of seven-segment numeric evidence. Numeric decoding checks decimals, alignment and size, excluding contained partial 1 strokes and smaller historical groups. Returned regions, digit/unit bounds, independent heuristic confidence evidence and correction matrices map to the original photo. Previews reuse corrected analysis pixels. Scores are geometric checks, not calibrated probabilities. No recognition network request or model download occurs. The previously bundled vendor files and separate OCR cache remain compatible with earlier app versions, but are not used by this pipeline. Include every new module and worker in APP_FILES.

Copy the supplied monitor photo locally to tests/fixtures/camera-monitor.jpg (ignored), then open tests/camera-recognition.html on the local server: expect 22.3°C/59%, excluding records, and no values/regions on blank input. Private timestamped native video frames and annotations live only under ignored work/; never commit or deploy them. Public regressions generate synthetic rotation, perspective/black-case, uneven-light, unit and decimal fixtures. Cache tests cover the worker and its import graph offline. Mocked lifecycle/viewport checks do not measure an actual iPhone; phone acceptance must check responsiveness, camera/flash, keyboard, permission recovery, background cancellation and offline capture through HTTPS.

The phone test build is published at `/preview/camera-reading-recognition/` on the existing GitHub Pages site. `node scripts/publish-camera-preview.cjs origin/main HEAD` prepares a deployment commit without switching branches or pushing. It copies only runtime assets, isolates preview storage and cache names, identifies the source commit, and preserves all existing main app assets. A `.nojekyll` marker ensures the locally bundled OCR files are served. Review the resulting commit and push it to `main` only when publication is authorised; a concurrent main update requires fetching and rebuilding the deployment commit.

`service-worker.js` lists the entire production module graph in `APP_FILES`. Add new modules there when adding imports; the graph-coverage test catches omissions. Installation uses reload requests so stable module URLs cannot be filled from stale HTTP-cache entries. The worker uses network-first requests, falls back to the current app cache, and returns the cached HTML shell only for navigation requests. Missing scripts or API responses fail rather than receiving HTML.

When preparing a requested push affecting `index.html`, `styles.css`, `app.js`, or any module under `src/`, increment the cache revision once. Keep the stylesheet and entry-script query strings in `index.html`, their `APP_FILES` URLs, and `CACHE_NAME` synchronised. Imported modules use stable relative URLs and are refreshed in the newly named precache. Deploy all files together and check an already-installed app upgrades and reloads offline. The numeric cache revision is separate from the diagnostic release identity in `src/config.js`.

During local iteration, the cache revision stays unchanged. Use an online reload to read current modules; do not treat an older offline cache as verification of local changes. Run `git diff --check` before a requested push. A refactor does not itself authorise committing, pushing or releasing.
