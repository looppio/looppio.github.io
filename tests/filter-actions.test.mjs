import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const compiled = await build({
  absWorkingDir: appRoot,
  stdin: {
    contents:
      "export {App} from './src/App.jsx'; export {default as CVPicker} from './src/CVPicker.jsx'; export {projects} from './src/projects.js'; export {filterProjects,categories} from './src/projectTaxonomy.js';",
    resolveDir: appRoot,
    loader: 'js',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  plugins: [
    {
      name: 'filter-action-probes',
      setup(b) {
        b.onResolve({ filter: /^react(?:\/jsx-runtime)?$/ }, (a) => ({
          path: a.path,
          namespace: 'probe',
        }));
        b.onResolve({ filter: /@phosphor-icons\/react\/dist\/csr\// }, (a) => ({
          path: a.path.split('/').at(-1),
          namespace: 'icon',
        }));
        b.onResolve({ filter: /(?:Gallery|BootLoader|ActionFeedback|CaseView)\.jsx$/ }, (a) => ({
          path: a.path.split('/').at(-1).replace('.jsx', ''),
          namespace: 'ui',
        }));
        b.onLoad({ filter: /.*/, namespace: 'probe' }, (a) => ({
          contents:
            a.path === 'react'
              ? 'export const useState=v=>globalThis.__filterHooks.state(v),useRef=v=>globalThis.__filterHooks.ref(v),useMemo=(f,d)=>globalThis.__filterHooks.memo(f,d),useEffect=(f,d)=>globalThis.__filterHooks.effect(f,d);'
              : 'export const jsx=(type,props)=>({type,props}),jsxs=jsx,Fragment=Symbol.for("filter.fragment");',
        }));
        b.onLoad({ filter: /.*/, namespace: 'icon' }, (a) => ({
          contents: `export const ${a.path}Icon=()=>null;`,
        }));
        b.onLoad({ filter: /.*/, namespace: 'ui' }, (a) => ({
          contents:
            a.path === 'ActionFeedback'
              ? 'export const EmailCopy=()=>null,DownloadCV=()=>null;'
              : `const Component=()=>null;Component.probe=${JSON.stringify(a.path)};export default Component;`,
        }));
      },
    },
  ],
});
const { App, CVPicker, projects, filterProjects, categories } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64')
);
const key = 'oleksii.portfolio.filters-seen.v1';
const memoryStorage = () => {
  const values = new Map();
  return {
    values,
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, String(v)),
  };
};
const nodes = (tree) =>
  tree == null
    ? []
    : Array.isArray(tree)
      ? tree.flatMap(nodes)
      : typeof tree === 'object'
        ? [tree, ...nodes(tree.props?.children)]
        : [];
const text = (node) =>
  node == null
    ? ''
    : Array.isArray(node)
      ? node.map(text).join('')
      : typeof node === 'object'
        ? text(node.props?.children)
        : typeof node === 'boolean'
          ? ''
          : String(node);
