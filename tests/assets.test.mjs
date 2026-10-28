import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkAssets, imageMetadata, mp4Metadata } from '../scripts/check-assets.mjs';

function png(width, height) {
  const bytes = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

function box(type, ...parts) {
  const body = Buffer.concat(parts),
    result = Buffer.alloc(8);
  result.writeUInt32BE(body.length + 8);
  result.write(type, 4);
  return Buffer.concat([result, body]);
}

function mp4(width, height, duration = 2.5) {
  const track = Buffer.alloc(84);
  track.writeUInt32BE(width * 65536, 76);
  track.writeUInt32BE(height * 65536, 80);
  const handler = Buffer.alloc(24);
  handler.write('vide', 8);
  const timing = Buffer.alloc(24);
  timing.writeUInt32BE(1000, 12);
  timing.writeUInt32BE(duration * 1000, 16);
  return Buffer.concat([
    box('ftyp', Buffer.from('isom0000')),
    box(
      'moov',
      box('trak', box('tkhd', track), box('mdia', box('hdlr', handler), box('mdhd', timing))),
    ),
    box('mdat', Buffer.alloc(4)),
  ]);
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'portfolio-assets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (path, bytes) => {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), bytes);
  };
  await put('public/assets/cover.png', png(64, 32));
  await put('public/assets/poster.png', png(64, 32));
  await put('public/assets/clip.mp4', mp4(64, 32));
  const project = {
    id: 'sample',
    slug: 'sample',
    cover: '/assets/cover.png',
    coverWidth: 64,
    coverHeight: 32,
    media: [
      {
        type: 'group',
        items: [
          {
            type: 'group',
            items: [
              {
                type: 'video',
                src: '/assets/clip.mp4',
                poster: '/assets/poster.png',
                width: 64,
                height: 32,
                duration: 2.5,
              },
            ],
          },
        ],
      },
    ],
  };
  return { root, put, project };
}

test('binary metadata works for real image signatures and a video track independently of filename suffix', () => {
  assert.deepEqual(imageMetadata(png(20, 30), '.jpg'), { width: 20, height: 30 });
  const video = mp4Metadata(mp4(64, 32));
  assert.equal(video.width, 64);
  assert.equal(video.height, 32);
  assert.equal(video.duration, 2.5);
  assert.equal(video.faststart, true);
});

test('nested groups, videos, CSS fonts, CV and runtime sky references are all reachable', async (t) => {
  const { root, put, project } = await fixture(t);
  await put('public/assets/sky.mp4', mp4(64, 32));
  await put('public/assets/cv.pdf', '%PDF-1.7\n');
  await put('public/assets/fonts/local.woff2', 'wOF2fixture');
  await put('public/assets/fonts/OFL.txt', 'Font license');
  await put('public/assets/fonts/local.css', '@font-face {src:url("./local.woff2")}');
  await put(
    'src/App.jsx',
    '// Sky\'s original is an asset.\nconst sky="/assets/sky.mp4"; const cv="/assets/cv.pdf";',
  );
  await put('src/styles.css', '@import url("/assets/fonts/local.css");');
  const report = await checkAssets({ projectRoot: root, projects: [project] });
  assert.deepEqual(report.errors, []);
  assert.equal(report.summary.leafMedia, 1);
  assert.equal(report.summary.videos, 1);
  assert.deepEqual(report.unused, []);
  assert.ok(
    report.files
      .find((file) => file.uri.endsWith('OFL.txt'))
      .referencedBy.includes('distribution license'),
  );
});

test('missing nested media and poster files fail with the actual case location', async (t) => {
  const { root, project } = await fixture(t);
  project.media[0].items[0].items[0].src = '/assets/missing.mp4';
  project.media[0].items[0].items[0].poster = '/assets/missing-poster.webp';
  const report = await checkAssets({ projectRoot: root, projects: [project] });
  assert.equal(report.errors.filter((error) => error.code === 'missing-asset').length, 2);
  assert.ok(report.errors.every((error) => error.at.includes('media[0].items[0].items[0]')));
});

test('incorrect media dimensions, aspect, missing poster and duplicate case identities are errors', async (t) => {
  const { root, put, project } = await fixture(t);
  await put('public/assets/poster.png', png(32, 64));
  project.media[0].items[0].items[0].width = 65;
  const second = {
    ...project,
    media: [{ type: 'video', src: '/assets/clip.mp4', width: 64, height: 32 }],
  };
  const report = await checkAssets({ projectRoot: root, projects: [project, second] });
  const codes = new Set(report.errors.map((error) => error.code));
  for (const code of ['dimension-mismatch', 'poster-aspect', 'video-poster', 'duplicate-case'])
    assert.ok(codes.has(code), code);
});

test('dynamic asset prefixes are retained conservatively and exact duplicates remain informational', async (t) => {
  const { root, put, project } = await fixture(t);
  await put('public/assets/generated/one.png', png(10, 12));
  await put('public/assets/generated/two.png', png(10, 12));
  await put('public/assets/orphan.png', png(7, 8));
  await put('src/dynamic.js', 'const texture=`/assets/generated/${name}.png`;');
  const report = await checkAssets({ projectRoot: root, projects: [project] });
  assert.deepEqual(report.errors, []);
  assert.ok(
    report.dynamicReferences.some((reference) => reference.prefix === '/assets/generated/'),
  );
  assert.deepEqual(
    report.unused.map((file) => file.uri),
    ['/assets/orphan.png'],
  );
  assert.ok(
    report.duplicateFiles.some(
      (group) =>
        group.uris.includes('/assets/generated/one.png') &&
        group.uris.includes('/assets/generated/two.png'),
    ),
  );
});

test('reusing a case cover as gallery content is valid while repeated gallery URIs are reported', async (t) => {
  const { root, project } = await fixture(t);
  const image = { type: 'image', src: '/assets/cover.png', width: 64, height: 32 };
  project.media.push(image, { ...image });
  const report = await checkAssets({ projectRoot: root, projects: [project] });
  assert.deepEqual(report.errors, []);
  assert.equal(
    report.warnings.filter((warning) => warning.code === 'repeated-media-uri').length,
    1,
  );
});

test('the actual portfolio has no missing assets, invalid dimensions or unprotected videos', async () => {
  const report = await checkAssets();
  assert.deepEqual(report.errors, []);
  assert.ok(report.summary.projects > 0 && report.summary.leafMedia > 0);
});
