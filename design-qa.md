# Maintenance QA

Checked on 2026-10-27. This record covers the repository cleanup and performance maintenance pass. It is not a guarantee for subsequent content or code changes.

## Changes checked

- Added the repository README, architecture guide, content workflow, deployment guide and compact agent contract.
- Added formatting, asset validation, build validation and a GitHub Actions check workflow.
- Archived obsolete code, unused public files and earlier QA records outside the intended repository. Retained full-resolution case media.
- Added separate gallery cover derivatives and a small author portrait. The 19 cover sources totalled 15,601,212 bytes; the derivatives total 1,373,036 bytes, a 91.2% reduction for those images only. The portrait changed from 901,970 to 1,906 bytes.
- Public assets total 86,645,930 bytes after cleanup, a net reduction of 2,839,392 bytes. This is the entire asset collection, not the initial page transfer.
- Cached card style measurements and stopped the scene animation loop while the document is hidden. Added playback guards for hidden tabs, reduced motion and disposal.
- Updated build dependencies without changing the major Vite version, removed an unused icon dependency and split the production JavaScript into application, React and graphics chunks.

## Automated evidence

- `npm run check` passed: formatting, asset checks, production build, 169 tests and artifact validation.
- Asset validation checked 19 cases, 170 media items and 20 case videos. No missing files, incorrect dimensions, unreferenced assets or exact duplicates remain.
- Production JavaScript totals 273.2 KiB compressed with gzip, below the 400 KiB check budget. This is not a network measurement or a Lighthouse score.
- `npm audit --json` reported zero known dependency vulnerabilities at the time of this check.
- Existing Sites packaging tests passed and the expected client, server and hosting metadata are present in the build.

## Browser evidence

Inspected the production preview in the Codex in-app browser at 1280 by 720 and 390 by 844 pixels.

- Startup completed and the gallery appeared without a persistent center dot.
- Default Featured contained 11 cases. Horizontal scrolling moved the gallery with the existing deformation.
- About opened inside the lens with readable copy, 5+ years of experience, four contact actions, CV and the small authorship note. Clicking outside closed it.
- All cases retained all 19 projects. Applying iGaming preserved every archive link, with four matches at opacity 1 and the other 15 at 0.72. An unmatched Ndax link remained usable.
- Mobile navigation used the bottom dock, the author footer was hidden and archive hover previews were absent.
- The mobile filter lens fit the viewport and displayed dynamic counts. The selected filter appeared in the URL.
- The Ndax case opened with a dark viewer, hidden global navigation, working close control and progress indicator. Its video had a decoded 1920 by 1280 frame and was playing; the animated sky also had a decoded frame.
- No console warnings or errors were captured during these checks.

Desktop gallery, mobile archive and mobile case screenshots are retained in the workspace deliverables outside this repository.

## Remaining limits

- No Lighthouse, bandwidth-throttling or frame-rate benchmark was run. The measured cover savings and lifecycle tests do not establish an overall page-speed score.
- The mobile check used a resized browser viewport, not a physical-device and browser compatibility matrix.
- Glue retains an animated GIF referenced as an image. Its DOM image can animate, but its WebGL image texture does not provide video playback. The asset checker reports this existing limitation.
- Some full-resolution case images remain large. They were preserved for case detail quality; further derivatives should be reviewed visually before replacement.
- Some personal-contribution copy remains placeholder text pending the owner's input. Review it before public release.
- No Git repository was initialized and nothing was pushed or deployed in this pass.

## Case content disclosures, 2026-10-27

