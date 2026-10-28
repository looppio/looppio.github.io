# Oleksii Tyshchenko portfolio

A React and Three.js portfolio with an animated cloud background, a WebGL gallery, category filters and a complete case archive. Case pages combine real DOM controls with measured WebGL media surfaces.

[Live demo](https://looppio.github.io/) · [Source repository](https://github.com/looppio/looppio.github.io)

This directory, `outputs/oleksii-portfolio`, is the repository root. The surrounding workspace and its `work/` records are not part of the repository.

## Requirements

- Node.js 22.12 or newer and npm. The included `.nvmrc` selects Node 24 for nvm users.
- A modern browser with WebGL for the visual experience.
- The included `package-lock.json` and reviewed local assets.

There is no application backend or CMS to start. A WebGL startup failure currently shows an error and reload action; a complete alternate visual experience without WebGL is not promised.

## Run locally

Run commands from this directory:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Its usual development port is 5173, but it can select another available port. The current development configuration binds to `0.0.0.0`; use `npm run dev -- --host 127.0.0.1` when a localhost-only server is preferred.

| Command                 | Purpose                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| `npm ci`                | Install the dependency versions in the lockfile.                                                   |
| `npm run dev`           | Start Vite with live source updates.                                                               |
| `npm test`              | Run all Node regression tests. Build first on a clean checkout.                                    |
| `npm run check`         | Check formatting and assets, build production output, run regression tests and validate the build. |
| `npm run build`         | Build the client and prepare the existing Sites server and hosting metadata.                       |
| `npm run build:pages`   | Build production output and add direct-route entry points for GitHub Pages.                        |
| `npm run prepare:pages` | Add GitHub Pages routes to an already checked production build.                                    |
| `npm run preview`       | Preview the built client locally. This does not emulate the Sites worker.                          |
| `npm run format`        | Format project files with Prettier.                                                                |
| `npm run format:check`  | Check formatting without changing files.                                                           |

Standalone tests include Sites packaging assertions, so a clean checkout needs `npm run build` before `npm test`. The combined check handles this order for you.

Before a handoff:

```sh
npm run check
npm run preview
```

Inspect the rendered result as well as the command output. Automated checks do not establish visual acceptance, accessibility compliance or production readiness by themselves.

## Project guide

- [Architecture](docs/ARCHITECTURE.md): rendering, routing, scroll and lifecycle boundaries.
- [Content](docs/CONTENT.md): adding cases, media, categories and Featured rules.
- [Deployment](docs/DEPLOYMENT.md): build artifacts, hosting requirements and publication review.
- [Agent contract](AGENTS.md): current design and content rules for future changes.
- [Current QA record](design-qa.md): scoped evidence and limitations, not a blanket guarantee for later changes.

The main application lives in `src/`. `src/projects.js` assembles the case inventory, `src/projectDetails.js` assembles case copy, and `src/projectTaxonomy.js` defines filter membership and primary archive grouping. Public media lives under `public/assets/`.

## GitHub demo

The GitHub Pages target is the root site `https://looppio.github.io/`, using the source repository `looppio/looppio.github.io`. Source belongs on `main`; only the checked `dist/client/` output belongs on the `gh-pages` publishing branch. Select `gh-pages` and `/ (root)` as the repository's Pages publishing source.

Run `npm run check` and then `npm run prepare:pages` before publishing the resulting client directory. Alternatively, `npm run build:pages` creates a fresh Pages build, but does not replace the full checks. The Pages preparation creates real directory entry points for All cases and every registered project, so direct links and reloads work without a 404-page redirect. The app accepts the trailing slash added by the static host. Unknown paths and missing assets retain the host's 404 behavior.

See [Deployment](docs/DEPLOYMENT.md#github-pages-demo) for the branch release procedure and live checks. The existing Sites output remains available independently.

## Content and publication

Default Featured is curated. Category filters can reveal matching cases outside that selection, `?all=1` opens the complete gallery, and `/full` always retains the complete archive. Counts come from the current inventory, not fixed interface numbers.

Everything in `public/` is copied to the client build, including unused files. Only approved public assets belong there. NDA originals, capture manifests, attribution evidence and private provenance must stay outside this project and outside the future repository. The private card case uses reviewed anonymized assets and must not reveal its original client identity or product URL.

Personal-contribution text uses published evidence or owner-approved copy. Where ownership is still pending, cases show factual product scope and omit the personal section; proposed copy stays in private approval files. Review outstanding attribution, asset permissions and privacy before public release. This documentation does not authorize deployment or initialization of a Git repository.
