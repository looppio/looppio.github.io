// Filters may overlap while every case has one primary index category.
// Filters can overlap; the primary category places each case in one index row.
export const categories = Object.freeze(
  [
    { id: 'igaming', label: 'iGaming' },
    { id: 'ai-chat-ux', label: 'AI & Chat UX' },
    { id: 'fintech-web3', label: 'FinTech & Web3' },
    { id: 'marketplaces', label: 'Marketplaces' },
    { id: 'saas-crm', label: 'SaaS & CRM' },
    { id: 'medtech', label: 'MedTech' },
    { id: 'immersive-xr', label: 'Immersive & XR' },
    { id: 'adult-dating', label: 'Adult & Dating' },
  ].map((category) => Object.freeze(category)),
);

// Additional curation exclusions alongside each project's filterOnly flag.
// These cases remain available to category filters and the complete archive.
export const featuredExcludedIds = Object.freeze(['vr-meditation', 'shroomradar']);

export const projectCategories = Object.freeze({
  metaplex: Object.freeze(['fintech-web3']),
  dexsport: Object.freeze(['igaming', 'fintech-web3']),
  '15m': Object.freeze(['igaming']),
  gambler: Object.freeze(['igaming']),
  'vr-meditation': Object.freeze(['medtech', 'immersive-xr']),
  modelx: Object.freeze(['adult-dating']),
  vicetemple: Object.freeze(['adult-dating']),
  zircuit: Object.freeze(['fintech-web3']),
  deepreel: Object.freeze(['ai-chat-ux', 'saas-crm']),
  'card-platform': Object.freeze(['fintech-web3']),
  ndax: Object.freeze(['fintech-web3']),
  'crypto-casino': Object.freeze(['igaming', 'fintech-web3']),
  'performance-marketing': Object.freeze(['ai-chat-ux', 'saas-crm']),
  'creator-economy': Object.freeze(['adult-dating', 'ai-chat-ux', 'saas-crm']),
  shroomradar: Object.freeze(['marketplaces']),
  caregiver: Object.freeze(['medtech', 'ai-chat-ux']),
  'exchange-redesign': Object.freeze(['fintech-web3']),
  'crypto-app': Object.freeze(['fintech-web3']),
  'nft-marketplace': Object.freeze(['fintech-web3', 'marketplaces']),
});

export const projectPrimaryCategory = Object.freeze({
  metaplex: 'fintech-web3',
  dexsport: 'igaming',
  '15m': 'igaming',
  gambler: 'igaming',
  'vr-meditation': 'medtech',
  modelx: 'adult-dating',
  vicetemple: 'adult-dating',
  zircuit: 'fintech-web3',
  deepreel: 'saas-crm',
  'card-platform': 'fintech-web3',
  ndax: 'fintech-web3',
  'crypto-casino': 'igaming',
  'performance-marketing': 'saas-crm',
  'creator-economy': 'adult-dating',
  shroomradar: 'marketplaces',
  caregiver: 'medtech',
  'exchange-redesign': 'fintech-web3',
  'crypto-app': 'fintech-web3',
  'nft-marketplace': 'marketplaces',
});

const labels = new Map(categories.map((category) => [category.id, category.label]));
const projectKey = (project) => project.id ?? project.slug;
const membership = (project) =>
  Object.hasOwn(projectCategories, projectKey(project))
    ? projectCategories[projectKey(project)]
    : [];
const normalize = (value) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

function assertProjects(projects) {
  if (!Array.isArray(projects)) throw new TypeError('projects must be an array');
  projects.forEach((project, index) => {
    if (!project || typeof project !== 'object' || Array.isArray(project)) {
      throw new TypeError(`projects[${index}] must be a project object`);
    }
  });
}

/**
 * Returns a new array with original project objects in their original order.
 * Selected categories use OR. Every query word must also match the project's
 * title, description, category, slug or filter labels (case insensitive).
 * Array and Set selections are accepted. Unknown category IDs match nothing;
 * projects absent from the taxonomy still appear when no category is selected.
 */
export function filterProjects(projects, selectedIds = [], query = '') {
  assertProjects(projects);
  if (!Array.isArray(selectedIds) && !(selectedIds instanceof Set)) {
    throw new TypeError('selectedIds must be an array or Set of category IDs');
  }
  if ([...selectedIds].some((id) => typeof id !== 'string')) {
    throw new TypeError('selectedIds must contain only string category IDs');
  }
  if (typeof query !== 'string') throw new TypeError('query must be a string');
  const selected = new Set(selectedIds);
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  return projects.filter((project) => {
    const ids = membership(project);
    if (selected.size && !ids.some((id) => selected.has(id))) return false;
    if (!terms.length) return true;
    const searchable = normalize(
      [
        project.title,
        project.description,
        project.category,
        project.slug,
        ...ids.map((id) => labels.get(id)),
      ]
        .filter((value) => typeof value === 'string')
        .join(' '),
    );
    return terms.every((term) => searchable.includes(term));
  });
}

/**
 * Returns nonempty {id, label, projects} rows in categories order, preserving
 * source order within each row. A project appears once, under its primary
 * category. Unknown projects remain available in a final "Other work" row.
 * Repeated IDs in the supplied array use the first object without mutation.
 */
export function groupedProjects(projects) {
  assertProjects(projects);
  const groups = categories.map((category) => ({ ...category, projects: [] }));
  const byId = new Map(groups.map((group) => [group.id, group]));
  const other = { id: 'other', label: 'Other work', projects: [] };
  const seen = new Set();
  for (const project of projects) {
    const key = projectKey(project);
    const identity = key ?? project;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const primary = Object.hasOwn(projectPrimaryCategory, key) ? projectPrimaryCategory[key] : null;
    (byId.get(primary) ?? other).projects.push(project);
  }
  return [...groups, other].filter((group) => group.projects.length);
}
