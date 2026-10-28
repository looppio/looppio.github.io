import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import PortfolioScene from '../src/reference/PortfolioScene.js';
import { createCardMaterial } from '../src/reference/PostProcess.js';
import { loadDecodedCover } from '../src/reference/coverImages.js';

const flush = () => new Promise((resolve) => setImmediate(resolve));
function fixture() {
  const projects = ['featured', 'hidden', 'other'].map((id) => ({
    id,
    cover: `/${id}.webp`,
    coverWidth: 1280,
    coverHeight: 960,
  }));
  const uploads = [],
    progress = [],
    images = new Map();
  const cards = projects.map((p) => {
    let source = null,
      resolve,
      reject;
    const decoded = new Promise((yes, no) => {
      resolve = yes;
      reject = no;
    });
    const image = {
      requests: [],
      decodeCalls: 0,
      naturalWidth: 0,
      naturalHeight: 0,
      getAttribute: () => source,
      set src(value) {
        source = value;
        this.requests.push(value);
      },
      decode() {
        this.decodeCalls++;
        return decoded;
      },
      finish() {
        this.naturalWidth = 1280;
        this.naturalHeight = 960;
        resolve();
      },
      fail: () => reject(new Error('Image load failed')),
    };
    images.set(p.id, image);
    const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    return {
      p,
      tex,
      coverReady: false,
      mesh: { material: createCardMaterial(tex, 1280, 960) },
      label: { mesh: {} },
      hit: { style: {} },
      el: {
        dataset: { id: p.id },
        style: { setProperty() {} },
        querySelector: () => image,
      },
    };
  });
  const scene = new PortfolioScene({}, { children: cards.map((c) => c.el) }, projects, {
    onBootProgress: (detail) => progress.push(detail),
  });
  Object.assign(scene, {
    cards,
    registry: new Map(cards.map((card) => [card.p.id, card])),
    visibleIds: new Set(['featured']),
    bootLoaded: 0,
    bootTotal: 4,
    measure() {},
    renderer: {
      capabilities: { getMaxAnisotropy: () => 8 },
      initTexture(texture) {
        assert.ok(texture.image.naturalWidth > 0);
        uploads.push(texture);
      },
    },
  });
  return { scene, cards, images, uploads, progress };
}

test('boot requests only selected covers and uploads the same decoded DOM image once', async () => {
  const f = fixture(),
    card = f.cards[0],
    image = f.images.get('featured'),
    fallback = card.tex;
  let retired = 0,
    done = false;
  fallback.addEventListener('dispose', () => retired++);
  const ready = f.scene.loadRequiredCovers().then(() => (done = true));
  const pending = f.scene.ensureCover(card);
  assert.equal(f.scene.ensureCover(card), pending);
  assert.deepEqual(image.requests, ['/featured.webp']);
  assert.equal(image.decodeCalls, 1);
  assert.deepEqual(f.images.get('hidden').requests, []);
  assert.equal(f.uploads.length, 0);
  await flush();
  assert.equal(done, false, 'download alone cannot release the decoded-cover barrier');
  image.finish();
  await ready;
  assert.equal(card.coverReady, true);
  assert.equal(card.tex.image, image);
  assert.equal(card.mesh.material.uniforms.u_texture.value, card.tex);
  assert.equal(f.uploads.length, 1);
  assert.equal(retired, 1);
  await f.scene.ensureCover(card);
  assert.equal(image.requests.length, 1);
  assert.equal(image.decodeCalls, 1);
  assert.equal(f.uploads.length, 1);
});

test('filter changes request new covers once and reusing previous selection keeps their textures', async () => {
  const f = fixture();
  const first = f.scene.loadRequiredCovers();
  f.images.get('featured').finish();
  await first;
  const texture = f.cards[0].tex;
  f.scene.bootReady = true;
  f.scene.setFilters(['hidden']);
  assert.deepEqual(f.images.get('hidden').requests, ['/hidden.webp']);
  assert.deepEqual(f.images.get('other').requests, []);
  f.images.get('hidden').finish();
  await f.scene.loadRequiredCovers();
  f.scene.setFilters(['featured']);
  await f.scene.loadRequiredCovers();
  assert.equal(f.cards[0].tex, texture);
  assert.equal(f.images.get('featured').decodeCalls, 1);
  f.scene.setFilters(null);
  assert.deepEqual(f.images.get('other').requests, ['/other.webp']);
  f.images.get('other').finish();
  await f.scene.loadRequiredCovers();
  assert.equal(f.uploads.length, 3);
});

test('startup rechecks the latest filter before becoming ready', async () => {
  const f = fixture();
  let done = false;
  const ready = f.scene.loadRequiredCovers().then(() => (done = true));
  f.scene.setFilters(['hidden']);
  f.images.get('featured').finish();
  await flush();
  assert.equal(done, false);
  f.images.get('hidden').finish();
  await ready;
  assert.equal(done, true);
  assert.deepEqual(f.images.get('other').requests, []);
});

test('a direct case outside Featured is included without loading the remaining hidden inventory', async () => {
  const f = fixture();
  f.scene.setState({ project: f.cards[1].p, phase: 'opening' });
  const ready = f.scene.loadRequiredCovers();
  assert.deepEqual(f.images.get('hidden').requests, ['/hidden.webp']);
  assert.deepEqual(f.images.get('other').requests, []);
  f.images.get('featured').finish();
  f.images.get('hidden').finish();
  await ready;
  assert.equal(f.cards[1].coverReady, true);
});

test('an archive preview can load an excluded cover without changing selection', async () => {
  const f = fixture(),
    selected = [...f.scene.visibleIds];
  const ready = f.scene.ensureCover(f.cards[1]);
  f.images.get('hidden').finish();
  await ready;
  assert.deepEqual([...f.scene.visibleIds], selected);
  assert.deepEqual(f.images.get('featured').requests, []);
  assert.equal(f.cards[1].coverReady, true);
});

test('a failed cover settles with the existing fallback and never uploads invalid pixels', async () => {
  const f = fixture(),
    fallback = f.cards[0].tex,
    ready = f.scene.loadRequiredCovers();
  f.images.get('featured').fail();
  await ready;
  assert.equal(f.cards[0].coverReady, true);
  assert.equal(f.cards[0].tex, fallback);
  assert.equal(f.cards[0].el.dataset.preview, 'unavailable');
  assert.equal(f.uploads.length, 0);
});

test('late decode completion after disposal does not allocate or publish a texture', async () => {
  const f = fixture(),
    fallback = f.cards[0].tex,
    ready = f.scene.loadRequiredCovers();
  f.scene.destroyed = true;
  f.images.get('featured').finish();
  await ready;
  assert.equal(f.cards[0].tex, fallback);
  assert.equal(f.cards[0].coverReady, false);
  assert.equal(f.uploads.length, 0);
  assert.equal(f.progress.length, 0);
});

test('decoded-image helper rejects zero-sized data instead of treating load as readiness', async () => {
  const image = {
    getAttribute: () => '/broken.webp',
    decode: async () => {},
    naturalWidth: 0,
    naturalHeight: 0,
  };
  await assert.rejects(loadDecodedCover(image, '/broken.webp'), /decoded dimensions/);
});
