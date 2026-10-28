import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import PortfolioScene from '../src/reference/PortfolioScene.js';
import PointerTrail, { POINTER_CONSTANTS } from '../src/reference/PointerTrail.js';
import { LensPass } from '../src/reference/PostProcess.js';

class RendererProbe {
  constructor() {
    this.autoClear = false;
    this.target = null;
    this.alpha = 1;
    this.color = new THREE.Color(0xffffff);
    this.calls = [];
  }
  getPixelRatio() {
    return 2;
  }
  getRenderTarget() {
    return this.target;
  }
  setRenderTarget(target) {
    this.target = target;
  }
  getClearAlpha() {
    return this.alpha;
  }
  getClearColor(result) {
    return result.copy(this.color);
  }
  setClearColor(color, alpha) {
    this.color.set(color);
    if (alpha !== undefined) this.alpha = alpha;
  }
  clear() {}
  render(scene, camera) {
    this.calls.push({ scene, camera, target: this.target });
  }
}

function pointerFixture({ mouse = true, shields = [] } = {}) {
  globalThis.document = { querySelectorAll: () => shields };
  const renderer = new RendererProbe();
  const post = new LensPass(renderer);
  post.resize(657, 899, 2);
  const pointer = new PointerTrail(post, () => ({ width: 657, height: 899, mouse }));
  const sceneTexture = new THREE.Texture();
  const frame = () => {
    const state = pointer.tick(1 / 60, 0);
    post.render(sceneTexture, state);
    return state;
  };
  const dispose = () => {
    pointer.dispose();
    post.dispose();
    sceneTexture.dispose();
  };
  return { renderer, post, pointer, sceneTexture, frame, dispose };
}

test('657px fine pointer drives the original fullscreen trail and actual ping-pong render calls', () => {
  const f = pointerFixture();
  f.pointer.move(200, 200);
  f.frame();
  assert.equal(f.post.trailFrames, 0);
  f.pointer.move(495, 230);
  const moving = f.frame();
  assert.ok(moving.ball > 0 && moving.trail.amplitude > 0.9);
  assert.deepEqual(moving.trail.position, [495 / 657, 1 - 230 / 899]);
  assert.equal(f.post.u.u_ballWarp.value, POINTER_CONSTANTS.SB);
  assert.equal(f.post.u.u_ballShade.value, POINTER_CONSTANTS.MB);
  assert.equal(f.post.trailFrames, 1);
  assert.equal(f.post.u.u_trail.value, f.post.trail[f.post.trailSide].texture);
  assert.equal(f.post.u.u_scene.value, f.sceneTexture);
  assert.equal(f.renderer.calls.at(-1).scene, f.post.scene);
  assert.equal(f.renderer.calls.at(-2).scene, f.post.trailScene);
  assert.equal(f.post.trailMaterial.uniforms.u_pos.value.x, 495 / 657);
  assert.equal(f.post.target.width, 1314, 'DPR applies to buffers, not pointer CSS coordinates');
  const side = f.post.trailSide;
  f.pointer.move(260, 320);
  f.frame();
  assert.equal(f.post.trailSide, 1 - side);
  assert.equal(f.post.trailFrames, 2);
  f.dispose();
});

test('source refraction decays naturally at rest instead of becoming a permanent static hover', () => {
  const f = pointerFixture();
  f.pointer.move(200, 200);
  f.frame();
  f.pointer.move(495, 230);
  f.frame();
  assert.ok(f.pointer.ball.e > 0.9);
  let last;
  for (let i = 0; i < 360; i += 1) last = f.frame();
  assert.ok(f.pointer.ball.e < 0.004);
  assert.equal(last.ball, 0);
  assert.equal(last.trail, null);
  const stoppedAt = f.post.trailFrames;
  f.frame();
  assert.equal(f.post.trailFrames, stoppedAt);
  f.dispose();
});

