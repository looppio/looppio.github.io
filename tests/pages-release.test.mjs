import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { parseOptions, stageRelease } from '../scripts/deploy-pages.mjs';
import { preparePagesBuild } from '../scripts/prepare-pages-build.mjs';
import {
  assertDomainChange,
  assertReleaseSource,
  git,
  readConfig,
  releaseFilename,
  validateConfig,
  validatePagesBuild,
  validateRemote,
} from '../scripts/pages-release.mjs';

const config = { ...(await readConfig()), customDomain: null };
const source = { sourceBranch: 'main', sourceCommit: 'a'.repeat(40), sourceDirty: false };
const identity = { name: 'Pages release test', email: 'test@example.invalid' };
const inventory = [{ slug: 'alpha' }, { slug: 'beta' }];
const version = '1.0.0';

async function fixture(t, domain = null) {
  const temporary = await mkdtemp(join(tmpdir(), 'pages-release-test-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const client = join(temporary, 'client');
  await mkdir(join(client, 'assets'), { recursive: true });
  await writeFile(join(client, 'assets/app.js'), 'console.log("production fixture");');
  await writeFile(
    join(client, 'index.html'),
    '<!doctype html><script type="module" src="/assets/app.js"></script>',
  );
  const settings = { ...config, customDomain: domain };
  await preparePagesBuild(client, inventory, { config: settings, source, version });
  return { temporary, client, config: settings, source, version, inventory, identity };
}

async function localRepository(t) {
  const f = await fixture(t);
  const remote = join(f.temporary, 'remote.git');
  const seed = join(f.temporary, 'seed');
  git(f.temporary, ['init', '--bare', remote]);
  git(f.temporary, ['init', '-b', 'gh-pages', seed]);
  git(seed, ['config', 'user.name', identity.name]);
  git(seed, ['config', 'user.email', identity.email]);
  await writeFile(join(seed, 'index.html'), 'previous public release');
  git(seed, ['add', '.']);
  git(seed, ['commit', '-m', 'Previous release']);
  git(seed, ['remote', 'add', 'origin', remote]);
  git(seed, ['push', 'origin', 'gh-pages']);
  return { ...f, remote, seed, previous: git(seed, ['rev-parse', 'HEAD']) };
}

test('release defaults to dry-run and rejects ambiguous or unknown options', () => {
  assert.deepEqual(parseOptions([]), { publish: false, allowDomainChange: false, help: false });
  assert.equal(parseOptions(['--publish', '--allow-domain-change']).publish, true);
  assert.throws(() => parseOptions(['--force']), /Unknown option/);
  assert.throws(() => parseOptions(['--dry-run', '--publish']), /Choose either/);
});

test('release guards reject wrong destinations, dirty or unpushed source, and unconfirmed domain changes', () => {
  assert.equal(validateConfig(config), config);
  assert.throws(
    () => validateConfig({ ...config, customDomain: 'unrelated.example' }),
    /Invalid Pages config/,
  );
  assert.throws(
    () => validateConfig({ ...config, token: 'never-a-config-field' }),
    /Invalid Pages config/,
  );
  assert.equal(
    validateRemote('https://github.com/looppio/looppio.github.io.git', config),
    'https://github.com/looppio/looppio.github.io.git',
  );
  for (const remote of [
    'https://github.com/another/site.git',
    'https://token@github.com/looppio/looppio.github.io.git',
    '-u',
  ]) {
    assert.throws(() => validateRemote(remote, config), /origin remote/);
  }
  assert.doesNotThrow(() => assertReleaseSource(source, config, source.sourceCommit));
  assert.throws(
    () => assertReleaseSource({ ...source, sourceDirty: true }, config, source.sourceCommit),
    /Commit or stash/,
  );
  assert.throws(
    () => assertReleaseSource({ ...source, sourceBranch: 'feature' }, config, source.sourceCommit),
    /main source branch/,
  );
  assert.throws(() => assertReleaseSource(source, config, 'b'.repeat(40)), /Push main first/);
  assert.doesNotThrow(() => assertDomainChange(null, null));
  assert.throws(() => assertDomainChange(null, 'alextish.com'), /allow-domain-change/);
  assert.throws(() => assertDomainChange('alextish.com', null), /allow-domain-change/);
  assert.doesNotThrow(() => assertDomainChange(null, 'alextish.com', true));
});

test('Pages preparation is repeatable, removes retired routes and binds content to source metadata', async (t) => {
  const f = await fixture(t);
  const first = await readFile(join(f.client, releaseFilename), 'utf8');
  const release = JSON.parse(first);
  assert.equal(release.sourceCommit, source.sourceCommit);
  assert.equal(release.sourceDirty, false);
  assert.equal(release.routeCount, 3);
  assert.match(release.artifactSha256, /^[a-f0-9]{64}$/);
  assert.ok(!first.includes(f.temporary));
  await mkdir(join(f.client, 'projects', 'retired'));
  await writeFile(join(f.client, 'projects', 'retired', 'index.html'), 'obsolete case');
  await preparePagesBuild(f.client, inventory, f);
  assert.deepEqual((await readdir(join(f.client, 'projects'))).sort(), ['alpha', 'beta']);
  assert.equal(await readFile(join(f.client, releaseFilename), 'utf8'), first);
  await validatePagesBuild(f.client, inventory, f.config, { source, version, requireClean: true });
});

test('CNAME and runtime notices are included in the validated output', async (t) => {
  const f = await fixture(t, 'alextish.com');
  assert.equal(await readFile(join(f.client, 'CNAME'), 'utf8'), 'alextish.com\n');
  assert.deepEqual((await readdir(join(f.client, 'licenses'))).sort(), [
    'phosphor.txt',
    'react.txt',
    'three.txt',
  ]);
  await validatePagesBuild(f.client, inventory, f.config, { source, version });
  await writeFile(join(f.client, 'CNAME'), 'wrong.example\n');
  await assert.rejects(validatePagesBuild(f.client, inventory, f.config), /CNAME/);
  await preparePagesBuild(f.client, inventory, { ...f, config });
  await assert.rejects(readFile(join(f.client, 'CNAME')), { code: 'ENOENT' });
  await writeFile(join(f.client, 'licenses/react.txt'), 'removed upstream attribution');
  await assert.rejects(validatePagesBuild(f.client, inventory, config), /license notice/);
});

test('artifact validation detects content tampering, stale metadata, absent routes and symlinks', async (t) => {
  const f = await fixture(t);
  const validate = () => validatePagesBuild(f.client, inventory, config, { source, version });
  await writeFile(join(f.client, 'assets/app.js'), 'changed after build');
  await assert.rejects(validate(), /metadata/);
  await preparePagesBuild(f.client, inventory, f);
  const metadata = JSON.parse(await readFile(join(f.client, releaseFilename), 'utf8'));
  await writeFile(
    join(f.client, releaseFilename),
    JSON.stringify({ ...metadata, sourceCommit: 'b'.repeat(40) }),
  );
  await assert.rejects(validate(), /metadata/);
  await preparePagesBuild(f.client, inventory, f);
  await rm(join(f.client, 'full/index.html'));
  await assert.rejects(validate(), /entry point/);
  await preparePagesBuild(f.client, inventory, f);
  await symlink(join(f.client, 'assets/app.js'), join(f.client, 'assets/linked.js'));
  await assert.rejects(validate(), /symbolic link/);
});

test('dry run stages a release without changing the remote or source files', async (t) => {
  const f = await localRepository(t);
  const before = await readFile(join(f.client, releaseFilename), 'utf8');
  const result = await stageRelease(f);
  assert.equal(result.status, 'dry-run');
  assert.match(result.changes, /release-source.json/);
  assert.equal(git(f.remote, ['rev-parse', 'gh-pages']), f.previous);
  assert.equal(await readFile(join(f.client, releaseFilename), 'utf8'), before);
});

test('an explicit local test release preserves history and an identical release is a no-op', async (t) => {
  const f = await localRepository(t);
  const result = await stageRelease({ ...f, publish: true });
  assert.equal(result.status, 'published');
  assert.equal(git(f.remote, ['rev-parse', 'gh-pages^']), f.previous);
  assert.equal(git(f.remote, ['rev-parse', 'gh-pages']), result.commit);
  assert.equal(
    JSON.parse(git(f.remote, ['show', `gh-pages:${releaseFilename}`])).sourceCommit,
    source.sourceCommit,
  );
  const again = await stageRelease({ ...f, publish: true });
  assert.equal(again.status, 'unchanged');
  assert.equal(git(f.remote, ['rev-parse', 'gh-pages']), result.commit);
});

test('a concurrent publishing-branch update rejects the release without overwriting history', async (t) => {
  const f = await localRepository(t);
  let concurrent;
  await assert.rejects(
    stageRelease({
      ...f,
      publish: true,
      beforePublish: async () => {
        await writeFile(join(f.seed, 'concurrent.txt'), 'a newer release');
        git(f.seed, ['add', '.']);
        git(f.seed, ['commit', '-m', 'Concurrent release']);
        git(f.seed, ['push', 'origin', 'gh-pages']);
        concurrent = git(f.seed, ['rev-parse', 'HEAD']);
      },
    }),
    /git push/,
  );
  assert.equal(git(f.remote, ['rev-parse', 'gh-pages']), concurrent);
  assert.equal(git(f.remote, ['rev-parse', 'gh-pages^']), f.previous);
});
