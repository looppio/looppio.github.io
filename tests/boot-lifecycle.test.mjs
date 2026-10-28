import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const storeKey = Symbol.for('oleksii.portfolio.boot.v1');
const compiled = await build({
  absWorkingDir: appRoot,
  stdin: {
    contents:
      "export * from './src/BootLoader.jsx'; export {default as BootLoader} from './src/BootLoader.jsx'; export {default as Gallery} from './src/Gallery.jsx';",
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
      name: 'boot-lifecycle-probes',
      setup(b) {
        b.onResolve({ filter: /^react(?:\/jsx-runtime)?$/ }, (a) => ({
          path: a.path,
          namespace: 'boot-probe',
        }));
        b.onResolve({ filter: /PortfolioScene\.js$/ }, () => ({
          path: 'scene',
          namespace: 'boot-probe',
        }));
        b.onLoad({ filter: /.*/, namespace: 'boot-probe' }, (a) => ({
          contents:
            a.path === 'react'
              ? 'export const useRef=v=>globalThis.__bootHooks.ref(v),useState=v=>globalThis.__bootHooks.state(v),useLayoutEffect=(f,d)=>globalThis.__bootHooks.effect(f,d);'
              : a.path === 'react/jsx-runtime'
                ? 'export const jsx=(type,props)=>({type,props}),jsxs=jsx;'
                : 'export default class Scene{constructor(...args){return new globalThis.__BootSceneProbe(...args)}}',
        }));
      },
    },
  ],
});
const bundle =
  'data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64');
let importId = 0;
const loadModule = () => import(`${bundle}#boot-probe-${++importId}`);
const flush = () => new Promise((resolve) => setImmediate(resolve));
const nodes = (tree) =>
  tree == null
    ? []
    : Array.isArray(tree)
      ? tree.flatMap(nodes)
      : typeof tree === 'object'
        ? [tree, ...nodes(tree.props?.children)]
        : [];

function hookRunner(component, rootDOM) {
  const slots = [],
    effects = new Map();
  let cursor = 0,
    pending = [];
  const hooks = {
    ref(value) {
      const i = cursor++;
      return (slots[i] ??= { current: value });
    },
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
    effect(fn, deps) {
      const i = cursor++,
        old = effects.get(i);
      if (!old || deps.some((v, j) => !Object.is(v, old.deps[j])))
        pending.push({ i, fn, deps, old });
    },
  };
  return {
    render(props = {}, commit = true) {
      globalThis.__bootHooks = hooks;
      cursor = 0;
      pending = [];
      const tree = component(props);
      for (const node of nodes(tree)) if (node.props?.ref) node.props.ref.current = rootDOM;
      if (commit) {
        for (const e of pending) e.old?.cleanup?.();
        for (const e of pending) effects.set(e.i, { deps: e.deps, cleanup: e.fn() });
      }
      return tree;
    },
    unmount() {
      for (const e of effects.values()) e.cleanup?.();
      effects.clear();
    },
  };
}
async function fixture() {
  delete globalThis[storeKey];
  const styles = new Map(),
    scenes = [];
  let reloads = 0;
  const root = {
    addEventListener() {},
    removeEventListener() {},
    focus() {},
    contains: () => false,
    querySelectorAll: () =>
      [0, 1, 2].map((i) => ({
        getBoundingClientRect: () => ({ left: 100 + i * 58, top: 300, width: 50, height: 5 }),
      })),
  };
  globalThis.document = {
    documentElement: { dataset: {}, style: { setProperty: (k, v) => styles.set(k, v) } },
    querySelectorAll: () => [],
    activeElement: null,
    body: {},
  };
  globalThis.window = {
    matchMedia: () => ({ matches: true }),
    location: { reload: () => reloads++ },
  };
  globalThis.__BootSceneProbe = class {
    constructor(host, track, projects, callbacks) {
      Object.assign(this, { host, track, projects, callbacks, progress: [], releases: [] });
      scenes.push(this);
    }
    start() {
      return new Promise((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      });
    }
    setState(state) {
      this.state = state;
    }
    setFilters(ids) {
      this.filters = ids;
    }
    setBootProgress(value) {
      this.progress.push(value);
    }
    releaseBoot(rects) {
      this.releases.push(rects);
    }
    dispose() {
      this.disposed = true;
    }
  };
  const api = await loadModule();
  const gallery = hookRunner(api.Gallery, root),
    loader = hookRunner(api.BootLoader, root);
  const p = { id: 'sample', title: 'Sample', cover: '/sample.webp', category: 'AI' };
  const props = {
    projects: [p],
    onOpen() {},
    onTransitionEnd() {},
    mode: 'full',
    project: null,
    phase: 'settled',
    visibleIds: ['sample'],
    filtersOpen: false,
    overlay: null,
  };
  return {
    api,
    styles,
    scenes,
    props,
    gallery,
    loader,
    root,
    reloads: () => reloads,
    dispose() {
      loader.unmount();
      gallery.unmount();
    },
  };
}