test('disconnected overlay shields do not suppress refraction after returning to a case', () => {
  const f = pointerFixture({ shields: [{ isConnected: false, closest: () => null }] });
  f.pointer.move(200, 200);
  f.frame();
  f.pointer.move(495, 230);
  const moving = f.frame();
  assert.ok(moving.trail.amplitude > 0.9);
  assert.equal(f.pointer.ball.w, 1);
  assert.equal(f.post.u.u_ballWarp.value, -0.045);
  f.dispose();
});

test('source fine-pointer requirement keeps touch and coarse input out of the field', () => {
  const fine = pointerFixture();
  fine.pointer.move(200, 200, 'touch');
  fine.frame();
  fine.pointer.move(495, 230, 'touch');
  fine.frame();
  assert.equal(fine.post.trailFrames, 0);
  fine.dispose();
  const coarse = pointerFixture({ mouse: false });
  coarse.pointer.move(200, 200);
  coarse.frame();
  coarse.pointer.move(495, 230);
  coarse.frame();
  assert.equal(coarse.post.trailFrames, 0);
  assert.equal(coarse.post.u.u_ballA.value, 0);
  coarse.dispose();
});

const box = (left, top, width, height) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});
function holeFixture() {
  const main = {
    dataset: {},
    style: {
      setProperty(name, value) {
        this[name] = value;
      },
    },
  };
  const panel = (rect) => ({
    isConnected: true,
    rect,
    getBoundingClientRect() {
      return this.rect;
    },
  });
  const panels = {
    'profile-panel': panel(box(208.5, 369.5, 240, 160)),
    'filters-panel': panel(box(163.5, 267, 330, 365)),
    'cv-panel': panel(box(88.5, 229.5, 480, 440)),
  };
  globalThis.document = {
    documentElement: { clientWidth: 657, clientHeight: 899 },
    getElementById: (id) => panels[id] || null,
  };
  const disc = { getBoundingClientRect: () => box(197, 318, 263, 263) };
  const host = { closest: () => main, querySelector: () => disc, parentElement: main };
  const scene = new PortfolioScene(host, { children: [] }, [{ id: 'a' }, { id: 'b' }], {});
  scene.width = 657;
  scene.height = 899;
  const canvas = {
    rect: box(0, 0, 657, 899),
    getBoundingClientRect() {
      return this.rect;
    },
  };
  scene.renderer = { domElement: canvas, getPixelRatio: () => 1 };
  scene.post = { width: 657, height: 899, dpr: 1 };
  const frame = () => {
    const geometry = scene.syncHole();
    scene.publishRenderedLensReady();
    return geometry;
  };
  return { scene, main, panels, canvas, frame };
}

test('filters bind to the actual panel envelope and stay hidden until the lens fits every corner', () => {
  const { scene, main, frame } = holeFixture();
  scene.setState({ overlay: 'filters', filtersOpen: true });
  assert.equal(main.dataset.lensReady, 'false');
  const geometry = scene.syncHole();
  assert.deepEqual(geometry.center, [0.5, 0.5]);
  assert.ok(geometry.radius * 657 * 2 > Math.hypot(330, 365));
  scene.hole.p = 0.95;
  frame();
  assert.equal(main.dataset.lensReady, 'false', '95 percent is still too small with source lobes');
  scene.hole.p = 1;
  scene.syncHole();
  assert.equal(
    main.dataset.lensReady,
    'false',
    'geometry alone cannot expose content before rendering',
  );
  scene.publishRenderedLensReady();
  assert.equal(
    main.dataset.lensReady,
    'false',
    'one matching render is not a stable presented frame',
  );
  frame();
  assert.equal(main.dataset.lensReady, 'true');
  assert.equal(main.style['--lens-content-opacity'], '1');
});

