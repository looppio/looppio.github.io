import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import PortfolioScene from '../src/reference/PortfolioScene.js';
import { createCardMaterial } from '../src/reference/PostProcess.js';

const rect = (left, top, width, height) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});
const classes = () => {
  const values = new Set();
  return {
    add: (v) => values.add(v),
    remove: (v) => values.delete(v),
    contains: (v) => values.has(v),
  };
};
function fixture() {
  const src = '/case-loop.mp4';
  const video = {
    isConnected: true,
    readyState: 0,
    videoWidth: 0,
    videoHeight: 0,
    error: null,
    paused: true,
    classList: classes(),
    plays: 0,
    pauses: 0,
    getAttribute: (k) => (k === 'src' ? src : null),
    play() {
      this.plays++;
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      this.pauses++;
      this.paused = true;
    },
  };
  const poster = { isConnected: true, getAttribute: () => '/poster.jpg', classList: classes() };
  const item = {
    isConnected: true,
    _parked: false,
    box: rect(600, 90, 600, 337.5),
    getBoundingClientRect() {
      return this.box;
    },
    querySelector: (s) => (s === 'video' ? video : poster),
  };
  item.parentElement = { children: [item] };
  const sheet = { getBoundingClientRect: () => rect(50, 30, 1180, 660) };
  const view = {
    classList: classes(),
    dataset: {},
    querySelector: () => sheet,
    querySelectorAll: () => [item],
  };
  const listeners = new Map();
  globalThis.document = {
    hidden: false,
    querySelector: (s) => (s === '.case-view' ? view : null),
    addEventListener: (n, f) => listeners.set(n, f),
    removeEventListener: (n, f) => {
      if (listeners.get(n) === f) listeners.delete(n);
    },
  };
  globalThis.getComputedStyle = () => ({ borderRadius: '0px' });
  const scene = new PortfolioScene({}, {}, [], {});
  scene.scene = new THREE.Scene();
  scene.geo = new THREE.PlaneGeometry(1, 1);
  Object.assign(scene, {
    width: 1280,
    height: 720,
    dpr: 1,
    H: 10,
    W: (1280 / 720) * 10,
    small: false,
    caseMotionQuery: { matches: false },
    state: { project: { id: 'demo' }, phase: 'settled' },
  });
  const main = new THREE.Mesh(scene.geo, createCardMaterial(new THREE.Texture(), 1, 1));
  scene.registry.set('demo', { mesh: main });
  const entry = () => [...scene.caseMedia.values()][0];
  const ready = () => {
    Object.assign(video, { readyState: 2, videoWidth: 1920, videoHeight: 1080 });
    scene.syncCase();
  };
  const dispose = () => {
    for (const [k, e] of scene.caseMedia) scene.retireCaseMedia(k, e);
    scene.geo.dispose();
    main.material.dispose();
  };
  return { scene, video, item, view, entry, ready, dispose, listeners };
}

test('DOM poster remains until decoded data and positive intrinsic dimensions, then GPU uses the video URL', () => {
  const f = fixture();
  f.scene.syncCase();
  assert.equal(f.entry().loaded, false);
  assert.equal(f.entry().texture, undefined);
  assert.equal(f.video.classList.contains('gl-media-ready'), false);
  assert.equal(
    f.entry().mesh.visible,
    false,
    'an undecoded surface cannot flash at its default center pose',
  );
  f.video.readyState = 2;
  f.scene.syncCase();
  assert.equal(f.entry().loaded, false, 'metadata dimensions must also be valid');
  f.ready();
  assert.equal(f.entry().loaded, true);
  assert.equal(f.entry().texture.isVideoTexture, true);
  assert.ok(f.entry().texture.version > 0, 'first frame must be uploaded even before rVFC');
  assert.deepEqual(f.entry().mesh.material.uniforms.u_size.value.toArray(), [1920, 1080]);
  assert.equal(f.video.classList.contains('gl-media-ready'), true);
  assert.ok([...f.scene.caseMedia.keys()][0].includes('/case-loop.mp4'));
  assert.equal(f.entry().mesh.visible, true);
  f.dispose();
});

test('a parked ancestor group prevents creation and pauses an already decoded child video', () => {
  const f = fixture(),
    group = f.item.parentElement;
  group._parked = true;
  f.scene.syncCase();
  assert.equal(f.scene.caseMedia.size, 0);
  group._parked = false;
  f.ready();
  assert.equal(f.video.paused, false);
  assert.equal(f.entry().mesh.visible, true);
  group._parked = true;
  f.scene.syncCase();
  assert.equal(f.video.paused, true);
  assert.equal(f.entry().mesh.visible, false);
  group._parked = false;
  f.scene.syncCase();
  assert.equal(f.video.paused, false);
  assert.equal(f.entry().mesh.visible, true);
  f.dispose();
});