- Replaced Dexsport's placeholder with the owner's explicitly approved English contribution and ten compact scope items. Role, dates, duration and numerical outcome claims remain unset.
- My contribution and Project scope now share a disclosure in every case. It measures three actual text lines, including spacing between list items, with black progressive blur and independent Show more and Show less controls. Short blocks remain fully visible. Project changes reset both sections.
- Checked Dexsport at a 390 by 844 browser viewport: both previews fit above the first media, clicking preview text expands it, Enter expands it, Tab brings an offscreen Show less into view, and collapsing both sections leaves the media reachable without a blank gap. The copy uses the main virtual case scroll and has no internal scrollbar. This was a viewport check, not a physical-device test.
- Checked a 1440 by 650 desktop viewport: collapsed text has no scrollbar. Expanding contribution creates a scrollbar only when the copy overflows. Scrolling that text moved copy scrollTop to 177.5 pixels while the media top stayed at 57.59375 pixels. Show less restored copy scrollTop to zero and hid the scrollbar.
- Checked navigation to 15M: its short placeholder contribution stayed fully visible without a redundant disclosure control.
- `npm run check` passed with 172 tests, including regression checks for three lines in paragraphs, bullet spacing and wrapped items. Existing media inventory and the previously documented Glue GIF warning are unchanged.
- Browser screenshots for collapsed mobile and collapsed and expanded desktop states are retained outside the repository in the workspace outputs.

## 15M content and disclosure edge, 2026-10-27

- Added the owner's approved English contribution and scope to 15M, including the complete design system, participation in SEO analysis and design changes based on its findings. No dates, duration, title or outcome metrics were added.
- Opened both 15M disclosures in the local browser and confirmed that the complete English copy, design-system entry and SEO entry are rendered.
- Removed the disclosure blur's tinted fill. Text and both transparent blur layers now fade to zero before the clipping edge, avoiding the horizontal band produced by clipped blurred glyphs. The mask uses the measured preview height, not the full list height.
- Inspected the collapsed Dexsport disclosures at 1440 by 900 and the mobile variant at 390 by 844. The change preserves three-line previews and the shared disclosure controls. Screenshots are retained outside the repository under the workspace outputs.
- `npm run check` passed with 172 tests after the content and mask changes. Existing asset counts and the documented Glue GIF warning are unchanged.

## 2026-10-27: case content and supplied Dexsport preview

- Added the nine English contribution and scope texts explicitly approved by the owner: Zircuit, Metaplex, DeepReel, Private card platform, Ndax, Gambler, Crypto casino platform, AI campaign workspace and Caregiver AI assistant. No new role, duration, calendar date or outcome metric was introduced. Approval and exact copy snapshots stay in private workspace records.
- Refreshed factual summaries and scope for the other eight cases. Reworded only existing attributed work for GhostMarket and Creator agency CRM. Six cases with pending personal attribution omit My contribution instead of showing lorem ipsum; their proposed first-person text stays in separate approval files. Existing media, curation and categories remain unchanged.
- Dexsport gallery now uses the owner's supplied 51.367 second, 960 by 540, 30 fps H.264 montage. Its video packets were copied without re-encoding, faststart enabled, and metadata removed. The stream hash matches the source. There is no audio track. A real frame at 5 seconds supplies the matching static cover. The six existing case interaction clips remain unchanged.
- `npm run check` passed: formatting, assets, production build, 172 tests and build validation. Assets: 215 files, 19 cases, 170 case media leaves and 20 case videos. The new gallery-only preview is not counted as an extra case media leaf. No unreferenced assets. The pre-existing Glue GIF image-texture warning remains.
- Browser review at 1440 by 900 confirmed the playing Dexsport preview, the approved Zircuit paragraphs and scope, and both disclosure controls. At 390 by 844, VR Meditation showed clean scope without a personal placeholder, and Creator CRM retained its role, duration and both disclosure sections. No console errors or warnings appeared in these checks.
- Evidence is saved outside the repository in outputs/portfolio-content-update-qa. This is a content and preview review, not a new full visual acceptance or production deployment.

## 2026-10-27: remaining approval and Dexsport opening film

- The owner approved the remaining eight content drafts. Nomiswap, Glue, ShroomRadar, VR Meditation, ModelX and Vicetemple now include the approved English My contribution. GhostMarket includes its approved second paragraph; Creator agency CRM retains its already integrated version. All 19 cases have approved contribution and factual scope. No roles, dates or outcome metrics were added. The approval and eight draft hashes are recorded privately.
- The same supplied Dexsport montage remains the gallery preview and is now the first case media item. It uses the existing local 960 by 540 poster and measured 51.367 second duration. The original 28 case items follow unchanged: Dexsport now has 29 items with seven videos. The shared file is referenced twice rather than duplicated on disk.
- `npm run check` passed with 172 tests, production build and build validation. Assets remain 215 files with no unreferenced files; the inventory contains 171 case media leaves and 21 case videos. The existing Glue animated GIF warning remains.
- Browser review of the rebuilt case at 1440 by 900 and 390 by 844 confirmed the supplied film playing above the original desktop overview. No console errors or warnings were captured. Screenshots are saved outside the repository in outputs/portfolio-content-update-qa/dexsport-first-video-desktop.png and dexsport-first-video-mobile.png. This review does not constitute production deployment.