test('retarget keeps one open lens, gates replacement content and category changes preserve progress', () => {
  const { scene, main, frame } = holeFixture();
  scene.setState({ overlay: 'profile' });
  scene.hole.p = 1;
  scene.holeTween = null;
  frame();
  frame();
  const previous = scene.holeGeometry.radius;
  scene.setState({ overlay: 'filters', filtersOpen: true });
  assert.equal(scene.hole.p, 1);
  assert.equal(scene.holeTween, null);
  assert.equal(main.dataset.lensReady, 'false');
  scene.clock = 0.4;
  frame();
  assert.ok(scene.holeGeometry.radius > previous);
  assert.equal(main.dataset.lensReady, 'false');
  scene.clock = 0.85;
  frame();
  frame();
  assert.equal(scene.holeRetarget, null);
  assert.equal(main.dataset.lensReady, 'true');
  const geometry = structuredClone(scene.holeGeometry);
  scene.setFilters(['a']);
  scene.setFilters([]);
  assert.equal(scene.hole.p, 1);
  assert.equal(scene.holeGroup, 'filters');
  assert.deepEqual(scene.holeGeometry, geometry);
  assert.equal(main.dataset.lensReady, 'true');
});

test('lens envelope is remeasured after responsive layout and closing hides content immediately', () => {
  const { scene, main, panels, canvas, frame } = holeFixture();
  scene.setState({ overlay: 'filters' });
  scene.hole.p = 1;
  frame();
  frame();
  scene.invalidateLensReady();
  scene.width = 375;
  scene.height = 700;
  document.documentElement.clientWidth = 375;
  document.documentElement.clientHeight = 700;
  panels['filters-panel'].rect = box(42.5, 180, 290, 340);
  const geometry = frame();
  assert.deepEqual(geometry.center, [0.5, 0.5]);
  assert.ok(geometry.radius * 375 * 2 > Math.hypot(290, 340));
  assert.equal(main.dataset.lensReady, 'false', 'old canvas/post dimensions remain hidden');
  canvas.rect = box(0, 0, 375, 700);
  scene.post.width = 375;
  scene.post.height = 700;
  frame();
  assert.equal(main.dataset.lensReady, 'false');
  frame();
  assert.equal(main.dataset.lensReady, 'true');
  scene.setState({ overlay: null });
  assert.equal(main.dataset.lensReady, 'false');
  assert.equal(scene.holeTween.duration, 0.65);
  assert.deepEqual(scene.syncHole(), geometry, 'closing retains the last bound disc');
});

test('About to CV keeps the open lens and gates five-option content through retarget and mobile resize', () => {
  const { scene, main, panels, canvas, frame } = holeFixture();
  scene.setState({ overlay: 'profile' });
  scene.hole.p = 1;
  scene.holeTween = null;
  frame();
  frame();
  assert.equal(main.dataset.lensReady, 'true');
  const aboutRadius = scene.holeGeometry.radius;

  scene.setState({ overlay: 'cv' });
  assert.equal(scene.holeElement, panels['cv-panel']);
  assert.equal(scene.hole.p, 1, 'changing the panel does not restart lens opening');
  assert.equal(scene.holeTween, null);
  assert.equal(main.dataset.lensReady, 'false');
  scene.clock = 0.4;
  frame();
  assert.ok(scene.holeGeometry.radius > aboutRadius);
  assert.equal(main.dataset.lensReady, 'false', 'CV stays hidden while the lens resizes');
  scene.clock = 0.85;
  frame();
  assert.equal(main.dataset.lensReady, 'false', 'one matching rendered frame is insufficient');
  frame();
  assert.equal(main.dataset.lensReady, 'true');
  assert.ok(scene.holeGeometry.radius * 657 * 2 > Math.hypot(480, 440));

  scene.invalidateLensReady();
  scene.width = 375;
  scene.height = 700;
  document.documentElement.clientWidth = 375;
  document.documentElement.clientHeight = 700;
  panels['cv-panel'].rect = box(42.5, 135, 290, 430);
  const geometry = frame();
  assert.deepEqual(geometry.center, [0.5, 0.5]);
  assert.ok(geometry.radius * 375 * 2 > Math.hypot(290, 430));
  assert.equal(main.dataset.lensReady, 'false', 'stale canvas dimensions cannot reveal the picker');
  canvas.rect = box(0, 0, 375, 700);
  scene.post.width = 375;
  scene.post.height = 700;
  frame();
  assert.equal(main.dataset.lensReady, 'false');
  frame();
  assert.equal(main.dataset.lensReady, 'true');
  scene.setState({ overlay: null });
  assert.equal(main.dataset.lensReady, 'false');
});

