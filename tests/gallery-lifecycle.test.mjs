import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const galleryPath = fileURLToPath(new URL('../src/Gallery.jsx', import.meta.url));

const compiled = await build({
  absWorkingDir: appRoot,
  entryPoints: [galleryPath],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  plugins: [
    {
      name: 'lifecycle-probes',
      setup(b) {
        b.onResolve({ filter: /^react(?:\/jsx-runtime)?$/ }, (a) => ({
          path: a.path,
          namespace: 'probe',
        }));
        b.onResolve({ filter: /PortfolioScene\.js$/ }, () => ({
          path: 'scene',
          namespace: 'probe',
        }));
        b.onLoad({ filter: /.*/, namespace: 'probe' }, (a) => ({
          contents:
            a.path === 'react'
              ? 'export const useRef=(v)=>globalThis.__galleryHooks.ref(v),useState=(v)=>globalThis.__galleryHooks.state(v),useLayoutEffect=(f,d)=>globalThis.__galleryHooks.effect(f,d);'
              : a.path === 'react/jsx-runtime'
                ? 'export const jsx=(type,props)=>({type,props}),jsxs=jsx;'
                : 'export default class Scene{constructor(...args){return new globalThis.__SceneProbe(...args)}}',
        }));
      },
    },
  ],
});
const { default: Gallery } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64')
);
const flush = () => new Promise((resolve) => setImmediate(resolve));
function fixture() {
  const scenes = [];
  let cursor = 0,
    pending = [];
  const slots = [],
    effects = new Map();
  const viewClasses = new Set(['gl-case-ready']),
    mediaClasses = new Set(['gl-media-ready']);
  globalThis.document = {
    querySelectorAll: (s) => [
      {
        classList: {
          remove: (v) => (s.includes('case-view.gl') ? viewClasses : mediaClasses).delete(v),
        },
      },
    ],
  };
  globalThis.__SceneProbe = class {
    constructor(host, track, projects, callbacks) {
      Object.assign(this, {
        host,
        track,
        projects,
        callbacks,
        state: { mode: 'featured', project: null },
      });
      scenes.push(this);
    }
    start() {
      return new Promise((resolve) => (this.resolve = resolve));
    }
    setState(value) {
      this.state = { ...this.state, ...value };
    }
    setFilters(value) {
      this.filters = value;
    }
    dispose() {
      this.disposed = true;
    }
  };
  const hooks = {
    ref(value) {
      const i = cursor++;
      return (slots[i] ??= { current: value });
    },
    state(value) {
      const i = cursor++;
      slots[i] ??= { value: typeof value === 'function' ? value() : value, state: true };
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
      if (!old || deps.some((x, j) => !Object.is(x, old.deps[j])))
        pending.push({ i, fn, deps, old });
    },
  };
  const render = (props) => {
    globalThis.__galleryHooks = hooks;
    cursor = 0;
    pending = [];
    Gallery(props);
    slots[0].current ??= {};
    slots[1].current ??= {};
    for (const e of pending) e.old?.cleanup?.();
    for (const e of pending) effects.set(e.i, { deps: e.deps, cleanup: e.fn() });
  };
  return {
    scenes,
    render,
    ready: () => slots.find((s) => s?.state).value,
    engine: () => slots[2].current,
    viewClasses,
    mediaClasses,
    unmount: () => {
      for (const e of effects.values()) e.cleanup?.();
    },
  };
}
const a = { id: 'a', title: 'A', cover: '/a.webp', category: 'AI' },
  b = { id: 'b', title: 'B', cover: '/b.webp', category: 'Web3' };
const base = () => ({
  projects: [a, b],
  onOpen() {},
  onTransitionEnd() {},
  mode: 'featured',
  project: a,
  phase: 'opening',
  visibleIds: ['a'],
  filtersOpen: false,
  overlay: null,
});

test('initial opening and selected filter are installed before startup and replayed after readiness', async () => {
  const f = fixture(),
    p = base();
  f.render(p);
  const first = f.scenes[0];
  assert.equal(first.state.project, a);
  assert.equal(first.state.phase, 'opening');
  assert.deepEqual(first.filters, ['a']);
  assert.equal(f.ready(), false);
  assert.equal(f.viewClasses.size, 0);
  assert.equal(f.mediaClasses.size, 0);
  first.resolve();
  await flush();
  assert.equal(first.state.project, a);
  assert.equal(first.state.phase, 'opening');
  assert.equal(f.ready(), true);
  f.unmount();
});

test('startup completion reads the latest committed mode, overlay, case and filters', async () => {
  const f = fixture(),
    p = base();
  f.render(p);
  const first = f.scenes[0];
  const next = {
    ...p,
    mode: 'full',
    project: null,
    phase: 'settled',
    overlay: 'filters',
    filtersOpen: true,
    visibleIds: ['b'],
  };
  f.render(next);
  first.resolve();
  await flush();
  assert.equal(first.state.mode, 'full');
  assert.equal(first.state.project, null);
  assert.equal(first.state.overlay, 'filters');
  assert.equal(first.state.filtersOpen, true);
  assert.deepEqual(first.filters, ['b']);
  assert.equal(f.ready(), true);
  f.unmount();
});

test('content HMR rehydrates unchanged case props and obsolete readiness cannot affect the replacement', async () => {
  const f = fixture(),
    p = { ...base(), phase: 'settled' };
  f.render(p);
  const old = f.scenes[0];
  const replacementProps = { ...p, projects: [{ ...a }, { ...b }] };
  f.render(replacementProps);
  const fresh = f.scenes[1];
  assert.equal(old.disposed, true);
  assert.equal(f.engine(), fresh);
  assert.equal(fresh.state.project, a);
  assert.equal(fresh.state.phase, 'settled');
  assert.deepEqual(fresh.filters, ['a']);
  assert.equal(f.ready(), false);
  old.resolve();
  await flush();
  assert.equal(f.ready(), false);
  assert.equal(f.engine(), fresh);
  fresh.resolve();
  await flush();
  assert.equal(f.ready(), true);
  f.unmount();
  assert.equal(fresh.disposed, true);
  assert.equal(f.engine(), null);
});

test('callbacks and state changes during loading are not captured from an older render', async () => {
  const f = fixture(),
    p = base();
  let opened = null;
  f.render(p);
  const scene = f.scenes[0];
  f.render({
    ...p,
    project: b,
    phase: 'opening',
    visibleIds: ['b'],
    onOpen: (value) => (opened = value),
  });
  scene.callbacks.onOpen(b);
  assert.equal(opened, b);
  scene.resolve();
  await flush();
  assert.equal(scene.state.project, b);
  assert.equal(scene.state.phase, 'opening');
  assert.deepEqual(scene.filters, ['b']);
  f.unmount();
});
