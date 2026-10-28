import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import PortfolioScene from '../src/reference/PortfolioScene.js';
import { createCardMaterial } from '../src/reference/PostProcess.js';
import { bootExpoIn, bootExpoInOut, BOOT_REVEAL } from '../src/reference/BootReveal.js';

const bars = [417, 475, 533].map((left) => ({ left, top: 297.5, width: 50, height: 5 }));
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
function fixture({
  positions = [80, 400, 720],
  enabled = true,
  mode = 'featured',
  small = false,
} = {}) {
  const frames = [],
    completed = [],
    transitions = [],
    opened = [],
    fullEntries = new Map();
  const motion = { matches: false };
  let caseTargets = [],
    fullButtons = [];
  const style = (el) => ({ borderRadius: el?.radius || '20px', fontSize: '10px' });
  const doc = {
    documentElement: { clientWidth: 1000, clientHeight: 600 },
    defaultView: { getComputedStyle: style },
    querySelectorAll(selector) {
      if (selector.includes('case-view')) return caseTargets;
      if (selector.includes('boot-loader-bar')) return bars.map(() => ({ radius: '20px' }));
      if (selector.includes('full-index')) return fullButtons;
      return [];
    },
    querySelector() {
      return caseTargets.find((el) => el.dataset.gl === 'sheet') || null;
    },
  };
  globalThis.document = doc;
  globalThis.matchMedia = () => motion;
  globalThis.getComputedStyle = style;
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class {
    constructor(type, init) {
      Object.assign(this, { type, ...init });
    }
  };
  globalThis.requestAnimationFrame = () => 1;
  const makeElement = (rect, id, gl = 'card') => ({
    dataset: { id, gl },
    _vrect: rect,
    isConnected: true,
    hidden: false,
    style: {},
    getBoundingClientRect() {
      return this._vrect;
    },
  });
  const geometry = new THREE.PlaneGeometry(1, 1, 24, 24),
    texture = new THREE.Texture({ width: 200, height: 200 });
  const cards = positions.map((left, index) => {
    const p = { id: `p${index}`, title: `P${index}`, cover: `/${index}.webp` },
      rect = { left, top: 200, width: 200, height: 200 };
    const mesh = new THREE.Mesh(geometry, createCardMaterial(texture, 200, 200)),
      label = new THREE.Mesh(geometry, createCardMaterial(texture, 200, 200));
    return {
      p,
      el: makeElement(rect, p.id),
      mesh,
      tex: texture,
      label: { mesh: label },
      hit: { style: {} },
    };
  });
  const scene = new PortfolioScene(
    { ownerDocument: doc, dataset: {} },
    { children: cards.map((c) => c.el) },
    cards.map((c) => c.p),
    {
      bootEnabled: enabled,
      onBootRevealFrame: (d) => frames.push({ ...d }),
      onBootRevealComplete: () => completed.push(true),
      onTransitionEnd: (phase) => transitions.push(phase),
      onOpen: (p) => opened.push(p),
    },
  );
  Object.assign(scene, {
    cards,
    width: 1000,
    height: 600,
    dpr: 1,
    W: 10,
    H: 6,
    small,
    bootReady: true,
    caseMotionQuery: motion,
    fullField: { entries: fullEntries, update() {} },
    resizeLabel() {},
  });
  scene.state.mode = mode;
  for (const card of cards) scene.registry.set(card.p.id, card);
  const target = (card, rect, gl) => makeElement(rect, card.p.id, gl);
  const frame = (dt) => {
    scene.bootReveal.advance(dt);
    scene.bootReveal.apply();
    scene.bootReveal.afterRender();
  };
  const clean = () => {
    scene.bootReveal.dispose();
    for (const c of cards) {
      c.mesh.material.dispose();
      c.label.mesh.material.dispose();
    }
    geometry.dispose();
    texture.dispose();
  };
  return {
    scene,
    boot: scene.bootReveal,
    cards,
    geometry,
    texture,
    frames,
    completed,
    transitions,
    opened,
    motion,
    frame,
    clean,
    target,
    caseTargets: (value) => (caseTargets = value),
    fullButtons: (count) => {
      fullButtons = Array.from({ length: count }, (_, index) => ({
        dataset: { projectId: `p${index}` },
      }));
      for (const button of fullButtons)
        fullEntries.set(button, {
          material: { uniforms: { u_progress: { value: 1 }, u_slide: { value: 0 } } },
        });
    },
  };
}
function ordinaryTicks(f, { syncCase = () => {} } = {}) {
  Object.assign(f.scene, {
    scene: new THREE.Scene(),
    over: new THREE.Scene(),
    scroll: { tick() {} },
    renderer: { setRenderTarget() {}, setClearColor() {}, clear() {}, render() {} },
    post: { target: { texture: {} }, render() {} },
    wipe: { render: (t) => t },
    pointerTrail: { tick: () => ({}) },
    veil: { material: { uniforms: { u_alpha: { value: 0 } } } },
    rail: { visible: false },
    syncRail() {},
    syncPreviewVideos() {},
    syncProgress() {},
    syncHit() {},
    syncCase,
    publishRenderedLensReady() {},
    syncHole: () => ({ center: [0.5, 0.5], radius: 0.1 }),
  });
  return () => {
    for (let frame = 1; frame <= 8; frame++) f.scene.tick(frame * 17);
  };
}

