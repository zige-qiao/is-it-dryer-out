# Maintain the documentation

**Audience:** Maintainers and agents

**Owns:** Document ownership, format, status, routing and compatibility

**Reviewed:** 16 October 2026

[Documentation index](index.md) · [Repository policy](../AGENTS.md)

## Choose the owner

Write an action or recovery procedure in the relevant user guide; a visible interaction contract in Design; an implementation mechanism in Development; calculations and limitations in Explanation; evidence or rejected experiments in History. The index owns the complete ownership map. The skill owns the maintenance workflow, not copies of component specifications.

Code establishes implemented behaviour; explicit user requirements and accepted constraints remain instructions. If they disagree, record the discrepancy. A changelog or an older experiment alone does not establish current behaviour. The visual board illustrates written rules and must not become an independent policy source.

## Status and dates

Topic references begin with audience, scope/ownership, status and review date. Use the implementation day's date for a fresh source review. Mark Unreleased changes and proposals locally, beside the affected guidance. Keep source-verified, emulated, fixture-tested and physically observed claims distinct.

Historical records retain original dates, labels, observations, quotations, errors, outcomes and uncertainty. Add a historical banner and a current-guidance link when moving them. Do not refresh upstream issue statuses or imply new device evidence merely because a record moves. Record approved design decisions with dates in [design history](history/design-review-and-decisions.md); do not append active rules below its revision log.

## Progressive disclosure

For people: give the answer, then the required steps, then advanced options, troubleshooting and evidence. Use contents links on long topic pages and descriptive link labels. Give a task a direct route from the user guide or index instead of another directory layer.

For agents: keep repository policy and the skill short, with explicit conditions for reading the relevant topic. Separate linked files reduce loaded context; collapsing text inside a long file only changes its visual presentation. Keep critical constraints in entry guidance, with detailed contracts in their owner. Do not require reading the whole archive before an ordinary edit.

## README format

Keep this order: title, concise purpose statement, prominent app link, brief explanation, Get started, Basic actions, Recent changes, Development and documentation, then author credit.

Get started covers the main user flow. Basic actions briefly covers Overview/Why, the Indoor button, the ventilation plan, Settings from Why's footer and the iPhone timer. Link to the user guide and topic guides for details. Recent changes has the latest documented release summary, followed by the full changelog link. Include one concise Unreleased summary only when the changelog contains pending changes; omit an empty or “No changes recorded” summary. Keep published history in the changelog. Retain brief development/test information and clear links to the user guide, documentation index and developer quick start.

## Update and verify

Follow explicit documentation requests immediately. Otherwise consolidate routine documentation during local iteration and reconcile it before a requested push. Update the canonical owner, check its audience summaries and related visual specimen, and add a notable change under Unreleased when appropriate. Do not rewrite historical release notes as current behaviour or record transient experiments as approved constraints.

Preserve uncommitted work, old paths, Markdown heading fragments, explicit HTML IDs and evidence-image paths. When a section moves, retain its old anchor with a descriptive link to the destination; collect these under Previous section links. Pointers should go directly to the relevant current reference or historical record, rather than through other pointers.

Run `npm run docs:check` before finishing documentation changes. It uses Node.js 24 or later without dependencies, network access, Git history or temporary migration records. It checks local Markdown links and HTML `href`/`src` targets, fragments, unique IDs, reading routes, topic labels, historical notices and the README section order and required links. External and application-scheme URLs are classified without opening them. Compatibility pointers retain their old paths but need no extra index link: entry points should link directly to their destinations.

The permanent [anchor record](../scripts/docs-anchors.json) protects the 413 heading destinations retained during the reorganisation. Keep these entries; if a section moves, leave its anchor and an onward link at the old path. Add newly established public heading links to the record when appropriate. Do not remove entries merely to make a failing check pass.

The checker handles ordinary Markdown headings, inline/reference links, images, HTML anchors and fenced code. It is a structural check, not a full Markdown renderer. Inspect affected rendered HTML and review these questions: did we update the correct owner, do its summaries still agree, and is historical evidence clearly separated from current guidance? Prose quality, actual implementation and physical-device claims require that review.

Do not change runtime code, cache versions, build identity or release tags for a documentation-only change. See [Testing](development/testing.md) for available checks and [Releases](development/releases.md) when release work is explicitly requested.
