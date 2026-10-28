import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { preparePagesBuild } from '../scripts/prepare-pages-build.mjs';
import { readRoute } from '../src/portfolioRoutes.js';
import { projects } from '../src/projects.js';

const testRelease = {
  source: { sourceBranch: 'main', sourceCommit: 'a'.repeat(40), sourceDirty: false },
  version: '1.0.0',
};

test('direct Pages directory URLs resolve to the same gallery and cases as client links', () => {
  assert.equal(readRoute('/full/', projects).view, 'full');
  assert.equal(readRoute('/full', projects).view, 'full');
  assert.deepEqual(readRoute('/', projects), { view: 'featured', project: null });
  for (const project of projects) {
    assert.equal(readRoute(`/projects/${project.slug}/`, projects).project, project);
    assert.equal(readRoute(`/projects/${project.slug}`, projects).project, project);
  }
  assert.equal(readRoute('/projects/not-a-registered-case/', projects).project, null);
  assert.equal(readRoute('/projects/dexsport/extra/', projects).project, null);
});

test('Pages packaging emits an entry for every case without a catch-all 404 page', async (t) => {
  const client = await mkdtemp(join(tmpdir(), 'portfolio-pages-'));
  t.after(() => rm(client, { recursive: true, force: true }));
  const html = '<!doctype html><script type="module" src="/assets/app.js"></script>';
  await mkdir(join(client, 'assets'));
  await writeFile(join(client, 'assets/app.js'), 'console.log("fixture");');
  await writeFile(join(client, 'index.html'), html);

  await preparePagesBuild(client, projects, testRelease);

  const routes = ['full', ...projects.map((project) => `projects/${project.slug}`)];
  for (const route of routes) {
    assert.equal(await readFile(join(client, route, 'index.html'), 'utf8'), html);
  }
  assert.equal(await readFile(join(client, '.nojekyll'), 'utf8'), '');
  assert.ok(!(await readdir(client)).includes('404.html'));
  assert.deepEqual(
    (await readdir(join(client, 'projects'))).sort(),
    projects.map((p) => p.slug).sort(),
  );
});

test('Pages packaging rejects a development entry or unsafe case route before writing routes', async (t) => {
  const client = await mkdtemp(join(tmpdir(), 'portfolio-pages-invalid-'));
  t.after(() => rm(client, { recursive: true, force: true }));
  await writeFile(join(client, 'index.html'), '<script src="/src/main.jsx"></script>');
  await assert.rejects(preparePagesBuild(client), /production client/);
  await writeFile(join(client, 'index.html'), '<script src="/assets/app.js"></script>');
  await assert.rejects(preparePagesBuild(client, [{ slug: '../escape' }]), /safe/);
  await assert.rejects(preparePagesBuild(client, [{ slug: 'case' }, { slug: 'case' }]), /unique/);
  assert.deepEqual(await readdir(client), ['index.html']);
});