const hasClass = (node, name) => node.props?.className?.split(' ').includes(name);
function fixture(path = '/', { local = memoryStorage(), session = memoryStorage() } = {}) {
  const slots = [],
    effects = new Map(),
    pending = [],
    listeners = new Map(),
    navigation = [];
  let cursor = 0,
    focuses = 0;
  globalThis.location = new URL(path, 'https://portfolio.test');
  globalThis.history = {
    pushState: (_state, _title, url) => {
      globalThis.location = new URL(url, location.href);
      navigation.push(location.pathname + location.search);
    },
  };
  globalThis.window = {
    localStorage: local,
    sessionStorage: session,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => {
      if (listeners.get(name) === fn) listeners.delete(name);
    },
  };
  globalThis.document = { title: '', querySelector: () => null };
  globalThis.requestAnimationFrame = (fn) => fn();
  const hooks = {
    state(value) {
      const i = cursor++;
      slots[i] ??= { value: typeof value === 'function' ? value() : value };
      return [
        slots[i].value,
        (next) => {
          slots[i].value = typeof next === 'function' ? next(slots[i].value) : next;
        },
      ];
    },
    ref(value) {
      const i = cursor++;
      return (slots[i] ??= { current: value });
    },
    memo(fn, deps) {
      const i = cursor++,
        old = slots[i];
      if (!old || deps.some((v, j) => !Object.is(v, old.deps[j]))) slots[i] = { value: fn(), deps };
      return slots[i].value;
    },
    effect(fn, deps) {
      const i = cursor++,
        old = effects.get(i);
      if (!old || deps.some((v, j) => !Object.is(v, old.deps[j])))
        pending.push({ i, fn, deps, old });
    },
  };
  const render = () => {
    globalThis.__filterHooks = hooks;
    cursor = 0;
    pending.length = 0;
    const tree = App();
    for (const n of nodes(tree)) if (n.props?.ref) n.props.ref.current = { focus: () => focuses++ };
    for (const e of pending) e.old?.cleanup?.();
    for (const e of pending) effects.set(e.i, { deps: e.deps, cleanup: e.fn() });
    return tree;
  };
  const trigger = (tree) => nodes(tree).find((n) => hasClass(n, 'filter-trigger'));
  const open = () => {
    const tree = render();
    trigger(tree).props.onClick();
    return render();
  };
  const primary = (tree) =>
    nodes(nodes(tree).find((n) => hasClass(n, 'filters-bottom'))).find(
      (n) => n.type === 'button' && hasClass(n, 'primary-action'),
    );
  const secondary = (tree) =>
    nodes(nodes(tree).find((n) => hasClass(n, 'filters-bottom'))).find(
      (n) => n.type === 'button' && hasClass(n, 'secondary-action'),
    );
  const reset = (tree) =>
    nodes(nodes(tree).find((n) => hasClass(n, 'filters-status'))).find(
      (n) => n.type === 'button' && text(n) === 'Reset',
    );
  const summary = (tree) =>
    nodes(nodes(tree).find((n) => hasClass(n, 'filters-status'))).find((n) =>
      hasClass(n, 'filters-caption'),
    );
  const category = (tree, id) =>
    nodes(tree).find(
      (n) =>
        hasClass(n, 'category-option') &&
        text(n).startsWith(categories.find((c) => c.id === id).label),
    );
  const gallery = (tree) => nodes(tree).find((n) => n.type?.probe === 'Gallery');
  const cleanup = () => {
    for (const e of effects.values()) e.cleanup?.();
  };
  return {
    render,
    open,
    primary,
    secondary,
    reset,
    summary,
    trigger,
    category,
    gallery,
    local,
    session,
    navigation,
    listeners,
    cleanup,
    focuses: () => focuses,
  };
}

test('the primary preserves the curated selection and the separate Show all action reveals the complete archive', () => {
  const f = fixture('/?from=cv&tags=unknown');
  let tree = f.render();
  const curated = f.gallery(tree).props.visibleIds.length;
  assert.ok(curated < projects.length);
  assert.ok(
    categories.reduce((n, c) => n + filterProjects(projects, [c.id]).length, 0) > projects.length,
  );
  assert.equal(f.gallery(tree).props.visibleIds.includes('vr-meditation'), false);
  assert.equal(f.gallery(tree).props.visibleIds.includes('shroomradar'), false);
  assert.equal(f.gallery(tree).props.visibleIds.includes('nft-marketplace'), false);
  tree = f.open();
  assert.equal(text(f.primary(tree)).trim(), `Keep ${curated} featured`);
  assert.equal(text(f.summary(tree)), `Showing ${curated} of ${projects.length} cases`);
  assert.equal(text(f.secondary(tree)).trim(), `Show all ${projects.length} cases`);
  assert.equal(f.reset(tree).props.disabled, true);
  f.primary(tree).props.onClick();
  tree = f.render();
  assert.equal(f.gallery(tree).props.overlay, null);
  assert.equal(f.navigation.length, 0);
  assert.equal(location.searchParams.has('all'), false);
  assert.equal(f.gallery(tree).props.visibleIds.length, curated);
  assert.equal(f.focuses(), 1);
  tree = f.open();
  f.secondary(tree).props.onClick();
  tree = f.render();
  assert.equal(location.pathname, '/');
  assert.equal(location.searchParams.get('all'), '1');
  assert.equal(location.searchParams.has('tags'), false);
  assert.equal(location.searchParams.get('from'), 'cv');
  assert.equal(f.navigation.length, 1);
  assert.equal(f.gallery(tree).props.mode, 'featured');
  assert.deepEqual(
    f.gallery(tree).props.visibleIds,
    projects.map((p) => p.id),
  );
  assert.equal(
    nodes(tree).some((n) => n.props?.className === 'full-index'),
    false,
  );
  tree = f.open();
  assert.equal(text(f.secondary(tree)).trim(), `Show ${curated} featured`);
  assert.equal(text(f.primary(tree)).trim(), `Keep all ${projects.length} cases`);
  f.cleanup();
});

