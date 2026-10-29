import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { renderBudget, frameDue } from '../src/reference/renderBudget.js';
import PortfolioScene from '../src/reference/PortfolioScene.js';
import { LensPass, createCardMaterial } from '../src/reference/PostProcess.js';

test('iPhone 13 budgets the canvas and every shared pass below native DPR without disabling effects', () => {
  const budget = renderBudget({
    width: 390,
    height: 844,
    devicePixelRatio: 3,
    coarsePointer: true,
  });
  assert.equal(budget.mobile, true);
  assert.equal(budget.dpr, 2);
  assert.equal(budget.fps, 60);
  assert.equal(budget.antialias, false);
  const renderer = { getPixelRatio: () => budget.dpr };
  const lens = new LensPass(renderer, { depthBuffer: false });
  lens.resize(390, 844, budget.dpr);
  assert.equal(lens.target.width, 780);
  assert.equal(lens.target.height, 1688);
  assert.equal(lens.target.depthBuffer, false);
  assert.ok(lens.material.fragmentShader.length > 1000, 'the original lens shader remains');
  lens.dispose();
});

test('landscape and large touch viewports retain the physical pixel cap; desktop preserves DPR 2', () => {
  for (const [width, height] of [
    [844, 390],
    [1024, 1366],
    [1920, 1080],
  ]) {
    const b = renderBudget({ width, height, devicePixelRatio: 3, coarsePointer: true });
    assert.ok(width * height * b.dpr ** 2 <= 2_000_001);
    assert.ok(b.dpr <= 2);
    assert.equal(b.fps, 60);
  }
  assert.deepEqual(renderBudget({ width: 1440, height: 900, devicePixelRatio: 3 }), {
    mobile: false,
    dpr: 2,
    fps: 0,
    antialias: true,
  });
  assert.equal(renderBudget({ width: 390, height: 844, devicePixelRatio: 1 }).dpr, 1);
});

test('fractional DPR passes match the renderer pixel grid without resampling a larger texture', () => {
  const renderer = { getPixelRatio: () => 1.5 };
  const lens = new LensPass(renderer);
  lens.resize(657, 899, 1.5);
  assert.equal(lens.target.width, 985);
  assert.equal(lens.target.height, 1348);
  lens.dispose();
});

test('ordinary frames draw once, while lens, pointer and page transitions retain their postprocess', () => {
  const scene = new PortfolioScene({}, {}, [], {});
  const calls = [];
  const target = { texture: {} };
  scene.bootReveal = { pending: false };
  scene.renderer = {
    setRenderTarget: (value) => calls.push(['target', value]),
    setClearColor() {},
    clear() {},
    render: () => calls.push(['scene']),
  };
  scene.post = { target, render: () => calls.push(['post']) };
  scene.wipe = {
    active: false,
    render: (texture) => {
      calls.push(['wipe']);
      return texture;
    },
  };
  const hole = { center: [0.5, 0.5], radius: 0.1 };
  scene.renderScene(1 / 60, hole, { ball: 0 });
  assert.deepEqual(calls, [['target', null], ['scene']]);
  for (const reason of ['lens', 'pointer', 'wipe']) {
    calls.length = 0;
    scene.hole.p = reason === 'lens' ? 0.5 : 0;
    scene.wipe.active = reason === 'wipe';
    scene.renderScene(1 / 60, hole, { ball: reason === 'pointer' ? 0.5 : 0 });
    assert.deepEqual(calls, [['target', target], ['scene'], ['wipe'], ['post']]);
  }
});

test('a view change captures a fresh frame including cached native index labels', () => {
  const scene = new PortfolioScene({}, {}, [], {});
  const calls = [];
  const target = { texture: {} };
  scene.renderer = {
    setRenderTarget: (value) => calls.push(['target', value]),
    clear() {},
    render: () => calls.push(['scene']),
  };
  scene.post = { target };
  scene.fullField = {
    withRasterSnapshot: (draw) => {
      calls.push(['labels']);
      draw();
    },
  };
  scene.wipe = {
    capture: (texture) => calls.push(['capture', texture]),
    start: () => calls.push(['start']),
  };
  scene.setState({ mode: 'full' });
  assert.deepEqual(calls, [
    ['labels'],
    ['target', target],
    ['scene'],
    ['capture', target.texture],
    ['start'],
  ]);
});