## 2026-10-28: CV selection lens

- Header and About CV controls open the shared lens with five named variants. All PDFs are pending, so Download controls remain disabled. The existing CV file is preserved.
- Option titles are centered, remain on one line and truncate with an ellipsis. Full titles are retained in the text and title attribute. Rows have a 999px radius on desktop and mobile.
- Browser review at 1280 by 720 and 390 by 844 confirmed the five options within the lens. Mobile recheck after the styling change confirmed no horizontal overflow: the list client and scroll widths are both 320px. Outside dismissal returns focus to the header CV control.
- Full validation passed with 175 tests before the styling refinement. Production build passed again after it. Actual PDF downloads remain untested because the new documents have not been supplied.
- Screenshots are retained outside the repository in outputs/cv-picker-qa. This is local preview work, not a production deployment.

## 2026-10-28: approved CV downloads

- Connected the five approved PDF versions in the existing selection lens. Each download uses its own file and filename. The readiness caption switches automatically and all five download controls are enabled. The legacy CV is preserved unchanged.
- `npm run check` passed: formatting, asset validation, production build, all 175 tests and production artifact validation. PDF text and visual approval were completed separately before integration. An independent HTTP check confirmed that all five local preview URLs return HTTP 200 with valid PDF content.
- Asset inventory is 220 files. The existing animated Glue GIF warning remains; the sole unreferenced asset is the intentionally retained legacy CV. No deployment was performed.

## 2026-10-28: substantive case copy refresh

- Rewrote summaries, personal contributions and scope for 18 cases, with matching gallery descriptions. Dexsport remains unchanged. Metaplex now describes the confirmed production website redesign and rebrand, including corrected website alt text.
- Compared all project data and repository file hashes with a saved baseline. Case order, IDs, categories, filters, roles, durations, UI code, CV files, covers and original media are unchanged. The 10 changed source files contain case copy only; Metaplex also has corrected descriptive alt text.
- Preserved accurate wallet and onboarding terms used by existing search checks. Narrowed the ShroomRadar account claim during independent evidence review. Public copy includes no source credits, private client identity, source URLs, invented result metrics or unsupported modern-tool chronology. The evidence map for all 18 IDs stays outside this repository.
- Final `npm run check` passed: formatting, asset validation, production build, all 175 tests and production artifact validation. Inventory remains 220 assets, 19 cases, 171 case media leaves and 21 case videos. The existing Glue GIF warning and retained legacy CV are unchanged.
- This entry records source, data, file-hash and automated checks. No new browser visual acceptance is claimed for the text refresh. Nothing was deployed.

## 2026-10-28: GitHub Pages demo publication

- Published the reviewed source to `looppio/looppio.github.io` on `main` and the production client to `gh-pages`. The public demo is https://looppio.github.io/. HTTPS is enforced; Pages serves the root of `gh-pages`. The successful deployment used client commit `bb81c98`, built from source commit `2015313`.
- Added real directory entry points for the archive and all 19 cases, with trailing-slash route support. Existing Sites packaging remains intact. The former CI workflow is retained as an inactive documentation example; validation runs locally before deployment.
- Removed nine unused provenance URLs from public project metadata and retained their mapping privately outside the repository. Checked the final tracked file set and compiled client; no private collection records, credentials, dependencies, active workflows or generated build output are tracked on `main`. The font license is preserved.
- `npm run check` passed formatting, asset validation, the production build, all 178 tests and artifact validation. `npm run prepare:pages` generated all 20 direct route entry points and `.nojekyll`. The existing Glue animated GIF warning remains.
- Live HTTP checks passed for 31 URLs covering the home page, archive, all cases, production scripts/styles, one CV, font, sky video and poster. All five CV variants additionally returned HTTP 200 as PDFs. Public HTML matched the local production build by SHA-256. Video range delivery returned HTTP 206; a missing asset returned HTTP 404.
- Browser checks confirmed the live gallery, archive navigation and direct reload, and Dexsport navigation and direct reload. The public page was also observed at the current narrow viewport with its bottom navigation dock. No browser errors were captured in these checks. This is a deployment smoke check, not a complete accessibility or device audit.
- Three sequential HTTPS GETs from this computer measured time to first byte of 0.338, 0.183 and 0.185 seconds. This includes connection setup and describes server response only, not visual readiness, animation frame rate or a mobile performance score. Initial client JavaScript is approximately 281 KiB gzip. Network evidence is retained privately outside the repository.

