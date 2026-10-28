import test from 'node:test';
import assert from 'node:assert/strict';
import { fifteenMProject, fifteenMDetails } from '../src/fifteenMProject.js';
import { projects } from '../src/projects.js';
import { projectDetails } from '../src/projectDetails.js';
import { projectLabel } from '../src/projectLabels.js';
import { filterProjects, groupedProjects } from '../src/projectTaxonomy.js';
import { visibleSelection, selectionUrl } from '../src/portfolioSelection.js';

test('15M is a single featured case after Dexsport with its own product URL and detail record', () => {
  assert.equal(projects.filter((project) => project.id === '15m').length, 1);
  assert.equal(projects[0].id, 'dexsport');
  assert.strictEqual(projects[1], fifteenMProject);
  assert.strictEqual(projectDetails['15m'], fifteenMDetails);
  assert.equal(projectLabel(fifteenMProject), '15M');
  assert.equal(fifteenMProject.websiteUrl, 'https://15m.com/');
  assert.ok(visibleSelection(projects).includes(fifteenMProject));
  assert.equal(
    selectionUrl(`/projects/${fifteenMProject.slug}`, ['igaming']),
    '/projects/15m?tags=igaming',
  );
});

test('15M matches iGaming and is grouped once without inferring unrelated finance or marketplace membership', () => {
  assert.deepEqual(filterProjects([fifteenMProject], ['igaming']), [fifteenMProject]);
  assert.deepEqual(
    filterProjects([fifteenMProject], ['fintech-web3', 'marketplaces', 'saas-crm']),
    [],
  );
  const groups = groupedProjects(projects);
  assert.equal(
    groups.flatMap((group) => group.projects).filter((project) => project.id === '15m').length,
    1,
  );
  assert.ok(groups.find((group) => group.id === 'igaming').projects.includes(fifteenMProject));
});

test('15M shows approved contribution and scope without inventing roles, dates or outcomes', () => {
  assert.equal(fifteenMDetails.verifiedContribution, true);
  for (const field of ['contribution', 'scope']) {
    const items = fifteenMDetails[field];
    assert.ok(Array.isArray(items) && items.length > 0, field);
    assert.ok(
      items.every((item) => typeof item === 'string' && item.trim().length > 0),
      field,
    );
    assert.doesNotMatch(items.join(' '), /lorem ipsum/i, field);
  }
  assert.equal(Object.hasOwn(fifteenMDetails, 'contributionPlaceholder'), false);
  for (const record of [fifteenMProject, fifteenMDetails]) {
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
