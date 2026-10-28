import { execFileSync } from 'node:child_process';
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { projects } from '../src/projects.js';
import { preparePagesBuild } from './prepare-pages-build.mjs';
import {
  artifactDigest,
  artifactFiles,
  assertReleaseSource,
  git,
  readConfig,
  releaseFilename,
  root,
  sourceState,
  validatePagesBuild,
  validateRemote,
} from './pages-release.mjs';

const defaultOutput = resolve(root, 'dist/cloudflare');
const defaultZip = resolve(root, 'dist/cloudflare-candidate.zip');
const productionOutput = resolve(root, 'dist/cloudflare-production');
const productionZip = resolve(root, 'dist/cloudflare-production.zip');
const defaultPlatform = 'cloudflare-workers-static';
const epoch = new Date('1980-01-01T00:00:00Z');
const notFoundHtml = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>404 | Oleksii Tyshchenko</title></head>
<body><main><h1>404</h1><p>This page could not be found.</p><a href="/">Return to the portfolio</a></main></body>
</html>
`;

function contains(parent, child) {
  const path = relative(resolve(parent), resolve(child));
  return path === '' || (!path.startsWith('..') && !isAbsolute(path));
}

export function validateUploadSizes(entries) {
  if (entries.length > 1000) throw new Error('Cloudflare dashboard upload exceeds 1,000 files.');
  for (const { name, bytes } of entries)
    if (bytes > 25 * 1024 * 1024) throw new Error(`Cloudflare asset exceeds 25 MiB: ${name}`);
}

export async function validateCloudflareBuild(directory, inventory = projects, options = {}) {
  const config = await targetConfig(options);
  const result = await validatePagesBuild(directory, inventory, config, {
    ...options,
    platform: options.platform ?? defaultPlatform,
    deploymentStatus: options.production ? 'production' : 'candidate',
    requireClean: options.production || options.requireClean,
  });
  const files = await artifactFiles(directory);
  const entries = await Promise.all(
    files.map(async (name) => ({ name, bytes: (await stat(resolve(directory, name))).size })),
  );
  validateUploadSizes(entries);
  return {
    ...result,
    totalBytes: entries.reduce((total, entry) => total + entry.bytes, 0),
    largestAssetBytes: Math.max(...entries.map((entry) => entry.bytes)),
  };
}

async function targetConfig(options) {
  if (
    options.production &&
    (options.domain !== 'alextish.com' || (options.platform ?? defaultPlatform) !== defaultPlatform)
  )
    throw new Error('Production requires Workers Static Assets and --domain alextish.com.');
  if (!options.production && options.domain)
    throw new Error('A domain is only recorded for an explicit production package.');
  return {
    ...(options.config ?? (await readConfig())),
    customDomain: options.production ? options.domain : null,
  };
}

export async function prepareCloudflareBuild(
  client = resolve(root, 'dist/client'),
  destination,
  inventory = projects,
  options = {},
) {
  destination ??= options.production ? productionOutput : defaultOutput;
  if (
    options.production &&
    (contains(defaultOutput, destination) || contains(destination, defaultOutput))
  )
    throw new Error('Production output must not replace the candidate directory.');
  if (contains(client, destination) || contains(destination, client))
    throw new Error('Cloudflare output must be separate from the original client build.');
  const sourceFiles = await artifactFiles(client);
  for (const file of sourceFiles)
    if (/(?:^|\/)(?:_worker\.js|functions|server)(?:\/|$)/i.test(file))
      throw new Error(`Non-static file in client build: ${file}`);
  const config = await targetConfig(options);
  const source = options.source ?? sourceState();
  if (options.production) assertReleaseSource(source, config, options.remoteCommit);
  const platform = options.platform ?? defaultPlatform;
  const version =
    options.version ?? JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version;
  await mkdir(dirname(destination), { recursive: true });
  const staging = await mkdtemp(resolve(dirname(destination), '.cloudflare-staging-'));
  try {
    await cp(client, staging, { recursive: true });
    await preparePagesBuild(staging, inventory, {
      config: { ...config, customDomain: null },
      source,
      version,
    });
    await rm(resolve(staging, '.nojekyll'));
    await writeFile(resolve(staging, '404.html'), notFoundHtml);
    const release = JSON.parse(await readFile(resolve(staging, releaseFilename), 'utf8'));
    Object.assign(release, {
      platform,
      deploymentStatus: options.production ? 'production' : 'candidate',
      customDomain: config.customDomain,
      artifactSha256: await artifactDigest(staging),
    });
    await writeFile(resolve(staging, releaseFilename), `${JSON.stringify(release, null, 2)}\n`);
    const result = await validateCloudflareBuild(staging, inventory, {
      ...options,
      config,
      source,
      version,
      platform,
    });
    // Normalize only the separate package, so ZIPs do not depend on build timestamps.
    for (const file of await artifactFiles(staging)) {
      await chmod(resolve(staging, file), 0o644);
      await utimes(resolve(staging, file), epoch, epoch);
    }
    await rm(destination, { recursive: true, force: true });
    await rename(staging, destination);
    return result;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

export async function packageCloudflareZip(
  directory = defaultOutput,
  destination = defaultZip,
  inventory = projects,
  options = {},
) {
  destination = resolve(destination);
  if (!destination.endsWith('.zip') || contains(directory, destination))
    throw new Error('Choose a .zip destination outside the Cloudflare asset directory.');
  const result = await validateCloudflareBuild(directory, inventory, options);
  const files = await artifactFiles(directory);
  if (files.some((file) => /[\r\n]/.test(file))) throw new Error('Unsafe ZIP entry name.');
  await mkdir(dirname(destination), { recursive: true });
  const temporary = await mkdtemp(resolve(dirname(destination), '.cloudflare-zip-'));
  try {
    const archive = resolve(temporary, 'candidate.zip');
    // Explicit relative entries prevent an enclosing folder, hidden workspace files or server output.
    execFileSync('zip', ['-X', '-q', archive, '-@'], {
      cwd: directory,
      input: `${files.join('\n')}\n`,
      env: { ...process.env, TZ: 'UTC' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    execFileSync('unzip', ['-tq', archive], { stdio: 'pipe' });
    await rename(archive, destination);
    return { ...result, zip: destination, zipBytes: (await stat(destination)).size };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export function parseOptions(args) {
  const options = {
    zip: null,
    platform: defaultPlatform,
    production: false,
    domain: null,
    help: false,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help') options.help = true;
    else if (args[i] === '--production') options.production = true;
    else if (args[i] === '--domain' && args[i + 1] && !args[i + 1].startsWith('--'))
      options.domain = args[++i];
    else if (args[i] === '--zip' && args[i + 1] && !args[i + 1].startsWith('--'))
      options.zip = resolve(args[++i]);
    else if (args[i] === '--platform' && ['workers', 'pages'].includes(args[i + 1]))
      options.platform = args[++i] === 'pages' ? 'cloudflare-pages' : defaultPlatform;
    else throw new Error(`Unknown or incomplete option: ${args[i]}`);
  }
  options.zip ??= options.production ? productionZip : defaultZip;
  if (
    options.production &&
    (options.domain !== 'alextish.com' || options.platform !== defaultPlatform)
  )
    throw new Error('Production requires --domain alextish.com and the workers platform.');
  if (!options.production && options.domain) throw new Error('--domain requires --production.');
  if (options.production && options.zip === defaultZip)
    throw new Error('Production ZIP must not replace the default candidate ZIP.');
  if (!options.zip.endsWith('.zip')) throw new Error('ZIP output must end in .zip.');
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    console.log(`Prepare a local Cloudflare static package; no upload or DNS changes.
Usage: npm run prepare:cloudflare -- [--platform workers|pages] [--zip /absolute/path/candidate.zip]
Production: npm run prepare:cloudflare -- --production --domain alextish.com [--zip /absolute/path/production.zip]
Default platform: Workers Static Assets, without Worker code or Functions.
Requires an existing production dist/client build and the zip/unzip command-line tools.
Creates dist/cloudflare plus the ZIP (default: dist/cloudflare-candidate.zip).
Production requires clean main matching remote main, rebuilds the client, and writes
dist/cloudflare-production plus dist/cloudflare-production.zip, preserving the candidate.
The candidate has no bound domain; sourceDirty records any uncommitted source changes.
Use npm run check before packaging. Test preview routes, 404, PDFs and video before promotion.`);
  } else {
    let source = sourceState();
    if (options.production) {
      const config = await targetConfig(options);
      // Reject local mistakes before contacting the remote or rebuilding.
      assertReleaseSource(source, config, source.sourceCommit);
      validateRemote(git(root, ['remote', 'get-url', 'origin']), config);
      options.remoteCommit = git(root, [
        'ls-remote',
        '--exit-code',
        'origin',
        'refs/heads/main',
      ]).split(/\s/)[0];
      assertReleaseSource(source, config, options.remoteCommit);
      execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
      source = sourceState();
      assertReleaseSource(source, config, options.remoteCommit);
    }
    const version = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version;
    const settings = { ...options, source, version };
    const output = options.production ? productionOutput : defaultOutput;
    await prepareCloudflareBuild(undefined, output, projects, settings);
    console.log(
      JSON.stringify(await packageCloudflareZip(output, options.zip, projects, settings), null, 2),
    );
  }
}