test('header CV opens five downloadable choices without downloading or changing the selected portfolio', () => {
  const f = fixture('/full?tags=adult-dating');
  let tree = f.render();
  const cv = nodes(tree).find((n) => n.props?.['aria-controls'] === 'cv-panel');
  assert.equal(cv.type, 'button');
  assert.equal(cv.props.href, undefined);
  assert.equal(cv.props.download, undefined);
  const ids = [...f.gallery(tree).props.visibleIds];
  cv.props.onClick();
  tree = f.render();
  assert.equal(f.gallery(tree).props.overlay, 'cv');
  assert.deepEqual(f.gallery(tree).props.visibleIds, ids);
  assert.equal(f.navigation.length, 0);
  assert.equal(location.searchParams.get('tags'), 'adult-dating');
  const panel = nodes(tree).find((n) => n.props?.id === 'cv-panel');
  assert.equal(panel.props.role, 'dialog');
  assert.equal(panel.props['data-gl-shield'], true);
  assert.equal(nodes(tree).find((n) => hasClass(n, 'full-index')).props.inert, true);
  const picker = nodes(panel).find((n) => n.type === CVPicker);
  assert.ok(picker);
  const choices = CVPicker(picker.props);
  assert.equal(nodes(choices).filter((n) => hasClass(n, 'cv-option')).length, 5);
  assert.equal(nodes(choices).filter((n) => n.type === 'button' && n.props.disabled).length, 0);
  const downloads = nodes(choices).filter((n) => hasClass(n, 'cv-option'));
  assert.equal(downloads.length, 5);
  assert.equal(new Set(downloads.map((n) => n.props.href)).size, 5);
  for (const download of downloads) {
    assert.match(download.props.href, /^\/assets\/cv\/Alex_Tyshchenko_CV_.*\.pdf$/);
    assert.equal(download.props.filename, download.props.href.split('/').at(-1));
    assert.match(download.props['aria-label'], /^Download /);
    assert.ok(nodes(download).some((n) => hasClass(n, 'cv-option-title')));
    assert.ok(nodes(download).some((n) => hasClass(n, 'cv-option-download') && n.type === 'span'));
  }
  assert.match(text(choices), /Explore my experience or choose a specialist CV/);
  assert.match(text(choices), /Product Design & Engineering CV/);
  assert.doesNotMatch(text(choices), /Full Master/);
  assert.doesNotMatch(text(choices), /coming soon/);
  f.listeners.get('keydown')({ key: 'Escape' });
  tree = f.render();
  assert.equal(f.gallery(tree).props.overlay, null);
  assert.equal(f.focuses(), 1, 'closing returns keyboard focus to the header CV trigger');
  f.cleanup();
});

