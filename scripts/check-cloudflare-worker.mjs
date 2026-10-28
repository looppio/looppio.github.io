import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { artifactFiles, root } from './pages-release.mjs';

const manifestPath = resolve(root, 'worker/cloudflare-media-manifest.json');

export async function mediaManifest(directory) {
  const names = (await artifactFiles(directory)).filter((name) =>
    /^assets\/.*\.(mp4|pdf)$/.test(name),
  );
  if (!names.length) throw new Error('No MP4/PDF files found in the prepared Cloudflare assets.');
  const files = {};
  for (const name of names) {
    const data = await readFile(resolve(directory, name));
    files[`/${name}`] = {
      bytes: data.byteLength,
      sha256: createHash('sha256').update(data).digest('hex'),
    };
  }
  return { schemaVersion: 1, files };
}

export async function checkMediaManifest(directory, path = manifestPath) {
  const actual = await mediaManifest(directory);
  const expected = JSON.parse(await readFile(path, 'utf8'));
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(
      'Cloudflare media manifest does not match the asset bundle. Prepare the current assets, run npm run check:cloudflare:worker -- --write, review and commit the updated manifest, then rebuild the release.',
    );
  return Object.keys(actual.files).length;
}

async function main(args) {
  let directory = resolve(root, 'dist/cloudflare');
  let write = false;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--help') {
      console.log(
        'Check media byte sizes and SHA-256 before Wrangler deploy.\nUsage: npm run check:cloudflare:worker -- [--assets DIRECTORY] [--write]\nDefault: dist/cloudflare; --write updates the checked-in manifest and requires source review/commit.',
      );
      return;
    }
    if (args[i] === '--write') write = true;
    else if (args[i] === '--assets' && args[i + 1]) directory = resolve(args[++i]);
    else throw new Error(`Unknown or incomplete option: ${args[i]}`);
  }
  if (write) {
    const manifest = await mediaManifest(directory);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const count = await checkMediaManifest(directory);
  console.log(`Cloudflare Worker media manifest matches ${count} files.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
