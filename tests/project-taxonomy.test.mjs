import test from 'node:test';
import assert from 'node:assert/strict';
import { projects } from '../src/projects.js';
import {
  categories,
  projectCategories,
  projectPrimaryCategory,
  filterProjects,
  groupedProjects,
} from '../src/projectTaxonomy.js';
import { visibleSelection } from '../src/portfolioSelection.js';

const ids = (list) => list.map((project) => project.id);
const expectedInventory = {
  metaplex: { filters: ['fintech-web3'], primary: 'fintech-web3' },
  dexsport: { filters: ['igaming', 'fintech-web3'], primary: 'igaming' },
  '15m': { filters: ['igaming'], primary: 'igaming' },
  zircuit: { filters: ['fintech-web3'], primary: 'fintech-web3' },
  deepreel: { filters: ['ai-chat-ux', 'saas-crm'], primary: 'saas-crm' },
  'card-platform': { filters: ['fintech-web3'], primary: 'fintech-web3' },
  ndax: { filters: ['fintech-web3'], primary: 'fintech-web3' },
  gambler: { filters: ['igaming'], primary: 'igaming' },
  'vr-meditation': { filters: ['medtech', 'immersive-xr'], primary: 'medtech' },
  modelx: { filters: ['adult-dating'], primary: 'adult-dating' },
  vicetemple: { filters: ['adult-dating'], primary: 'adult-dating' },
  'crypto-casino': { filters: ['igaming', 'fintech-web3'], primary: 'igaming' },
  'performance-marketing': { filters: ['ai-chat-ux', 'saas-crm'], primary: 'saas-crm' },
  'creator-economy': {
    filters: ['ai-chat-ux', 'saas-crm', 'adult-dating'],
    primary: 'adult-dating',
  },
  shroomradar: { filters: ['marketplaces'], primary: 'marketplaces' },
  caregiver: { filters: ['medtech', 'ai-chat-ux'], primary: 'medtech' },
  'exchange-redesign': { filters: ['fintech-web3'], primary: 'fintech-web3' },
  'crypto-app': { filters: ['fintech-web3'], primary: 'fintech-web3' },
  'nft-marketplace': { filters: ['fintech-web3', 'marketplaces'], primary: 'marketplaces' },
};
const filterOnlyIds = [
  'exchange-redesign',
  'crypto-app',
  'nft-marketplace',
  'modelx',
  'vicetemple',
  'creator-economy',
];
const curatedExcludedIds = [...filterOnlyIds, 'vr-meditation', 'shroomradar'];
const pick = (...projectIds) =>
  projectIds.map((id) => {
    const project = projects.find((project) => project.id === id);
    assert.ok(project, `Missing project ${id}`);
    return project;
  });
const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};

test('nineteen real projects have the independently expected memberships and primary categories', () => {
  const known = new Set(categories.map((category) => category.id));
  assert.deepEqual(
    [...known].sort(),
    [
      'igaming',
      'ai-chat-ux',
      'fintech-web3',
      'marketplaces',
      'saas-crm',
      'medtech',
      'immersive-xr',
      'adult-dating',
    ].sort(),
  );
  assert.equal(
    categories.find((category) => category.id === 'adult-dating')?.label,
    'Adult & Dating',
  );
  assert.equal(categories.find((category) => category.id === 'medtech')?.label, 'MedTech');
  assert.equal(categories.length, known.size);
  assert.equal(projects.length, 19);
  assert.equal(new Set(ids(projects)).size, projects.length);
  assert.deepEqual(ids(projects).sort(), Object.keys(expectedInventory).sort());
  assert.deepEqual(Object.keys(projectCategories).sort(), ids(projects).sort());
  assert.deepEqual(Object.keys(projectPrimaryCategory).sort(), ids(projects).sort());
  for (const project of projects) {
    const expected = expectedInventory[project.id];
    assert.deepEqual(
      [...projectCategories[project.id]].sort(),
      [...expected.filters].sort(),
      project.id,
    );
    assert.equal(projectPrimaryCategory[project.id], expected.primary, project.id);
    if (project.filterCategories)
      assert.deepEqual([...project.filterCategories].sort(), [...expected.filters].sort());
    if (project.primaryCategory)
      assert.equal(project.primaryCategory, projectPrimaryCategory[project.id]);
  }
});