test('About CV retargets to the picker and its close action restores the surviving header trigger', () => {
  const f = fixture('/');
  let tree = f.render();
  nodes(tree)
    .find((n) => n.props?.['aria-controls'] === 'profile-panel')
    .props.onClick({
      preventDefault() {},
    });
  tree = f.render();
  const about = nodes(tree).find((n) => n.props?.id === 'profile-panel');
  const cv = nodes(about).find((n) => n.props?.['aria-controls'] === 'cv-panel');
  assert.equal(cv.type, 'button');
  assert.equal(cv.props.href, undefined);
  assert.equal(cv.props.download, undefined);
  cv.props.onClick();
  tree = f.render();
  assert.equal(f.gallery(tree).props.overlay, 'cv');
  assert.equal(
    nodes(tree).some((n) => n.props?.id === 'profile-panel'),
    false,
  );
  assert.equal(nodes(tree).filter((n) => hasClass(n, 'center-panel')).length, 1);
  nodes(tree)
    .find((n) => n.props?.['aria-label'] === 'Close CV selection')
    .props.onClick();
  tree = f.render();
  assert.equal(f.gallery(tree).props.overlay, null);
  assert.equal(f.focuses(), 1);
  assert.equal(f.navigation.length, 0);
  f.cleanup();
});

test('an all-gallery URL reload restores all cases and a selected category clears its all flag', () => {
  const f = fixture('/?all=1&from=shared');
  let tree = f.render();
  assert.deepEqual(
    f.gallery(tree).props.visibleIds,
    projects.map((p) => p.id),
  );
  tree = f.open();
  f.category(tree, 'igaming').props.onClick();
  tree = f.render();
  const matching = filterProjects(projects, ['igaming']);
  assert.equal(location.searchParams.has('all'), false);
  assert.equal(location.searchParams.get('tags'), 'igaming');
  assert.deepEqual(
    f.gallery(tree).props.visibleIds,
    matching.map((p) => p.id),
  );
  assert.equal(text(f.primary(tree)).trim(), `Show ${matching.length} featured`);
  assert.equal(text(f.summary(tree)), `${matching.length} of ${projects.length} cases match`);
  assert.ok(f.secondary(tree));
  const before = f.navigation.length;
  f.primary(tree).props.onClick();
  tree = f.render();
  assert.equal(f.navigation.length, before);
  assert.equal(location.searchParams.get('tags'), 'igaming');
  assert.equal(f.gallery(tree).props.mode, 'featured');
  assert.equal(f.gallery(tree).props.overlay, null);
  f.cleanup();
});

test('all-gallery keeps both actions and Reset restores the default curated choices', () => {
  const curated = projects.filter(
    (p) => !p.filterOnly && !['vr-meditation', 'shroomradar'].includes(p.id),
  ).length;
  const f = fixture('/?all=1');
  let tree = f.open();
  assert.equal(text(f.primary(tree)).trim(), `Keep all ${projects.length} cases`);
  assert.equal(text(f.secondary(tree)).trim(), `Show ${curated} featured`);
  assert.equal(text(f.summary(tree)), `Showing ${projects.length} of ${projects.length} cases`);
  assert.equal(f.reset(tree).props.disabled, false);
  f.primary(tree).props.onClick();
  tree = f.render();
  assert.equal(f.gallery(tree).props.overlay, null);
  assert.equal(f.gallery(tree).props.visibleIds.length, projects.length);
  assert.equal(location.searchParams.get('all'), '1');
  assert.equal(f.navigation.length, 0);
  tree = f.open();
  f.reset(tree).props.onClick();
  tree = f.render();
  assert.equal(f.gallery(tree).props.visibleIds.length, curated);
  assert.equal(location.searchParams.has('all'), false);
  assert.ok(curated < projects.length);
  assert.equal(text(f.primary(tree)).trim(), `Keep ${curated} featured`);
  assert.equal(text(f.secondary(tree)).trim(), `Show all ${projects.length} cases`);
  assert.equal(f.reset(tree).props.disabled, true);
  f.secondary(tree).props.onClick();
  tree = f.render();
  assert.equal(f.gallery(tree).props.visibleIds.length, projects.length);
  f.cleanup();
});

