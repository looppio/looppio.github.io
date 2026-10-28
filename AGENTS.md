# Portfolio contract

This folder is the intended repository root. Read [README](README.md), [Architecture](docs/ARCHITECTURE.md), [Content](docs/CONTENT.md) and [Deployment](docs/DEPLOYMENT.md) for maintenance details. Work on the portfolio only; job research and applications remain paused unless requested.

## Working rules

- Preserve the React, Vite and Three.js app in `src/`. Do not reinitialize the app or Git as routine work. Keep private workspace records outside the future repository.
- Before substantial visual changes, inspect the current approved source and follow the relevant Product Design workflow. Do not redesign unrelated surfaces during technical fixes. When visual verification is required, run the preview and inspect it yourself.
- Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs` and `tests/sites-worker.test.mjs` intact unless an explicitly scoped hosting task requires otherwise.
- Use `npm run check` for formatting, asset validation, production build, all tests and build validation. Standalone `npm test` needs a prior build because packaging assertions read `dist/`. Sites output must retain `dist/client/index.html`, `dist/server/index.js` and `dist/.openai/hosting.json`. Do not publish without authorization.

## Visual and navigation contract

- Use local DM Sans and the approved animated clouds at `public/assets/origin-sky.mp4`, with `origin-sky-poster.jpg` fallback. Include the background in lens refraction and wipes. Do not re-enable the floor grid or falling models.
- Preserve the source lens, pointer wave, sheet deformation, infinite scroll, masks, transitions and actual case progress wheel. Do not substitute decorative CSS approximations. Preserve original media colors.
- Gallery cards retain dark scrims, white captions, factual tags and arrows following the same geometry and hover deformation as the card. Case viewers remain dark; About and Contact use white lens discs and readable black copy.
- Header name is only Oleksii Tyshchenko, matching About and Contact in size and weight. Header text/icons are white over clouds. Keep transparent progressive blur, a white header CV pill and a black About CV button.
- Featured, All cases and filters move to a floating bottom dock at widths up to 1050px, or up to 1440px with a coarse pointer; hide the author footer there. Do not introduce a second tablet header row. Include large-tablet portrait and landscape widths when checking this boundary. Hide header, dock and footer in an open case. Keep the desktop portrait and linked author signature. Small-screen typography and the mobile rendering budget retain their separate 767px boundary.
- Preserve the separate 649px case breakpoint. Mobile pairs stack there. Disable archive hover previews for touch, coarse pointers and widths up to 767px; links must still work.

## Overlays and contact

- Keep plain About and Contact header links, the internal About ID `profile`, and a Phosphor FunnelSimple multiselect filter without search. Do not duplicate Telegram or Email controls in the header.
- Reveal panel copy only after the lens encloses it and two correctly sized rendered frames agree. Resize and overlay switches invalidate readiness. Hide both archive DOM and GPU labels beneath any lens panel.
- Keep header, dock and footer in the shared chrome wrapper. Clip only the region covered by the animated lens and its refractive rim using the same center, width-based radius, breath, lobes and squash as rendering and hit testing. Covered chrome must not receive pointer hits; fully covered controls become inert and recover their original state when uncovered or disposed. Invalidate cached control bounds after layout changes. Keep visible navigation usable for retargeting, and preserve keyboard focus through closing.
- Keep card activation blocked until the lens has finished closing, even when panel state is already cleared. Every lens panel retains its close button and fits the current viewport with internal scrolling when needed; CV options must not collapse in a short window.
- Outside-lens clicks dismiss overlays. Interior controls, header retargeting and dragging do not. Action popovers dismiss before the lens.
- Header and About CV buttons open the shared `cv` lens. Its five options are configured in `src/cvVariants.js`; keep downloads disabled until each approved PDF is supplied. Preserve the existing CV file. Actual option downloads retain their feedback and individual filenames.
- About and Contact share LinkedIn, Telegram, WhatsApp and Email. Social links have trailing Phosphor ArrowUpRight; Email is a CopySimple action without a duplicate raw address outside feedback. Preserve the current email and CV popovers, dismissal priority, focus behavior and manual-copy failure fallback.
- About's first sentence includes 5+ years of experience. Keep its small gray note below Download CV explaining that this portfolio was designed and built by the owner using AI. Do not turn that note into a claim of sole authorship of the displayed products.

## Inventory and selection

- Keep the full ordered inventory in `src/projects.js`; membership and primary grouping are explicit in `src/projectTaxonomy.js`. Keep case metadata aligned with the maps. Derive all counts from current data.
- Default Featured omits Nomiswap, Glue, GhostMarket, ModelX, Vicetemple, Creator agency CRM, VR Meditation and ShroomRadar. Preserve these cases in matching filters, `?all=1` and All cases. Respect both per-project `filterOnly` flags and additional taxonomy exclusions.
- Category tags use OR and canonical URL order. `?all=1` requests the complete gallery only without recognized tags. Preserve selection across reload, view changes, case navigation and Back. A category choice or Reset removes the all flag.
- All cases always shows every project once under its primary category. Matching links use opacity 1; nonmatches remain clickable at 0.72 without moving. With no filter all links use opacity 1. Keep compact fully rounded translucent pills, centered text/arrows, stronger focus fill and a scrollable complete list.
- Default filter actions: secondary Show all N cases on the left, primary Keep F featured on the right. All-gallery actions: Show F featured and Keep all N cases. Show F restores the curated ribbon and clears tags and the all flag; Keep all only closes the panel. Preserve selected-category Show M featured or Highlight M cases, and the unselected archive's Back to all N cases. Use dynamic F, N and M counts, right-pointing Phosphor arrows, Reset and the current-versus-total helper.
- MedTech is primary for Caregiver and VR Meditation; retain their secondary `ai-chat-ux` and `immersive-xr` memberships. Metaplex is `fintech-web3` and follows Zircuit. 15M is iGaming and follows Dexsport. Credit Booster and Betslip remain excluded.

## Case content and runtime

- Integrate supplied cases directly into this portfolio. Do not create separate review websites or repeatedly block material collection on unknown personal contribution. Keep English copy brief and factual.
- My contribution and Project scope use the shared three-line disclosure. Preserve black progressive blur, click-to-expand previews, independent Show more and Show less controls, short-list handling and reset between projects. Remeasure the existing virtual scroll after expansion without recreating its controller. Show desktop copy scrollbar only for expanded overflowing content; mobile has no internal copy scrollbar.
- Never invent roles, dates, duration, results, metrics, awards, clients or sole authorship. Personal contribution requires explicit source evidence or owner approval. Keep proposed personal copy in private approval files. When unknown, omit My contribution and show factual summary and Project scope without lorem ipsum. No em dashes, slash/dot separators or actual location in interface copy. Visit-site actions require a verified direct product URL.
- Optional groups accept English title/caption, `single` or `mobile-pair` layout and normal image/video children. Group backgrounds stay transparent. Each group is one scroll item; each leaf retains its own interactive surface and unique original/repeat slot.
- Respect ancestor parking for visibility/playback. Keyboard focus brings the actual child into view; repeated copies stay outside tab and accessibility navigation. Preserve ordinary media layout.
- Use real dimensions, reserved aspect and local posters. Upload video to the GPU only after a decoded frame with positive dimensions. Pause offscreen, hidden and reduced-motion playback; preserve error posters and complete teardown.
- Preserve case, phase and filters across HMR and asynchronous startup. Dispose listeners/resources and ignore late loads after teardown. Boot follows real readiness and a successful scene frame, with the actual strip-to-scene reveal. Retired planes/labels stay hidden at zero alpha and normal poses; no later center dot may reappear.
- Keep gallery and case input profiles separate in the shared scroll hub. Gallery touch uses axis locking, bounded velocity-based release and a small movement threshold; wheel notches and trackpad packets retain distinct paths. Normalize decay by elapsed frame time and bound recovery after stalls. A pointer tap during gallery momentum stops it without opening a card; a later settled tap and deliberate keyboard activation still work. Disable and disposal must clear owned gestures and queued input.
- Preserve lens shortcut guards: only inactive pointer fields may bypass chromatic work, AA derivatives must be evaluated before divergent returns, and neither the refractive rim nor partially covered AA pixels may be skipped. Rendering budgets and numeric tests are not evidence of physical-device frame rate or a verified Telegram fix.

## Private material and release

- Everything in `public/` ships, even unused files. NDA originals, raw recordings, manifests, hashes, source URLs, attribution evidence and provenance stay outside this project and outside the public bundle.
- Private card platform uses only approved anonymized assets. Never expose its original identity, URL, branding or account identifiers through copy, filenames, metadata or frames. Keep the approved phone-on-dark-blue-chair cover frame from `card-platform-09.png`, including when using an optimized cover derivative.
- No studio/coauthor credit slides, collaborator lists, thank-you end cards or like/subscribe promotions in public cases. Preserve permitted product branding and required license notices. Removing credits must not imply sole ownership.
- Before publication, review placeholders, claims, rights, redactions, links and the actual built output. Sanitizing a poster does not sanitize its video. Keep QA dated and scoped: distinguish code tests, source inspection, browser checks and remaining limits. Tests alone do not establish visual acceptance, accessibility compliance or deployment.