test('multiple category selections use OR in original project order', () => {
  const input = pick('caregiver', 'gambler', 'ndax', 'crypto-casino', 'deepreel', 'vr-meditation');
  assert.deepEqual(ids(filterProjects(input, ['igaming', 'ai-chat-ux'])), [
    'caregiver',
    'gambler',
    'crypto-casino',
    'deepreel',
  ]);
});

test('overlapping memberships and repeated selections do not duplicate cases', () => {
  const aiInput = pick('caregiver', 'creator-economy', 'ndax', 'deepreel', 'performance-marketing');
  assert.deepEqual(ids(filterProjects(aiInput, ['ai-chat-ux', 'saas-crm', 'saas-crm'])), [
    'caregiver',
    'creator-economy',
    'deepreel',
    'performance-marketing',
  ]);
  const financeInput = pick('nft-marketplace', 'shroomradar', 'modelx', 'zircuit', 'crypto-casino');
  assert.deepEqual(ids(filterProjects(financeInput, new Set(['marketplaces', 'fintech-web3']))), [
    'nft-marketplace',
    'shroomradar',
    'zircuit',
    'crypto-casino',
  ]);
});

test('clearing all selections and search returns a new array with every original object', () => {
  const result = filterProjects(projects, [], ' \t ');
  assert.notStrictEqual(result, projects);
  assert.deepEqual(result, projects);
  result.forEach((project, index) => assert.strictEqual(project, projects[index]));
  assert.deepEqual(filterProjects(projects, new Set()), projects);
});

test('search folds case and whitespace and matches all words across visible fields', () => {
  const input = pick(
    'crypto-casino',
    'deepreel',
    'performance-marketing',
    'creator-economy',
    'caregiver',
  );
  assert.deepEqual(ids(filterProjects(input, [], '  CRYPTO  WALLETS  ')), ['crypto-casino']);
  assert.deepEqual(ids(filterProjects(input, [], 'messaging onboarding')), ['creator-economy']);
  assert.deepEqual(ids(filterProjects(input, [], 'chat ux')), [
    'deepreel',
    'performance-marketing',
    'creator-economy',
    'caregiver',
  ]);
});

test('search intersects the OR category result instead of expanding it', () => {
  const input = pick('nft-marketplace', 'crypto-casino', 'creator-economy', 'shroomradar');
  assert.deepEqual(ids(filterProjects(input, ['marketplaces', 'fintech-web3'], 'NFT')), [
    'nft-marketplace',
  ]);
  assert.deepEqual(filterProjects(input, ['igaming'], 'NFT'), []);
  assert.deepEqual(ids(filterProjects(input, ['saas-crm'], 'messaging')), ['creator-economy']);
});

test('literal query punctuation is safe and has no regex behavior', () => {
  assert.deepEqual(filterProjects(projects, [], '[AI]'), []);
  assert.deepEqual(filterProjects(projects, [], '('), []);
});

test('the complete inventory groups into six nonempty primary categories with each project exactly once', () => {
  const groups = groupedProjects(projects);
  assert.deepEqual(
    groups.map((group) => group.id),
    ['igaming', 'fintech-web3', 'marketplaces', 'saas-crm', 'medtech', 'adult-dating'],
  );
  assert.deepEqual(Object.fromEntries(groups.map((group) => [group.id, group.projects.length])), {
    igaming: 4,
    'fintech-web3': 6,
    marketplaces: 2,
    'saas-crm': 2,
    medtech: 2,
    'adult-dating': 3,
  });
  const flattened = groups.flatMap((group) => group.projects);
  assert.equal(flattened.length, projects.length);
  assert.equal(new Set(ids(flattened)).size, projects.length);
  assert.deepEqual(ids(flattened).sort(), ids(projects).sort());
  for (const group of groups) {
    assert.ok(
      group.projects.every((project) => expectedInventory[project.id].primary === group.id),
      group.id,
    );
  }
});

test('MedTech groups both health cases while their original filters remain reachable', () => {
  const health = pick('caregiver', 'vr-meditation');
  assert.deepEqual(
    visibleSelection(projects, ['medtech']),
    projects.filter((project) => health.includes(project)),
  );
  assert.deepEqual(ids(filterProjects(health, ['ai-chat-ux'])), ['caregiver']);
  assert.deepEqual(ids(filterProjects(health, ['immersive-xr'])), ['vr-meditation']);
  assert.deepEqual(groupedProjects(health), [
    { id: 'medtech', label: 'MedTech', projects: health },
  ]);
  assert.equal(visibleSelection(projects, ['medtech'], 'full').length, projects.length);
  assert.deepEqual(
    health.map((project) => project.category),
    ['MedTech', 'MedTech'],
  );
});

