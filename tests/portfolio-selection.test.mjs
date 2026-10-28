import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readTags,
  readAllGallery,
  selectionUrl,
  visibleSelection,
} from '../src/portfolioSelection.js';

test('a shared link round-trips multiple categories and preserves unrelated parameters', () => {
  const url = selectionUrl('/full', ['fintech-web3', 'igaming'], '?from=portfolio');
  assert.equal(url, '/full?from=portfolio&tags=igaming,fintech-web3');
  assert.deepEqual(readTags(url.slice(url.indexOf('?'))), ['igaming', 'fintech-web3']);
});

test('duplicate and unrecognized URL tags cannot inject a category', () => {
  assert.deepEqual(readTags('?tags=igaming,unknown&tags=igaming,ai-chat-ux'), [
    'igaming',
    'ai-chat-ux',
  ]);
  assert.deepEqual(readTags('?tags=%3Cscript%3E'), []);
  assert.deepEqual(readTags('?tags=adult-platforms'), []);
});

test('Adult & Dating and Immersive & XR selections round-trip under their current IDs', () => {
  const url = selectionUrl('/full', ['adult-dating', 'immersive-xr', 'adult-dating'], '?from=cv');
  assert.equal(url, '/full?from=cv&tags=immersive-xr,adult-dating');
  assert.deepEqual(readTags(url.slice(url.indexOf('?'))), ['immersive-xr', 'adult-dating']);
  assert.deepEqual(readTags('?tags=adult-platforms,adult-dating'), ['adult-dating']);
});

test('MedTech shares URLs alongside the original AI and XR filter IDs', () => {
  const selected = ['medtech', 'immersive-xr', 'ai-chat-ux'];
  const url = selectionUrl('/full', selected, '?from=cv');
  assert.equal(url, '/full?from=cv&tags=ai-chat-ux,medtech,immersive-xr');
  const tags = readTags(url.slice(url.indexOf('?')));
  assert.deepEqual(tags, ['ai-chat-ux', 'medtech', 'immersive-xr']);
  assert.equal(
    selectionUrl('/projects/caregiver', tags),
    '/projects/caregiver?tags=ai-chat-ux,medtech,immersive-xr',
  );
  assert.equal(selectionUrl('/', tags), '/?tags=ai-chat-ux,medtech,immersive-xr');
  const health = [{ id: 'caregiver' }, { id: 'vr-meditation' }];
  assert.deepEqual(visibleSelection(health, readTags('?tags=ai-chat-ux')), [health[0]]);
  assert.deepEqual(visibleSelection(health, readTags('?tags=immersive-xr')), [health[1]]);
  assert.deepEqual(visibleSelection(health, readTags('?tags=medtech')), health);
});

test('clearing removes tags while project and view links retain the same selection', () => {
  const tags = readTags('?tags=fintech-web3');
  assert.equal(selectionUrl('/projects/ndax', tags), '/projects/ndax?tags=fintech-web3');
  assert.equal(selectionUrl('/', tags), '/?tags=fintech-web3');
  assert.equal(selectionUrl('/full', [], '?tags=igaming&from=cv'), '/full?from=cv');
});

test('Featured filters matching cases while All cases retains the complete archive for any selection', () => {
  const projects = [
    { id: 'ndax' },
    { id: 'exchange-redesign', filterOnly: true },
    { id: 'crypto-casino' },
    { id: 'nft-marketplace', filterOnly: true },
  ];
  assert.deepEqual(
    visibleSelection(projects, []).map((p) => p.id),
    ['ndax', 'crypto-casino'],
  );
  assert.deepEqual(
    visibleSelection(projects, [], 'featured').map((p) => p.id),
    ['ndax', 'crypto-casino'],
  );
  assert.deepEqual(visibleSelection(projects, [], 'full'), projects);
  assert.deepEqual(
    visibleSelection(projects, ['marketplaces']).map((p) => p.id),
    ['nft-marketplace'],
  );
  assert.deepEqual(visibleSelection(projects, ['fintech-web3']), projects);
  for (const tags of [
    [],
    ['marketplaces'],
    ['fintech-web3'],
    ['adult-dating'],
    ['igaming', 'marketplaces'],
  ]) {
    const result = visibleSelection(projects, tags, 'full');
    assert.deepEqual(result, projects);
    result.forEach((project, index) => assert.strictEqual(project, projects[index]));
  }
});

