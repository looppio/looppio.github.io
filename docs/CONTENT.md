# Content and case maintenance

## Sources of truth

The ordered `projects` array in `src/projects.js` is the full inventory, including cases omitted from default Featured. Details are assembled in `src/projectDetails.js`. Public case metadata must describe confirmed product scope without implying personal ownership of the entire product.

Taxonomy is explicit. Filtering reads `projectCategories`, and archive grouping reads `projectPrimaryCategory` in `src/projectTaxonomy.js`. A project's display `category` or `filterCategories` field alone does not register it in those maps. Keep duplicate metadata consistent with the maps.

Do not add unconfirmed personal roles, periods, durations, metrics, awards or client claims. A UI balance, rating, review count or date visible inside a source screenshot is not a case-study outcome.

## Add a case

1. Review the source assets and rights outside this project. Record original URLs, hashes, dimensions, capture notes and attribution in private workspace records.
2. Copy only approved public files into `public/assets/cases/<id>/`. Use stable lowercase filenames and keep original aspect ratios.
3. Create a module exporting the project and, when useful, its details. Follow an existing module rather than duplicating the viewer.
4. Import and place the project in `src/projects.js`. Ordering affects the gallery and order within archive groups. Preserve deliberate placement, including Metaplex immediately after Zircuit and 15M after Dexsport.
5. Register details in `src/projectDetails.js` and an optional compact name in `src/projectLabels.js`.
6. Add the ID to both explicit taxonomy maps. Keep the project's primary and filter metadata aligned.
7. Update the independent inventory and grouping expectations in `tests/project-taxonomy.test.mjs`, add meaningful media checks when needed, then run `npm run check` and inspect the case locally.

IDs and slugs should be unique and stable. The route handler accepts `/projects/<slug>` with or without a trailing slash. GitHub Pages build routes are derived from this inventory. Changing a slug requires a deliberate link or redirect migration; do not silently break shared links.

## Project shape

This is an illustrative schema, not a ready-to-publish case. Replace paths, copy and measurements with verified values.

```js
export const exampleProject = {
  id: 'example',
  slug: 'example',
  title: 'Example product',
  category: 'FinTech and Web3',
  primaryCategory: 'fintech-web3',
  filterCategories: ['fintech-web3'],
  tags: ['FinTech', 'Mobile'],
  description: 'A short factual description of the product.',
  websiteUrl: 'https://example.com/', // Omit without a verified direct product URL.
  cover: '/assets/cases/example/overview.webp',
  coverWidth: 1600,
  coverHeight: 1000,
  media: [],
};
```

`cover` is always a still image, including when `coverVideo` points to a real video preview. It acts as the loading, error and reduced-motion fallback. Prefer an existing dark still or a real product clip when suitable; do not recolor source images to force this preference. Give the poster and preview compatible proportions.

`filterOnly: true` excludes a case from default Featured. It does not hide the case from matching category filters, `?all=1` or All cases.

## Images, videos and groups

```js
const screen = {
  type: 'image',
  src: '/assets/cases/example/screen.webp',
  alt: 'A concrete description of the visible interface',
  width: 1600,
  height: 1000,
};

const interaction = {
  type: 'video',
  src: '/assets/cases/example/flow.mp4',
  poster: '/assets/cases/example/flow-poster.webp',
  alt: 'The action demonstrated by this interaction',
  width: 1600,
  height: 1000,
  duration: 6.5, // Seconds, measured from the actual file.
};

const section = {
  type: 'group',
  title: 'Explore the product',
  caption: 'A short factual explanation of these screens.',
  layout: 'mobile-pair', // Or 'single'.
  items: [mobileScreen, mobileInteraction],
};
```

Use actual intrinsic dimensions, not the browser viewport or desired display size. Each video needs a real local poster. Keep video URLs in `src`, with `type: 'video'`; an image URL or static WebP must not be labelled video. The viewer plays clips as muted loops. Preserve capture timing when converting recordings or animations and document any processing privately.

`presentation: 'mobile'` opts a portrait image or video into a phone-sized surface on desktop while retaining its aspect ratio. It uses the normal content width on mobile.

A group accepts normal image and video children. `single` lays them out vertically; `mobile-pair` uses two columns on desktop and one column at widths up to 649px. Group titles and captions are DOM text on a transparent background. Do not add an opaque wrapper that covers the WebGL media below it. Do not add your own nested scroll container, animation loop or mesh registry.

Counts must distinguish stages from leaf media. For example, 15M currently has nine top-level stages containing fourteen leaves: five videos and nine stills. A group is one stage, not an extra image. Posters and gallery covers are assets, not additional case-media leaves.

## Details and personal contribution

The viewer prefers detail title and summary, and uses project tags before detail tags. Personal `role`, `period` and `duration` render only when supplied in details. Do not infer them from a generic biography or a publication date.

```js
export const exampleDetails = {
  title: 'Example product',
  summary: 'Confirmed product scope.',
  tags: ['FinTech', 'Mobile'],
  verifiedContribution: false,
  contribution: [],
  scope: ['A confirmed feature shown by the source material.'],
};
```