test('bundled Expo uses the source correction and exact symmetric inOut endpoints', () => {
  assert.equal(bootExpoIn(0), 0);
  assert.equal(bootExpoIn(1), 1);
  assert.equal(bootExpoInOut(0), 0);
  assert.equal(bootExpoInOut(0.5), 0.5);
  assert.equal(bootExpoInOut(1), 1);
  near(bootExpoIn(0.5), Math.pow(2, -5) * 0.5 + Math.pow(0.5, 6) * 0.5);
  for (const t of [0.01, 0.15, 0.25, 0.4]) near(bootExpoInOut(t), 1 - bootExpoInOut(1 - t));
  assert.notEqual(bootExpoIn(0.5), Math.pow(2, -5));
});

test('waiting hides content but leaves real first-render readiness independent of reveal', () => {
  const f = fixture();
  let ready = 0,
    renders = 0,
    caseCalls = 0;
  f.scene.bootReady = false;
  f.scene.bootLoaded = 0;
  f.scene.bootTotal = 6;
  f.scene.callbacks.onBootReady = () => ready++;
  Object.assign(f.scene, {
    scene: new THREE.Scene(),
    over: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    scroll: { tick() {} },
    renderer: {
      setRenderTarget() {},
      setClearColor() {},
      clear() {},
      render() {
        renders++;
        assert(f.cards.every((c) => !c.mesh.visible && !c.label.mesh.visible));
      },
    },
    post: { target: { texture: {} }, render() {} },
    wipe: { render: (t) => t },
    pointerTrail: { tick: () => ({}) },
    veil: { material: { uniforms: { u_alpha: { value: 1 } } } },
    rail: { visible: true },
    publishRenderedLensReady() {},
    syncHole: () => ({ center: [0.5, 0.5], radius: 0.1 }),
    syncCase() {
      caseCalls++;
    },
  });
  assert.equal(f.scene.releaseBoot(bars), false);
  f.scene.tick(16);
  f.scene.tick(32);
  assert.equal(ready, 1);
  assert.equal(renders, 4);
  assert.equal(caseCalls, 0);
  assert.equal(f.boot.waiting, true);
  assert.equal(f.completed.length, 0);
  // GSAP lagSmoothing(0) advances the source flight in elapsed seconds even
  // when rendering is throttled; only physical shader dt is capped at .05.
  f.scene.renderer.render = () => {};
  f.scene.releaseBoot(bars);
  f.scene.tick(1032);
  near(f.boot.elapsed, 1);
  assert.equal(f.completed.length, 0);
  f.clean();
});

