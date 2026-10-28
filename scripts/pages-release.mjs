import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const releaseFilename = 'release-source.json';
export const runtimeNotices = ['react', 'three', 'phosphor'];

export function git(directory, args) {
  return execFileSync('git', args, {
    cwd: directory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

export function validateConfig(config) {
  const expected = ['customDomain', 'publishBranch', 'repository', 'schemaVersion', 'sourceBranch'];
  if (
    !config ||
    Object.keys(config).sort().join() !== expected.join() ||
    config.schemaVersion !== 1 ||
    config.repository !== 'looppio/looppio.github.io' ||
    config.sourceBranch !== 'main' ||
    config.publishBranch !== 'gh-pages' ||
    ![null, 'alextish.com'].includes(config.customDomain)
  ) {
    throw new Error(
      'Invalid Pages config: expected looppio/looppio.github.io, main → gh-pages, and null or alextish.com.',
    );
  }
  return config;
}

export async function readConfig(directory = root) {
  return validateConfig(
    JSON.parse(await readFile(resolve(directory, 'pages.config.json'), 'utf8')),
  );
}

export function sourceState(directory = root) {
  return {
    sourceBranch: git(directory, ['branch', '--show-current']),
    sourceCommit: git(directory, ['rev-parse', 'HEAD']),
    sourceDirty: Boolean(git(directory, ['status', '--porcelain', '--untracked-files=all'])),
  };
}

export function assertReleaseSource(source, config, remoteCommit) {
  if (source.sourceDirty) throw new Error('Commit or stash source changes before releasing Pages.');
  if (source.sourceBranch !== config.sourceBranch)
    throw new Error('Release from the main source branch.');
  if (!/^[a-f0-9]{40}$/.test(source.sourceCommit)) throw new Error('Invalid source commit.');
  if (remoteCommit !== source.sourceCommit)
    throw new Error('Push main first: local HEAD must equal the remote main commit.');
}

export function validateRemote(remote, config) {
  const allowed = [
    `https://github.com/${config.repository}`,
    `https://github.com/${config.repository}.git`,
    `git@github.com:${config.repository}`,
    `git@github.com:${config.repository}.git`,
  ];
  if (!allowed.includes(remote))
    throw new Error(
      'The origin remote must be looppio/looppio.github.io without embedded credentials.',
    );
  return remote;
}

export function pageRoutes(inventory) {
  const slugs = inventory.map((project) => project.slug);
  if (slugs.some((slug) => typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) {
    throw new Error('Every case needs a safe, lowercase route slug.');
  }
  if (new Set(slugs).size !== slugs.length) throw new Error('Case route slugs must be unique.');
  return ['full', ...slugs.map((slug) => `projects/${slug}`)];
}

export async function artifactFiles(client, directory = '', gitCheckout = false) {
  if (!(await lstat(resolve(client, directory))).isDirectory())
    throw new Error('Pages output must be a real directory.');
  const files = [];
  for (const entry of await readdir(resolve(client, directory), { withFileTypes: true })) {
    if (gitCheckout && directory === '' && entry.name === '.git') continue;
    const name = directory ? `${directory}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink())
      throw new Error(`Pages output cannot contain a symbolic link: ${name}`);
    if (entry.isDirectory()) files.push(...(await artifactFiles(client, name, gitCheckout)));
    else if (entry.isFile()) files.push(name);
    else throw new Error(`Unsupported Pages output entry: ${name}`);
  }
  return files.sort();
}

export async function artifactDigest(client, files) {
  files ??= await artifactFiles(client);
  const hash = createHash('sha256');
  for (const name of files) {
    if (name === releaseFilename) continue;
    const data = await readFile(resolve(client, name));
    hash.update(`${name}\0${data.length}\0`);
    hash.update(data);
  }
  return hash.digest('hex');
}

export async function readDomain(client) {
  try {
    return (await readFile(resolve(client, 'CNAME'), 'utf8')).trim();
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export function assertDomainChange(currentDomain, desiredDomain, allowDomainChange = false) {
  if (currentDomain !== desiredDomain && !allowDomainChange) {
    throw new Error(
      `CNAME would change from ${currentDomain ?? '(none)'} to ${desiredDomain ?? '(none)'}. Confirm the domain setup, then use --allow-domain-change.`,
    );
  }
}

export async function validatePagesBuild(
  client,
  inventory,
  config,
  {
    source,
    version,
    requireClean = false,
    gitCheckout = false,
    platform = 'github-pages',
    deploymentStatus = 'candidate',
  } = {},
) {
  if (!['github-pages', 'cloudflare-pages', 'cloudflare-workers-static'].includes(platform))
    throw new Error('Unsupported static hosting platform.');
  const cloudflare = platform !== 'github-pages';
  validateConfig(config);
  const routes = pageRoutes(inventory);
  const files = await artifactFiles(client, '', gitCheckout);
  const expectedHtml = new Set(['index.html', ...routes.map((route) => `${route}/index.html`)]);
  const html = await readFile(resolve(client, 'index.html'), 'utf8');
  if (html.includes('/src/main.jsx') || !/<script\b[^>]*type=["']module["']/.test(html)) {
    throw new Error('Build the production client first.');
  }
  for (const file of files) {
    if (
      /(?:^|\/)(?:node_modules|src|qa|work|\.git|\.openai|\.env[^/]*|\.DS_Store)(?:\/|$)/.test(
        file,
      ) ||
      /\.(?:map|md)$/.test(file) ||
      (/source\.json$/.test(file) && file !== releaseFilename)
    )
      throw new Error(`Private or development file in Pages output: ${file}`);
    if (
      cloudflare &&
      /(?:^|\/)(?:CNAME|\.nojekyll|_worker\.js|functions|server)(?:\/|$)/i.test(file)
    )
      throw new Error(`Non-static or host-specific file in Cloudflare output: ${file}`);
    if (file.endsWith('.html') && !expectedHtml.has(file) && !(cloudflare && file === '404.html'))
      throw new Error(`Unexpected or stale Pages route: ${file}`);
  }
  for (const file of expectedHtml) {
    if (!files.includes(file) || (await readFile(resolve(client, file), 'utf8')) !== html) {
      throw new Error(`Missing or stale Pages entry point: ${file}`);
    }
  }
  for (const [, href] of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    if (href.startsWith('data:')) continue;
    const asset = href.split(/[?#]/)[0];
    if (
      !asset.startsWith('/') ||
      asset.startsWith('//') ||
      !files.includes(decodeURIComponent(asset.slice(1)))
    )
      throw new Error(`Missing or non-root HTML asset: ${href}`);
  }
  for (const notice of runtimeNotices) {
    const name = `licenses/${notice}.txt`;
    if (
      !files.includes(name) ||
      !(await readFile(resolve(client, name))).equals(await readFile(resolve(root, 'docs', name)))
    ) {
      throw new Error(`Missing or changed runtime license notice: ${name}`);
    }
  }
  if (cloudflare) {
    const notFound = await readFile(resolve(client, '404.html'), 'utf8');
    if (!/\b404\b/.test(notFound) || /<script\b/i.test(notFound) || notFound === html)
      throw new Error('Cloudflare output needs a static 404.html without the SPA application.');
  } else if (
    !files.includes('.nojekyll') ||
    (await readFile(resolve(client, '.nojekyll'), 'utf8')) !== ''
  ) {
    throw new Error('Pages output needs an empty .nojekyll file.');
  }
  if (!cloudflare && (await readDomain(client)) !== config.customDomain)
    throw new Error('Pages CNAME does not match pages.config.json.');
  const release = JSON.parse(await readFile(resolve(client, releaseFilename), 'utf8'));
  const keys = [
    'artifactSha256',
    'customDomain',
    'repository',
    'routeCount',
    'schemaVersion',
    'sourceBranch',
    'sourceCommit',
    'sourceDirty',
    'version',
  ];
  if (cloudflare) keys.push('deploymentStatus', 'platform');
  if (
    Object.keys(release).sort().join() !== keys.sort().join() ||
    (cloudflare &&
      (release.platform !== platform ||
        !['candidate', 'production'].includes(deploymentStatus) ||
        release.deploymentStatus !== deploymentStatus ||
        (deploymentStatus === 'candidate' && config.customDomain !== null) ||
        (deploymentStatus === 'production' &&
          (platform !== 'cloudflare-workers-static' ||
            config.customDomain !== 'alextish.com' ||
            release.sourceDirty !== false)))) ||
    release.schemaVersion !== 1 ||
    release.repository !== config.repository ||
    release.sourceBranch !== config.sourceBranch ||
    release.customDomain !== config.customDomain ||
    release.routeCount !== routes.length ||
    !/^[a-f0-9]{40}$/.test(release.sourceCommit) ||
    typeof release.sourceDirty !== 'boolean' ||
    typeof release.version !== 'string' ||
    !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(release.version) ||
    (version !== undefined && release.version !== version) ||
    (requireClean && release.sourceDirty) ||
    (source &&
      ['sourceBranch', 'sourceCommit', 'sourceDirty'].some(
        (key) => source[key] !== release[key],
      )) ||
    release.artifactSha256 !== (await artifactDigest(client, files))
  )
    throw new Error(
      'Pages release metadata is invalid, stale, or does not match this artifact/source.',
    );
  return { release, fileCount: files.length, routes };
}
