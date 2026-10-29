# Performance baseline and verification

## Baseline: 28 October 2026

These observations describe the initial public GitHub Pages build from source `2015313`. They are a baseline for comparison, not a promise for every visitor or a claim about later optimizations. Traces were captured in a desktop browser on a Mac; the mobile profile used emulation on the same machine.

| Condition                                                               | Observation                                                                                                                     | What it establishes                                                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Desktop, 1666 × 658 CSS pixels, DPR 2, cache disabled, no throttling    | Large recognizable cards around 2.35–2.45 s; gallery visually settled around 3.8–4.0 s                                          | Observed desktop startup in this run                                                           |
| Mobile emulation, 440 × 956 CSS pixels, Slow 4G, CPU ×4, cache disabled | Boot completion upper bound 23.875 s                                                                                            | Inferred from the preview request after boot completion; not a frame-by-frame visual timestamp |
| Cold loading in the baseline                                            | 38 cover requests; approximately 2.68 MB transferred for covers                                                                 | Duplicate cover fetching was present and warranted investigation                               |
| Mobile-emulation reveal window                                          | Main-thread tasks around 120 ms and 198 ms                                                                                      | Startup had individual stalls despite smooth later animation                                   |
| Steady mobile-emulation window on the Mac                               | Approximately 120 presented frames/s                                                                                            | Host-machine behavior; not physical-phone GPU performance                                      |
| Media lifecycle after playback started                                  | No empty-buffer events or reported player errors for more than 3 minutes of sky playback and 7 minutes of gallery-film playback | Playback continuity in those captures; dropped decoder frames were not measured                |

Separate initial HTTP probes measured time to first byte of 0.338, 0.183 and 0.185 seconds. Those values include connection setup and measure server response, not visible gallery readiness. The initial JavaScript artifact was approximately 281 KiB gzip. Compressed artifact size is not a page-load measurement.

## Implemented changes: 28 October 2026, v1.1.0

The source now reuses each gallery DOM image as its WebGL texture source. Covers outside the current selection are requested on demand instead of joining initial startup. Selected cover requests start alongside the sky and fonts; font readiness remains an explicit barrier. Image decoding, texture upload and postprocess shader preparation happen before the reveal.

For viewports up to 767 CSS pixels or a coarse pointer, the main renderer caps DPR at 1.5 and approximately one million pixels, disables its antialiasing, omits the lens target's extra depth buffer and targets 60 frames/s. The closed, inactive lens uses a simple copy pass. Card hit polygons are reused while their geometry is unchanged. Parked case media skip layout measurement and remain paused. These changes reduce requested work while retaining the existing effects; a 60 frames/s target is not a measured guarantee.

The local pre-release build passed the full checks with 205 tests. A local in-app-browser check at 390 × 844 confirmed 11 cover sources during default startup, all 19 after showing the complete gallery, direct VR Meditation case loading and the About lens, without captured browser errors. These checks do not establish a new public speed score. No comparable post-deployment performance measurement has been completed yet.

The owner reported a problem on an actual iPhone 13 inside Telegram, with better behavior in Safari. That report remains an open compatibility concern. The changes have not been verified as fixing Telegram on that phone.

## v1.2.0: input and lens changes

The release adds separate gallery gesture handling: bounded touch release based on recent velocity, dominant-axis locking, smoothing for repeated mouse-wheel notches, reversal braking and elapsed-time decay. A tap during momentum stops the gallery without opening a card beneath it. The case input profile remains separate. These changes address interaction behavior; they are not a measured increase in rendering speed.

The lens shader now avoids chromatic sampling for fully opaque interior pixels and unaffected exterior pixels when the pointer field is inactive. Edge antialiasing is calculated before branching, and the original ring and active-pointer equations remain intact. Numeric tests compare 26,136 sampled points with the original lens formula, including wide antialiasing footprints, and test the pointer threshold. This establishes the shortcut's math under the test conditions, not identical performance across GPU drivers.

Navigation follows the lens contour through opening, retargeting and closing. The contour helper caches control measurements and restores hidden controls as they become uncovered. Its JavaScript arithmetic is small in a local synthetic check, but that check excludes browser layout, clip-path rasterization, backdrop filters and GPU compositing. No speed improvement is claimed from it. The dock now covers narrow desktop windows and coarse-pointer tablets; short panels and the CV option list remain scrollable.

