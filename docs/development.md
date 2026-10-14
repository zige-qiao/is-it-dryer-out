# Architecture and development

**Audience:** Maintainers and Codex agents

**Status:** Current working-tree architecture and local setup

**Reviewed:** 14 October 2026

The app is static HTML, CSS and native JavaScript modules. It needs no framework, build step or dependency installation for ordinary use and Node tests. Serve the repository root over HTTP: `file://` cannot load the module graph reliably. Deploy the root files and `src/` together, including when hosting under a repository subdirectory.

[Documentation index](index.md) · [Design contracts](design-system.md) · [User guide](user-guide.md)

## Run locally

Use an existing static server rooted at this repository. For example, with Python:

```sh
python -m http.server 8766 --bind 127.0.0.1
```

Open [the local app](http://127.0.0.1:8766/). Serve `.js` files with a JavaScript MIME type. Live weather and location lookup need a network connection. This localhost address is a desktop development address; a shared phone preview needs a verified reachable URL and the preview requirements in [Testing](development/testing.md#phone-previews).

## Source layout

| Location | Responsibility |
| --- | --- |
| `app.js` | Initial state, DOM lookup, feature wiring, startup and page lifecycle |
| `src/config.js` | Defaults, endpoints, storage keys, calculation constants and diagnostic build identity |
| `src/domain/` | Humidity physics, forecast interpolation and ventilation estimates |
| `src/services/` | Browser storage, geocoding and weather requests |
| `src/ui/` | Formatters, recommendation/dashboard rendering, chart, controls, dialogs, location sheet, events and pull-to-refresh |
| `src/voice/` | Pure command parsing and recognition/microphone lifecycle controller |
| `src/camera/` | Camera lifecycle, review drafts, local pixel geometry, units, normalisation and worker analysis |
| `tests/` | Node tests, browser fakes and pre-refactor calculation fixtures |
| `diagnostics/` | Standalone Voice and Camera flash tools; independent of production code |
| `docs/` | Design system, user guide and development records |
| `work/` | Ignored local previews, logs and private evidence; not deployed |
| `docs/voice/` | Current investigation, historical research and supporting analysis |

## Architecture boundaries

`app.js` owns initial state, DOM lookup, startup and feature wiring. Domain functions receive readings/settings explicitly and do not access the DOM or mutate app state. Controllers receive state, elements and callbacks through factories; their optional environment argument supplies browser APIs for isolated tests, defaulting to `globalThis` in production.

Keep request IDs, timers, sessions and resources private to their controller. Wire cross-feature callbacks through the entry point to avoid circular imports. Browser listeners and timers start during explicit initialisation, not module import. Tests import modules/controllers directly; do not extract function source. Input-driven rendering coalesces into one animation frame.

The camera graph loads lazily on first activation, while its production modules remain precached. The root keeps production entry files, metadata and compatibility pointers. Root diagnostic HTML redirects to `diagnostics/` while preserving queries/fragments and providing no-JavaScript fallback links; deploy diagnostics when access is needed. Private evidence stays under ignored `work/` and is not deployed.

## Verification

Use Node.js 24 or later; tests rely on its synchronous CommonJS loading of ES modules:

```sh
node --test tests/*.test.cjs
```

Where worker creation is restricted, use `node --test --test-isolation=none tests/*.test.cjs`. Browser checks need optional available Playwright; no package installation or lockfile is required by the app. See [Testing](development/testing.md) for syntax checks, browser commands, fixtures and evidence limits.

## Specialist references

| Work | Read |
|---|---|
| Appearance, startup, preferences, navigation, gestures and focus | [Interface implementation](development/interface.md) |
| Camera permissions, capture, zoom, lighting and diagnostics | [Camera capture](development/camera.md) |
| Recognition worker, budgets, geometry, units and field validation | [Camera recognition](development/camera-recognition.md) |
| Voice parsing, review and microphone lifecycle | [Voice implementation](development/voice.md) and [current investigation](voice/VOICE-INVESTIGATION.md) |
| Verification and fixture methodology | [Testing](development/testing.md) |
| Requested cache, deployment or release work | [Releases](development/releases.md) |

Read only references relevant to the change. Design owns visible interaction contracts; implementation references own mechanisms. Historical timer/camera/voice records preserve observations and rejected approaches without replacing current policy. Code establishes actual behaviour; explicit requirements and accepted constraints remain instructions.

<details>
<summary>Previous section links</summary>

These links preserve earlier bookmarks. Follow the named current reference or dated record.

<a id="appearance"></a>
- [Appearance](development/interface.md)

<a id="location-and-reading-recovery"></a>
- [Location and reading recovery](development/interface.md)

<a id="view-navigation"></a>
- [View navigation](development/interface.md)

<a id="offline-cache-and-releases"></a>
- [Offline cache and releases](development/releases.md)

<a id="page-spacing-regression"></a>
- [Page spacing regression](development/testing.md)

</details>
