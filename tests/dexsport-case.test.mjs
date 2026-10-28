import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { dexsportProject, dexsportDetails } from '../src/dexsportProject.js';
import { projects } from '../src/projects.js';
import { projectDetails } from '../src/projectDetails.js';
import { projectLabel } from '../src/projectLabels.js';
import { filterProjects, groupedProjects } from '../src/projectTaxonomy.js';
import { visibleSelection, selectionUrl } from '../src/portfolioSelection.js';

const publicAsset = (path) => new URL(`../public/${path.replace(/^\//, '')}`, import.meta.url);
function webpSize(path) {
  const bytes = readFileSync(publicAsset(path));
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const type = bytes.toString('ascii', offset, offset + 4),
      length = bytes.readUInt32LE(offset + 4),
      start = offset + 8;
    if (type === 'VP8X')
      return [bytes.readUIntLE(start + 4, 3) + 1, bytes.readUIntLE(start + 7, 3) + 1];
    if (type === 'VP8L') {
      const bits = bytes.readUInt32LE(start + 1);
      return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
    }
    if (type === 'VP8 ')
      return [bytes.readUInt16LE(start + 6) & 0x3fff, bytes.readUInt16LE(start + 8) & 0x3fff];
    offset = start + length + (length % 2);
  }
  throw new Error(`No image dimensions in ${path}`);
}

test('Dexsport is one featured case with a direct product link and matching detail record', () => {
  assert.equal(projects.filter((project) => project.id === 'dexsport').length, 1);
  assert.strictEqual(projects[0], dexsportProject);
  assert.strictEqual(projectDetails.dexsport, dexsportDetails);
  assert.equal(dexsportProject.websiteUrl, 'https://dexsport.io/');
  assert.equal(projectLabel(dexsportProject), 'Dexsport');
  assert.ok(visibleSelection(projects).includes(dexsportProject));
  assert.equal(
    selectionUrl(`/projects/${dexsportProject.slug}`, ['igaming']),
    '/projects/dexsport?tags=igaming',
  );
});

test('Dexsport matches both relevant filters but appears only once under iGaming', () => {
  for (const category of ['igaming', 'fintech-web3'])
    assert.ok(filterProjects(projects, [category]).includes(dexsportProject));
  const matches = filterProjects(projects, ['igaming', 'fintech-web3']);
  assert.equal(matches.filter((project) => project.id === 'dexsport').length, 1);
  const groups = groupedProjects(projects);
  assert.equal(
    groups.flatMap((group) => group.projects).filter((project) => project.id === 'dexsport').length,
    1,
  );
  assert.ok(groups.find((group) => group.id === 'igaming').projects.includes(dexsportProject));
});

test('approved Dexsport contribution is visible without invented role, dates or outcome claims', () => {
  assert.equal(dexsportDetails.verifiedContribution, true);
  assert.ok(dexsportDetails.contribution.length > 0);
  assert.ok(dexsportDetails.scope.length > 0);
  assert.equal(Object.hasOwn(dexsportDetails, 'contributionPlaceholder'), false);
  for (const record of [dexsportProject, dexsportDetails]) {
    for (const field of [
      'role',
      'period',
      'duration',
      'results',
      'coauthors',
      'collaborators',
      'sources',
    ])
      assert.equal(Object.hasOwn(record, field), false, field);
  }
});

test('the accepted Dexsport sequence has real local assets, original image dimensions and portrait metadata', () => {
  const media = dexsportProject.media;
  assert.equal(media.length, 29);
  assert.equal(new Set(media.map((item) => item.src)).size, media.length);
  assert.equal(media.filter((item) => item.type === 'image').length, 22);
  assert.equal(media.filter((item) => item.type === 'video').length, 7);
  const excluded = [
    '02-desktop-entry',
    '08-desktop-catalog',
    '15-desktop-sports-club',
    '23-mobile-sort',
  ];
  for (const item of media) {
    assert.ok(item.src.startsWith('/assets/cases/dexsport/'));
    assert.ok(statSync(publicAsset(item.src)).size > 0, item.src);
    assert.ok(item.width > 0 && item.height > 0);
    assert.ok(item.alt?.length > 8);
    assert.ok(excluded.every((name) => !item.src.includes(name)));
    if (item.type === 'image')
      assert.deepEqual(webpSize(item.src), [item.width, item.height], item.src);
    else {
      assert.ok(item.duration > 0);
      assert.deepEqual(webpSize(item.poster), [item.width, item.height], item.poster);
    }
    assert.equal(item.presentation === 'mobile', item.height > item.width, item.src);
  }
  const firstMobile = media.findIndex((item) => item.presentation === 'mobile');
  assert.ok(firstMobile > 0);
  assert.ok(media.slice(firstMobile).every((item) => item.presentation === 'mobile'));
});

test('the supplied montage opens the case and remains the gallery preview with a matching fallback', () => {
  const bytes = readFileSync(publicAsset(dexsportProject.coverVideo));
  assert.equal(bytes.toString('ascii', 4, 8), 'ftyp');
  assert.ok(statSync(publicAsset(dexsportProject.coverVideo)).size > 0);
  const intro = dexsportProject.media[0];
  assert.equal(intro.type, 'video');
  assert.equal(intro.src, dexsportProject.coverVideo);
  assert.equal(intro.poster, dexsportProject.cover);
  // The new introduction preserves the existing detailed interaction clips.
  assert.ok(
    dexsportProject.media.some((item) => item.src.endsWith('/desktop-match-navigation.mp4')),
  );
  assert.equal(dexsportProject.cover, '/assets/covers/dexsport.webp');
  assert.equal(dexsportProject.coverWidth / dexsportProject.coverHeight, 16 / 9);
  assert.deepEqual(webpSize(dexsportProject.cover), [
    dexsportProject.coverWidth,
    dexsportProject.coverHeight,
  ]);
});