## 2026-10-28: v1.1.0 startup and mobile rendering candidate

- Reused decoded gallery DOM images as texture sources and deferred covers outside the current selection. Preserved the font-readiness barrier and moved required texture decoding/upload and postprocess preparation before reveal.
- Added a mobile main-renderer budget: DPR at most 1.5, approximately one million render pixels, no main-renderer antialiasing, no extra lens-target depth buffer and a 60 frames/s scheduling target. Added the closed-lens copy pass, cached unchanged hit polygons and skipped layout measurement for parked case media while preserving their playback pause policy.
- Full local validation passed with 205 tests. This records code and build validation, not a new deployment performance score.
- Local in-app-browser review at 390 by 844 confirmed default startup with 11 cover sources, all 19 after showing the complete gallery, direct VR Meditation case loading and the About lens. No browser errors were captured in those checks.
- The owner reported a problem on iPhone 13 inside Telegram and better behavior in Safari. The candidate has not been verified on that physical-device/app combination; no Telegram fix is claimed. Comparable post-deployment measurements remain pending. The earlier public baseline remains documented separately in `docs/PERFORMANCE.md`.
- Hosting remains GitHub Pages. Domain registration stays with Vicetemple; Cloudflare Free DNS was selected and the website records imported in DNS-only mode. The release configuration prepares `alextish.com`; nameserver activation, public DNS and HTTPS verification are pending. No account identifiers or verification values are stored in this record.

## 2026-10-28: v1.2.0 interaction and lens correction

- Gallery finger movement is near 1:1 with bounded velocity-based release. Its input budget uses the smallest positive visual viewport, layout viewport and measured container size. Horizontal ribbons accept either horizontal or vertical touch motion, lock the dominant axis and preserve the source deformation. Discrete mouse-wheel bursts use a separate smoothed queue; trackpad and case profiles remain separate. A tap during gallery momentum stops movement without opening the card underneath.
- A single DOM chrome layer is clipped by the same animated lens contour and rim used for hit testing. Only intersecting header/dock regions are occluded; uncovered navigation stays available. Fully covered controls become inert and are restored on uncovering or disposal. The closing animation keeps gallery input locked. Deferred CV/filter return focus waits for a usable trigger and cancels on further user navigation.
- Dock layout now covers widths through 1050px and coarse pointers through 1440px, including the current 13-inch iPad preset. The separate 649px case layout is preserved. Lens content and CV choices remain scrollable in a short dynamic viewport.
- The active lens skips chromatic texture work for its fully opaque interior and unaffected exterior, with AA, ring and active pointer behavior preserved. Numeric tests compare 26,136 points against the original formula. This is an exact-result optimization under tested conditions, not a measured physical-phone FPS claim.
- Final local combined validation passed with 230 tests, formatting, asset checks, production build and artifact validation. The pre-existing Glue GIF warning remains.
- Local browser review: 390×580 lens overlaps the header and dock without hiding outside corners; About-to-CV transition remains available. Native Chrome UI drags at 390×580 moved cards without opening a case. iPad Pro 13 emulation at 1032×1376 accepted horizontal dragging, and 1376×1032 showed the bottom dock after rebuilding. This is desktop emulation, not physical iPhone/Telegram or iPad verification. Screenshots remain outside the public repository.
- Domain migration status at this check: Cloudflare Free nameservers and DNS-only GitHub A/AAAA/www records are set and public recursive resolvers return the new records. GitHub still reports its verification lookup pending and the certificate request as new; HTTPS is not yet enforced. The default Pages hostname redirects to the configured domain during propagation. No paid hosting was added.