test('grouped filtered input omits empty rows and retains input order within each row', () => {
  const input = pick(
    'crypto-app',
    'nft-marketplace',
    'gambler',
    'exchange-redesign',
    'crypto-casino',
    'ndax',
    'zircuit',
  );
  const subset = filterProjects(input, ['fintech-web3']);
  assert.deepEqual(
    groupedProjects(subset).map((group) => [group.id, ids(group.projects)]),
    [
      ['igaming', ['crypto-casino']],
      ['fintech-web3', ['crypto-app', 'exchange-redesign', 'ndax', 'zircuit']],
      ['marketplaces', ['nft-marketplace']],
    ],
  );
});

test('missing taxonomy entries remain searchable and are grouped as Other work', () => {
  const unknown = { id: 'unassigned', title: 'Unknown interface', description: 'A prototype' };
  assert.deepEqual(filterProjects([unknown]), [unknown]);
  assert.deepEqual(filterProjects([unknown], [], 'unknown'), [unknown]);
  assert.deepEqual(filterProjects([unknown], ['ai-chat-ux']), []);
  assert.deepEqual(groupedProjects([unknown]), [
    { id: 'other', label: 'Other work', projects: [unknown] },
  ]);
  const prototypeName = { id: '__proto__', title: 'Prototype name' };
  assert.deepEqual(filterProjects([prototypeName], ['toString']), []);
  assert.equal(groupedProjects([prototypeName])[0].projects[0], prototypeName);
});

test('unknown filter IDs never silently clear filtering', () => {
  assert.deepEqual(filterProjects(projects, ['missing-category']), []);
  assert.deepEqual(
    ids(filterProjects(pick('gambler', 'ndax', 'crypto-casino'), ['missing-category', 'igaming'])),
    ['gambler', 'crypto-casino'],
  );
});

test('grouping repeated project IDs keeps the first supplied object once', () => {
  const first = projects[0];
  const duplicate = { ...first, title: 'Repeated object' };
  const groups = groupedProjects([first, duplicate]);
  assert.equal(groups[0].projects.length, 1);
  assert.strictEqual(groups[0].projects[0], first);
});

test('functions do not mutate input arrays, selected IDs, objects or taxonomy', () => {
  const input = deepFreeze(structuredClone(projects));
  const selection = Object.freeze(['fintech-web3', 'marketplaces']);
  const snapshot = JSON.stringify(input);
  const constants = JSON.stringify({ categories, projectCategories, projectPrimaryCategory });
  const filtered = filterProjects(input, selection, 'crypto');
  const grouped = groupedProjects(input);
  const visible = visibleSelection(input, selection);
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(
    JSON.stringify({ categories, projectCategories, projectPrimaryCategory }),
    constants,
  );
  assert.deepEqual(selection, ['fintech-web3', 'marketplaces']);
  filtered.forEach((project) => assert.ok(input.includes(project)));
  grouped
    .flatMap((group) => group.projects)
    .forEach((project) => assert.ok(input.includes(project)));
  visible.forEach((project) => assert.ok(input.includes(project)));
  assert.ok(Object.isFrozen(categories) && categories.every(Object.isFrozen));
  assert.ok(
    Object.isFrozen(projectCategories) && Object.values(projectCategories).every(Object.isFrozen),
  );
});

test('empty inputs return empty results', () => {
  assert.deepEqual(filterProjects([]), []);
  assert.deepEqual(groupedProjects([]), []);
});

test('invalid inputs raise useful TypeErrors instead of mutating caller data', () => {
  assert.throws(() => filterProjects(null), /projects must be an array/);
  assert.throws(() => groupedProjects({}), /projects must be an array/);
  assert.throws(() => filterProjects([null]), /projects\[0\] must be a project object/);
  assert.throws(() => groupedProjects([[]]), TypeError);
  assert.throws(() => filterProjects(projects, 'igaming'), /selectedIds must be an array or Set/);
  assert.throws(() => filterProjects(projects, [1]), /only string category IDs/);
  assert.throws(() => filterProjects(projects, [], null), /query must be a string/);
  assert.equal(projects.length, Object.keys(expectedInventory).length);
});

test('the six original per-project filter-only flags remain intact', () => {
  assert.deepEqual(
    ids(projects.filter((project) => project.filterOnly)).sort(),
    [...filterOnlyIds].sort(),
  );
  for (const project of pick(...filterOnlyIds))
    assert.strictEqual(project.filterOnly, true, project.id);
});

