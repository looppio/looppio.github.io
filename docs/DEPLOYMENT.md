# Deployment preparation

The application supports a GitHub Pages demo and the existing Sites build. Treat `outputs/oleksii-portfolio` as the repository root; do not include the surrounding workspace or private `work/` records. Running the build commands below does not publish anything.

## Verify the release candidate

From the project root, with Node.js 22.12 or newer:

```sh
npm ci
npm run check
npm run preview
```

`check` checks formatting and assets, builds the production output, runs all Node regression tests and validates the build. It complements visual review.

Standalone tests include packaging assertions that read `dist/`. On a clean checkout, build before running them:

```sh
npm run build
npm test
```

Inspect the URL printed by the preview server. Preview serves the Vite client output, not the Sites worker runtime. A passing preview does not establish that an external host has the correct routing or asset binding.

Review first load, About and Contact, the filter's curated and all-gallery actions, direct case navigation, All cases, grouped media, lightbox, video posters and playback, reduced motion and a narrow viewport. Record what was actually checked in `design-qa.md`; do not overwrite historical evidence or imply unperformed checks passed.

## Build output

`npm run build` runs Vite and then `scripts/prepare-sites-build.mjs`.

```text
dist/
  client/
    index.html
    assets/...
  server/
    index.js
  .openai/
    hosting.json
```

Vite generates `dist/client/` from the application and copies the complete `public/` directory into it. The preparation script copies `worker/index.js` to `dist/server/index.js` and the hosting metadata into `dist/.openai/hosting.json`. Generated output is not a substitute for the source project and should be regenerated after changes.

Keep these existing hosting integration files intact unless an explicitly scoped hosting change requires otherwise:

- `.openai/hosting.json`
- `worker/index.js`
- `scripts/prepare-sites-build.mjs`
- `tests/sites-worker.test.mjs`

`npm run test:sites` checks worker behavior and the required artifact layout. Build output must exist before the packaging checks that read it.

## GitHub Pages demo

The repository is [looppio/looppio.github.io](https://github.com/looppio/looppio.github.io), serving [https://looppio.github.io/](https://looppio.github.io/). A root user site preserves the app's absolute `/assets/`, `/full` and `/projects/` paths. Do not deploy this output below an arbitrary repository subdirectory.

Source is kept on `main`. The `gh-pages` branch contains only the generated `dist/client/` tree. Configure repository Settings → Pages → Build and deployment with **Deploy from a branch**, **gh-pages**, **/ (root)**. This release path does not require a custom Actions workflow or a token with workflow-edit permission.

The former check-only workflow is preserved as `docs/ci-check.example.yml`. It is an inactive reference, so checks currently run locally before publication. Enabling custom CI later is a separate setup step.

Prepare a release from the source root:

```sh
npm ci
npm run check
npm run prepare:pages
```

`prepare:pages` uses the current project inventory to copy the production HTML entry to `full/index.html` and `projects/<slug>/index.html`. It adds `.nojekyll` for branch publishing. The app accepts both original client URLs and the trailing-slash URLs served by GitHub Pages. The query string stays in the browser URL, including category filters and `all=1`. No catch-all `404.html` is created, so missing assets and unknown paths do not masquerade as successful app responses.

For a fresh build without the full validation, `npm run build:pages` runs the ordinary Sites-compatible build followed by Pages preparation. Every Vite rebuild clears previous generated route directories, so always rerun Pages preparation after a build. A deployment must publish the same client output that was checked, without a later unvalidated source change.

Commit the reviewed source to `main`. Then copy the checked `dist/client/` contents into an isolated checkout of `gh-pages`, commit and push that branch. Keep the existing branch history on later releases; do not force-push. Publish neither `dist/server/` nor `dist/.openai/` to Pages, and never copy the parent workspace or `node_modules/`. Preserve the source project and all existing Sites files.

After Pages finishes publishing, check the actual HTTPS root, `/full/`, a registered `/projects/<slug>/` URL with selection parameters, a downloadable CV and a video byte-range request. A known route without its final slash can redirect once to the directory URL. Reload both the archive and a case directly. Measure the public URL with a cold cache and record device/network conditions; the local preview and compressed bundle size are not measurements of internet load speed.

## Sites or another worker host

The worker expects an `ASSETS` binding. Existing asset responses pass through. If the asset binding returns 404 for a GET or HEAD request that accepts `text/html`, the worker serves `/index.html` so the client can handle its route. Requests without HTML acceptance retain their normal result.

There is no application API and no explicit `/api` path exemption in this worker. If a backend is added later, route it explicitly and test it rather than assuming the current fallback knows which paths are APIs. The current hosting metadata does not configure D1 or R2 resources.

Use the intended hosting integration to attach `dist/client/` to the asset binding and run the prepared worker. This guide does not specify a provider-specific publish command or contain deployment credentials. Publishing requires a separate authorized action and a chosen destination.

## Another static host

The client can also be served by a host that supports SPA navigation. Configure:

- The built `dist/client/` directory as the public root.
- HTML fallback for `/full` and `/projects/<slug>`, including direct visits and reloads.
- Query-string preservation for `tags` and `all`.
- Correct asset MIME types and byte-range delivery for media.
- HTTPS for the public site and browser capabilities such as clipboard access.

Do not turn missing JavaScript, media, write requests or future API errors into successful HTML pages. Test direct URLs on the actual target host. Asset and application paths currently assume deployment at the domain root; a subdirectory deployment requires deliberate changes to routing and absolute asset paths, not just copying the folder below a prefix.

## Publication boundary

Before uploading, inspect the actual generated client directory, not only the files referenced by `src/`. Unused files in `public/` are still shipped. Remove private originals, provenance manifests and obsolete material from the public input before rebuilding; moving files only out of `dist/` is temporary because the next build copies them again.

Confirm asset rights and any reference-code or third-party license requirements. Retain required license notices. Confirm the NDA redactions across every included frame, keep source attribution evidence private, and review any pending personal attribution before public release. Personal contribution is omitted while unconfirmed; its private proposal must not be published as fact. No source screenshot, automated test or earlier QA entry establishes permission to publish new material.

For the future repository, keep source, reviewed public assets, dependency lockfile, tests and documentation together. Keep `node_modules/`, generated output, QA captures and private collection records out of source control as appropriate to the repository's ignore rules. Do not initialize or push a repository from the parent workspace by mistake.
