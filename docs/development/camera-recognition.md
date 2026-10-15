# Camera recognition

**Audience:** Recognition maintainers

**Status:** Current main reference for v0.7.11

**Owns:** Worker budgets, source geometry, field validation, ambiguity and fixture methodology

**Reviewed:** 16 October 2026

[Documentation index](../index.md) · [User guide](../user-guide.md)

## Contents

- [Practical recognition limitations](#practical-recognition-limitations)

Keep unreadable or conflicting fields unresolved. Validated fields, original source coordinates and cancellation ownership must survive every refinement stage. Fixture success does not prove physical capture or complete angle/distance coverage; see [camera evidence](../history/camera-device-evidence.md).

`current-row.js` establishes aligned integer-cell scale from raw greyscale strokes before accepting any decoded value or unit. `row-context.js` preserves that rectified LCD frame through overview, original-resolution crops, corrections, worker progress and merging. Every integer cell must meet 80% of the established main height and overlap the current row by at least 50% of its own height. Fractions use separate full-cell validation. Manual selections retain whole-display context while limiting assignment to the selected digits. A later larger reference withdraws smaller provisional candidates; unreadable main digits do not authorize historical replacements. Relative measurements remain local to one LCD, including supported perspective transforms.

recognition.js sends an overview capped at 800 pixels to one local worker, prepares raw display/colour/stroke geometry before numeric decoding and reuses at most four distinct orientation/correction hypotheses, including identity, then crops those areas from the retained original before resizing or normalising. Manual boxes use the containing LCD from the retained original for row/scale context, while restricting numerical assignment to the original selection. Each worker image stays at most 800 pixels; small regional images may be interpolated up to 4× for consistent stroke analysis, without claiming recovered detail. Preparation, extraction, correction and regional refinement share one cancellable request and the ten-second overall recognition deadline.

Stage IDs isolate late replies; synchronous pixel loops check the budget and cooperative fallback yields between stages. Capture and photo decoding precede this budget. Regional matrices and bounds map back to the original photo; previews come from the chosen regional correction. Each correction compares shared adaptive, display-local dark-foreground, gentle and denoised variants, stopping once the requested fields are validated after at least two variants. Greyscale segment validation uses median evidence and contrast relative to the digit cell; narrow ones exclude neighbouring glyphs. Complete digit groups reject skipped full-height strokes, even when those strokes did not pass greyscale validation.

Display proposals use minimal padding to exclude bezel fragments. evidence.js combines greyscale-validated glyphs only at matching coordinates, analyses small fractions independently, checks decimal points and can assign temperature beside validated humidity on the same continuous display without requiring °C. Visible °F rejects this assignment. Field validation, rather than raw detection, controls early completion. Native large crops are checked before enlargement, and humidity anchors the first regional search for missing temperature. Connected component pixels exclude unrelated speckles, and unit masking removes only symbol pixels.

Full fractional cells retain pre-unit evidence and check mapped original greyscale for coherent contradictory strokes, preventing a surviving stroke from becoming 1 or an 8 losing its middle bar and becoming 0. Conflicting comparable values remain unresolved and smaller historical results are filtered after mapping. Cancellation terminates the worker and settles obsolete requests. A cooperative fallback yields between bounded stages where Worker is unavailable; worker errors leave manual entry available. orientation.js ranks raw LCD and stroke axes before any number decoding, including cardinal and diagonal orientations.

Exact cardinal transforms permute pixels without interpolation; supported diagonal/perspective correction composes with resizing in one resampling. geometry.js supports shear only with consistent edge votes and optional LCD quadrilateral correction. Credible orientation alternatives must be checked before acceptance; conflicting values or physical assignments remain blank, including across refinement stages. Manual rereads retain the complete source transform. No gyro permission or framing storage is used. Screen edges are not mandatory. image.js supplies shared illumination/contrast normalisation, components, and pixel crops. units.js checks degree/C and percent stroke geometry independently of seven-segment numeric evidence.

Numeric decoding checks decimals, alignment and size, excluding contained partial 1 strokes and smaller historical groups. Returned regions, digit/unit bounds, independent heuristic confidence evidence and correction matrices map to the original photo. Previews reuse corrected analysis pixels. Scores are geometric checks, not calibrated probabilities. No recognition network request or model download occurs. Include every new module and worker in APP_FILES.

Recognition preserves every original mask pixel inside component bounds, verifies active and inactive segments in greyscale, and uses raw paired stroke geometry to reject historical rows even when current digits fail. Adaptive .55/.4, gentle .55 and denoised .7 are shared by direct tests and the worker. A bounded adaptive .75 refinement can support a faint fraction at the same established perspective geometry. A nonzero geometric correction requires supporting variants; unsupported or conflicting digits stay blank. Worker progress carries session and stage IDs and mapped validated partial entries; the overall 10-second deadline can retain a safe field. Strong raw LCD interiors are checked at native crop detail before the overview.

Disjoint credible displays must all be evaluated before accepting a field; an unlabelled overview cannot erase a display conflict. Manual regions check native detail before enlargement and reuse a resolved transform only from the same retained photo. Private supplied-photo regressions live only under ignored work/.

## Practical recognition limitations

LCD detection, unit identification and segment reading run locally in a worker, with an 800-pixel maximum analysis dimension. Photo geometry is checked before decoding to handle sideways, upside-down and supported diagonal views without motion-sensor permission. Supported shear and screen perspective correction improve angled images; display-local dark-foreground and adaptive contrast reduce uneven lighting; median greyscale evidence tolerates thin reflected streaks while uncertain segments stay blank. The smaller crops show the same corrected pixels used for recognition. Full fraction cells are checked against the original greyscale image. Obscured segments, conflicting orientations or conflicting readings remain unresolved.

Scanning works offline after the app shell is cached; fresh outdoor weather still needs a connection. Photos are not saved or uploaded. Recognition targets Celsius/percent segmented displays; other displays may require manual entry.
