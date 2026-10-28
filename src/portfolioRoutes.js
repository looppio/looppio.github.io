// Static hosts redirect directory entry points to URLs with a trailing slash.
export function readRoute(pathname, projects) {
  const path = pathname.replace(/\/+$/, '') || '/';
  return {
    view: path === '/full' ? 'full' : 'featured',
    project: projects.find((project) => path === `/projects/${project.slug}`) || null,
  };
}
