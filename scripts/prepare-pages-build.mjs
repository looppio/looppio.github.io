import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { projects } from '../src/projects.js';

export async function preparePagesBuild(client, inventory = projects) {
  const index = resolve(client, 'index.html');
  const html = await readFile(index, 'utf8');
  if (html.includes('/src/main.jsx')) throw new Error('Build the production client first.');

  const slugs = inventory.map((project) => project.slug);
  if (slugs.some((slug) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) {
    throw new Error('Every case needs a safe, lowercase route slug.');
  }
  if (new Set(slugs).size !== slugs.length) throw new Error('Case route slugs must be unique.');

  const routes = ['full', ...slugs.map((slug) => `projects/${slug}`)];
  for (const route of routes) {
    const directory = resolve(client, route);
    await mkdir(directory, { recursive: true });
    await copyFile(index, resolve(directory, 'index.html'));
  }
  // Branch-based GitHub Pages must serve Vite's output without Jekyll processing.
  await writeFile(resolve(client, '.nojekyll'), '');
  return routes;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const client = fileURLToPath(new URL('../dist/client/', import.meta.url));
  const routes = await preparePagesBuild(client);
  console.log(`Prepared GitHub Pages: ${routes.length} direct routes and .nojekyll.`);
}
