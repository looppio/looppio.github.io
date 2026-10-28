# Maintaining this portfolio

## One source of truth

Use `main` in [looppio/looppio.github.io](https://github.com/looppio/looppio.github.io) as the reviewed source. Work in a current clone of that repository. The earlier Downloads handoff is a snapshot from 27 October 2026 and does not receive later changes automatically. Do not replace current source with that snapshot.

`gh-pages` contains generated public files. Application changes belong on source branches, then `main`. Do not hand-edit generated JavaScript or media on the publishing branch. Deployment records identify the source commit used for a release.

## Make a change

1. Update a clean `main` with `git pull --ff-only` and create a descriptive working branch.
2. Read `AGENTS.md` and the relevant architecture or content guide. Preserve the established design when a change is technical.
3. Install locked dependencies with `npm ci`. Keep `package-lock.json` with any intentional dependency change.
4. Make a focused change. Verify asset dimensions and posters; keep approved copy and original media colors.
5. Run `npm run check`. Tests that read generated output require a preceding build; the combined command handles this order.
6. Preview the production build. Check changed behavior, direct routes and a narrow viewport. Record the actual browser/device and any limits.
7. Review `git diff` and the files being added. Open a pull request with the problem, resulting behavior and relevant validation. Direct owner maintenance can use the same review checklist before committing.

Use regression tests for meaningful behavior and rendered checks for visual changes. Passing code tests alone does not prove visual acceptance or physical-device compatibility.

## Content and media

Follow [Content](docs/CONTENT.md) for case IDs, slugs, taxonomy, filters, grouped media, contribution text and CV variants. Keep complete case inventory independent of the default Featured selection. Preserve existing public URLs unless a deliberate migration is included.

Everything in `public/` ships, including files without a visible link. Only approved public material belongs there. Keep original restricted material, account identifiers, source records and approval evidence outside the repository. Sanitize every included video frame, not only its poster.

Do not invent roles, outcomes or sole authorship. Preserve required licenses. Public availability of a file does not settle permission to republish it; record that decision with the owner privately. This repository does not grant a blanket license over client work, brands or adapted material.

## Review before merging

- The change has a clear purpose and preserves unrelated accepted behavior.
- `npm run check` passes, or the exact failure is recorded and resolved before release.
- Relevant browser checks cover navigation, resize and media playback where affected.
- Added files contain no credentials, private records or unintended media.
- Documentation matches changed commands, content structure and known limits.
- Performance claims identify the tested commit, hardware, browser, network and cache conditions.

The CI YAML in `docs/ci-check.example.yml` is an inactive example. There is no repository validation workflow enabled by that file; run the checks locally. GitHub's Pages publication status confirms deployment, not this project's full test suite.

## Release and handoff

Merge reviewed source to `main`, push it and follow [Deployment](docs/DEPLOYMENT.md). A dry run is the default. Publishing is an explicit action and uses a new descendant commit on `gh-pages`, preserving rollback history.

A handoff should include the source commit, deployed source commit, active URL, checks actually completed and remaining work. Update domain status only after the custom domain and HTTPS have been verified. Keep raw traces, screenshots and private notes outside public source unless a particular sanitized artifact is intentionally approved for publication.
