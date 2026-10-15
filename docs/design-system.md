# Is it dryer out — design system

**Audience:** Designers, maintainers and Codex agents

**Status:** Current working-tree reference; labelled Unreleased work and proposals are separate

**Reviewed:** 16 October 2026

This overview routes to the written contracts. The [visual review board](design-system.html) illustrates colour and component states; it does not define a second set of rules. Use [the documentation index](index.md) for user, implementation and historical references. Code establishes actual implemented behaviour; explicit requirements and accepted constraints remain instructions. Record mismatches rather than changing the product to match an old note.

## Product principles

Help someone decide whether opening windows reduces indoor moisture and approximately how long to open them. Keep the recommendation decisive, controls easy to adjust and technical explanations available without dominating the page. This is a planning tool, not a precise airflow measurement or guarantee.

Use UK English and named theme roles. Preserve independent selected, pressed, focused, disabled and loading states. Use labelled native controls, keyboard alternatives, restrained borders and no decorative shadows. Broader typography normalisation remains proposed; the documented local appearance work is Unreleased. Dark verdict backgrounds use the 16% lightness reduction in [Foundations](design/foundations.md#a-recommendation-and-integrated-chart-surface), preserving hue and foreground styling; Light backgrounds and loading/unavailable surfaces retain their existing colours.

## Current page hierarchy

Recommendation is always shown and pinned first, with the chart and ventilation summary integrated. Below it, default Overview options are Indoor summary hidden, Moisture comparison hidden and Chart key shown. Only these three optional boxes can be hidden/reordered; saved order and visibility are preserved.

Why owns the permanent recommendation explanation and its expandable More detail, followed by Glossary, How estimates work and Weather data. Settings, Refresh app and author/GitHub credit live in Why's footer. The separate Indoor thermometer button opens manual readings from either page. Indoor readings opens automatically on initial Overview launch by default; opening Why directly does not trigger it.

Manual changes save immediately. Camera and voice values remain drafts until confirmation or Apply. Shared sheets preserve focus, dismissal, visible header actions and native scrolling; the Unreleased glass treatment uses 95% tint in Light and 55% in Dark, with content passing behind pinned headers and existing footers. The foreground iOS microphone policy remains an accepted limited mitigation; presentation changes must not alter it.

## Read the relevant contract

| Topic | Reference |
|---|---|
| Appearance, palettes, typography, spacing and number/unit formatting | [Foundations](design/foundations.md) |
| Page hierarchy, navigation, reordering, gestures and section spacing | [Layout/navigation](design/layout-navigation.md) |
| Sheet geometry, focus, dismissal, rulers, validation and control states | [Sheets/controls](design/sheets-controls.md) |
| Verdict wording, forecast chart, loading/failure, rain/wind and supporting details | [Recommendation/chart](design/recommendation-chart.md) |
| Indoor, camera and voice entry, feedback, drafts and confirmation | [Readings/media](design/readings-media.md) |

Read only the affected contract; use [development](development.md) for controller and algorithm details and [the user guide](user-guide.md) for steps. Semantic chart colours, plan verdicts and current moisture comparisons remain independent even when their states differ.

## Status and verification

Appearance is implemented in the local working tree and remains Unreleased. Broader typography normalisation, suggested semantic token aliases and a shared token source for the standalone board remain proposals or maintenance follow-ups. Range feedback is implemented: rejected committed values restore the saved value with inline guidance; it is not an unfinished silent-reversion proposal.

[Testing and acceptance](development/testing.md) records the checks and remaining physical-device/accessibility gaps. A documented rule or passing mock does not prove physical iPhone keyboard, microphone, camera, screen-reader or semantic contrast behaviour. Historical captures show their original period, not the current interface.

[Design review and decisions](history/design-review-and-decisions.md) preserves the baseline audit, decision ledger and revision history. Keep new active contracts in their topic references rather than appending them after historical notes.

<details>
<summary>Previous section links</summary>

These links preserve earlier bookmarks. Follow the named current reference or dated record.

<a id="decision-ledger"></a>
- [Decision ledger](history/design-review-and-decisions.md)

<a id="1-purpose-and-principles"></a>
- [1. Purpose and principles](design-system.md)

<a id="ventilation-timer-v074"></a>
- [Ventilation timer (v0.7.4)](design/sheets-controls.md)

<a id="2-pre-implementation-review-evidence-and-findings"></a>
- [2. Pre-implementation review evidence and findings](history/design-review-and-decisions.md)

<a id="baseline-findings-and-proposed-resolutions"></a>
- [Baseline findings and proposed resolutions](history/design-review-and-decisions.md)

<a id="review-limits"></a>
- [Review limits](history/design-review-and-decisions.md)

<a id="3-colour-foundations--implemented"></a>
- [3. Colour foundations — implemented](design/foundations.md)

<a id="appearance--unreleased"></a>
- [Appearance — Unreleased](design/foundations.md)

<a id="light-neutral-role-tokens"></a>
- [Light neutral role tokens](design/foundations.md)

<a id="contrast-checks"></a>
- [Contrast checks](design/foundations.md)

<a id="semantic-colours--current-implementation"></a>
- [Semantic colours — current implementation](design/foundations.md)

<a id="a-recommendation-and-integrated-chart-surface"></a>
- [A. Recommendation and integrated chart surface](design/foundations.md)

<a id="b-outdoor-card-and-let-in-humidity"></a>
- [B. Outdoor card and “Let in” humidity](design/foundations.md)

<a id="c-chart-curve-and-supporting-layers"></a>
- [C. Chart curve and supporting layers](design/foundations.md)

<a id="d-loading-unavailable-data-and-feedback"></a>
- [D. Loading, unavailable data and feedback](design/foundations.md)

<a id="e-legacy-styles-not-active-system-components"></a>
- [E. Legacy styles, not active system components](design/foundations.md)

<a id="semantic-system-rules"></a>
- [Semantic system rules](design/foundations.md)

<a id="4-typography--proposed-normalisation"></a>
- [4. Typography — proposed normalisation](design/foundations.md)

<a id="5-geometry-layout-and-motion"></a>
- [5. Geometry, layout and motion](design/readings-media.md)

<a id="camera-readings"></a>
- [Camera readings](design/readings-media.md)

<a id="shared-scale"></a>
- [Shared scale](design/foundations.md)

<a id="two-view-navigation-experiment"></a>
- [Two-view navigation experiment](design/layout-navigation.md)

<a id="responsive-rules"></a>
- [Responsive rules](design/layout-navigation.md)

<a id="6-component-contracts-and-state-matrix"></a>
- [6. Component contracts and state matrix](design/sheets-controls.md)

<a id="state-rules"></a>
- [State rules](design/sheets-controls.md)

<a id="specific-behaviours"></a>
- [Specific behaviours](design-system.md)

<a id="7-data-and-content-states"></a>
- [7. Data and content states](design/recommendation-chart.md)

<a id="8-implementation-map-and-remaining-work"></a>
- [8. Implementation map and remaining work](history/design-review-and-decisions.md)

<a id="9-maintaining-the-system"></a>
- [9. Maintaining the system](documentation.md)

<a id="remaining-contracts-added-in-the-completeness-review"></a>
- [Remaining contracts added in the completeness review](design/foundations.md)

<a id="verification-still-outstanding"></a>
- [Verification still outstanding](development/testing.md)

<a id="10-acceptance-checklist-for-implementation"></a>
- [10. Acceptance checklist for implementation](development/testing.md)

<a id="manual-input-rejection-and-outdoor-refresh"></a>
- [Manual input rejection and outdoor refresh](design/sheets-controls.md)

<a id="revision-log"></a>
- [Revision log](history/design-review-and-decisions.md)

<a id="camera-capture-controls"></a>
- [Camera capture controls](design/readings-media.md)

<a id="conditional-verdict-copy"></a>
- [Conditional verdict copy](design/recommendation-chart.md)

<a id="advisory-rain-overlay"></a>
- [Advisory rain overlay](design/recommendation-chart.md)

<a id="voice-entry-presentation"></a>
- [Voice entry presentation](design/readings-media.md)

</details>