test('nested media with the same source and sibling position keep distinct original and repeat GPU slots', () => {
  const f = fixture();
  f.item.dataset = { caseSlot: 'original-0-0' };
  const video = {
    ...f.video,
    classList: classes(),
    readyState: 2,
    videoWidth: 1920,
    videoHeight: 1080,
    plays: 0,
    pauses: 0,
  };
  const repeated = {
    ...f.item,
    dataset: { caseSlot: 'repeat-0-0-0' },
    box: rect(600, 440, 600, 220),
    querySelector: (selector) => (selector === 'video' ? video : null),
  };
  const group = { children: [repeated], _parked: false };
  repeated.parentElement = group;
  f.view.querySelectorAll = () => [f.item, repeated];
  f.ready();
  assert.equal(f.scene.caseMedia.size, 2);
  const keys = [...f.scene.caseMedia.keys()];
  assert.ok(keys.some((key) => key.endsWith(':original-0-0')));
  assert.ok(keys.some((key) => key.endsWith(':repeat-0-0-0')));
  assert.equal(new Set([...f.scene.caseMedia.values()].map((entry) => entry.dom)).size, 2);
  assert.equal(video.paused, false);
  group._parked = true;
  f.scene.syncCase();
  assert.equal(video.paused, true);
  assert.equal(f.video.paused, false);
  assert.equal(
    [...f.scene.caseMedia.values()].find((entry) => entry.dom === video).mesh.visible,
    false,
  );
  f.dispose();
});

test('decode error removes GPU readiness and restores the native poster surface', () => {
  const f = fixture();
  f.ready();
  f.video.error = { code: 3 };
  f.scene.syncCase();
  assert.equal(f.entry().loaded, false);
  assert.equal(f.entry().mesh.visible, false);
  assert.equal(f.video.classList.contains('gl-media-ready'), false);
  assert.equal(f.video.paused, true);
  f.dispose();
});

test('offscreen, zero-sized, parked, hidden, reduced-motion and transitioning videos pause', () => {
  const f = fixture();
  f.ready();
  assert.equal(f.video.paused, false);
  f.item.box = rect(600, 800, 600, 337.5);
  f.scene.syncCase();
  assert.equal(f.video.paused, true);
  f.item.box = rect(600, 90, 600, 337.5);
  f.scene.syncCase();
  assert.equal(f.video.paused, false);
  f.item.box = rect(600, 90, 0, 0);
  f.scene.syncCase();
  assert.equal(f.video.paused, true);
  f.item.box = rect(600, 90, 600, 337.5);
  f.scene.syncCase();
  f.item._parked = true;
  f.scene.syncCase();
  assert.equal(f.video.paused, true);
  f.item._parked = false;
  document.hidden = true;
  f.scene.syncCase();
  assert.equal(f.video.paused, true);
  document.hidden = false;
  f.scene.caseMotionQuery.matches = true;
  f.scene.syncCase();
  assert.equal(f.video.paused, true);
  f.scene.caseMotionQuery.matches = false;
  f.scene.syncCase();
  assert.equal(f.video.paused, false);
  f.scene.state.phase = 'closing';
  f.scene.syncCase();
  assert.equal(f.video.paused, true);
  f.dispose();
});

test('leaving a case retires the texture, removes DOM readiness and pauses video', () => {
  const f = fixture();
  f.ready();
  const e = f.entry();
  let disposed = false;
  e.texture.addEventListener('dispose', () => (disposed = true));
  f.scene.state.project = null;
  f.scene.syncCase();
  assert.equal(disposed, true);
  assert.equal(e.retired, true);
  assert.equal(f.video.paused, true);
  assert.equal(f.scene.caseMedia.size, 0);
  assert.equal(f.video.classList.contains('gl-media-ready'), false);
  f.dispose();
});

test('late resolution of play cannot restart an offscreen video', async () => {
  const f = fixture();
  let resolvePlay;
  f.video.play = function () {
    this.plays++;
    return new Promise((resolve) => {
      resolvePlay = () => {
        this.paused = false;
        resolve();
      };
    });
  };
  f.scene.syncCase();
  f.item.box = rect(600, 800, 600, 337.5);
  f.scene.syncCase();
  resolvePlay();
  await Promise.resolve();
  assert.equal(f.video.paused, true);
  f.dispose();
});

test('policy listeners pause immediately and are all removed on teardown', () => {
  const f = fixture(),
    motionListeners = new Map();
  const motion = {
    matches: false,
    addEventListener: (n, fn) => motionListeners.set(n, fn),
    removeEventListener: (n, fn) => {
      if (motionListeners.get(n) === fn) motionListeners.delete(n);
    },
  };
  globalThis.matchMedia = () => motion;
  f.scene.watchCaseVideos();
  f.ready();
  document.hidden = true;
  f.listeners.get('visibilitychange')();
  assert.equal(f.video.paused, true);
  document.hidden = false;
  f.scene.syncCase();
  motion.matches = true;
  motionListeners.get('change')();
  assert.equal(f.video.paused, true);
  f.scene.stopCaseVideos();
  assert.equal(f.listeners.size, 0);
  assert.equal(motionListeners.size, 0);
  f.dispose();
});
