# Hosting, releases and domain setup

## Current setup

| Item             | State                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Canonical source | [looppio/looppio.github.io](https://github.com/looppio/looppio.github.io), `main`         |
| Published files  | `gh-pages`, root directory                                                                |
| Pages address    | [looppio.github.io](https://looppio.github.io/), redirects to configured domain           |
| Custom domain    | `alextish.com` configured; public DNS resolves; GitHub verification/HTTPS pending         |
| Domain config    | `pages.config.json` has `customDomain: "alextish.com"`; nameservers changed to Cloudflare |
| Validation       | Local `npm run check`; the CI example is inactive                                         |

GitHub Pages is available for public repositories on GitHub Free. This portfolio needs no paid server or database. Domain registration and renewal remain separate. Current Pages limits include a 1 GB published site and a soft 100 GB monthly bandwidth allowance; check these again as media or traffic grows. [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

Keep source, lockfile, tests, documentation and approved assets together in this repository. The Downloads handoff is an older snapshot. Do not publish its surrounding private folders, archives or manifests.

## Prerequisites

Use Node.js 24 from `.nvmrc`, npm, Git and ordinary repository-write authentication for `looppio/looppio.github.io`. Keep credentials in the local credential manager. No token belongs in this repository, and this branch-based release does not need workflow-edit permission. Use `npm run deploy:pages -- --help` to inspect supported release options.

Repository Settings → Pages must use **Deploy from a branch**, **gh-pages**, **/ (root)**. The YAML in `docs/ci-check.example.yml` is documentation only, not active CI. GitHub's deployment status does not replace the project's checks.

`pages.config.json` records the repository, source and publishing branches, and custom domain. The current configuration uses `customDomain: "alextish.com"`. The release CNAME is deployed and public DNS has the GitHub records. GitHub domain verification and HTTPS must still finish before the domain is announced as live. The default Pages hostname redirects to the custom domain during this transition; it is not a working fallback if a resolver still has the old DNS state. Do not change it merely to label a local preview.

## Preview a candidate

```sh
npm ci
npm run check
npm run prepare:pages
npm run check:pages
npm run preview -- --host 127.0.0.1
```

Inspect first load, About and Contact, CV downloads, filters, All cases, a direct case reload, grouped media and playback. Use desktop and narrow layouts; check reduced motion when affected. Review the actual `dist/client` files because every `public/` file is copied, including unused media.

`npm run check` formats nothing: it checks formatting and assets, builds, runs regression tests and validates the production artifact. `npm run prepare:pages` then creates directory entry points for `/full/` and every registered `/projects/<slug>/`, adds `.nojekyll`, retains dependency notices and writes release metadata. The app supports trailing slashes and preserves selection parameters. Unknown routes and missing assets keep a 404 response; there is no catch-all 404 redirect.

Every ordinary Vite rebuild clears the prepared route files. Run Pages preparation again after rebuilding. `npm run build:pages` is a convenient fresh build plus preparation, but it does not replace the full checks.

## Publish reviewed source

1. Finish the review, commit source on `main` and push it to `origin/main`. Include documentation and the lockfile when changed. Do not commit `dist/` on `main`.
2. Ensure the source checkout is clean and matches remote `main`. The release script checks the expected repository and source state.
3. Run the default dry run:

   ```sh
   npm run deploy:pages
   ```

   It installs locked dependencies, runs the full checks, prepares and validates Pages output, and stages a temporary publishing checkout. It does not push a deployment.

4. Review the reported source commit, domain and artifact summary, then publish explicitly:

   ```sh
   npm run deploy:pages -- --publish
   ```

   The tool rebuilds and checks again rather than trusting a stale `dist/`. It requires a clean `main` whose HEAD equals remote `main`, and pushes a normal descendant commit to `gh-pages`. It never force-pushes. A concurrent remote update should be investigated and retried from the updated state.

5. Wait for GitHub Pages to finish publishing and complete the live checks below. Record the source commit and deployment commit with the result. A successful push alone is not a completed deployment.

No application code should be maintained directly in `gh-pages`. The script publishes only the client artifact, not dependencies, the source workspace, `dist/server` or `.openai` hosting metadata.

### Release identity

`release-source.json` at the public root records `schemaVersion`, repository, source branch, full `sourceCommit`, `sourceDirty`, package version, custom domain, route count and `artifactSha256`. The fingerprint covers the prepared artifact excluding this metadata file. It contains no local paths or credentials. The source SHA identifies a release even when the package version is unchanged.

After fetching the remote, inspect the deployment record without changing branches:

```sh
git fetch origin
git show origin/gh-pages:release-source.json
```

The first demo predates this metadata. Its source was `2015313` and its publishing commit was `bb81c98`; later releases should carry the record. Use `git log origin/gh-pages` to inspect retained deployment history.

## Check the live release

Confirm the active HTTPS root, `/full/`, a known case with filter parameters, all five CV downloads and a video. Reload the archive and case directly. Verify that a missing asset returns 404 and a byte-range video request returns 206. Inspect visible startup and navigation in the browser, not only response codes.

Compare the served `release-source.json` with the intended source SHA. The full performance baseline and its limitations are in [Performance](PERFORMANCE.md). New speed claims require a new measurement of the deployed commit under stated device, network and cache conditions.

## Roll back without rewriting history

Find the last accepted source SHA from deployment history and its `release-source.json`. Compare it with current `main` to identify the change to undo. Preserve unrelated changes and domain configuration. For a single faulty source commit, the normal path is:

```sh
git switch main
git pull --ff-only
git revert BAD_SOURCE_COMMIT
npm run check
git push origin main
npm run deploy:pages
npm run deploy:pages -- --publish
```

Replace `BAD_SOURCE_COMMIT` with the reviewed commit. For several commits or a merge, prepare a reviewed revert branch rather than guessing a range. Resolve conflicts, validate and merge it before release. The resulting deployment points to the new revert commit and preserves both source and publishing history. Do not reset or force-push `gh-pages` to an old commit. Repeat the live checks after rollback.

## Connect alextish.com

**Status: prepared, pending.** These steps are a runbook, not evidence that DNS or HTTPS is already configured. Use `alextish.com` as canonical and redirect `www.alextish.com` to it. Domain registration stays with Vicetemple. Cloudflare Free has been selected for DNS in the existing account. The website records have been imported in DNS-only mode; nameserver activation and public verification remain pending.

1. In the `looppio` account's Pages settings, verify ownership using GitHub's supplied TXT record. Retain that record. Its value must come from GitHub. [Domain verification](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)
2. Prepare `customDomain: "alextish.com"` in `pages.config.json`, review, commit and push it. Set the repository's Pages custom domain before pointing web DNS at Pages. Saving that setting may add a `CNAME` commit on `gh-pages`; preserve it.
3. In Cloudflare DNS, use the records below in DNS-only mode. In Vicetemple, enter the exact nameserver pair assigned to this zone by Cloudflare; do not reuse another zone’s pair. Confirm delegation before relying on a saved record in the dashboard. Preserve unrelated records, especially email records. Avoid wildcard records.

   | Type  | Name  | Value               |
   | ----- | ----- | ------------------- |
   | A     | `@`   | `185.199.108.153`   |
   | A     | `@`   | `185.199.109.153`   |
   | A     | `@`   | `185.199.110.153`   |
   | A     | `@`   | `185.199.111.153`   |
   | CNAME | `www` | `looppio.github.io` |

   The imported IPv6 records are `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153` and `2606:50c0:8003::153`, all at the apex. Keep the GitHub ownership TXT record in Cloudflare without publishing its verification value in this repository.

4. Release with matching configuration. A deliberate CNAME change requires explicit acknowledgement when the release tool reports a difference:

   ```sh
   npm run deploy:pages -- --allow-domain-change
   npm run deploy:pages -- --publish --allow-domain-change
   ```

5. Verify DNS, enable **Enforce HTTPS** when GitHub allows it, and check the apex plus `www` redirect. DNS/certificate availability can take up to 24 hours. [GitHub custom-domain setup](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

Useful read-only checks:

```sh
dig alextish.com A +short
dig www.alextish.com CNAME +short
curl -I https://alextish.com/
curl -I https://www.alextish.com/
```

Pages preparation generates `CNAME` from the committed config so future releases retain it. The domain-change guard prevents silently removing or changing a published domain. A domain is not connected merely because a CNAME file exists locally. Update the README status only after live HTTPS, redirects, routes, CVs and video checks pass. Do not combine a content rollback with removal of a working custom domain.

## Preserved Sites output

`npm run build` still produces `dist/client/index.html`, `dist/server/index.js` and `dist/.openai/hosting.json`. The existing worker expects an `ASSETS` binding and falls back to `/index.html` only for HTML GET/HEAD navigation after an asset 404. GitHub Pages does not execute that worker.

Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs` and `tests/sites-worker.test.mjs` intact. Another host can use the retained build, but migration is a separate deliberate change. The current deployment needs no application API, database or object-storage service.