test('asset completion and Gallery start resolution cannot publish100 before renderer first-frame readiness', async () => {
  const f = await fixture();
  f.gallery.render(f.props);
  const scene = f.scenes[0];
  scene.callbacks.onBootProgress({ loaded: 4, total: 4, phase: 'All assets loaded' });
  assert.equal(f.api.getBootState().progress, 0.99);
  assert.equal(f.api.getBootState().status, 'loading');
  scene.resolve();
  await flush();
  assert.equal(f.api.getBootState().progress, 0.99);
  assert.equal(f.api.getBootState().dismissed, false);
  const tree = f.loader.render({}, false),
    bar = nodes(tree).find((n) => n.props?.role === 'progressbar');
  assert.equal(bar.props['aria-valuenow'], 99);
  scene.callbacks.onBootReady();
  assert.equal(f.api.getBootState().progress, 1);
  assert.equal(f.api.getBootState().status, 'ready');
  assert.equal(f.api.getBootState().dismissed, false);
  f.dispose();
});

test('ready is held until release and only renderer completion dismisses the loader', async () => {
  const f = await fixture();
  f.gallery.render(f.props);
  const scene = f.scenes[0];
  scene.callbacks.onBootReady();
  const token = globalThis[storeKey].generation;
  f.api.finishBootReveal(token);
  assert.equal(f.api.getBootState().dismissed, false);
  assert.equal(scene.releases.length, 0);
  f.loader.render();
  assert.equal(f.api.getBootState().status, 'revealing');
  assert.equal(f.api.getBootState().dismissed, false);
  assert.deepEqual(scene.releases[0], [
    { left: 100, top: 300, width: 50, height: 5 },
    { left: 158, top: 300, width: 50, height: 5 },
    { left: 216, top: 300, width: 50, height: 5 },
  ]);
  assert.equal(scene.progress.at(-1), 1);
  f.api.releaseBoot([]);
  assert.equal(scene.releases.length, 1, 'release is one-shot');
  await flush();
  assert.equal(
    f.api.getBootState().dismissed,
    false,
    'neither start completion nor a microtask dismisses',
  );
  scene.callbacks.onBootRevealFrame({ hudAlpha: 0.5, contentAlpha: 0.25 });
  assert.equal(f.styles.get('--boot-hud-alpha'), '0.5');
  assert.equal(f.styles.get('--boot-content-alpha'), '0.25');
  assert.equal(f.api.getBootState().dismissed, false);
  scene.callbacks.onBootRevealComplete();
  assert.equal(f.api.getBootState().dismissed, true);
  assert.equal(document.documentElement.dataset.portfolioBoot, 'complete');
  assert.equal(f.styles.get('--boot-content-alpha'), '1');
  assert.equal(f.loader.render(), null);
  f.dispose();
});

test('release without a live current-generation renderer cannot dismiss or enter revealing', async () => {
  const f = await fixture(),
    a = f.api.beginBoot(3);
  f.api.completeBoot(a);
  f.api.releaseBoot([]);
  assert.equal(f.api.getBootState().status, 'ready');
  assert.equal(f.api.getBootState().dismissed, false);
  let calls = 0;
  f.api.bindBootRenderer(a, { release: () => calls++ });
  const b = f.api.beginBoot(4);
  f.api.completeBoot(b);
  f.api.releaseBoot([]);
  assert.equal(calls, 0);
  assert.equal(f.api.getBootState().status, 'ready');
  f.dispose();
});