test('Show featured returns from all-gallery to the curated ribbon and removes only its selection URL state', () => {
  const curatedIds = projects
    .filter((p) => !p.filterOnly && !['vr-meditation', 'shroomradar'].includes(p.id))
    .map((p) => p.id);
  for (const path of ['/?all=1&from=shared', '/full?all=1&from=shared']) {
    const f = fixture(path);
    let tree = f.open();
    assert.equal(text(f.secondary(tree)).trim(), `Show ${curatedIds.length} featured`);
    f.secondary(tree).props.onClick();
    tree = f.render();
    assert.equal(location.pathname, '/');
    assert.equal(location.searchParams.has('all'), false);
    assert.equal(location.searchParams.has('tags'), false);
    assert.equal(location.searchParams.get('from'), 'shared');
    assert.equal(f.gallery(tree).props.mode, 'featured');
    assert.equal(f.gallery(tree).props.overlay, null);
    assert.deepEqual(f.gallery(tree).props.visibleIds, curatedIds);
    assert.equal(f.focuses(), 1);
    tree = f.open();
    assert.equal(text(f.secondary(tree)).trim(), `Show all ${projects.length} cases`);
    assert.equal(text(f.primary(tree)).trim(), `Keep ${curatedIds.length} featured`);
    f.cleanup();
  }
});

test('All cases primary returns to the complete index while its secondary explicitly opens the all-case feed', () => {
  const f = fixture('/full?from=index');
  let tree = f.open();
  assert.equal(nodes(tree).filter((n) => n.props?.['data-project-id']).length, projects.length);
  assert.equal(text(f.primary(tree)).trim(), `Back to all ${projects.length} cases`);
  assert.equal(text(f.summary(tree)), `Showing ${projects.length} of ${projects.length} cases`);
  f.primary(tree).props.onClick();
  tree = f.render();
  assert.equal(location.pathname, '/full');
  assert.equal(f.navigation.length, 0);
  assert.equal(f.gallery(tree).props.mode, 'full');
  assert.equal(f.gallery(tree).props.overlay, null);
  tree = f.open();
  f.secondary(tree).props.onClick();
  tree = f.render();
  assert.equal(location.pathname, '/');
  assert.equal(location.searchParams.get('all'), '1');
  assert.equal(location.searchParams.get('from'), 'index');
  assert.equal(f.gallery(tree).props.mode, 'featured');
  assert.equal(f.gallery(tree).props.visibleIds.length, projects.length);
  f.cleanup();
});

test('selected archive categories keep all links and their existing highlight action', () => {
  const f = fixture('/full?tags=adult-dating');
  let tree = f.open();
  const matching = filterProjects(projects, ['adult-dating']).length;
  assert.equal(nodes(tree).filter((n) => n.props?.['data-project-id']).length, projects.length);
  assert.equal(text(f.primary(tree)).trim(), `Highlight ${matching} cases`);
  assert.equal(text(f.summary(tree)), `${matching} of ${projects.length} cases match`);
  f.primary(tree).props.onClick();
  tree = f.render();
  assert.equal(location.pathname, '/full');
  assert.equal(location.searchParams.get('tags'), 'adult-dating');
  assert.equal(f.navigation.length, 0);
  assert.equal(f.gallery(tree).props.visibleIds.length, projects.length);
  f.cleanup();
});

