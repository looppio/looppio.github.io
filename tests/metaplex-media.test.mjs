import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { metaplexProject, metaplexDetails } from '../src/metaplexProject.js';
import { projects } from '../src/projects.js';
import { projectDetails } from '../src/projectDetails.js';
import { projectLabel } from '../src/projectLabels.js';
import { imageMetadata } from '../scripts/check-assets.mjs';

const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpegStartOfFrame = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function publicImageSize(src) {
  assert.equal(typeof src, 'string');
  assert.match(src, /^\/assets\/.+\.(?:jpe?g|png)$/i, src);
  const path = resolve(publicRoot, `.${src}`);
  assert.ok(path.startsWith(resolve(publicRoot) + sep), `Image must stay inside public: ${src}`);
  assert.ok(statSync(path).isFile(), src);
  const bytes = readFileSync(path);
  assert.ok(bytes.length >= 24, `Image is empty or truncated: ${src}`);

  if (/\.png$/i.test(src)) {
    assert.deepEqual(bytes.subarray(0, 8), pngSignature, src);
    assert.equal(bytes.readUInt32BE(8), 13, `Invalid PNG IHDR length: ${src}`);
    assert.equal(bytes.toString('ascii', 12, 16), 'IHDR', src);
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  }

  assert.equal(bytes.readUInt16BE(0), 0xffd8, `Invalid JPEG signature: ${src}`);
  let offset = 2;
  while (offset < bytes.length) {
    assert.equal(bytes[offset], 0xff, `Invalid JPEG marker: ${src}`);
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    assert.ok(offset + 2 <= bytes.length, `Truncated JPEG segment: ${src}`);
    const length = bytes.readUInt16BE(offset);
    assert.ok(
      length >= 2 && offset + length <= bytes.length,
      `Invalid JPEG segment length: ${src}`,
    );
    if (jpegStartOfFrame.has(marker)) {
      assert.ok(length >= 8, `Truncated JPEG frame: ${src}`);
      return [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)];
    }
    offset += length;
  }
  assert.fail(`JPEG has no size-bearing frame: ${src}`);
}

test('Metaplex is registered once immediately after Zircuit with its detail record and public label', () => {
  const matches = projects.filter((project) => project.id === 'metaplex');
  assert.equal(matches.length, 1);
  assert.strictEqual(matches[0], metaplexProject);
  assert.equal(metaplexProject.slug, 'metaplex');
  const zircuitIndex = projects.findIndex((project) => project.id === 'zircuit');
  assert.ok(zircuitIndex >= 0);
  assert.strictEqual(projects[zircuitIndex + 1], metaplexProject);
  assert.strictEqual(projectDetails.metaplex, metaplexDetails);
  assert.equal(projectLabel(metaplexProject), 'Metaplex');

  const website = new URL(metaplexProject.websiteUrl);
  assert.equal(website.protocol, 'https:');
  assert.ok(['metaplex.com', 'www.metaplex.com'].includes(website.hostname));
  assert.equal(website.pathname, '/');
  assert.equal(website.search + website.hash + website.username + website.password, '');
});

test('Metaplex media references real original JPEG and PNG files with matching dimensions and useful alt text', () => {
  const media = metaplexProject.media;
  assert.ok(Array.isArray(media) && media.length > 0);
  assert.equal(new Set(media.map((item) => item.src)).size, media.length, 'Duplicate media source');
  const formats = new Set();
  for (const item of media) {
    assert.equal(item.type, 'image', item.src);
    assert.ok(Number.isInteger(item.width) && item.width > 0, item.src);
    assert.ok(Number.isInteger(item.height) && item.height > 0, item.src);
    assert.ok(typeof item.alt === 'string' && item.alt.trim().length > 8, item.src);
    assert.deepEqual(publicImageSize(item.src), [item.width, item.height], item.src);
    formats.add(item.src.toLowerCase().endsWith('.png') ? 'png' : 'jpeg');
  }
  assert.deepEqual([...formats].sort(), ['jpeg', 'png']);
});

test('Metaplex cover preserves the approved hero aspect and the raw portrait opts into mobile presentation', () => {
  const hero = metaplexProject.media.find((item) => item.src.endsWith('/website-hero.jpg'));
  assert.ok(hero, 'The accepted hero must remain in the case');
  const { coverWidth, coverHeight } = metaplexProject;
  assert.equal(metaplexProject.cover, '/assets/covers/metaplex.webp');
  assert.ok(coverWidth <= 1280, 'Gallery thumbnails should not download full case images');
  assert.ok(Math.abs(coverWidth / coverHeight - hero.width / hero.height) < 0.002);
  assert.deepEqual(
    imageMetadata(readFileSync(resolve(publicRoot, `.${metaplexProject.cover}`)), '.webp'),
    { width: coverWidth, height: coverHeight },
  );
  assert.equal(Object.hasOwn(metaplexProject, 'coverVideo'), false);

  const portraits = metaplexProject.media.filter((item) => item.height > item.width);
  assert.ok(portraits.length > 0);
  for (const item of metaplexProject.media) {
    assert.equal(item.presentation === 'mobile', item.height > item.width, item.src);
  }
});

test('Metaplex public data includes owner-approved contribution without unconfirmed metadata or private provenance', () => {
  assert.equal(metaplexDetails.verifiedContribution, true);
  for (const field of ['contribution', 'scope']) {
    assert.ok(metaplexDetails[field].length > 0, `${field} should contain approved copy`);
    for (const text of metaplexDetails[field]) {
      assert.equal(typeof text, 'string');
      assert.ok(text.trim().length > 0);
      assert.doesNotMatch(text, /lorem ipsum|placeholder/i);
    }
  }
  assert.equal(Object.hasOwn(metaplexDetails, 'contributionPlaceholder'), false);
  for (const record of [metaplexProject, metaplexDetails]) {
    for (const key of ['role', 'period', 'duration', 'results'])
      assert.equal(Object.hasOwn(record, key), false, key);
  }
  const forbidden = new Set([
    'source',
    'sources',
    'credit',
    'credits',
    'coauthor',
    'coauthors',
    'collaborator',
    'collaborators',
  ]);
  const inspect = (value, path) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.equal(
        forbidden.has(key.toLowerCase()),
        false,
        `Unconfirmed attribution or provenance at ${path}.${key}`,
      );
      inspect(child, `${path}.${key}`);
    }
  };
  inspect(metaplexProject, 'project');
  inspect(metaplexDetails, 'details');
});
