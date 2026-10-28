import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { projects } from '../src/projects.js';
import {
  artifactDigest,
  pageRoutes,
  readConfig,
  releaseFilename,
  root,
  runtimeNotices,
  sourceState,
  validateConfig,
  validatePagesBuild,
} from './pages-release.mjs';

export async function preparePagesBuild(client, inventory = projects, options = {}) {
  const index = resolve(client, 'index.html');
  const html = await readFile(index, 'utf8');
  if (html.includes('/src/main.jsx')) throw new Error('Build the production client first.');
  const routes = pageRoutes(inventory);
  const config = validateConfig(options.config ?? (await readConfig()));
  const source = options.source ?? sourceState();
  const version =
    options.version ?? JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version;
  // These directories are generated from the inventory, so removed cases cannot linger.
  for (const directory of ['full', 'projects'])
    await rm(resolve(client, directory), { recursive: true, force: true });
  for (const route of routes) {
    const directory = resolve(client, route);
    await mkdir(directory, { recursive: true });
    await copyFile(index, resolve(directory, 'index.html'));
  }
  // Branch-based GitHub Pages must serve Vite's output without Jekyll processing.
  await writeFile(resolve(client, '.nojekyll'), '');
  await mkdir(resolve(client, 'licenses'), { recursive: true });
  for (const notice of runtimeNotices) {
    await copyFile(
      resolve(root, 'docs/licenses', `${notice}.txt`),
      resolve(client, 'licenses', `${notice}.txt`),
    );
  }
  if (config.customDomain) await writeFile(resolve(client, 'CNAME'), `${config.customDomain}\n`);
  else await rm(resolve(client, 'CNAME'), { force: true });
  const release = {
    schemaVersion: 1,
    repository: config.repository,
    sourceBranch: source.sourceBranch,
    sourceCommit: source.sourceCommit,
    sourceDirty: source.sourceDirty,
    version,
    customDomain: config.customDomain,
    routeCount: routes.length,
    artifactSha256: await artifactDigest(client),
  };
  await writeFile(resolve(client, releaseFilename), `${JSON.stringify(release, null, 2)}\n`);
  await validatePagesBuild(client, inventory, config, { source, version });
  return routes;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const client = fileURLToPath(new URL('../dist/client/', import.meta.url));
  const routes = await preparePagesBuild(client);
  console.log(`Prepared GitHub Pages: ${routes.length} direct routes and .nojekyll.`);
}