test('Show all clears multiple selected categories in either view and opens every gallery card', () => {
  for (const path of ['/?tags=ai-chat-ux,saas-crm', '/full?tags=ai-chat-ux,saas-crm']) {
    const f = fixture(path);
    let tree = f.open();
    const matching = filterProjects(projects, ['ai-chat-ux', 'saas-crm']).length;
    assert.equal(text(f.summary(tree)), `${matching} of ${projects.length} cases match`);
    assert.equal(text(f.secondary(tree)).trim(), `Show all ${projects.length} cases`);
    f.secondary(tree).props.onClick();
    tree = f.render();
    assert.equal(location.pathname, '/');
    assert.equal(location.searchParams.get('all'), '1');
    assert.equal(location.searchParams.has('tags'), false);
    assert.equal(f.gallery(tree).props.mode, 'featured');
    assert.equal(f.gallery(tree).props.overlay, null);
    assert.deepEqual(
      f.gallery(tree).props.visibleIds,
      projects.map((p) => p.id),
    );
    f.cleanup();
  }
});

test('the footer places Show all before its primary in DOM order and both arrows point right', () => {
  for (const path of ['/', '/?tags=igaming', '/full?tags=igaming', '/?all=1']) {
    const f = fixture(path),
      tree = f.open(),
      footer = nodes(tree).find((n) => hasClass(n, 'filters-bottom')),
      buttons = nodes(footer).filter((n) => n.type === 'button');
    assert.deepEqual(buttons, [f.secondary(tree), f.primary(tree)]);
    for (const button of buttons) {
      assert.equal(nodes(button).filter((n) => n.type?.name === 'ArrowRightIcon').length, 1);
      assert.equal(
        nodes(button).some((n) => n.type?.name === 'ArrowUpRightIcon'),
        false,
      );
    }
    f.cleanup();
  }
});

test('all-gallery mode survives view and case navigation and browser Back restores the default', () => {
  const f = fixture('/?all=1');
  let tree = f.render();
  const allLink = nodes(tree).find((n) => n.type === 'a' && text(n) === 'All cases');
  allLink.props.onClick({ preventDefault() {} });
  tree = f.render();
  assert.equal(location.pathname, '/full');
  assert.equal(location.searchParams.get('all'), '1');
  const archived = nodes(tree).find((n) => n.props?.['data-project-id']);
  archived.props.onClick();
  tree = f.render();
  assert.ok(location.pathname.startsWith('/projects/'));
  assert.equal(location.searchParams.get('all'), '1');
  const caseView = nodes(tree).find((n) => n.type?.probe === 'CaseView');
  caseView.props.onClose();
  tree = f.render();
  assert.equal(location.pathname, '/');
  assert.equal(location.searchParams.get('all'), '1');
  f.gallery(tree).props.onTransitionEnd('closing');
  tree = f.render();
  assert.equal(f.gallery(tree).props.project, null);
  globalThis.location = new URL('https://portfolio.test/');
  f.listeners.get('popstate')();
  tree = f.render();
  assert.ok(f.gallery(tree).props.visibleIds.length < projects.length);
  f.cleanup();
});

test('attention dot disappears on the first Filters click and stays dismissed after reload', () => {
  const local = memoryStorage(),
    f = fixture('/', { local });
  let tree = f.render();
  assert.equal(nodes(f.trigger(tree)).filter((n) => hasClass(n, 'filter-attention-dot')).length, 1);
  f.trigger(tree).props.onClick();
  tree = f.render();
  assert.equal(
    nodes(f.trigger(tree)).some((n) => hasClass(n, 'filter-attention-dot')),
    false,
  );
  assert.equal(local.getItem(key), '1');
  f.cleanup();
  const reload = fixture('/', { local });
  assert.equal(
    nodes(reload.trigger(reload.render())).some((n) => hasClass(n, 'filter-attention-dot')),
    false,
  );
  reload.cleanup();
});

test('active category badge takes priority over the attention dot', () => {
  const f = fixture('/?tags=igaming');
  const tree = f.render(),
    trigger = f.trigger(tree);
  assert.equal(
    nodes(trigger).some((n) => hasClass(n, 'filter-attention-dot')),
    false,
  );
  assert.equal(text(nodes(trigger).find((n) => hasClass(n, 'filter-badge'))), '1');
  f.cleanup();
});