test('stale generation progress, frame, failure and completion callbacks cannot overwrite the current boot', async () => {
  const f = await fixture(),
    old = f.api.beginBoot(10),
    current = f.api.beginBoot(20);
  f.api.reportBoot(current, { loaded: 7, total: 20 });
  const snapshot = f.api.getBootState();
  f.api.reportBoot(old, { loaded: 10, total: 10 });
  f.api.completeBoot(old);
  f.api.failBoot(old, new Error('old error'));
  f.api.reportBootReveal(old, { hudAlpha: 1, contentAlpha: 1 });
  f.api.finishBootReveal(old);
  assert.equal(f.api.getBootState(), snapshot);
  assert.equal(f.styles.size, 0);
  let currentReleases = 0;
  f.api.bindBootRenderer(current, { release: () => currentReleases++ });
  f.api.bindBootRenderer(old, { release: () => assert.fail('stale driver') });
  f.api.completeBoot(current);
  f.api.releaseBoot([]);
  assert.equal(currentReleases, 1);
  f.dispose();
});

test('Gallery HMR ignores callbacks and Promise completions from the disposed scene', async () => {
  const f = await fixture();
  f.gallery.render(f.props);
  const old = f.scenes[0];
  f.gallery.render({ ...f.props, projects: [...f.props.projects] });
  const current = f.scenes[1];
  assert.equal(old.disposed, true);
  assert.equal(current.callbacks.bootEnabled, true);
  const snapshot = f.api.getBootState();
  old.callbacks.onBootProgress({ loaded: 999, total: 999 });
  old.callbacks.onBootReady();
  old.callbacks.onBootError(new Error('late failure'));
  old.callbacks.onBootRevealFrame({ hudAlpha: 1, contentAlpha: 1 });
  old.callbacks.onBootRevealComplete();
  old.resolve();
  await flush();
  assert.equal(f.api.getBootState(), snapshot);
  assert.equal(f.styles.size, 0);
  current.callbacks.onBootReady();
  f.loader.render();
  assert.equal(current.releases.length, 1);
  assert.equal(old.releases.length, 0);
  current.callbacks.onBootRevealComplete();
  assert.equal(f.api.getBootState().dismissed, true);
  f.dispose();
});

test('failure during release offers recovery and late renderer completion cannot hide that error', async () => {
  const f = await fixture();
  f.gallery.render(f.props);
  const scene = f.scenes[0];
  scene.callbacks.onBootReady();
  f.loader.render();
  const error = new Error('GPU lost during reveal');
  scene.callbacks.onBootError(error);
  assert.equal(f.api.getBootState().status, 'error');
  assert.equal(f.api.getBootState().dismissed, false);
  assert.equal(f.api.getBootState().error, error);
  scene.callbacks.onBootRevealComplete();
  scene.callbacks.onBootReady();
  assert.equal(f.api.getBootState().status, 'error');
  assert.equal(f.api.getBootState().dismissed, false);
  const recovery = nodes(f.loader.render()).find(
    (n) => n.type === 'button' && n.props.children === 'Reload portfolio',
  );
  assert.ok(recovery);
  recovery.props.onClick();
  assert.equal(f.reloads(), 1);
  f.dispose();
});

test('completed boot remains dismissed across HMR and late callbacks cannot restart it', async () => {
  const f = await fixture();
  f.gallery.render(f.props);
  const first = f.scenes[0];
  first.callbacks.onBootReady();
  f.loader.render();
  first.callbacks.onBootRevealComplete();
  const snapshot = f.api.getBootState();
  f.dispose();
  const refreshed = await loadModule();
  assert.equal(refreshed.getBootState(), snapshot);
  assert.equal(refreshed.beginBoot(500), null);
  const gallery = hookRunner(refreshed.Gallery, f.root);
  gallery.render(f.props);
  const scene = f.scenes[1];
  assert.equal(scene.callbacks.bootEnabled, false);
  scene.callbacks.onBootProgress({ loaded: 0, total: 100 });
  scene.callbacks.onBootReady();
  scene.callbacks.onBootError(new Error('post-boot failure'));
  scene.callbacks.onBootRevealFrame({ hudAlpha: 0, contentAlpha: 0 });
  scene.callbacks.onBootRevealComplete();
  scene.resolve();
  await flush();
  assert.equal(refreshed.getBootState(), snapshot);
  assert.equal(document.documentElement.dataset.portfolioBoot, 'complete');
  assert.equal(f.styles.get('--boot-content-alpha'), '1');
  assert.equal(scene.releases.length, 0);
  gallery.unmount();
});
