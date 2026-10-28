# Oleksii Tyshchenko portfolio

A React and Three.js portfolio with an animated sky, WebGL gallery, category filters, case studies and five downloadable CV versions.

- **Pages address:** [looppio.github.io](https://looppio.github.io/) (redirects to the configured custom domain)
- **Source:** [looppio/looppio.github.io](https://github.com/looppio/looppio.github.io), branch `main`
- **Custom domain:** `alextish.com`. GitHub Pages and Cloudflare Free DNS are configured; public DNS records resolve correctly, while GitHub verification and HTTPS issuance are still pending. The Pages address redirects to this domain, so it is not an independent fallback during propagation. Registration stays at Vicetemple.

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

Source lives on `main`; the checked client build lives on `gh-pages`. GitHub Pages provides hosting for this public repository. No paid server or database is required; domain registration and renewal are separate.

After committing and pushing reviewed source to `main`:

```sh
npm run deploy:pages
```

This prepares and checks a release without pushing it. To publish deliberately:

```sh
npm run deploy:pages -- --publish
```

The release tool rebuilds from clean source and records its commit in `release-source.json`. It preserves deployment history. Read [Deployment](docs/DEPLOYMENT.md) for prerequisites, domain setup, live checks and rollback.

## Maintainer guide

| Document                                      | Use it for                                          |
| --------------------------------------------- | --------------------------------------------------- |
| [Contributing](CONTRIBUTING.md)               | Making, reviewing and handing off changes           |
| [Content](docs/CONTENT.md)                    | Cases, categories, media and CVs                    |
| [Architecture](docs/ARCHITECTURE.md)          | Rendering, routing, scrolling and lifecycle         |
| [Deployment](docs/DEPLOYMENT.md)              | GitHub Pages, `alextish.com`, releases and rollback |
| [Performance](docs/PERFORMANCE.md)            | Dated baseline, repeatable measurements and limits  |
| [Security](SECURITY.md)                       | Private reporting and publishing boundaries         |
| [Third-party notices](THIRD_PARTY_NOTICES.md) | Dependency notices and content permissions          |
| [Agent contract](AGENTS.md)                   | Established design and content requirements         |
| [QA history](design-qa.md)                    | Checks actually performed on earlier changes        |

The speed baseline includes a slow first load under simulated Slow 4G. The v1.1.0 startup and mobile rendering changes are implemented, with post-deployment measurement and iPhone 13/Telegram verification still pending; desktop and emulated results do not establish physical-phone performance. The visual experience requires WebGL. See [the measured baseline and known limits](docs/PERFORMANCE.md) before making speed or compatibility claims.
