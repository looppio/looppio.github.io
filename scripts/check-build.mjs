// Validate the deployable artifact, not a developer's working directory.
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(root, 'dist');
const client = resolve(dist, 'client');
const errors = [];
const files = [];

async function walk(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, item.name);
    if (item.isDirectory()) await walk(path);
    else files.push(path);
  }
}

for (const required of ['client/index.html', 'server/index.js', '.openai/hosting.json']) {
  try {
    if (!(await stat(resolve(dist, required))).size) errors.push(`Empty artifact: ${required}`);
  } catch {
    errors.push(`Missing artifact: ${required}. Run npm run build first.`);
  }
}
if (!errors.length) {
  await walk(client);
  const html = await readFile(resolve(client, 'index.html'), 'utf8');
  if (html.includes('/src/main.jsx')) errors.push('HTML still points to development source.');
  for (const [, href] of html.matchAll(/(?:src|href)="(\/[^"?#]+)"/g)) {
    try {
      await stat(resolve(client, `.${href}`));
    } catch {
      errors.push(`Broken HTML asset: ${href}`);
    }
  }
  for (const path of files) {
    const name = relative(client, path);
    if (
      /(?:^|\/)(?:node_modules|src|qa|work|\.git|\.env[^/]*|\.DS_Store)(?:\/|$)/.test(name) ||
      (/(?:source\.json|\.map|\.md)$/.test(name) && name !== 'release-source.json')
    ) {
      errors.push(`Development or provenance file leaked into build: ${name}`);
    }
  }

  let jsGzip = 0;
  let totalBytes = 0;
  const chunks = [];
  for (const path of files) {
    const bytes = (await stat(path)).size;
    totalBytes += bytes;
    if (!path.endsWith('.js')) continue;
    const gzipBytes = gzipSync(await readFile(path)).length;
    jsGzip += gzipBytes;
    chunks.push({ file: relative(client, path), bytes, gzipBytes });
  }
  // Covers and cases are checked separately. This catches accidental JS dependency bloat.
  if (jsGzip > 400 * 1024)
    errors.push(`JavaScript exceeds the 400 KiB gzip budget: ${(jsGzip / 1024).toFixed(1)} KiB.`);
  console.table(chunks);
  console.log(`Client: ${files.length} files, ${(totalBytes / 1e6).toFixed(2)} MB on disk.`);
  console.log(
    `JavaScript: ${(jsGzip / 1024).toFixed(1)} KiB gzip. This is an artifact size, not a measured page load.`,
  );
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Production artifact checks passed.');
}