test('changing views and clearing categories changes visibility without losing cases or source order', () => {
  const projects = Object.freeze([
    Object.freeze({ id: 'vicetemple', filterOnly: true }),
    Object.freeze({ id: 'ndax' }),
    Object.freeze({ id: 'creator-economy', filterOnly: true }),
    Object.freeze({ id: 'modelx', filterOnly: true }),
    Object.freeze({ id: 'deepreel' }),
  ]);
  const selected = Object.freeze(['adult-dating', 'ai-chat-ux', 'adult-dating']);
  for (const view of ['featured', 'full']) {
    const result = visibleSelection(projects, selected, view);
    assert.deepEqual(
      result.map((p) => p.id),
      view === 'full'
        ? ['vicetemple', 'ndax', 'creator-economy', 'modelx', 'deepreel']
        : ['vicetemple', 'creator-economy', 'modelx', 'deepreel'],
    );
    assert.equal(new Set(result).size, result.length);
    assert.ok(result.every((project) => projects.includes(project)));
  }
  assert.deepEqual(visibleSelection(projects, [], 'full'), projects);
  assert.deepEqual(
    visibleSelection(projects, [], 'featured').map((p) => p.id),
    ['ndax', 'deepreel'],
  );
  assert.deepEqual(selected, ['adult-dating', 'ai-chat-ux', 'adult-dating']);
  assert.equal(projects.length, 5);
});

test('unknown or retired URL categories use each view default instead of revealing Featured-only exclusions', () => {
  const projects = [{ id: 'modelx', filterOnly: true }, { id: 'ndax' }];
  const tags = readTags('?tags=adult-platforms,unknown');
  assert.deepEqual(tags, []);
  assert.deepEqual(
    visibleSelection(projects, tags).map((p) => p.id),
    ['ndax'],
  );
  assert.deepEqual(visibleSelection(projects, tags, 'full'), projects);
});

test('explicit all-gallery links round-trip while category choices and Reset remove the flag', () => {
  const url = selectionUrl('/', [], '?from=cv', true);
  assert.equal(url, '/?from=cv&all=1');
  assert.equal(readAllGallery('?from=cv&all=1'), true);
  assert.equal(readAllGallery('?all=0'), false);
  assert.equal(readAllGallery('?all=1&tags=igaming'), false);
  assert.equal(
    selectionUrl('/projects/ndax', [], '?from=cv&all=1'),
    '/projects/ndax?from=cv&all=1',
  );
  assert.equal(selectionUrl('/full', [], '?from=cv&all=1'), '/full?from=cv&all=1');
  assert.equal(selectionUrl('/', ['igaming'], '?from=cv&all=1'), '/?from=cv&tags=igaming');
  assert.equal(selectionUrl('/', [], '?from=cv&all=1', false), '/?from=cv');
});

test('all-gallery displays every original case while default Featured stays curated', () => {
  const projects = [{ id: 'modelx', filterOnly: true }, { id: 'ndax' }, { id: 'crypto-casino' }];
  assert.deepEqual(
    visibleSelection(projects, [], 'featured').map((project) => project.id),
    ['ndax', 'crypto-casino'],
  );
  assert.deepEqual(visibleSelection(projects, [], 'featured', true), projects);
  assert.deepEqual(
    visibleSelection(projects, ['igaming'], 'featured', true).map((project) => project.id),
    ['crypto-casino'],
  );
  assert.deepEqual(visibleSelection(projects, ['igaming'], 'full', true), projects);
});

test('the new curated exclusions apply without data flags and preserve both legacy filters and all-gallery mode', () => {
  const projects = Object.freeze([
    Object.freeze({ id: 'vr-meditation' }),
    Object.freeze({ id: 'caregiver' }),
    Object.freeze({ id: 'shroomradar' }),
    Object.freeze({ id: 'ndax' }),
  ]);
  assert.deepEqual(
    visibleSelection(projects, []).map((p) => p.id),
    ['caregiver', 'ndax'],
  );
  assert.deepEqual(visibleSelection(projects, readTags('?tags=immersive-xr')), [projects[0]]);
  assert.deepEqual(visibleSelection(projects, readTags('?tags=marketplaces')), [projects[2]]);
  assert.deepEqual(visibleSelection(projects, [], 'featured', true), projects);
  assert.deepEqual(visibleSelection(projects, ['medtech'], 'full'), projects);
  assert.deepEqual(
    projects.map((p) => Object.keys(p)),
    [['id'], ['id'], ['id'], ['id']],
  );
});
