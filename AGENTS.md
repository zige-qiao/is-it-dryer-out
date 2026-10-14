# Repository guidance

This repository is **Is it dryer out**, a static HTML, CSS and native JavaScript ventilation checker. Help someone decide whether opening windows will reduce indoor moisture and approximately how long to open them. Keep the recommendation clear and put technical explanations behind supporting detail.

## Working policy

- Use UK English in prose and visible copy. Preserve code/API identifiers, filenames, URLs, machine-readable fields and verbatim quotations. Audio level meters remain meters; lengths use metres.
- Preserve uncommitted work. Inspect the affected current code before editing; keep existing IDs, classes, helpers and feature boundaries unless the requested change needs otherwise.
- Code establishes implemented behaviour. Explicit user requirements and accepted constraints establish instructions. Report discrepancies instead of silently changing the product to make documentation agree.
- Apply clearly requested, reversible edits directly. Resolve material ambiguity or scope expansion with the user; do not add an approval step to routine work already authorised.
- A normal edit does not request a commit, branch, push, merge, tag or release. Perform those operations only when explicitly requested.
- Keep the static architecture and existing data boundaries. Saved readings/settings stay in browser storage; do not add a backend or transmit additional user data without a request. Private evidence stays under ignored `work/` and must not be committed or deployed.

## Essential product constraints

Recommendation is always visible and pinned first. Manual readings/settings save immediately; camera and voice drafts require review before confirmation or Apply.

On iOS, retain explicitly activated microphone capture throughout the foreground session; stop waveform animation outside active attempts and release capture on hidden/pagehide. Background-release recovery remains unresolved. Do not restore the rejected release/reopen strategy without new device evidence.

## Read by task

For app code, copy, behaviour, documentation or release work, load [the repository skill](.agents/skills/is-it-dryer-out-ui/SKILL.md), then only the references relevant to the task:

| Task | Read |
|---|---|
| Colours/appearance | [Foundations](docs/design/foundations.md); [interface](docs/development/interface.md) for logic |
| Layout/navigation/reordering | [Layout](docs/design/layout-navigation.md); [interface](docs/development/interface.md) for controllers |
| Sheets/rulers/focus | [Shared controls](docs/design/sheets-controls.md) and affected component |
| Verdict/chart/explanation | [Recommendation/chart](docs/design/recommendation-chart.md); [model](docs/explanation/moisture-and-estimates.md) for assumptions/calculations |
| Camera capture | [Presentation](docs/design/readings-media.md) and [capture](docs/development/camera.md) |
| Camera recognition | [Recognition](docs/development/camera-recognition.md), [testing](docs/development/testing.md), relevant [evidence](docs/history/camera-device-evidence.md) |
| Voice lifecycle | [Voice policy](docs/development/voice.md) and [current investigation](docs/voice/VOICE-INVESTIGATION.md) |
| Documentation | [Maintenance](docs/documentation.md) and relevant [user guidance](docs/user-guide.md) |
| Requested release/cache work | [Releases](docs/development/releases.md) and [testing](docs/development/testing.md) |

[Documentation index](docs/index.md) owns the complete map. For documentation changes, run `npm run docs:check` and review the affected owners and summaries before finishing. Historical instructions are evidence, not current policy; use them only for the relevant question. Do not read the entire archive by default.
