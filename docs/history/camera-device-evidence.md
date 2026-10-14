# Camera fixture and device evidence

**Audience:** Readers investigating camera evidence

**Status:** Historical evidence

**Owns:** Reported fixture results, private-evidence boundaries and outstanding phone checks

**Reviewed:** 13 October 2026

[Documentation index](../index.md) · [User guide](../user-guide.md)

> Historical evidence. Instructions and “current” statements in this record describe their original period. Consult the linked current reference before implementation.

**Moved:** 13 October 2026. Original record dates and verification limits are retained. [Current guidance](../development/camera.md).

Private timestamped native video frames and annotations live only under ignored work/; never commit or deploy them. Public regressions generate synthetic rotation, perspective/black-case, uneven-light, unit and decimal fixtures. Cache tests cover the worker and its import graph offline. Private supplied-photo checks recover 22.3°C/59% and two legible screenshot photo regions at 21.4°C/59% and 21.7°C/61%. The 640×352 busy-background video still leaves many samples unresolved, especially where units are tiny or pale; it is not evidence of complete angle/distance coverage. Private flash/torch regressions additionally cover all nine flashed examples, the 10 representative native 1920×1080 frames and the lower-resolution recording.

Clear flashed photos at 21.2°C/61% and 21.3°C/61%, plus medium and close HD frames at 21.4°C/60% and 21.4°C/61%, decode automatically and through manual regions within the same ten-second budget. Browser-worker checks also preserve the earlier 23.4°C/62% close-up and verify cancellation and partial-result timeout. These are fixture checks, not physical capture evidence. Actual 3×/5× telephoto still capture and flash restoration remain pending phone verification. Mocked lifecycle/viewport checks do not measure an actual iPhone; phone acceptance must check responsiveness, camera/flash, keyboard, permission recovery, background cancellation and offline capture through HTTPS.

The private tilt-and-blur set contains 23 supplied screenshots, with visible ground truth recorded locally. Checks include upright, sideways, diagonal and upside-down displays, manual rereads using the same retained photo, and an exact clipped-fraction crop. Clear required examples recover both fields, the angled 22.1°C case recovers temperature, and the clipped 21.9°C fraction remains blank rather than becoming 21.1°C. Unreadable temperatures are marked unknown; heavy-blur cases must leave those fields blank. These media and annotations remain under ignored `work/`.

The former camera preview deployment and its publishing helper are retired now that camera readings are part of the main app. Historical preview builds remain available in Git history.
