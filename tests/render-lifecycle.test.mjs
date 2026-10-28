import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import PortfolioScene from '../src/reference/PortfolioScene.js';
import { createCardMaterial } from '../src/reference/PostProcess.js';

function fixture(t, { hidden = false, cardCount = 0 } = {}) {
  const names = [
    'document',
    'window',
    'CustomEvent',
    'getComputedStyle',
    'requestAnimationFrame',
    'cancelAnimationFrame',
  ];
  const saved = names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  const restoreGlobals = () => {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  };
  const listeners = new Map(),
    queue = new Map(),
    ratios = [],
    frames = [],
    styleReads = [];
  let nextId = 0;
  const root = { fontSize: '12px' };
  const doc = {
    hidden,
    documentElement: root,
    querySelectorAll: () => [],
    addEventListener(type, fn) {
      const group = listeners.get(type) || new Set();
      group.add(fn);
      listeners.set(type, group);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
  };
  globalThis.document = doc;
  globalThis.window = {
    dispatchEvent(event) {
      frames.push(event.detail);
    },
  };
  globalThis.CustomEvent = class {
    constructor(type, options) {
      this.type = type;
      Object.assign(this, options);
    }
  };
  globalThis.getComputedStyle = (el) => {
    styleReads.push(el);
    return { fontSize: el.fontSize, borderRadius: el.radius };
  };
  globalThis.requestAnimationFrame = (fn) => {
    queue.set(++nextId, fn);
    return nextId;
  };
  globalThis.cancelAnimationFrame = (id) => queue.delete(id);
  const scene = new PortfolioScene({ ownerDocument: doc, dataset: {} }, { children: [] }, [], {
    bootEnabled: false,
  });
  const geometry = new THREE.PlaneGeometry(1, 1),
    texture = new THREE.Texture({ width: 200, height: 200 });
  const cards = Array.from({ length: cardCount }, (_, index) => {
    const p = { id: `p${index}` },
      rect = { left: index * 210, top: 200, width: 200, height: 200 };
    const material = createCardMaterial(texture, 200, 200),
      labelMaterial = createCardMaterial(texture, 200, 200);
    const el = { dataset: { id: p.id }, radius: '24px', _vrect: rect };
    return {
      p,
      el,
      mesh: new THREE.Mesh(geometry, material),
      label: { mesh: new THREE.Mesh(geometry, labelMaterial) },
    };
  });
  const labelSizes = [];
  Object.assign(scene, {
    cards,
    visibleIds: new Set(cards.map((card) => card.p.id)),
    width: 1000,
    height: 600,
    W: 10,
    H: 6,
    bootReady: true,
    scroll: {
      tick(ratio) {
        ratios.push(ratio);
      },
      measure() {},
      reset() {},
    },
    scene: new THREE.Scene(),
    over: new THREE.Scene(),
    renderer: { setRenderTarget() {}, setClearColor() {}, clear() {}, render() {} },
    post: { target: { texture: {} }, render() {} },
    wipe: { render: (value) => value },
    pointerTrail: { tick: () => ({}) },
    veil: { material: { uniforms: { u_alpha: { value: 0 } } } },
    rail: { visible: false },
    fullField: { update() {} },
    syncRail() {},
    syncPreviewVideos() {},
    syncProgress() {},
    syncHit() {},
    syncCase() {},
    publishRenderedLensReady() {},
    syncHole: () => ({ center: [0.5, 0.5], radius: 0.1 }),
    resizeLabel(label, width, height, rem) {
      labelSizes.push({ width, height, rem });
    },
  });
  t.after(() => {
    scene.stopRenderLoop();
    scene.bootReveal.dispose();
    for (const card of cards) {
      card.mesh.material.dispose();
      card.label.mesh.material.dispose();
    }
    geometry.dispose();
    texture.dispose();
    restoreGlobals();
  });
  return {
    scene,
    doc,
    queue,
    listeners,
    ratios,
    frames,
    cards,
    root,
    styleReads,
    labelSizes,
    visibility(value) {
      doc.hidden = value;
      for (const fn of listeners.get('visibilitychange') || []) fn();
    },
    frame(time) {
      const entry = queue.entries().next().value;
      assert.ok(entry, 'a visible frame is scheduled');
      queue.delete(entry[0]);
      entry[1](time);
    },
  };
}

test('hidden scenes stop scheduling and resume with one frame of local animation time', (t) => {
  const f = fixture(t);
  f.scene.startRenderLoop();
  f.frame(1000);
  f.frame(1016);
  const clock = f.scene.clock;
  assert.equal(f.queue.size, 1);
  f.visibility(true);
  assert.equal(f.queue.size, 0, 'no WebGL work is queued for a hidden document');
  f.scene.tick(60000);
  assert.equal(f.frames.length, 2, 'even a late callback cannot advance a hidden scene');
  assert.equal(f.scene.clock, clock);
  f.visibility(false);
  f.visibility(false);
  assert.equal(f.queue.size, 1, 'visibility events cannot duplicate the frame loop');
  f.frame(61016);
  assert.equal(f.ratios.at(-1), 1, 'virtual scroll does not receive the hidden minute as a delta');
  assert.equal(f.frames.at(-1).dt, 1 / 60);
  assert.ok(Math.abs(f.scene.clock - clock - 1 / 60) < 1e-9);
  f.frame(61032);
  assert.equal(f.ratios.at(-1), 0.96);
});

test('startup stays idle while hidden and teardown removes listeners and stale callbacks', (t) => {
  const f = fixture(t, { hidden: true });
  f.scene.startRenderLoop();
  assert.equal(f.queue.size, 0);
  assert.equal(f.listeners.get('visibilitychange').size, 1);
  f.visibility(false);
  const lateFrame = [...f.queue.values()][0];
  f.scene.stopRenderLoop();
  f.scene.stopRenderLoop();
  assert.equal(f.queue.size, 0);
  assert.equal(f.listeners.get('visibilitychange').size, 0);
  lateFrame(3000);
  assert.equal(f.frames.length, 0, 'a stopped loop cannot render a stale scheduled callback');
  f.scene.startRenderLoop();
  f.scene.startRenderLoop();
  assert.equal(f.listeners.get('visibilitychange').size, 1);
  assert.equal(f.queue.size, 1);
});

test('measured card styles are reused for rendered frames and refreshed after layout changes', (t) => {
  const f = fixture(t, { cardCount: 3 });
  f.scene.measure();
  assert.equal(f.styleReads.length, 4, 'one root font read and one radius read per card');
  for (let index = 1; index <= 10; index++) f.scene.tick(index * 16);
  assert.equal(f.styleReads.length, 4, 'steady frames do not read computed gallery styles');
  assert.ok(f.cards.every((card) => card.mesh.material.uniforms.u_corner.value === 0.12));
  assert.ok(f.labelSizes.every((size) => size.rem === 12));
  f.root.fontSize = '10px';
  for (const card of f.cards) card.el.radius = '15px';
  f.scene.measure();
  f.labelSizes.length = 0;
  f.scene.tick(176);
  assert.equal(f.styleReads.length, 8);
  assert.ok(f.cards.every((card) => card.mesh.material.uniforms.u_corner.value === 0.075));
  assert.ok(f.labelSizes.every((size) => size.rem === 10));
});
