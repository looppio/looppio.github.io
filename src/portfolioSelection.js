import { categories, featuredExcludedIds, filterProjects } from './projectTaxonomy.js';

const categoryIds = categories.map((category) => category.id);
const curatedExclusions = new Set(featuredExcludedIds);

export function normalizeTags(tags) {
  const selected = new Set(tags);
  return categoryIds.filter((id) => selected.has(id));
}

export function readTags(search = '') {
  const params = new URLSearchParams(search);
  return normalizeTags(params.getAll('tags').flatMap((value) => value.split(',')));
}

export function readAllGallery(search = '') {
  return new URLSearchParams(search).get('all') === '1' && readTags(search).length === 0;
}

export function selectionUrl(path, tags, search = '', allGallery = readAllGallery(search)) {
  const params = new URLSearchParams(search);
  const selected = normalizeTags(tags);
  params.delete('tags');
  params.delete('all');
  if (selected.length) params.set('tags', selected.join(','));
  else if (allGallery) params.set('all', '1');
  const query = params.toString().replace(/%2C/gi, ',');
  return path + (query ? `?${query}` : '');
}

// Featured defaults to curated work; all=1 explicitly includes the full gallery.
// All cases always keeps the complete archive, with or without category tags.
export function visibleSelection(projects, tags, view = 'featured', allGallery = false) {
  if (view === 'full') return filterProjects(projects);
  const selected = normalizeTags(tags);
  return filterProjects(projects, selected).filter(
    (project) =>
      selected.length ||
      allGallery ||
      (!project.filterOnly && !curatedExclusions.has(project.id ?? project.slug)),
  );
}
