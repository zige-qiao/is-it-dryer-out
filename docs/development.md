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
| `tests/` | Node tests, browser fakes and pre-refactor calculation fixtures |
| `docs/voice/` | Current investigation, historical research and supporting analysis |

Domain functions receive readings/settings explicitly and do not access the DOM or mutate app state. Controllers receive state, elements and callbacks through their factory arguments. The optional second argument supplies browser APIs for isolated tests; production uses `globalThis`. Request identifiers, timers and microphone sessions belong to their controller closures.

Cross-feature callbacks are wired in `app.js`, avoiding circular imports. Browser listeners and timers start only during explicit initialisation, not module import. The root stylesheet and public asset names remain unchanged. The standalone `voice-test.html` / `voice-test.js` diagnostic remains independent of production voice code and retains its historical build identity.

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

`service-worker.js` lists the entire production module graph in `APP_FILES`. Add new modules there when adding imports; the graph-coverage test catches omissions. Installation uses reload requests so stable module URLs cannot be filled from stale HTTP-cache entries. The worker uses network-first requests, falls back to the current app cache, and returns the cached HTML shell only for navigation requests. Missing scripts or API responses fail rather than receiving HTML.

When preparing a requested push affecting `index.html`, `styles.css`, `app.js`, or any module under `src/`, increment the cache revision once. Keep the stylesheet and entry-script query strings in `index.html`, their `APP_FILES` URLs, and `CACHE_NAME` synchronised. Imported modules use stable relative URLs and are refreshed in the newly named precache. Deploy all files together and check an already-installed app upgrades and reloads offline. The numeric cache revision is separate from the diagnostic release identity in `src/config.js`.

During local iteration, the cache revision stays unchanged. Use an online reload to read current modules; do not treat an older offline cache as verification of local changes. Run `git diff --check` before a requested push. A refactor does not itself authorise committing, pushing or releasing.
