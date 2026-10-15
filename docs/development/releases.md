# Cache, deployment and releases

**Audience:** Maintainers performing requested release work

**Status:** Current main reference for v0.7.11

**Owns:** Offline import graph, cache revision, deployment and release operations

**Reviewed:** 16 October 2026

[Documentation index](../index.md) · [User guide](../user-guide.md)

## Contents

- [Requested production pushes](#requested-production-pushes)
- [Explicitly requested releases](#explicitly-requested-releases)
- [Recorded identity discrepancy](#recorded-identity-discrepancy)

A normal edit does not request Git operations or a release. Apply the cache and publishing steps below only when the user requests the corresponding operation. Do not repair unrelated version identifiers during documentation work.

`service-worker.js` lists the entire production module graph in `APP_FILES`. Add new modules there when adding imports; the graph-coverage test catches omissions. Installation uses reload requests so stable module URLs cannot be filled from stale HTTP-cache entries. The worker uses network-first requests, falls back to the current app cache, and returns the cached HTML shell only for navigation requests. Missing scripts or API responses fail rather than receiving HTML.

## Requested production pushes

When preparing a requested GitHub push that changes `index.html`, `styles.css`, `app.js` or a production module under `src/`, increment the numeric cache revision once and synchronise all three places:

- `styles.css?v=N` and `app.js?v=N` in `index.html`.
- The corresponding asset URLs in the service worker's `APP_FILES`.
- `CACHE_NAME` in `service-worker.js`.

This refreshes an installed app without creating a new revision for every local iteration. Imported modules keep stable relative URLs and refresh in the newly named precache. Keep every production module and worker in `APP_FILES`; graph-coverage tests catch missing imports. Deploy the root assets and full `src/` graph together. Missing scripts/API resources must fail rather than receive the cached HTML shell; navigation alone may use it.

Check an already-installed app upgrades and reloads offline. The numeric cache revision is separate from the diagnostic release identity in `src/config.js`. During local iteration, leave the revision unchanged, use an online reload and do not treat an older offline cache as verification. Run `git diff --check` before a requested push. A refactor does not itself authorise committing, pushing or releasing.

## Explicitly requested releases

When the user requests a release:

- For a user-specified version branch, use the exact requested branch name and make the app diagnostic build name match it; do not substitute the default `codex/` prefix.
- Update both `README.md` and `CHANGELOG.md` with claims supported by the actual diff.
- Use a patch version for refinements to an already published release; do not move an existing public tag without explicit confirmation.
- Perform only the requested Git operations. Pushing a feature branch does not imply merging, tagging, or publishing a release.
- When a full release is explicitly requested, merge into `main`, run final checks, create the requested annotated version tag, and push `main` and the tag.
- Confirm the working tree is clean and `main` tracks `origin/main` before reporting completion.

## Recorded identity discrepancy

At the 13 October 2026 documentation review, the working-tree `APP_BUILD_VERSION` in `src/config.js` is `v0.7.9` and the shell cache revision is `171`, while the README/changelog's latest documented release and a local tag are `v0.7.10`. This discrepancy is preserved; the documentation reorganisation changes no build/cache identity. Before a requested release, inspect the actual working-tree diff and tag history rather than mechanically copying a document's version label into the code.

The v0.7.11 preparation on 16 October 2026 resolves that historical discrepancy: main carries build identity `v0.7.11` and shell cache revision `175`, advancing the published v0.7.10 revision `174`. Appearance and continuous glass sheets are included in the merged module graph.
