import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultRoot = fileURLToPath(new URL('../', import.meta.url));
const textExtensions = new Set(['.js', '.jsx', '.mjs', '.css', '.html', '.json']);
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
const assetExtension =
  /\.(?:png|jpe?g|webp|gif|svg|mp4|webm|pdf|woff2?|ttf|otf|glb|gltf|bin|json|css)(?:[?#].*)?$/i;
const external = (value) => /^(?:https?:|data:|blob:|mailto:|#|\/\/)/i.test(value);
const uriPath = (value) => decodeURIComponent(value.split(/[?#]/, 1)[0]);
const integerSize = (value) => Number.isInteger(value) && value > 0;

async function filesUnder(folder) {
  let entries;
  try {
    entries = await readdir(folder, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const children = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? filesUnder(resolve(folder, entry.name))
        : entry.isFile()
          ? [resolve(folder, entry.name)]
          : [],
    ),
  );
  return children.flat().sort();
}

export function imageMetadata(bytes, extension) {
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    extension = '.png';
  else if (bytes.length >= 2 && bytes.readUInt16BE(0) === 0xffd8) extension = '.jpg';
  else if (bytes.length >= 6 && /^GIF8[79]a$/.test(bytes.toString('ascii', 0, 6)))
    extension = '.gif';
  else if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  )
    extension = '.webp';
  if (
    extension === '.png' &&
    bytes.length >= 24 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (['.jpg', '.jpeg'].includes(extension) && bytes.readUInt16BE(0) === 0xffd8) {
    const frames = new Set([
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
    ]);
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if ([0xda, 0xd9].includes(marker)) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (frames.has(marker) && length >= 8)
        return { width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3) };
      offset += length;
    }
  }
  if (
    extension === '.gif' &&
    bytes.length >= 13 &&
    /^GIF8[79]a$/.test(bytes.toString('ascii', 0, 6))
  ) {
    let offset = 13 + (bytes[10] & 128 ? 3 * 2 ** ((bytes[10] & 7) + 1) : 0),
      frames = 0;
    const skipBlocks = () => {
      while (offset < bytes.length) {
        const size = bytes[offset++];
        if (!size) return;
        offset += size;
      }
    };
    while (offset < bytes.length) {
      const marker = bytes[offset++];
      if (marker === 0x3b) break;
      if (marker === 0x21) {
        offset++;
        skipBlocks();
      } else if (marker === 0x2c && offset + 9 <= bytes.length) {
        frames++;
        const flags = bytes[offset + 8];
        offset += 9;
        if (flags & 128) offset += 3 * 2 ** ((flags & 7) + 1);
        offset++;
        skipBlocks();
      } else break;
    }
    return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8), frames };
  }
  if (
    extension === '.webp' &&
    bytes.length >= 30 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    for (let offset = 12; offset + 8 <= bytes.length; ) {
      const tag = bytes.toString('ascii', offset, offset + 4),
        length = bytes.readUInt32LE(offset + 4),
        body = offset + 8;
      if (body + length > bytes.length) break;
      if (tag === 'VP8X' && length >= 10)
        return {
          width: bytes.readUIntLE(body + 4, 3) + 1,
          height: bytes.readUIntLE(body + 7, 3) + 1,
        };
      if (tag === 'VP8L' && length >= 5 && bytes[body] === 0x2f) {
        const packed = bytes.readUInt32LE(body + 1);
        return { width: (packed & 0x3fff) + 1, height: ((packed >>> 14) & 0x3fff) + 1 };
      }
      if (tag === 'VP8 ' && length >= 10 && bytes.toString('hex', body + 3, body + 6) === '9d012a')
        return {
          width: bytes.readUInt16LE(body + 6) & 0x3fff,
          height: bytes.readUInt16LE(body + 8) & 0x3fff,
        };
      offset = body + length + (length & 1);
    }
  }
  if (extension === '.svg') {
    const tag = bytes.toString('utf8').match(/<svg\b[^>]*>/i)?.[0] || '';
    const width = Number(tag.match(/\bwidth=["']([\d.]+)(?:px)?["']/i)?.[1]);
    const height = Number(tag.match(/\bheight=["']([\d.]+)(?:px)?["']/i)?.[1]);
    const viewBox = tag
      .match(/\bviewBox=["']([^"']+)["']/)?.[1]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (width > 0 && height > 0) return { width, height };
    if (viewBox?.length === 4 && viewBox[2] > 0 && viewBox[3] > 0)
      return { width: viewBox[2], height: viewBox[3] };
  }
  throw new Error(`Cannot read ${extension} image dimensions`);
}

function mp4Boxes(bytes, start = 0, end = bytes.length) {
  const boxes = [];
  for (let offset = start; offset + 8 <= end; ) {
    let size = bytes.readUInt32BE(offset),
      header = 8;
    if (size === 1) {
      if (offset + 16 > end) break;
      size = Number(bytes.readBigUInt64BE(offset + 8));
      header = 16;
    }
    if (size === 0) size = end - offset;
    if (!Number.isSafeInteger(size) || size < header || offset + size > end) break;
    boxes.push({
      type: bytes.toString('ascii', offset + 4, offset + 8),
      start: offset,
      body: offset + header,
      end: offset + size,
    });
    offset += size;
  }
  return boxes;
}

export function mp4Metadata(bytes) {
  const top = mp4Boxes(bytes),
    moov = top.find((box) => box.type === 'moov');
  if (!moov) throw new Error('MP4 has no moov metadata');
  const inside = (box) => mp4Boxes(bytes, box.body, box.end);
  for (const track of inside(moov).filter((box) => box.type === 'trak')) {
    const children = inside(track),
      media = children.find((box) => box.type === 'mdia'),
      header = children.find((box) => box.type === 'tkhd');
    if (!media || !header) continue;
    const mediaChildren = inside(media),
      handler = mediaChildren.find((box) => box.type === 'hdlr'),
      timing = mediaChildren.find((box) => box.type === 'mdhd');
    if (!handler || bytes.toString('ascii', handler.body + 8, handler.body + 12) !== 'vide')
      continue;
    const width = bytes.readUInt32BE(header.end - 8) / 65536,
      height = bytes.readUInt32BE(header.end - 4) / 65536;
    let duration;
    if (timing) {
      const wide = bytes[timing.body] === 1,
        scaleOffset = timing.body + (wide ? 20 : 12),
        durationOffset = scaleOffset + 4;
      const scale = bytes.readUInt32BE(scaleOffset),
        units = wide
          ? Number(bytes.readBigUInt64BE(durationOffset))
          : bytes.readUInt32BE(durationOffset);
      if (scale) duration = units / scale;
    }
    if (!(width > 0 && height > 0)) throw new Error('MP4 video dimensions are empty');
    return {
      width,
      height,
      duration,
      faststart: moov.start < (top.find((box) => box.type === 'mdat')?.start ?? Infinity),
    };
  }
  throw new Error('MP4 has no sized video track');
}

function localReferences(text, extension, baseUri) {
  const matches =
    extension === '.css'
      ? [...text.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/g)].map((match) => match[2])
      : [...text.matchAll(/(["'`])(\/assets\/[^\s"'`<>)]*)\1/g)].map((match) => match[2]);
  return matches.flatMap((value) => {
    if (!value || external(value)) return [];
    if (value.startsWith('/assets/')) return [value];
    if (baseUri && extension === '.css' && !value.includes('${'))
      return [new URL(value, 'https://local.test' + baseUri).pathname];
    return [];
  });
}

/** Read-only integrity and conservative reachability audit. Never deletes files. */
export async function checkAssets({ projectRoot = defaultRoot, projects: suppliedProjects } = {}) {
  projectRoot = resolve(projectRoot);
  const publicRoot = resolve(projectRoot, 'public'),
    errors = [],
    warnings = [],
    references = new Map(),
    dynamicReferences = [];
  const issue = (list, code, at, message) => list.push({ code, at, message });
  const inventory = await filesUnder(publicRoot),
    metadata = new Map(),
    inspected = new Set();
  const normalize = (value, at) => {
    if (typeof value !== 'string' || !value) {
      issue(errors, 'asset-uri', at, 'Expected a nonempty asset URI');
      return null;
    }
    if (external(value)) return null;
    try {
      const decoded = uriPath(value);
      if (
        !decoded.startsWith('/') ||
        decoded.includes('\\') ||
        decoded.split('/').includes('..') ||
        decoded.includes('\0')
      )
        throw new Error('Unsafe local path');
      return decoded;
    } catch {
      issue(errors, 'asset-uri', at, `Invalid local asset URI: ${value}`);
      return null;
    }
  };
  const reference = async (value, at) => {
    const uri = normalize(value, at);
    if (!uri) return null;
    if (!references.has(uri)) references.set(uri, []);
    references.get(uri).push(at);
    if (inspected.has(uri)) return metadata.get(uri) || null;
    inspected.add(uri);
    const path = resolve(publicRoot, '.' + uri);
    if (!path.startsWith(publicRoot + sep)) {
      issue(errors, 'asset-uri', at, `Path escapes public: ${uri}`);
      return null;
    }
    let bytes;
    try {
      bytes = await readFile(path);
    } catch {
      issue(errors, 'missing-asset', at, `Missing public file: ${uri}`);
      return null;
    }
    const extension = extname(uri).toLowerCase();
    let data = { bytes: bytes.length };
    if (!bytes.length) issue(errors, 'empty-asset', at, `Empty public file: ${uri}`);
    try {
      if (imageExtensions.has(extension)) data = { ...data, ...imageMetadata(bytes, extension) };
      if (extension === '.mp4') data = { ...data, ...mp4Metadata(bytes) };
      if (extension === '.pdf' && bytes.toString('ascii', 0, 5) !== '%PDF-')
        throw new Error('Invalid PDF header');
      if (extension === '.woff2' && bytes.toString('ascii', 0, 4) !== 'wOF2')
        throw new Error('Invalid WOFF2 header');
      if (extension === '.glb' && bytes.toString('ascii', 0, 4) !== 'glTF')
        throw new Error('Invalid GLB header');
    } catch (error) {
      issue(errors, 'asset-format', at, `${uri}: ${error.message}`);
    }
    metadata.set(uri, data);
    if (extension === '.css')
      for (const child of localReferences(bytes.toString('utf8'), '.css', uri))
        await reference(child, `public${uri}`);
    if (extension === '.json' || extension === '.gltf' || extension === '.glb') {
      try {
        const json =
          extension === '.glb'
            ? JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)).trim())
            : JSON.parse(bytes.toString('utf8'));
        const visit = async (value) => {
          if (typeof value === 'string' && !external(value) && assetExtension.test(value))
            await reference(new URL(value, 'https://local.test' + uri).pathname, `public${uri}`);
          else if (value && typeof value === 'object')
            for (const child of Object.values(value)) await visit(child);
        };
        await visit(json);
      } catch (error) {
        if (['.json', '.gltf'].includes(extension))
          issue(errors, 'asset-format', at, `Invalid referenced JSON: ${uri}`);
      }
    }
    return data;
  };
  const size = (declared, actual, at) => {
    if (!integerSize(declared.width) || !integerSize(declared.height))
      issue(errors, 'media-dimensions', at, 'Width and height must be positive integers');
    else if (
      actual?.width &&
      (declared.width !== actual.width || declared.height !== actual.height)
    )
      issue(
        errors,
        'dimension-mismatch',
        at,
        `Declared ${declared.width}×${declared.height}, actual ${actual.width}×${actual.height}`,
      );
  };
  const projects =
    suppliedProjects ??
    (await import(pathToFileURL(resolve(projectRoot, 'src/projects.js')).href)).projects;
  const ids = new Set(),
    slugs = new Set();
  let leaves = 0,
    videos = 0;
  for (const [index, project] of projects.entries()) {
    const at = `projects[${index}](${project.id || '?'})`;
    for (const [key, seen] of [
      ['id', ids],
      ['slug', slugs],
    ]) {
      if (typeof project[key] !== 'string' || !project[key])
        issue(errors, 'case-identity', at, `Case ${key} is missing`);
      else if (seen.has(project[key]))
        issue(errors, 'duplicate-case', at, `Duplicate case ${key}: ${project[key]}`);
      seen.add(project[key]);
    }
    const cover = await reference(project.cover, at + '.cover');
    size({ width: project.coverWidth, height: project.coverHeight }, cover, at + '.cover');
    if (project.coverVideo)
      await reference(
        typeof project.coverVideo === 'string' ? project.coverVideo : project.coverVideo.src,
        at + '.coverVideo',
      );
    const used = new Set();
    const media = async (items, location) => {
      if (!Array.isArray(items)) {
        issue(errors, 'media-list', location, 'Expected a media array');
        return;
      }
      for (const [mediaIndex, item] of items.entries()) {
        const itemAt = `${location}[${mediaIndex}]`;
        if (item?.type === 'group') {
          await media(item.items, itemAt + '.items');
          continue;
        }
        if (!item || !['image', 'video'].includes(item.type)) {
          issue(errors, 'media-type', itemAt, 'Expected an image, video or group');
          continue;
        }
        leaves++;
        const actual = await reference(item.src, itemAt + '.src');
        size(item, actual, itemAt);
        const canonical = typeof item.src === 'string' ? item.src.split(/[?#]/, 1)[0] : null;
        if (used.has(canonical))
          issue(
            warnings,
            'repeated-media-uri',
            itemAt,
            `Repeated media URI within a case: ${canonical}`,
          );
        used.add(canonical);
        if (item.type === 'video') {
          videos++;
          if (!item.poster) issue(errors, 'video-poster', itemAt, 'Video needs an explicit poster');
          else {
            const poster = await reference(item.poster, itemAt + '.poster');
            if (
              poster?.width &&
              Math.abs(poster.width / poster.height - item.width / item.height) > 0.005
            )
              issue(errors, 'poster-aspect', itemAt, 'Poster aspect differs from its video');
          }
          if (
            item.duration !== undefined &&
            (!(item.duration > 0) || !Number.isFinite(item.duration))
          )
            issue(errors, 'video-duration', itemAt, 'Video duration must be positive');
          else if (
            item.duration &&
            actual?.duration &&
            Math.abs(item.duration - actual.duration) > Math.max(0.06, actual.duration * 0.005)
          )
            issue(
              errors,
              'video-duration',
              itemAt,
              `Declared ${item.duration}s, actual video track ${actual.duration}s`,
            );
        } else if ((actual?.frames || 0) > 1)
          issue(
            warnings,
            'animated-image',
            itemAt,
            'Animated GIF is referenced as an image; the WebGL image texture does not provide video playback',
          );
      }
    };
    await media(project.media, at + '.media');
  }
  const staticFiles = [
    ...(await filesUnder(resolve(projectRoot, 'src'))),
    ...(await filesUnder(resolve(projectRoot, 'worker'))),
    ...(await filesUnder(resolve(projectRoot, '.openai'))),
  ];
  for (const file of await readdir(projectRoot, { withFileTypes: true }))
    if (file.isFile() && textExtensions.has(extname(file.name)))
      staticFiles.push(resolve(projectRoot, file.name));
  for (const file of staticFiles.filter((file) => textExtensions.has(extname(file)))) {
    const text = await readFile(file, 'utf8'),
      origin = relative(projectRoot, file);
    for (const value of localReferences(text, extname(file))) {
      if (value.includes('${') || !assetExtension.test(value)) {
        dynamicReferences.push({ source: origin, prefix: value.split('${', 1)[0] });
        continue;
      }
      await reference(value, origin);
    }
  }
  const retained = [],
    unused = [],
    hashes = new Map(),
    files = [];
  for (const path of inventory) {
    const uri = '/' + relative(publicRoot, path).split(sep).join('/'),
      bytes = await readFile(path),
      hash = createHash('sha256').update(bytes).digest('hex');
    const reasons = [...(references.get(uri) || [])];
    for (const dynamic of dynamicReferences)
      if (uri.startsWith(dynamic.prefix)) reasons.push(`dynamic prefix in ${dynamic.source}`);
    if (/\/(?:OFL|LICEN[CS]E)(?:\.[\w-]+)?$/i.test(uri)) reasons.push('distribution license');
    const item = { uri, bytes: bytes.length, sha256: hash, referencedBy: reasons };
    files.push(item);
    (reasons.length ? retained : unused).push(item);
    if (!hashes.has(hash)) hashes.set(hash, []);
    hashes.get(hash).push(item);
  }
  const duplicateFiles = [...hashes.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      bytesEach: group[0].bytes,
      possibleSaving: group[0].bytes * (group.length - 1),
      uris: group.map((file) => file.uri),
    }));
  return {
    summary: {
      projects: projects.length,
      leafMedia: leaves,
      videos,
      publicFiles: files.length,
      publicBytes: files.reduce((sum, file) => sum + file.bytes, 0),
      referencedFiles: retained.length,
      unusedFiles: unused.length,
      unusedBytes: unused.reduce((sum, file) => sum + file.bytes, 0),
      errors: errors.length,
      warnings: warnings.length,
    },
    errors,
    warnings,
    dynamicReferences,
    unused,
    duplicateFiles,
    largest: [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 20),
    files,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await checkAssets();
    if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(
        `Assets: ${report.summary.publicFiles} files, ${report.summary.publicBytes} bytes; ${report.summary.projects} cases, ${report.summary.leafMedia} leaf media, ${report.summary.videos} videos.`,
      );
      console.log(
        `${report.errors.length} errors, ${report.warnings.length} warnings; ${report.unused.length} unreferenced files (${report.summary.unusedBytes} bytes).`,
      );
      for (const item of [...report.errors, ...report.warnings])
        console.log(`${item.code}: ${item.at}: ${item.message}`);
      if (report.dynamicReferences.length)
        console.log(
          `Conservatively retained ${report.dynamicReferences.length} dynamic asset prefixes; inspect --json before cleanup.`,
        );
    }
    process.exitCode = report.errors.length ? 1 : 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