test('rapid viewport changes never reuse readiness from an older rendered viewport', () => {
  const { scene, main, canvas, frame } = holeFixture();
  scene.setState({ overlay: 'filters' });
  scene.hole.p = 1;
  frame();
  frame();
  assert.equal(main.dataset.lensReady, 'true');
  for (const width of [320, 768, 1024, 1280]) {
    document.documentElement.clientWidth = width;
    scene.invalidateLensReady();
    assert.equal(main.dataset.lensReady, 'false');
    frame();
    frame();
    assert.equal(main.dataset.lensReady, 'false');
  }
  scene.width = 1280;
  scene.height = 720;
  document.documentElement.clientHeight = 720;
  scene.post.width = 1280;
  scene.post.height = 720;
  canvas.rect = box(0, 0, 1280, 720);
  frame();
  assert.equal(main.dataset.lensReady, 'false');
  frame();
  assert.equal(main.dataset.lensReady, 'true');
});

test('outside lens click uses actual disc plus rim, preserves controls and drags, and cleans up listeners', () => {
  const { scene } = holeFixture();
  const listeners = new Map();
  document.addEventListener = (type, handler) => listeners.set(type, handler);
  document.removeEventListener = (type, handler) => {
    if (listeners.get(type) === handler) listeners.delete(type);
  };
  let dismissals = 0;
  scene.callbacks.onDismissOverlay = () => {
    dismissals += 1;
  };
  scene.setState({ overlay: 'filters' });
  scene.hole.p = 1;
  scene.syncHole();
  scene.watchOverlayDismiss();
  const event = (x, y, target = { closest: () => null }) => ({
    clientX: x,
    clientY: y,
    target,
    button: 0,
    detail: 1,
    isPrimary: true,
  });
  const click = (down, up = down) => {
    listeners.get('pointerdown')(down);
    listeners.get('click')(up);
  };
  assert.equal(scene.outsideLens(328.5, 449.5), false);
  assert.equal(
    scene.outsideLens(15, 449.5),
    false,
    'refractive source rim remains part of the lens',
  );
  assert.equal(scene.outsideLens(20, 20), true);
  click(event(20, 20));
  assert.equal(dismissals, 1);
  click(event(328.5, 449.5));
  assert.equal(dismissals, 1);
  for (const selector of ['.center-panel', '.site-header', '.site-footer']) {
    const control = { closest: (selectors) => (selectors.includes(selector) ? {} : null) };
    click(event(20, 20, control));
  }
  assert.equal(dismissals, 1);
  let popoverOpen = true;
  document.querySelector = (selector) =>
    selector === '[data-portfolio-popover]' && popoverOpen ? {} : null;
  listeners.get('pointerdown')(event(20, 20));
  popoverOpen = false;
  listeners.get('click')(event(20, 20));
  assert.equal(
    dismissals,
    1,
    'closing a popover between pointerdown and click must preserve its underlying lens',
  );
  delete document.querySelector;
  const boundaryY = 449.5 + (scene.holeGeometry.radius + 0.09) * 657;
  click(event(328.5, boundaryY - 1), event(328.5, boundaryY + 1));
  assert.equal(dismissals, 1, 'starting inside and ending just outside is not an outside click');
  listeners.get('pointerdown')(event(20, 20));
  scene.trackOverlayPointer(event(40, 40));
  scene.trackOverlayPointer(event(20, 20));
  listeners.get('click')(event(20, 20));
  assert.equal(dismissals, 1, 'a returning touch or mouse drag is still a drag');
  listeners.get('pointerdown')(event(20, 20));
  listeners.get('pointercancel')();
  listeners.get('click')(event(20, 20));
  assert.equal(dismissals, 1);
  listeners.get('pointerdown')(event(20, 20));
  scene.state.overlay = 'profile';
  listeners.get('click')(event(20, 20));
  assert.equal(dismissals, 1, 'retargeting cannot close the replacement overlay');
  scene.stopOverlayDismiss();
  assert.equal(listeners.size, 0);
});