test('release reuses the same three real card planes and source textures at bar poses', () => {
  const f = fixture(),
    meshes = f.cards.map((c) => c.mesh),
    input = structuredClone(bars);
  f.scene.setBootProgress(0.8);
  f.scene.setBootProgress(0.4);
  assert.equal(f.boot.progress, 0.8);
  assert.equal(f.scene.releaseBoot(input), true);
  assert.equal(f.scene.releaseBoot(input), false);
  assert.deepEqual(
    f.cards.map((c) => c.mesh),
    meshes,
  );
  assert.equal(f.boot.entries.length, 3);
  for (const [index, entry] of f.boot.entries.entries()) {
    const expected = f.scene.pose(bars[index]);
    assert(entry.card.mesh.position.equals(expected.position));
    assert(entry.card.mesh.scale.equals(expected.scale));
    assert.equal(entry.card.mesh.geometry, f.geometry);
    assert.equal(entry.card.mesh.material.uniforms.u_texture.value, f.texture);
    assert.equal(entry.card.mesh.material.uniforms.u_white.value, 1);
    assert.equal(entry.card.mesh.material.uniforms.u_sheetP.value, 0);
  }
  input[0].left = 0;
  assert.equal(f.boot.entries[0].from.left, 417);
  f.clean();
});

test('the first flight matches exact midpoint, stagger, wash, shading and pixel radius formulas', () => {
  const f = fixture();
  f.scene.releaseBoot(bars);
  f.frame(0.75);
  const e = f.boot.entries[0],
    u = e.card.mesh.material.uniforms,
    target = f.scene.pose(e.card.el._vrect);
  assert(
    e.card.mesh.position.equals(new THREE.Vector3().lerpVectors(e.position, target.position, 0.5)),
  );
  assert(e.card.mesh.scale.equals(new THREE.Vector3().lerpVectors(e.scale, target.scale, 0.5)));
  near(u.u_white.value, 0.46);
  near(u.u_sheetP.value, 0.5);
  near(u.u_shade.value, 0.5);
  near(u.u_corner.value, 20 / 102.5);
  assert.equal(u.u_clipOn.value, 0);
  const second = f.boot.entries[1],
    delayProgress = bootExpoInOut((0.75 - 0.05) / 1.5);
  near(second.card.mesh.material.uniforms.u_sheetP.value, delayProgress);
  assert.equal(e.card.label.mesh.visible, false);
  f.frame(0.05);
  assert(e.card.label.mesh.visible);
  assert(f.frames.at(-1).hudAlpha > 0);
  assert.equal(e.card.mesh.renderOrder, 100);
  assert.equal(e.card.label.mesh.renderOrder, 101);
  assert.deepEqual(e.card.label.mesh.material.uniforms.u_res.value.toArray(), [
    e.card.mesh.scale.x,
    e.card.mesh.scale.y,
  ]);
  assert(e.card.label.mesh.position.equals(e.card.mesh.position));
  assert(e.card.label.mesh.scale.equals(e.card.mesh.scale));
  f.clean();
});

test('completion follows the final rendered source flight and fires exactly once', () => {
  const f = fixture();
  f.scene.releaseBoot(bars);
  f.frame(1.5);
  assert.equal(f.completed.length, 0);
  f.frame(0.1);
  assert.equal(f.completed.length, 1);
  assert.equal(f.boot.pending, false);
  for (const e of f.boot.entries) {
    const u = e.card.mesh.material.uniforms;
    near(u.u_white.value, 0);
    near(u.u_sheetP.value, 1);
    near(u.u_shade.value, 1);
    assert.equal(u.u_clipOn.value, 0);
    assert.equal(e.card.mesh.renderOrder, 10);
    assert.equal(e.card.label.mesh.renderOrder, 11);
  }
  f.frame(20);
  assert.equal(f.completed.length, 1);
  assert.equal(f.frames.at(-1).phase, 'complete');
  f.clean();
});