On 28 October, a local in-app-browser check at 390 × 580 showed the lens covering the intersecting central header and dock regions while leaving outside corners visible. Targeted lens, pointer and render-lifecycle tests passed. This is scoped local verification of the working source. The final combined check passed 230 tests. Physical iPhone/Telegram testing and a comparable public performance measurement remain pending.

Chrome's iPad Pro 13-inch preset was checked at 1032 × 1376 CSS pixels in portrait. The coarse-pointer dock range was then extended to 1440px to include its 1376 × 1032 landscape viewport; the rebuilt landscape layout was rechecked with its bottom dock visible. Horizontal native-UI drags moved the ribbon in the portrait profile; a 390 × 580 phone-profile drag moved cards without opening a case. These are desktop emulation checks, not physical iPad measurements. These input checks used Chrome on a Mac and do not reproduce physical iOS touch hardware.

## 29 October: content clarity

The old one-megapixel touch budget could reduce a 1032 × 1376 tablet below DPR 1, and Full-index labels inherited that resolution. The current budget caps mobile DPR at 2 and the framebuffer at two million pixels. An iPhone 13-sized 390 × 844 viewport now uses 780 × 1688 render pixels rather than 585 × 1266; it still stays below native DPR 3.

Idle Full-index chips use their native DOM text, fill and icons. Their WebGL equivalents remain cached for hover deformation, pointer refraction, lens effects and page transitions. Raster textures use an independent 2–3× text scale, and fractional canvas dimensions use the exact texture-to-plane scale. This improves text sampling without increasing the full-screen effects budget to native phone DPR.

Frames without a lens, pointer field or page wipe now render directly to the screen, removing the inactive full-screen copy pass. A view change explicitly captures a fresh scene with cached index rasters before the wipe begins. Active effects still use the postprocess pipeline. Render targets round pixel sizes down exactly as Three's drawing buffer does, avoiding fractional-DPR resampling. Static covers use mipmapped filtering so their configured anisotropy can work; video textures remain unchanged.

These changes remove a source of softness and some unnecessary GPU work. Raising the mobile framebuffer increases active-effect pixel work, so this is not a measured phone-FPS improvement. Physical iPhone/Telegram verification is still required. The approved Dexsport preview itself is 960 × 540; improving the renderer cannot recover detail missing from that source, and it has not been artificially upscaled.

## Current limits

Startup and mobile rendering changes are implemented in v1.1.0, with further interaction changes in v1.2.0. Comparable deployed measurements and physical-device verification are still pending. Compare a freshly deployed candidate with this baseline under the same conditions before reporting improvement. The baseline's duplicate requests or timing must not be presented as measurements of an untested later build.

- The baseline did not validate a physical phone, and the later changes have not been retested on the reported iPhone 13/Telegram combination. CPU throttling does not emulate a phone GPU, thermal behavior or memory pressure.
- No broad browser compatibility or accessibility certification is implied.
- The experience depends on WebGL. A startup failure shows an error and reload action; a complete equivalent non-WebGL view is not implemented.
- Some full-resolution case images are deliberately large. Review quality before replacing them with derivatives.
- Glue retains an animated GIF as an image. Its DOM image can animate; the WebGL image texture does not supply video playback.
- Long-running media events do not establish zero dropped frames, and desktop compositor frame rates do not establish animation performance on phones.

## Repeat a measurement

1. Record the deployed `release-source.json` source commit and tested URL. For the initial release without that record, use its documented source/deployment pair in the QA history.
2. Record browser version, host/device, viewport, DPR, CPU/network settings, cache state and reduced-motion setting.
3. Capture a fresh navigation with screenshots and network activity. Separate first response, first recognizable content, boot completion and settled gallery.
4. Count cover requests and transferred bytes. Inspect long tasks during reveal separately from steady animation and scrolling.
5. Test a direct case load, scroll, playback, tab hiding/restoration and repeated navigation. Include a physical-device run before making a mobile speed claim.
6. Keep the sanitized summary and comparison date here or in `design-qa.md`; keep raw traces outside the public repository. Report regressions and uncertainty as well as improvements.
