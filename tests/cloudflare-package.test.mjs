import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  packageCloudflareZip,
  parseOptions,
  prepareCloudflareBuild,
  validateCloudflareBuild,
  validateUploadSizes,
} from '../scripts/prepare-cloudflare-build.mjs';
import { preparePagesBuild } from '../scripts/prepare-pages-build.mjs';
import { artifactDigest, artifactFiles, readConfig } from '../scripts/pages-release.mjs';

const inventory = [{ slug: 'alpha' }, { slug: 'beta' }];
const options = {
  config: { ...(await readConfig()), customDomain: 'alextish.com' },
  source: { sourceBranch: 'main', sourceCommit: 'a'.repeat(40), sourceDirty: true },
  version: '1.2.0',
};

async function fixture(t) {
  const temporary = await mkdtemp(join(tmpdir(), 'cloudflare-package-test-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const client = join(temporary, 'client');
  const output = join(temporary, 'cloudflare');
  await mkdir(join(client, 'assets'), { recursive: true });
  await writeFile(join(client, 'assets/app.js'), 'console.log("static candidate");');
  await writeFile(
    join(client, 'index.html'),
    '<!doctype html><script type="module" src="/assets/app.js"></script>',
  );
  await preparePagesBuild(client, inventory, options);
  return { temporary, client, output };
}

test('Cloudflare preparation preserves the GitHub artifact and creates explicit routes, 404 and candidate identity', async (t) => {
  const f = await fixture(t);
  const original = await artifactDigest(f.client);
  const originalMetadata = await readFile(join(f.client, 'release-source.json'));
  const result = await prepareCloudflareBuild(f.client, f.output, inventory, options);
  assert.equal(await artifactDigest(f.client), original);
  assert.deepEqual(await readFile(join(f.client, 'release-source.json')), originalMetadata);
  assert.equal(await readFile(join(f.client, 'CNAME'), 'utf8'), 'alextish.com\n');
  assert.equal(result.release.platform, 'cloudflare-workers-static');
  assert.equal(result.release.deploymentStatus, 'candidate');
  assert.equal(result.release.customDomain, null);
  assert.equal(result.release.sourceCommit, options.source.sourceCommit);
  assert.equal(result.release.sourceDirty, true);
  assert.equal(result.release.routeCount, 3);
  for (const route of ['full', 'projects/alpha', 'projects/beta'])
    assert.deepEqual(
      await readFile(join(f.output, route, 'index.html')),
      await readFile(join(f.output, 'index.html')),
    );
  assert.match(await readFile(join(f.output, '404.html'), 'utf8'), /<h1>404<\/h1>/);
  for (const file of ['CNAME', '.nojekyll'])
    await assert.rejects(readFile(join(f.output, file)), { code: 'ENOENT' });
  assert.equal(result.release.artifactSha256, await artifactDigest(f.output));
});

test('the repeatable ZIP has root-relative files and validates after extraction', async (t) => {
  const f = await fixture(t);
  await prepareCloudflareBuild(f.client, f.output, inventory, options);
  const first = join(f.temporary, 'first.zip');
  await packageCloudflareZip(f.output, first, inventory, options);
  const names = execFileSync('unzip', ['-Z1', first], { encoding: 'utf8' }).trim().split('\n');
  assert.deepEqual(names, await artifactFiles(f.output));
  assert.ok(names.includes('index.html'));
  assert.ok(names.includes('404.html'));
  const extracted = join(f.temporary, 'extracted');
  execFileSync('unzip', ['-q', first, '-d', extracted]);
  await validateCloudflareBuild(extracted, inventory, options);
  await prepareCloudflareBuild(f.client, f.output, inventory, options);
  const second = join(f.temporary, 'second.zip');
  await packageCloudflareZip(f.output, second, inventory, options);
  assert.deepEqual(await readFile(second), await readFile(first));
});

test('unexpected executable/private material and symlinks cannot enter the static package', async (t) => {
  for (const file of ['_worker.js', 'functions/api.js', 'server/index.js', '.env', 'private.md']) {
    const f = await fixture(t);
    await mkdir(join(f.client, file, '..'), { recursive: true });
    await writeFile(join(f.client, file), 'must not ship');
    await assert.rejects(
      prepareCloudflareBuild(f.client, f.output, inventory, options),
      /Non-static|Private or development/,
    );
  }
  const f = await fixture(t);
  await symlink(join(f.client, 'assets/app.js'), join(f.client, 'assets/linked.js'));
  await assert.rejects(
    prepareCloudflareBuild(f.client, f.output, inventory, options),
    /symbolic link/,
  );
});

test('post-build modifications, unsafe destinations and dashboard size limits are rejected', async (t) => {
  const f = await fixture(t);
  for (const output of [f.client, join(f.client, 'nested'), f.temporary])
    await assert.rejects(prepareCloudflareBuild(f.client, output, inventory, options), /separate/);
  await prepareCloudflareBuild(f.client, f.output, inventory, options);
  await assert.rejects(
    packageCloudflareZip(f.output, join(f.output, 'nested.zip'), inventory, options),
    /outside/,
  );
  await writeFile(join(f.output, 'assets/app.js'), 'changed after preparation');
  await assert.rejects(
    packageCloudflareZip(f.output, join(f.temporary, 'bad.zip'), inventory, options),
    /metadata/,
  );
  assert.doesNotThrow(() => validateUploadSizes([{ name: 'limit.bin', bytes: 25 * 1024 * 1024 }]));
  assert.throws(
    () => validateUploadSizes([{ name: 'oversize.bin', bytes: 25 * 1024 * 1024 + 1 }]),
    /25 MiB/,
  );
  assert.throws(
    () => validateUploadSizes(Array.from({ length: 1001 }, () => ({ name: 'file', bytes: 1 }))),
    /1,000 files/,
  );
  assert.throws(() => parseOptions(['--publish']), /Unknown/);
  assert.throws(() => parseOptions(['--zip']), /incomplete/);
  assert.equal(parseOptions(['--help']).help, true);
  assert.equal(parseOptions(['--platform', 'pages']).platform, 'cloudflare-pages');
  assert.equal(parseOptions(['--platform', 'workers']).platform, 'cloudflare-workers-static');
  assert.throws(() => parseOptions(['--platform', 'unknown']), /Unknown/);
});

test('production records clean published source and its domain without replacing the candidate', async (t) => {
  const f = await fixture(t);
  await prepareCloudflareBuild(f.client, f.output, inventory, options);
  const candidateMetadata = await readFile(join(f.output, 'release-source.json'));
  const candidateDigest = await artifactDigest(f.output);
  const production = {
    ...options,
    production: true,
    domain: 'alextish.com',
    source: { ...options.source, sourceDirty: false },
    remoteCommit: options.source.sourceCommit,
  };
  const output = join(f.temporary, 'production');
  const result = await prepareCloudflareBuild(f.client, output, inventory, production);
  assert.equal(result.release.deploymentStatus, 'production');
  assert.equal(result.release.platform, 'cloudflare-workers-static');
  assert.equal(result.release.customDomain, 'alextish.com');
  assert.equal(result.release.sourceDirty, false);
  await assert.rejects(readFile(join(output, 'CNAME')), { code: 'ENOENT' });
  const archive = join(f.temporary, 'production.zip');
  await packageCloudflareZip(output, archive, inventory, production);
  const archived = JSON.parse(execFileSync('unzip', ['-p', archive, 'release-source.json']));
  assert.deepEqual(archived, result.release);
  assert.deepEqual(await readFile(join(f.output, 'release-source.json')), candidateMetadata);
  assert.equal(await artifactDigest(f.output), candidateDigest);
  await assert.rejects(validateCloudflareBuild(output, inventory, options), /metadata/);
});

test('production refuses dirty, unpushed or wrongly targeted source before changing output', async (t) => {
  const f = await fixture(t);
  const production = {
    ...options,
    production: true,
    domain: 'alextish.com',
    source: { ...options.source, sourceDirty: false },
    remoteCommit: options.source.sourceCommit,
  };
  const output = join(f.temporary, 'production');
  await mkdir(output);
  await writeFile(join(output, 'keep.txt'), 'previous package');
  for (const [change, reason] of [
    [{ source: options.source }, /Commit or stash/],
    [{ remoteCommit: 'b'.repeat(40) }, /Push main first/],
    [{ source: { ...production.source, sourceBranch: 'feature' } }, /main source branch/],
    [{ domain: 'unrelated.example' }, /--domain alextish.com/],
  ]) {
    await assert.rejects(
      prepareCloudflareBuild(f.client, output, inventory, { ...production, ...change }),
      reason,
    );
    assert.equal(await readFile(join(output, 'keep.txt'), 'utf8'), 'previous package');
  }
  const parsed = parseOptions(['--production', '--domain', 'alextish.com']);
  assert.equal(parsed.production, true);
  assert.match(parsed.zip, /cloudflare-production\.zip$/);
  assert.throws(() => parseOptions(['--production']), /--domain/);
  assert.throws(() => parseOptions(['--domain', 'alextish.com']), /--production/);
  assert.throws(
    () => parseOptions(['--production', '--domain', 'alextish.com', '--platform', 'pages']),
    /workers platform/,
  );
});