test('only nearest visible cards become targets and two filtered cases never gain a duplicate', () => {
  const f = fixture({ positions: [-600, 80, 400, 720, 1500] });
  f.scene.visibleIds = new Set(['p1', 'p3']);
  f.scene.releaseBoot(bars);
  assert.deepEqual(
    f.boot.entries.map((e) => e.card.p.id),
    ['p1', 'p3'],
  );
  assert.equal(f.cards.length, 5);
  assert.equal(f.boot.duration, 1.55);
  f.frame(1.55);
  assert.equal(f.completed.length, 1);
  assert.equal(f.cards[0].mesh.visible, false);
  assert.equal(f.cards[4].mesh.visible, false);
  f.clean();
});

test('mobile selects by vertical proximity without changing card layout or scroll transforms', () => {
  const f = fixture({ small: true });
  f.cards[0].el._vrect.top = 900;
  f.cards[1].el._vrect.top = 100;
  f.cards[2].el._vrect.top = 350;
  const before = f.cards.map((c) => ({ ...c.el._vrect }));
  f.scene.releaseBoot(bars.slice(0, 2));
  assert.deepEqual(
    f.boot.entries.map((e) => e.card.p.id),
    ['p1', 'p2'],
  );
  assert.deepEqual(
    f.cards.map((c) => c.el._vrect),
    before,
  );
  f.frame(1.55);
  assert.equal(f.cards[1].mesh.material.uniforms.u_sheetW.value, 0);
  f.clean();
});

test('remaining on-screen cards enter after source 1.15s and finish before callback', () => {
  const f = fixture({ positions: [20, 260, 500, 740] });
  f.scene.releaseBoot(bars);
  assert.equal(f.boot.rest.length, 1);
  const rest = f.boot.rest[0];
  f.frame(1.14);
  assert.equal(rest.mesh.visible, false);
  f.frame(0.02);
  assert.equal(rest.mesh.visible, true);
  assert(rest.mesh.material.uniforms.u_alpha.value > 0);
  assert.equal(f.completed.length, 0);
  f.frame(1.24);
  assert.equal(f.completed.length, 1);
  near(rest.mesh.material.uniforms.u_alpha.value, 1);
  f.clean();
});

test('resize recomputes the live landing pose during an in-flight reveal', () => {
  const f = fixture();
  f.scene.releaseBoot(bars);
  f.frame(0.4);
  const e = f.boot.entries[0];
  Object.assign(e.card.el._vrect, { left: 40, top: 140, width: 320, height: 240 });
  f.scene.width = 1200;
  f.scene.W = 12;
  f.frame(1.2);
  const expected = f.scene.pose(e.card.el._vrect);
  assert(e.card.mesh.position.equals(expected.position));
  assert(e.card.mesh.scale.equals(expected.scale));
  f.clean();
});

test('Full retires bar planes and reveals the index shader without flying into hidden cards', () => {
  const f = fixture({ mode: 'full' });
  f.fullButtons(16);
  f.scene.releaseBoot(bars);
  assert(f.boot.entries.every((e) => e.kind === 'retiring'));
  f.frame(0.15);
  near(f.cards[0].mesh.material.uniforms.u_alpha.value, 1 - (1 - bootExpoIn(0.5)));
  const entries = [...f.scene.fullField.entries.values()];
  assert(entries[0].material.uniforms.u_progress.value > 0);
  assert.equal(entries[15].material.uniforms.u_progress.value, 0);
  f.frame(0.2);
  assert(f.cards.every((c) => !c.mesh.visible));
  assert.equal(f.completed.length, 0);
  f.frame(1.2);
  assert.equal(f.completed.length, 1);
  assert(
    entries.every(
      (e) => e.material.uniforms.u_progress.value === 1 && e.material.uniforms.u_slide.value === 0,
    ),
  );
  f.clean();
});

