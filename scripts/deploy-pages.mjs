import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertDomainChange,
  assertReleaseSource,
  git,
  readConfig,
  readDomain,
  root,
  sourceState,
  validatePagesBuild,
  validateRemote,
} from './pages-release.mjs';

export function parseOptions(args) {
  const allowed = ['--dry-run', '--publish', '--allow-domain-change', '--help'];
  if (args.some((arg) => !allowed.includes(arg))) throw new Error('Unknown option. Use --help.');
  if (args.includes('--dry-run') && args.includes('--publish'))
    throw new Error('Choose either --dry-run or --publish.');
  return {
    publish: args.includes('--publish'),
    allowDomainChange: args.includes('--allow-domain-change'),
    help: args.includes('--help'),
  };
}

// The CLI validates the remote, source and artifact before calling this stage.
// A normal fast-forward push preserves history and fails safely on a concurrent release.
export async function stageRelease({
  client,
  remote,
  config,
  inventory,
  source,
  version,
  identity,
  publish = false,
  allowDomainChange = false,
  beforePublish,
}) {
  const original = await validatePagesBuild(client, inventory, config, {
    source,
    version,
    requireClean: true,
  });
  const temporary = await mkdtemp(join(tmpdir(), 'portfolio-pages-release-'));
  const checkout = join(temporary, 'gh-pages');
  try {
    git(temporary, [
      'clone',
      '--depth',
      '1',
      '--single-branch',
      '--branch',
      config.publishBranch,
      '--no-tags',
      '--',
      remote,
      checkout,
    ]);
    assertDomainChange(await readDomain(checkout), config.customDomain, allowDomainChange);
    for (const entry of await readdir(checkout)) {
      if (entry !== '.git') await rm(join(checkout, entry), { recursive: true, force: true });
    }
    await cp(client, checkout, { recursive: true, dereference: false });
    const staged = await validatePagesBuild(checkout, inventory, config, {
      source,
      version,
      requireClean: true,
      gitCheckout: true,
    });
    if (staged.release.artifactSha256 !== original.release.artifactSha256)
      throw new Error('Pages output changed while preparing the release.');
    git(checkout, ['add', '--all']);
    const changes = git(checkout, ['diff', '--cached', '--stat']);
    if (!changes) return { status: 'unchanged', changes: '' };
    if (!publish) return { status: 'dry-run', changes };
    if (!identity?.name || !identity?.email)
      throw new Error('Set this source repository’s Git author name and email before publishing.');
    git(checkout, [
      '-c',
      `user.name=${identity.name}`,
      '-c',
      `user.email=${identity.email}`,
      'commit',
      '-m',
      `Deploy source ${source.sourceCommit}`,
    ]);
    const commit = git(checkout, ['rev-parse', 'HEAD']);
    await beforePublish?.();
    git(checkout, ['push', 'origin', `HEAD:refs/heads/${config.publishBranch}`]);
    return { status: 'published', commit, changes };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function deployPages(options) {
  const config = await readConfig();
  const before = sourceState();
  assertReleaseSource(before, config, before.sourceCommit);
  const remote = validateRemote(git(root, ['remote', 'get-url', 'origin']), config);
  const remoteCommit = git(root, [
    'ls-remote',
    '--exit-code',
    '--heads',
    remote,
    `refs/heads/${config.sourceBranch}`,
  ]).split(/\s+/)[0];
  assertReleaseSource(before, config, remoteCommit);
  const identity = options.publish
    ? {
        name: git(root, ['config', 'user.name']),
        email: git(root, ['config', 'user.email']),
      }
    : undefined;
  console.log(
    `${options.publish ? 'Release' : 'Dry run'}: ${config.repository}, source ${before.sourceCommit.slice(0, 12)}; custom domain ${config.customDomain ?? '(none)'}.`,
  );
  for (const args of [['ci'], ['run', 'check'], ['run', 'prepare:pages']]) {
    execFileSync('npm', args, { cwd: root, stdio: 'inherit' });
  }
  const after = sourceState();
  assertReleaseSource(after, config, before.sourceCommit);
  // Detect a newer main commit before publishing an older release.
  const currentRemote = git(root, [
    'ls-remote',
    '--exit-code',
    '--heads',
    remote,
    `refs/heads/${config.sourceBranch}`,
  ]).split(/\s+/)[0];
  assertReleaseSource(after, config, currentRemote);
  const { projects } = await import('../src/projects.js');
  const version = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version;
  const result = await stageRelease({
    client: resolve(root, 'dist/client'),
    remote,
    config,
    inventory: projects,
    source: after,
    version,
    identity,
    beforePublish: () => {
      const latest = git(root, [
        'ls-remote',
        '--exit-code',
        '--heads',
        remote,
        `refs/heads/${config.sourceBranch}`,
      ]).split(/\s+/)[0];
      assertReleaseSource(sourceState(), config, latest);
      if (latest !== after.sourceCommit)
        throw new Error('Source changed while staging the Pages release.');
    },
    ...options,
  });
  if (result.changes) console.log(result.changes);
  console.log(
    result.status === 'published'
      ? `Pushed release ${result.commit}. Check GitHub Pages deployment status before announcing it live.`
      : result.status === 'unchanged'
        ? 'The publishing branch already matches this checked release.'
        : 'Dry run passed. No remote changes. Use npm run deploy:pages -- --publish to release.',
  );
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.help)
      console.log(`Usage: npm run deploy:pages -- [--dry-run | --publish] [--allow-domain-change]

Default: dry run. Validates a clean main already pushed to the configured repository,
installs locked dependencies, runs all checks, builds and stages the Pages release.
Only --publish pushes gh-pages, preserving its history. No force push or workflow scope.
--allow-domain-change permits a confirmed CNAME change configured in pages.config.json.
This command does not configure DNS, GitHub Pages settings, or HTTPS certificates.`);
    else await deployPages(options);
  } catch (error) {
    console.error(error.message);
    if (error.stderr) console.error(String(error.stderr).trim());
    process.exitCode = 1;
  }
}
