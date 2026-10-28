import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { projects } from '../src/projects.js';
import { readConfig, root, sourceState, validatePagesBuild } from './pages-release.mjs';

const version = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version;
const result = await validatePagesBuild(
  resolve(root, 'dist/client'),
  projects,
  await readConfig(),
  {
    source: sourceState(),
    version,
  },
);
console.log(
  `Pages artifact passed: ${result.fileCount} files, ${result.routes.length} direct routes, source ${result.release.sourceCommit.slice(0, 12)}${result.release.sourceDirty ? ' (local uncommitted changes; not publishable)' : ''}.`,
);