test('Full completion parks every unused plane and ordinary frames cannot resurrect a centre dot', () => {
  const f = fixture({ mode: 'full', positions: [-400, 20, 260, 500, 900] });
  f.fullButtons(16);
  f.scene.modeAlpha = 1;
  f.scene.releaseBoot(bars);
  f.frame(2);
  assert(f.cards.every((c) => !c.mesh.visible && !c.label.mesh.visible));
  assert(f.cards.every((c) => c.mesh.material.uniforms.u_alpha.value === 0));
  for (const card of f.cards) {
    const pose = f.scene.pose(card.el._vrect);
    assert(card.mesh.position.equals(pose.position));
    assert(card.mesh.scale.equals(pose.scale));
  }
  // A reduced-motion or cached startup can leave modeAlpha above its old
  // visibility threshold. Full must still never show gallery planes.
  assert.equal(f.scene.modeAlpha, 0);
  ordinaryTicks(f)();
  assert(f.cards.every((c) => !c.mesh.visible && !c.label.mesh.visible));
  f.clean();
});

test('direct case hands bar meshes to the actual sheet and related slots then settles once', () => {
  const f = fixture();
  f.scene.state.project = f.cards[1].p;
  f.scene.state.phase = 'opening';
  f.scene.pendingTransition = true;
  f.caseTargets([
    f.target(f.cards[0], { left: -850, top: 50, width: 800, height: 500 }, 'related'),
    f.target(f.cards[1], { left: 50, top: 20, width: 900, height: 560 }, 'sheet'),
    f.target(f.cards[2], { left: 1100, top: 50, width: 800, height: 500 }, 'related'),
  ]);
  f.scene.releaseBoot(bars);
  assert.equal(f.scene.pendingTransition, false);
  assert.deepEqual(
    f.boot.entries.map((e) => e.kind),
    ['related', 'sheet', 'related'],
  );
  f.frame(1.6);
  assert.equal(f.completed.length, 1);
  assert.deepEqual(f.transitions, ['opening']);
  assert.equal(f.scene.state.phase, 'settled');
  const u = f.cards[1].mesh.material.uniforms;
  assert.equal(u.u_white.value, 1);
  near(u.u_wash.value.r, 0.031);
  assert.equal(f.cards[0].mesh.visible, false);
  f.frame(1);
  assert.equal(f.transitions.length, 1);
  f.clean();
});

test('missing targets or bar geometry cannot leave the loader at 100% indefinitely', () => {
  const f = fixture({ positions: [] });
  f.scene.releaseBoot([]);
  f.frame(0);
  assert.equal(f.completed.length, 1);
  assert.equal(f.boot.pending, false);
  f.clean();
});

test('reduced motion completes in one rendered frame and input is blocked until handoff finishes', () => {
  const f = fixture();
  f.scene.activate(f.cards[0].p);
  assert.equal(f.opened.length, 0);
  f.scene.syncHit(f.cards[0]);
  assert.equal(f.cards[0].hit.style.display, 'none');
  f.scene.releaseBoot(bars);
  f.motion.matches = true;
  f.frame(0);
  assert.equal(f.completed.length, 1);
  assert.equal(f.boot.pending, false);
  f.scene.activate(f.cards[0].p);
  assert.equal(f.opened.length, 1);
  f.clean();
});

test('disposal suppresses late progress, release, frame and completion callbacks', () => {
  const f = fixture();
  f.scene.releaseBoot(bars);
  f.boot.dispose();
  f.scene.destroyed = true;
  const count = f.frames.length;
  f.frame(5);
  assert.equal(f.frames.length, count);
  assert.equal(f.completed.length, 0);
  assert.equal(f.scene.releaseBoot(bars), false);
  f.clean();
});

test('a completed or HMR replacement scene does not replay the first boot', () => {
  const f = fixture({ enabled: false });
  assert.equal(f.boot.pending, false);
  assert.equal(f.scene.releaseBoot(bars), false);
  f.frame(10);
  assert.equal(f.frames.length, 0);
  assert.equal(f.completed.length, 0);
  f.clean();
});