Set `verifiedContribution: true` only with explicit evidence of the owner's personal work or owner approval of that specific copy. Then `contribution` appears under My contribution. Where attribution is pending, keep `contribution` empty and omit `contributionPlaceholder`; the personal section stays hidden while factual summary and Project scope remain visible. Proposed first-person paragraphs and their research belong in private approval files outside this repository. Hiding other credits must never strengthen a claim of sole authorship.

Only use `websiteUrl` for a verified direct product website. The viewer rejects Behance and Dribbble as visit-site destinations. Do not invent product URLs or expose an NDA client's original identity through a link.

The shared viewer initially shows up to three visual lines in My contribution and Project scope. Longer lists receive a black progressive blur and Show more. Clicking the collapsed preview also expands it; Show less restores the preview. Short lists remain fully visible without redundant controls. Keep full text in the normal arrays and let the viewer measure wrapping and list spacing. Do not truncate the source strings or add manual line breaks for this presentation.

Each section expands independently and resets when the project changes. Expanded content participates in the existing case measurements and mobile virtual scrolling. The desktop copy scrollbar is visible only when at least one section is expanded and the copy actually overflows. The mobile copy remains part of the main case scroll without an internal scrollbar.

## Categories and curation

Add a new category to `categories` in `src/projectTaxonomy.js`, then assign each affected project in `projectCategories` and `projectPrimaryCategory`. A case can match several filters but has exactly one primary archive group. Empty primary groups are omitted. Unknown IDs appear under Other work in the archive, but missing taxonomy for a registered case should be caught and corrected by the inventory test.

Add a matching Phosphor icon import and `categoryIcons` entry in `src/App.jsx` when a new category needs a specific icon. Category order defines canonical URL tag order. Keep existing public IDs stable. Unknown or retired tag IDs are ignored; no alias migration exists automatically.

Caregiver and VR Meditation have primary MedTech grouping. Caregiver retains `ai-chat-ux`; VR Meditation retains `immersive-xr`. Metaplex has `fintech-web3` membership and primary grouping.

Default Featured respects each project's `filterOnly` flag plus `featuredExcludedIds` in the taxonomy. The current omissions are Nomiswap, Glue, GhostMarket, ModelX, Vicetemple, Creator agency CRM, VR Meditation and ShroomRadar. Do not remove their inventory entries to curate the ribbon.

| State                                        | Result                                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/` without recognized tags or `all=1`       | Default curated Featured.                                                                                                |
| `/?tags=medtech,immersive-xr`                | OR matches for the recognized categories, including non-featured cases.                                                  |
| `/?all=1` without recognized tags            | Every project in the gallery.                                                                                            |
| `/full` with any selection                   | Every project once in its primary archive group. Matching links are emphasized; others remain clickable at opacity 0.72. |
| `/projects/<slug>` with selection parameters | A direct case route retaining the selection for navigation.                                                              |

Selecting a category or Reset removes `all=1`. Show all clears tags and opens the actual complete gallery. With no categories, the filter has two actions: Show all N cases and Keep F featured. In all-gallery mode they become Show F featured and Keep all N cases. The first returns to the default ribbon and removes the all flag; the second preserves the full selection. F, N and matching counts are calculated from data.

## CV versions

Five approved PDFs are connected in `public/assets/cv`: Product Design, iGaming, Design Engineer, FinTech Web3 and AI SaaS. Each uses the `Alex_Tyshchenko_CV_` filename prefix and has a dedicated download filename in the variant registry. The general version is displayed as Product Design & Engineering CV.

The header and About CV buttons open a shared lens containing five versions. Edit `src/cvVariants.js` to connect each approved PDF. Keep the stable `id`, set `file` to its local public URL and `filename` to the desired download filename. For example, `public/assets/cv/Alex_Tyshchenko_CV_Product_Design.pdf` uses `file: '/assets/cv/Alex_Tyshchenko_CV_Product_Design.pdf'` and `filename: 'Alex_Tyshchenko_CV_Product_Design.pdf'`.

Each available option is a single download link covering the entire rounded row. The icon is decorative, not a nested control. Titles stay left aligned on one line and truncate when needed; the accessible label and title retain the full name. An option with `file: null` remains visible as a disabled row. Never point unfinished versions at an unrelated PDF. The legacy `public/assets/Oleksii_Tyshchenko_CV.pdf` is preserved separately and is not assigned to a new version automatically. New downloads use the existing confirmation popover with a direct fallback link.

## Private material and publication review

Everything under `public/` is copied into the client output, even when no code references it. An unlinked or non-featured case is still public content. A filename, query string or hidden source field can disclose identity just as a visible logo can.

- Keep NDA originals, capture sessions, raw video, manifests, source URLs, hashes, evidence and collaborator attribution outside this project and its public repository.
- Use only approved sanitized assets for Private card platform. Do not include its original product URL, client name, raw branding or identifying account data in public copy, paths or screenshots.
- Redact every frame before publishing a restricted video. A blurred poster does not sanitize the underlying clip.
- Do not include studio credit slides, collaborator lists, thank-you end cards or like/subscribe promotional cards. Preserve legitimate product branding where permitted.
- Preserve required third-party license notices. The rule against promotional credits does not authorize removing licenses.
- Review placeholders, personal claims, asset permissions, metadata, live links and the entire built public output before a release.

Keep the QA record explicit about code checks, screenshots, actual browser checks and remaining limitations. Do not describe a test fixture or source screenshot as verification of the current rendered app.
