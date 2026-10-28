# Hosting, releases and domain setup

## Current setup

| Item             | State                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Canonical source | [looppio/looppio.github.io](https://github.com/looppio/looppio.github.io), `main`                           |
| Primary host     | Cloudflare Workers Static Assets with a small media-range Worker                                            |
| Primary address  | [alextish.com](https://alextish.com/), attached to `alextish-portfolio`                                     |
| Preview target   | Separate `alextish-portfolio-preview` Worker; candidate releases do not overwrite production                |
| GitHub demo      | [looppio.github.io](https://looppio.github.io/), separate `gh-pages` target with no custom domain           |
| Validation       | Local `npm run check`, local Worker runtime checks and live HTTPS/byte-range checks; CI example is inactive |

**Observed on 28 October 2026:** a strict TLS request to the attached Cloudflare domain through Cloudflare's public DNS-over-HTTPS resolver returned HTTP 200 and the exact prepared index, with certificate verification successful. No IP override or certificate bypass was used. The machine's default DNS resolver failed at that time; this observation does not establish recovery of every resolver. Cloudflare Universal SSL is active for the apex and wildcard, Always Use HTTPS is enabled, and the `www` redirect rule is enabled. Complete the live verification procedure below for each released source and artifact; DNS configuration alone is not release acceptance.

Source, lockfile, tests, documentation and approved assets stay together in this repository. The Downloads handoff is a dated snapshot. Do not publish surrounding private folders, source collections or archives. Domain registration and renewal remain separate from the free hosting plan. Physical iPhone/Telegram performance has not been verified; server response checks do not establish device frame rate.

## Prerequisites and local checks

Use Node.js 24 from `.nvmrc`, npm, Git, and the `zip`/`unzip` command-line tools. Use ordinary repository-write authentication for GitHub and an authenticated Cloudflare account with permission to deploy the intended Worker. Keep credentials in the local credential manager; no token belongs in the repository. Cloudflare publication commands below pin Wrangler to `4.155.0`. GitHub demo publication does not require workflow-edit permission; `docs/ci-check.example.yml` is documentation only.

```sh
npm ci
npm run check
npm run preview -- --host 127.0.0.1
```

`npm run check` does not format or publish. It checks formatting and assets, builds, runs regression tests and validates the build. Inspect first load, About and Contact, CV downloads, filters, All cases, direct case reloads, grouped media and playback on desktop and narrow layouts. Review the actual artifact: every file under `public/` is copied, including unused media.

## Prepare and publish a preview

```sh
npm run check
npm run prepare:cloudflare -- --zip /absolute/path/cloudflare-candidate.zip
npm run check:cloudflare:worker
npm exec --yes --package=wrangler@4.155.0 -- wrangler deploy --config wrangler.cloudflare.jsonc --env "" --dry-run --outdir dist/cloudflare-worker-preview
```

Preparation copies the built client into the separate `dist/cloudflare` directory, adds all 20 route entries, `404.html`, runtime notices and release metadata. It retains the original Sites/GitHub build and omits `CNAME`, `.nojekyll`, server files, Worker code and Functions. The ZIP has relative files directly at its root, normalized timestamps and integrity checks. Validation conservatively enforces 1,000 files and 25 MiB per file and rejects private/development material. A normal Vite rebuild clears prepared route files in `dist/client`; prepare again after rebuilding. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Direct Upload limits](https://developers.cloudflare.com/pages/get-started/direct-upload/)

The ZIP contains assets only. The static dashboard uploader cannot deploy the required media handler; use Wrangler to publish both assets and code. After checking the dry-run result, publish deliberately to the separate preview Worker:

```sh
npm exec --yes --package=wrangler@4.155.0 -- wrangler deploy --config wrangler.cloudflare.jsonc --env ""
```

The default environment targets `alextish-portfolio-preview`. Do not override its name with the production name for routine testing. Generated per-version preview URLs are explicitly disabled; the separate preview Worker provides the preview destination. Verify its generated address without changing DNS or the production domain.

## Publish reviewed production source

First commit and push reviewed source, media manifest and hosting configuration to `main`. Do not commit `dist/`. Then run:

```sh
npm run check
npm run prepare:cloudflare -- --production --domain alextish.com
npm exec --yes --package=wrangler@4.155.0 -- wrangler deploy --config wrangler.cloudflare.jsonc --env production --dry-run --outdir dist/cloudflare-worker-preview
```

Production preparation requires clean `main` with HEAD matching a fresh read of remote `main`, validates the expected GitHub remote, and rebuilds the client. It creates `dist/cloudflare-production` and `dist/cloudflare-production.zip`, leaving the candidate intact. An optional `--zip /absolute/path/production.zip` selects another archive destination. Preparation does not upload, edit DNS or change GitHub Pages.

Review the source SHA, artifact digest and dry run, then publish explicitly:

```sh
npm exec --yes --package=wrangler@4.155.0 -- wrangler deploy --config wrangler.cloudflare.jsonc --env production
```

The production environment explicitly targets `alextish-portfolio` and validates the production asset folder against the media manifest before bundling. Keep the existing custom-domain binding in Cloudflare; normal content releases do not require DNS changes. Finish the live checks below and record the Worker deployment/version identity with the source SHA. A successful upload alone is not release acceptance.

### Release identity

The public `release-source.json` records schema version, repository, source branch, full source SHA, `sourceDirty`, package version, custom domain, route count and exact-byte `artifactSha256`. Its digest covers prepared assets excluding the metadata file itself. It contains no credentials or local paths.

Cloudflare records `platform: "cloudflare-workers-static"`; this names the Static Assets product even with the separate media Worker. Preview metadata uses `deploymentStatus: "candidate"` and `customDomain: null`. A dirty preview's SHA identifies the base commit; its digest identifies packaged contents. Production metadata uses `deploymentStatus: "production"`, `customDomain: "alextish.com"` and `sourceDirty: false`. These fields describe the intended target, not proof of a successful rollout.

Worker code and its media manifest are bundled separately from the static artifact and are not included in that asset digest. Record the reviewed source commit and observed Worker version alongside the public metadata. Rebuild after source changes; do not relabel an old package as a new source release.

## Media handling and free-plan limits

`wrangler.cloudflare.jsonc` targets the separate `alextish-portfolio-preview` Worker by default with `auto-trailing-slash` and `404-page` behavior. Its selective `run_worker_first` patterns are `/assets/*.mp4` and `/assets/*.pdf`; Cloudflare's `*` matches nested paths. HTML, scripts, styles, images and fonts retain asset-first serving. No account identifiers, custom-domain routes or credentials are stored in this config. [Asset routing configuration](https://developers.cloudflare.com/workers/static-assets/binding/)

The handler supports single prefix, suffix and open-ended byte ranges, `206`/`416`, conditional requests and HEAD. HEAD returns no body; the runtime may omit its optional `Content-Length` header, and a present value must equal the complete GET length. Unsupported multipart or malformed ranges receive the complete representation. It streams skipped and selected chunks without buffering whole files, cancels unused tails and propagates visitor cancellation. A late/suffix range still reads preceding bytes internally, so it is not a random-access storage service. `FixedLengthStream` supplies correct partial-response lengths in the Workers runtime. [Workers response lengths](https://developers.cloudflare.com/workers/runtime-apis/response/#set-the-content-length-header)

The asset binding can omit `Content-Length` internally. `worker/cloudflare-media-manifest.json` therefore records byte sizes and SHA-256 for every public MP4/PDF. Wrangler's build hook verifies this checked-in manifest against the selected prepared asset folder before bundling. A missing, extra or changed media file stops deployment. Never manually edit a size to bypass this check. After an intentional media update, run `npm run build:cloudflare`, then `npm run check:cloudflare:worker -- --write`. Review and commit the manifest with the media change after `npm run check` passes, then rebuild the release from that commit. The full check also compares the manifest with current public media, so a fresh checkout detects a stale manifest before deployment.

Requests served directly as static assets are free and unlimited. Media requests invoke Worker code and count toward the Workers Free allowance of 100,000 requests per day, as do any other requests that reach the Worker; additional CPU and runtime limits apply. When the free request quota is exhausted, Worker-first routes fail rather than silently using static delivery. No paid Worker plan, storage service or database is required by this setup. Monitor usage before relying on it for larger traffic. [Static asset billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [Workers Free limits](https://developers.cloudflare.com/workers/platform/limits/)

## Check the live release

Use strict HTTPS through public DNS. Verify the root, `/full/`, every project route, direct reload with filter parameters, all five CV downloads, a missing asset returning 404, every video/PDF prefix range, suffix ranges and unsatisfiable ranges. Check `206`/`416`, exact response bytes and range headers. HEAD must have no body; if its optional length is present, it must match the complete file. Verify ETag/conditional request behavior and compare the entire served release record with the intended local artifact.

Check HTTP-to-HTTPS and `www`-to-apex redirects with paths and query strings preserved. Inspect startup, navigation, video playback and seeking in the browser. Record date, source SHA, Worker version, resolver choice and any remaining limitations. If the machine's DNS is stale, an explicitly recorded public DNS-over-HTTPS check can establish TLS/serving independently, but is not evidence that the local resolver recovered. Do not use `--insecure` or present an IP override as ordinary DNS success.

The current measured performance baseline and its limits remain in [Performance](PERFORMANCE.md). New speed claims need measurements of the deployed commit under stated device, network and cache conditions. Physical iPhone/Telegram verification remains separate.

## Domain and HTTPS maintenance

The registrar remains Vicetemple; the assigned Cloudflare nameservers and active Free zone remain in place. Cloudflare owns the Worker-managed proxied apex record for `alextish.com`. `www` is a proxied CNAME to `alextish.com`. The previous eight GitHub Pages A/AAAA records have been removed after backup. The existing ownership TXT record is retained; its value is intentionally not reproduced here. Preserve unrelated records, especially email records.

Cloudflare Universal SSL is active for the apex and wildcard, and Always Use HTTPS is enabled. The enabled canonical rule matches only hostname `www.alextish.com` and returns a permanent redirect to `https://alextish.com` plus the original path, preserving the query string. Confirm the installed rule and strict TLS for both names after any DNS or redirect change. Do not point the apex back to GitHub Pages as part of an ordinary content rollback.

Earlier GitHub Pages domain setup failed its own DNS health checks with `InvalidDNSError`/`Dnsruby::ServFail`, despite correct public resolver results. A custom-domain reset did not resolve that result. The underlying cause was not established; this is not a proven cache diagnosis. Cloudflare hosting replaces that domain-serving path. The old GitHub DNS retry instructions no longer apply to the primary site.

## Independent GitHub Pages demo

Keep the GitHub demo independent: `customDomain: null` in `pages.config.json`, no repository Pages custom-domain binding, no `CNAME` in the published artifact, and Repository Settings → Pages set to **Deploy from a branch**, **gh-pages**, **/ (root)**. Cloudflare production metadata separately records `alextish.com`. Verify that the GitHub hostname serves the intended release without redirecting to the custom domain after each Pages deployment.

After pushing clean reviewed source to `main`, use the history-preserving Pages tool:

```sh
npm run deploy:pages
npm run deploy:pages -- --publish
```

The first command installs locked dependencies, runs checks, prepares the client and stages a temporary publishing checkout without pushing. The second deliberately publishes a normal descendant commit to `gh-pages`; it never force-pushes. An intentional change from the old published domain requires `--allow-domain-change` on the dry run and publish. Review the reported difference before using that acknowledgement. A concurrent remote change should be investigated and retried from the updated source.

The tool publishes the client only, including static entries for `/full/` and every case, `.nojekyll`, dependency notices and release metadata. It excludes source, dependencies, server output and private material. Wait for GitHub Pages to finish, then verify the independent HTTPS hostname, routes, CVs, video ranges, 404 and source SHA. GitHub does not execute the Cloudflare Worker. No application edits belong directly in `gh-pages`. GitHub Pages has separate limits, including a 1 GB site and soft 100 GB monthly bandwidth allowance. [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

## Roll back without rewriting history

Keep each accepted asset package, corresponding source/manifest and Worker version. Redeploy a matching accepted set after review, or revert the faulty source commit on `main`, run the checks, push the revert and rebuild production using the commands above. Never mix an older asset package with a newer media manifest. Preserve working DNS and domain bindings during content rollback.

For the GitHub demo, publish the reviewed revert through the normal Pages tool so both source and publishing history remain intact. Do not reset or force-push `gh-pages`. Repeat the live checks after either host is rolled back.

## Preserved Sites output

`npm run build` still produces `dist/client/index.html`, `dist/server/index.js` and `dist/.openai/hosting.json`. The existing `worker/index.js` uses an `ASSETS` binding and falls back to `/index.html` only for HTML GET/HEAD navigation after an asset 404. It is separate from the Cloudflare media handler and remains unchanged.

Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs` and `tests/sites-worker.test.mjs` intact. The portfolio does not need an application API, database or object-storage service.