test('unfiltered Featured excludes all eight curated omissions while All cases retains the full inventory', () => {
  const featured = visibleSelection(projects, []);
  const allSelection = visibleSelection(projects, [], 'full');
  const allCases = groupedProjects(allSelection).flatMap((group) => group.projects);
  const expected = ids(projects).filter((id) => !curatedExcludedIds.includes(id));
  assert.equal(featured.length, projects.length - curatedExcludedIds.length);
  assert.deepEqual(ids(featured), expected);
  assert.deepEqual(allSelection, projects);
  assert.equal(allCases.length, projects.length);
  assert.deepEqual(ids(allCases).sort(), ids(projects).sort());
  assert.equal(new Set(ids(allCases)).size, allCases.length);
  assert.deepEqual(visibleSelection(projects, ['unknown-category']), featured);
  assert.deepEqual(visibleSelection(projects, ['unknown-category'], 'full'), projects);
  for (const category of categories) {
    const selection = visibleSelection(projects, [category.id], 'full');
    assert.deepEqual(selection, projects, category.id);
    selection.forEach((project, index) => assert.strictEqual(project, projects[index]));
    assert.equal(
      groupedProjects(selection).flatMap((group) => group.projects).length,
      projects.length,
    );
  }
});

test('VR Meditation, ShroomRadar and GhostMarket remain reachable outside default Featured', () => {
  const omitted = pick('vr-meditation', 'shroomradar', 'nft-marketplace');
  assert.deepEqual(visibleSelection(omitted, []), []);
  assert.deepEqual(visibleSelection(omitted, [], 'featured', true), omitted);
  assert.deepEqual(visibleSelection(omitted, [], 'full'), omitted);
  for (const project of omitted) {
    for (const category of expectedInventory[project.id].filters) {
      assert.ok(
        visibleSelection(projects, [category]).includes(project),
        `${project.id} through ${category}`,
      );
    }
  }
});

test('every filter-only case remains reachable through each matching category', () => {
  for (const id of filterOnlyIds) {
    const original = pick(id)[0];
    for (const category of expectedInventory[id].filters) {
      for (const view of ['featured', 'full']) {
        const selection = visibleSelection(projects, [category], view);
        assert.ok(selection.includes(original), `${id} through ${category} in ${view}`);
        const indexed = groupedProjects(selection).flatMap((group) => group.projects);
        assert.ok(indexed.includes(original), `${id} in filtered index`);
      }
    }
  }
  const input = pick(
    'vicetemple',
    'ndax',
    'nft-marketplace',
    'modelx',
    'gambler',
    'exchange-redesign',
  );
  assert.deepEqual(ids(visibleSelection(input, ['adult-dating', 'fintech-web3', 'adult-dating'])), [
    'vicetemple',
    'ndax',
    'nft-marketplace',
    'modelx',
    'exchange-redesign',
  ]);
});

test('ModelX and ViceTemple match only Adult & Dating while All cases keeps them visible', () => {
  const adult = pick('modelx', 'vicetemple');
  assert.deepEqual(visibleSelection(adult, []), []);
  assert.deepEqual(visibleSelection(adult, [], 'full'), adult);
  assert.deepEqual(visibleSelection(adult, ['adult-dating']), adult);
  for (const category of categories.filter((category) => category.id !== 'adult-dating')) {
    assert.deepEqual(filterProjects(adult, [category.id]), [], category.id);
    assert.deepEqual(visibleSelection(adult, [category.id]), [], `${category.id} in Featured`);
    assert.deepEqual(
      visibleSelection(adult, [category.id], 'full'),
      adult,
      `${category.id} in All cases`,
    );
  }
  assert.deepEqual(visibleSelection(adult, []), []);
});

test('Creator agency CRM is indexed under Adult & Dating and remains reachable through AI and SaaS', () => {
  const creator = pick('creator-economy');
  assert.deepEqual(visibleSelection(creator, []), []);
  assert.deepEqual(visibleSelection(creator, [], 'full'), creator);
  for (const filter of ['adult-dating', 'ai-chat-ux', 'saas-crm']) {
    for (const view of ['featured', 'full']) {
      const selected = visibleSelection(creator, [filter], view);
      assert.deepEqual(selected, creator);
      assert.deepEqual(groupedProjects(selected), [
        {
          id: 'adult-dating',
          label: 'Adult & Dating',
          projects: creator,
        },
      ]);
    }
  }
});
