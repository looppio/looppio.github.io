# Architecture

## Application boundaries

This is a client-rendered React application built by Vite. There is no React Router, server-side rendering, content database or application API. The small worker in `worker/` exists to serve the generated assets and support HTML navigation on Sites.

| File or directory                                                                              | Responsibility                                                                                   |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/main.jsx`                                                                                 | Mounts React StrictMode and global styles.                                                       |
| `src/App.jsx`                                                                                  | Route state, overlays, filters, navigation, social controls and lightbox.                        |
| `src/projects.js` and case modules                                                             | Complete ordered project inventory and public media metadata.                                    |
| `src/projectDetails.js`                                                                        | Case descriptions, approved personal contribution and factual scope.                             |
| `src/projectTaxonomy.js`                                                                       | Category definitions, overlapping membership, primary groups and additional curation exclusions. |
| `src/portfolioSelection.js`                                                                    | Canonical URL tags and Featured versus complete-inventory selection.                             |
| `src/projectLabels.js`                                                                         | Compact archive names, independent of full case titles.                                          |
| `src/Gallery.jsx`                                                                              | React bridge that creates and disposes the scene and forwards the latest state.                  |
| `src/reference/PortfolioScene.js`                                                              | Three.js scene, measured surfaces, render loop, case media and preview playback.                 |
| `src/reference/CaseView.jsx` and `case.css`                                                    | Case DOM, copy, media controls, grouped layouts and case navigation.                             |
| `src/reference/scroll.js`                                                                      | Virtual scrolling, wrapping, input and per-item parking.                                         |
| `src/reference/PostProcess.js`, `shaders.js`, `PointerTrail.js`, `FullField.js`, `PageWipe.js` | Lens, refraction, pointer trail, archive surfaces and transitions.                               |
| `src/BootLoader.jsx`, `boot-loader.css`, `src/reference/BootReveal.js`                         | First-load readiness, progress and the real scene entrance.                                      |
| `src/ActionFeedback.jsx` and `action-feedback.css`                                             | Email-copy and CV-download feedback.                                                             |
| `src/CVPicker.jsx` and `src/cvVariants.js`                                                     | CV selection in the shared lens, approved PDF paths and individual download filenames.           |
| `src/reference/coverImages.js` and `renderBudget.js`                                           | Shared cover decoding, selection loading, mobile resolution budget and frame scheduling.         |
| `src/reference/AnimatedSky.js`                                                                 | Cloud video texture, poster and playback policy.                                                 |
| `scripts/check-*.mjs`                                                                          | Asset and production-output validation used by the project checks.                               |

The `reference/` directory contains adapted rendering mechanics, not a separate running application. Do not execute downloaded source bundles as part of this app. Legacy decorative helpers are not a reason to re-enable the removed grid or falling models.

## Routing and selection

`App.jsx` reads the browser pathname and query string and uses the History API. It listens for `popstate` to restore navigation state.

- `/` displays the Featured gallery.
- `/full` displays every project once, grouped by its primary category.
- `/projects/<slug>` opens a case from the registered inventory.
- A trailing slash is accepted for the archive and case URLs, including GitHub Pages directory entry points.
- `tags` stores recognized category IDs in canonical category order.
- `all=1` requests the complete gallery when there are no recognized category tags.

See [Content](CONTENT.md) for the exact selection and button behavior. A hosting provider must support direct navigation to these paths; the client cannot fix a server returning 404 before its JavaScript runs. The GitHub Pages build emits a real HTML entry for each registered route; Sites uses the existing worker fallback.

## DOM and WebGL cooperation

The application retains real links, buttons, images and videos in the DOM. The scene measures those surfaces and draws the corresponding WebGL planes. Once a surface is ready, the DOM image or video can be visually hidden while retaining the measured box and controls. Do not remove the DOM layer in favor of unlabelled canvas hit regions.

`Gallery.jsx` owns the scene instance. The scene's render loop also dispatches `portfolio-tick`; the case adapter consumes this clock rather than starting a competing scrolling loop. New animation code must clean up listeners, timers, video playback, textures, geometries and materials on disposal. Late asynchronous loads must not mutate a retired scene.

Content-module refreshes reconstruct the scene with the current case, phase, overlay and filter selection. State changes during font, cover or background loading must still be applied when startup completes.

## Loading and transitions

The first-load controller tracks real font, sky-poster, cover or fallback readiness and a successful scene frame. It does not reach 100 percent on a timer. Boot state survives hot module replacement but restarts on a full page reload.

Gallery cards start without fetching every cover. The scene requests covers for the current selection and reuses each decoded DOM image in its Three.js texture, avoiding a separate texture-loader request for the same cover. Hidden cases load when selected or otherwise needed. The startup barrier rechecks selection changes, waits for font readiness and uploads required cover textures before reveal. Postprocess shaders are prepared before the reveal as well. Keep the loading and teardown guards when changing this path.

At release, measured loading strips hand off to existing scene planes. The gallery entrance, direct-case entrance and archive-text reveal have separate paths. Retired planes must be hidden and restored to their normal poses so later frames cannot resurrect a center dot.

About, Contact, CV selection and category filters share the source lens. Their DOM content stays hidden until the lens encloses it and two correctly sized rendered frames agree. Resizing or switching an overlay invalidates this readiness. Both archive DOM and GPU labels stay hidden beneath a lens panel.

## Rendering budget

`renderBudget.js` selects the mobile budget for widths up to 767 CSS pixels or a coarse pointer. Main-scene DPR is capped at 1.5 and further limited to approximately one million render pixels; desktop DPR remains capped at 2. The mobile main renderer disables antialiasing and its lens render target does not allocate the extra depth buffer. Mobile frame scheduling targets 60 frames/s with a running deadline, preserving elapsed animation time across skipped callbacks. These are work budgets, not measured speed guarantees.

When the lens is closed and the pointer effect is inactive, postprocessing uses a simple copy material instead of evaluating the lens shader. The full effect remains available for interaction. Card hit polygons are cached against geometry and deformation state, so unchanged cards do not rebuild the same projected polygon every frame. Hidden tabs still stop the scene loop and media playback.

## Case media and scrolling

Case scrolling is virtual. A group is one top-level scroll item, while its image and video children remain individual measured surfaces. Each rendered leaf has a unique `data-case-slot` derived from its original or repeated render key and child index. The mesh registry includes that slot so repeated sources do not collide.

The `_parked` state can live on an ancestor group. Visibility, playback and focus calculations must account for it. Parked case media pause playback and skip bounding-box measurement until they become active. Focusing a child in a tall group first restores the group's virtual position, then brings that child into view. Repeated loop copies are excluded from accessibility navigation and tab order.

Videos reserve their dimensions and retain a poster until a decoded frame and positive intrinsic dimensions exist. Playback pauses offscreen, on hidden tabs and for reduced motion. Errors retain a usable poster. Case exit clears sources and renderer resources. Preserve these rules for grouped and ordinary media alike.

## Responsive and interaction boundaries

- Header views and filters become a bottom dock at widths up to 767px. The author footer is hidden there.
- Case layout and grouped mobile pairs switch at 649px. These are distinct layout decisions, not one global breakpoint.
- Archive hover previews are disabled at narrow widths, for coarse pointers and for touch input. Links remain usable.
- Case content, captions and photographs retain their original colors. Lens adaptation must not invert the source media.

Tests exercise lifecycle and state contracts; browser checks are still needed for rendered geometry, clipping, focus visibility, pointer interaction and video playback on target devices.
