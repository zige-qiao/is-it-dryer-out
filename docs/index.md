# Documentation directory

Start with the task you want to complete. Short entry points give the immediate answer; linked references hold the detailed rules. Current guidance and historical evidence have separate roles, so a past experiment does not become an implementation instruction.

**Reviewed:** 14 October 2026. These references describe the current working tree. Appearance work is explicitly **Unreleased**; typography normalisation remains proposed. A review date is not proof of physical iPhone verification.

[Open the app](https://zige-qiao.github.io/is-it-dryer-out/) · [Project introduction](../README.md)

## Use the app

- [User quick start](user-guide.md): readings, location, recommendation and everyday actions.
- [Readings and settings](guides/readings-and-settings.md): manual input, ventilation plan, layout, appearance and keyboard alternatives.
- [Camera readings](guides/camera.md): capture, review and confirm; optional controls and recovery.
- [Voice readings](guides/voice.md): examples, recording, review and microphone limitations.
- [iPhone ventilation timer](guides/ventilation-timer.md): install the Shortcut once and hand off to Clock.
- [Moisture and estimates](explanation/moisture-and-estimates.md): interpretation, assumptions, uncertainty and limitations.

## Change the app

Agents begin with [repository policy](../AGENTS.md) and [the maintenance skill](../.agents/skills/is-it-dryer-out-ui/SKILL.md), then select the relevant route below. People can open the same references directly. Only read historical evidence when the task needs it.

| Task | Current references |
|---|---|
| Colours/appearance | [Foundations](design/foundations.md); [interface](development/interface.md) when logic changes |
| Page layout/navigation/reordering | [Layout/navigation](design/layout-navigation.md); [interface](development/interface.md) for controllers |
| Sheets/rulers/focus | [Sheets/controls](design/sheets-controls.md) and affected component |
| Verdict/chart/explanation | [Recommendation/chart](design/recommendation-chart.md); [model](explanation/moisture-and-estimates.md) for calculations/assumptions |
| Camera capture | [Readings/media](design/readings-media.md) and [camera implementation](development/camera.md) |
| Camera recognition | [Recognition](development/camera-recognition.md), [testing](development/testing.md) and relevant [camera evidence](history/camera-device-evidence.md) |
| Voice lifecycle | [Voice implementation/policy](development/voice.md) and [current investigation](voice/VOICE-INVESTIGATION.md) |
| User-facing documentation | [Documentation maintenance](documentation.md) and relevant user guide |
| Requested release/cache work | [Releases](development/releases.md) and [testing](development/testing.md) |

[Development quick start](development.md) explains serving, source ownership and architecture. [Design overview](design-system.md) links the written contracts and [visual specimens](design-system.html).

## Ownership

| Area | Owns |
|---|---|
| Repository policy | Working policy, essential constraints and agent routes |
| Repository skill | Maintenance workflow and conditional verification |
| User guides | Actions, steps, recovery and practical limitations |
| Design | Intended visible behaviour, tokens and interaction contracts |
| Development | Implementation boundaries, lifecycles, algorithms and operational procedures |
| Explanation | Moisture/forecast interpretation, assumptions and uncertainty |
| Current investigation | Known voice issue, accepted mitigation and unresolved questions |
| History | Dated observations, decisions, experiments and superseded proposals |
| Visual board | Illustrations of written contracts, not an independent rule source |
| [Changelog](../CHANGELOG.md) | Release history and notable Unreleased changes |

## Evidence and history

- [Design review and decisions](history/design-review-and-decisions.md): baseline audit and revision history.
- [Camera evidence](history/camera-device-evidence.md): fixture observations and physical-device gaps; private media remain ignored.
- [Timer evidence](history/timer-development.md): signing experiment, user-confirmed handoffs and outstanding checks.
- [Voice chronology](history/voice/VOICE-INVESTIGATION.md), [recovery research](history/voice/VOICE-RECOVERY-RESEARCH.md), [unsubmitted bug draft](history/voice/WEBKIT-VOICE-BUG-DRAFT.md) and [video analysis](history/voice/ios_web_speech_microphone_video_analysis.md).

Keep original evidence dates separate from document review dates. Code establishes current implementation; explicit user requirements and accepted constraints establish instructions. If they disagree, record the discrepancy and resolve the relevant question rather than changing unrelated behaviour.
