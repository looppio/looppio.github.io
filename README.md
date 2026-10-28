# Oleksii Tyshchenko portfolio

A React and Three.js portfolio with an animated sky, WebGL gallery, category filters, case studies and five downloadable CV versions.

- **Website:** [alextish.com](https://alextish.com/), hosted on Cloudflare Workers Static Assets.
- **GitHub demo:** [looppio.github.io](https://looppio.github.io/), published separately from `gh-pages`.
- **Source:** [looppio/looppio.github.io](https://github.com/looppio/looppio.github.io), branch `main`
- **Domain and HTTPS:** registration stays at Vicetemple; Cloudflare manages DNS and the free certificate. See [Deployment](docs/DEPLOYMENT.md) for the current configuration, validation and rollback.

The current repository is the canonical project. The Downloads handoff is a dated snapshot, not a synchronized working copy. Keep private collection material and archives outside this repository.

## Quick start

Use Node.js 24 (`.nvmrc`) and npm. The minimum supported Node version is 22.12.

```sh
git clone https://github.com/looppio/looppio.github.io.git
cd looppio.github.io
npm ci
npm run dev -- --host 127.0.0.1
```

Open the URL printed by Vite. No application server, database or CMS is required.

## Check and preview

```sh
npm run check
npm run preview -- --host 127.0.0.1
```

The combined check covers formatting, asset validation, production build, regression tests and build validation. Standalone `npm test` requires an existing build. Inspect desktop and narrow layouts in the browser after changes affecting presentation or behavior.

## Publish an update

Source lives on `main`. Cloudflare hosts the primary website; GitHub Pages retains a separate demo on `gh-pages`. No paid server or database is required; domain registration and renewal are separate. Direct static requests are free and unlimited. Video/PDF requests use a small streaming handler and count toward the Workers Free allowance of 100,000 requests per day.

After committing and pushing reviewed source to `main`:

```sh
npm run check
npm run prepare:cloudflare -- --production --domain alextish.com
npm exec --yes --package=wrangler@4.155.0 -- wrangler deploy --config wrangler.cloudflare.jsonc --env production --dry-run --outdir dist/cloudflare-worker-preview
```

This prepares and validates a production package without uploading it. To publish deliberately:

```sh
npm exec --yes --package=wrangler@4.155.0 -- wrangler deploy --config wrangler.cloudflare.jsonc --env production
```

Preparation requires clean source matching remote `main` and records its commit in `release-source.json`. The Worker build verifies video/PDF sizes and hashes against the exact asset package. Preview deployments use a separate Worker. Update the GitHub demo with `npm run deploy:pages -- --publish`; its custom domain stays unset. Read [Deployment](docs/DEPLOYMENT.md) before publishing, changing media or rolling back.

## Maintainer guide

| Document                                      | Use it for                                         |
| --------------------------------------------- | -------------------------------------------------- |
| [Contributing](CONTRIBUTING.md)               | Making, reviewing and handing off changes          |
| [Content](docs/CONTENT.md)                    | Cases, categories, media and CVs                   |
| [Architecture](docs/ARCHITECTURE.md)          | Rendering, routing, scrolling and lifecycle        |
| [Deployment](docs/DEPLOYMENT.md)              | Cloudflare, GitHub demo, releases and rollback     |
| [Performance](docs/PERFORMANCE.md)            | Dated baseline, repeatable measurements and limits |
| [Security](SECURITY.md)                       | Private reporting and publishing boundaries        |
| [Third-party notices](THIRD_PARTY_NOTICES.md) | Dependency notices and content permissions         |
| [Agent contract](AGENTS.md)                   | Established design and content requirements        |
| [QA history](design-qa.md)                    | Checks actually performed on earlier changes       |

The speed baseline includes a slow first load under simulated Slow 4G. The v1.2.0 release includes startup, mobile rendering, scroll and lens fixes. Physical iPhone 13/Telegram verification is still required; desktop and emulated results do not establish physical-phone performance. The visual experience requires WebGL. See [the measured baseline and known limits](docs/PERFORMANCE.md) before making speed or compatibility claims.