test('60 Hz timestamp jitter never accidentally halves the render rate', () => {
  const clock = {};
  for (let index = 0; index < 600; index++) {
    const jitter = index % 3 === 0 ? -0.4 : index % 3 === 1 ? 0.2 : 0;
    assert.equal(frameDue(clock, 1000 + index * (1000 / 60) + jitter, 60), true);
  }
});

test('120 Hz and 90 Hz use a running deadline to average 60 rendered frames per second', () => {
  for (const refresh of [120, 90]) {
    const clock = {},
      rendered = [];
    for (let index = 0; index < refresh * 10; index++) {
      const time = (index * 1000) / refresh;
      if (frameDue(clock, time, 60)) rendered.push(time);
    }
    assert.equal(rendered.length, 600);
    assert.ok(rendered.at(-1) > 9950);
  }
});

test('late frames recover the deadline without replaying missed work or carrying hidden time', () => {
  const clock = {};
  assert.equal(frameDue(clock, 1000, 60), true);
  assert.equal(frameDue(clock, 1008, 60), false);
  assert.equal(frameDue(clock, 1100, 60), true);
  assert.equal(frameDue(clock, 1108, 60), false);
  assert.equal(frameDue(clock, 1116.667, 60), true);
  assert.equal(frameDue({}, 60000, 60), true);
});

test('stationary exact hit geometry is reused and invalidates on movement, deformation and viewport changes', () => {
  const scene = new PortfolioScene({}, {}, [], {}),
    tex = new THREE.Texture({ width: 100, height: 100 }),
    geometry = new THREE.PlaneGeometry(1, 1),
    material = createCardMaterial(tex, 100, 100),
    mesh = new THREE.Mesh(geometry, material);
  let polygonWrites = 0;
  const style = new Proxy(
    {},
    {
      set(target, key, value) {
        if (key === 'clipPath') polygonWrites++;
        target[key] = value;
        return true;
      },
    },
  );
  const card = { p: { id: 'test' }, mesh, hit: { style } };
  scene.width = 390;
  scene.height = 844;
  scene.visibleIds.add('test');
  scene.camera = new THREE.PerspectiveCamera(53.4, 390 / 844, 0.1, 2000);
  scene.camera.position.z = 41.18;
  scene.camera.updateMatrixWorld();
  scene.syncHit(card);
  assert.equal(polygonWrites, 1);
  for (let i = 0; i < 60; i++) scene.syncHit(card);
  assert.equal(polygonWrites, 1);
  mesh.position.x += 1;
  scene.syncHit(card);
  material.uniforms.u_bulgeA.value = 0.1;
  scene.syncHit(card);
  scene.width = 844;
  scene.syncHit(card);
  assert.equal(polygonWrites, 4);
  scene.state.overlay = 'contact';
  scene.syncHit(card);
  assert.equal(style.display, 'none');
  scene.state.overlay = null;
  scene.syncHit(card);
  assert.equal(style.display, 'block');
  assert.equal(polygonWrites, 4, 'returning to unchanged geometry only restores visibility');
  tex.dispose();
  material.dispose();
  geometry.dispose();
});

test('30 Hz devices render every available frame instead of being throttled again', () => {
  const clock = {};
  for (let index = 0; index < 300; index++)
    assert.equal(frameDue(clock, index * (1000 / 30), 60), true);
});

test('closed lens uses identical opaque copy, and any active lens or pointer field restores its shader', () => {
  const materials = [];
  const renderer = {
    autoClear: true,
    setRenderTarget() {},
    clear() {},
    render(scene) {
      materials.push(scene.children[0].material);
    },
  };
  const lens = new LensPass(renderer);
  const texture = new THREE.Texture();
  lens.render(texture, { progress: 0, ball: 0 });
  assert.equal(materials.at(-1), lens.copyMaterial);
  assert.equal(lens.copyMaterial.uniforms.u_scene.value, texture);
  lens.render(texture, { progress: 0.001, ball: 0 });
  assert.equal(materials.at(-1), lens.material);
  lens.render(texture, { progress: 0, ball: 0.01 });
  assert.equal(materials.at(-1), lens.material);
  lens.render(texture, { progress: 0, ball: 0.001 });
  assert.equal(materials.at(-1), lens.copyMaterial);
  assert.equal(renderer.autoClear, true);
  lens.dispose();
  texture.dispose();
});