test('storage restrictions use the session fallback or safe in-memory dismissal', () => {
  const denied = {
    getItem() {
      throw new Error('storage denied');
    },
    setItem() {
      throw new Error('storage denied');
    },
  };
  const session = memoryStorage(),
    f = fixture('/', { local: denied, session });
  f.open();
  assert.equal(session.getItem(key), '1');
  f.cleanup();
  const reload = fixture('/', { local: denied, session });
  assert.equal(
    nodes(reload.trigger(reload.render())).some((n) => hasClass(n, 'filter-attention-dot')),
    false,
  );
  reload.cleanup();
  const blocked = fixture('/', { local: denied, session: denied });
  assert.doesNotThrow(() => blocked.open());
  assert.equal(
    nodes(blocked.trigger(blocked.render())).some((n) => hasClass(n, 'filter-attention-dot')),
    false,
  );
  blocked.cleanup();
});

test('one viewport chrome layer contains header and footer while lens panels stay outside its clipping scope', () => {
  const f = fixture('/');
  let tree = f.render();
  const assertChrome = () => {
    const wrappers = nodes(tree).filter((node) => hasClass(node, 'site-chrome'));
    assert.equal(wrappers.length, 1);
    for (const className of ['site-header', 'site-footer']) {
      const elements = nodes(wrappers[0]).filter((node) => hasClass(node, className));
      assert.equal(elements.length, 1);
      assert.equal(elements[0].props.inert, undefined, 'uncovered chrome remains interactive');
      assert.equal(elements[0].props['aria-hidden'], false);
    }
    assert.equal(
      nodes(wrappers[0]).some((node) => hasClass(node, 'center-panel')),
      false,
    );
    return wrappers[0];
  };
  let chrome = assertChrome();
  for (const name of ['profile', 'contact', 'cv', 'filters']) {
    const trigger = nodes(chrome).find((node) => node.props?.['aria-controls'] === `${name}-panel`);
    trigger.props.onClick({ preventDefault() {} });
    tree = f.render();
    assert.equal(f.gallery(tree).props.overlay, name, 'uncovered controls can retarget the lens');
    const panel = nodes(tree).find((node) => node.props?.id === `${name}-panel`);
    assert.ok(panel);
    assert.ok(nodes(panel).some((node) => /^Close /.test(node.props?.['aria-label'] || '')));
    chrome = assertChrome();
  }
  f.cleanup();
});

test('CV and filter close wait for covered triggers and cancel a stale return when another panel opens', () => {
  for (const name of ['cv', 'filters']) {
    const f = fixture('/');
    let tree = f.render();
    const trigger = () =>
      nodes(tree).find((node) => node.props?.['aria-controls'] === `${name}-panel`);
    trigger().props.onClick();
    tree = f.render();
    const covered = trigger().props.ref.current;
    covered.inert = true;
    nodes(tree)
      .find(
        (node) =>
          node.props?.['aria-label'] === `Close ${name === 'cv' ? 'CV selection' : 'filters'}`,
      )
      .props.onClick();
    tree = f.render();
    assert.equal(f.focuses(), 0);
    assert.equal(f.gallery(tree).props.overlay, null);
    covered.inert = false;
    f.listeners.get('portfolio-tick')();
    assert.equal(f.focuses(), 1);
    assert.equal(f.listeners.has('portfolio-tick'), false);

    trigger().props.onClick();
    tree = f.render();
    trigger().props.ref.current.inert = true;
    f.listeners.get('keydown')({ key: 'Escape' });
    tree = f.render();
    assert.equal(f.listeners.has('portfolio-tick'), true);
    nodes(tree)
      .find((node) => node.props?.['aria-controls'] === 'contact-panel')
      .props.onClick({ preventDefault() {} });
    tree = f.render();
    assert.equal(f.gallery(tree).props.overlay, 'contact');
    assert.equal(f.listeners.has('portfolio-tick'), false);
    assert.equal(f.focuses(), 1, 'opening a new panel cancels the old return request');
    f.cleanup();
  }
});
