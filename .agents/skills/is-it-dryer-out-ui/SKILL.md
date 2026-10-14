---
name: is-it-dryer-out-ui
description: Maintain the Is it dryer out app's UI, copy, weather states, voice flow, documentation, and releases. Use only for this repository.
---

# Is It Dryer Out UI

Maintain the static vanilla HTML, CSS and JavaScript app as a calm decision tool: will opening windows reduce indoor moisture, and approximately how long should they stay open? Keep the recommendation clear, controls easy to adjust and technical explanation available without dominating the page. Do not imply precise measured airflow or a guarantee.

## Essential constraints

Follow [repository policy](../../../AGENTS.md). Use UK English, preserve uncommitted work and inspect the affected current code. Code establishes implemented behaviour; explicit requirements and accepted constraints remain instructions. Resolve discrepancies rather than implementing an obsolete document.

Recommendation stays visible and pinned first. Manual readings/settings save immediately; camera/voice values need review and confirmation or Apply. Do not present old weather results as current during refresh/failure. Preserve focus, keyboard alternatives, reduced motion, accessible names and distinct selected/pressed/focused states.

Voice presentation must preserve the accepted foreground-held iOS microphone policy. Stop waveform animation outside active attempts; release capture on hidden/pagehide and clean up invalid resources. Persistent indication is an accepted limited trade-off, and background-release recovery remains unresolved. Do not reintroduce release/reopen recovery without new device evidence. Read both voice references below before lifecycle changes.

Keep the existing static architecture, local persistence and data boundaries. Do not add a backend or transmit additional user data without a request. Keep private evidence under ignored work paths, outside commits/deployment. Ordinary edits do not request Git operations or a release.

## Inspect and choose a route

Read only the relevant files. For changes crossing feature boundaries, start with [architecture](../../../docs/development.md): the entry point wires callbacks, pure domain functions stay DOM-independent, and controllers keep resources private. Retain existing IDs, helpers and render patterns unless the request needs otherwise. Tests import modules/controllers directly; do not extract function source.

| Task | Required reference after this skill |
|---|---|
| Colours/appearance | [Foundations](../../../docs/design/foundations.md); [interface](../../../docs/development/interface.md) for logic |
| Layout/navigation/reordering | [Layout](../../../docs/design/layout-navigation.md); [interface](../../../docs/development/interface.md) for controllers |
| Sheets/rulers/focus | [Shared sheets/controls](../../../docs/design/sheets-controls.md) and affected component |
| Verdict/chart/explanation | [Recommendation/chart](../../../docs/design/recommendation-chart.md); [model](../../../docs/explanation/moisture-and-estimates.md) for assumptions/calculations |
| Camera capture | [Readings/media](../../../docs/design/readings-media.md) and [capture](../../../docs/development/camera.md) |
| Camera recognition | [Recognition](../../../docs/development/camera-recognition.md), [testing](../../../docs/development/testing.md), relevant [evidence](../../../docs/history/camera-device-evidence.md) |
| Voice lifecycle | [Voice policy](../../../docs/development/voice.md) and [current investigation](../../../docs/voice/VOICE-INVESTIGATION.md) |
| User-facing documentation | [Documentation maintenance](../../../docs/documentation.md) and relevant [user guide](../../../docs/user-guide.md) |
| Requested release/cache work | [Releases](../../../docs/development/releases.md) and [testing](../../../docs/development/testing.md) |

[The index](../../../docs/index.md) owns the complete map. Historical instructions are evidence, not current policy; read the specific experiment only when needed.

## Change and verify

Apply clearly requested, reversible edits directly. Discuss choices that are materially ambiguous or expand the request. Keep the change within the user's scope. Reuse the named design roles and affected component contracts; do not replace conditional verdict wording with a universal secondary sentence.

Verify in proportion to the change: inspect rendered copy; check narrow mobile and wide desktop when layout/responsiveness changes; syntax-check changed JavaScript and run relevant imported-module tests with Node.js 24 or later. Structural changes need the complete Node suite, with --test-isolation=none when workers are restricted. Cache checks apply when cache code/references change. See Testing for exact commands and fixture policy.

Measure rendered spacing/clipping when investigating it, restore test-only states, and do not claim visual verification from unavailable/stale previews. For a shared UI preview, read [phone-preview requirements](../../../docs/development/testing.md#phone-previews) and give a verified phone-openable link. Real camera/microphone behaviour requires device evidence; mocks and live track state cannot prove it.

## Reconcile documentation and requested publishing

Follow explicit documentation requests immediately. Otherwise consolidate routine updates during iteration and reconcile before a requested push. Update the canonical owner, its audience summary and relevant visual specimen. Add notable changes under Unreleased; retain dated evidence and numbered release history. Update this skill only when the workflow or a critical constraint changes.

Only perform explicitly requested Git operations. For a requested production push, follow Releases to synchronise the cache once and deploy the full module graph. Run the complete relevant regression pass and git diff --check before pushing. Use requested branch/version names exactly, never move a public tag without explicit confirmation, and distinguish pushing a feature branch from a full release.

<details>
<summary>Previous section links</summary>

These links preserve earlier bookmarks. Follow the named current reference or dated record.

<a id="product-intent"></a>
- [Product Intent](SKILL.md)

<a id="language-convention"></a>
- [Language convention](../../../AGENTS.md)

<a id="working-with-the-user"></a>
- [Working with the user](../../../AGENTS.md)

<a id="files-and-existing-work"></a>
- [Files And Existing Work](../../../AGENTS.md)

<a id="where-rules-belong"></a>
- [Where rules belong](../../../docs/documentation.md)

<a id="readme-format"></a>
- [README Format](../../../docs/documentation.md)

<a id="information-hierarchy"></a>
- [Information Hierarchy](../../../docs/design/layout-navigation.md)

<a id="responsive-controls"></a>
- [Responsive Controls](../../../docs/design/sheets-controls.md)

<a id="recommendation-language"></a>
- [Recommendation Language](../../../docs/design/recommendation-chart.md)

<a id="forecast-and-dashboard"></a>
- [Forecast And Dashboard](../../../docs/design/recommendation-chart.md)

<a id="supporting-details"></a>
- [Supporting Details](../../../docs/design/readings-media.md)

<a id="visual-conventions"></a>
- [Visual Conventions](../../../docs/design/foundations.md)

<a id="weather-and-persistence"></a>
- [Weather And Persistence](../../../docs/development/interface.md)

<a id="cache-updates"></a>
- [Cache Updates](../../../docs/development/releases.md)

<a id="verification"></a>
- [Verification](../../../docs/development/testing.md)

<a id="releases"></a>
- [Releases](../../../docs/development/releases.md)

</details>
