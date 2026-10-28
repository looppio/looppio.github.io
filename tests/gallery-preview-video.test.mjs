import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import PortfolioScene from '../src/reference/PortfolioScene.js';
import { createCardMaterial } from '../src/reference/PostProcess.js';
import { ndaxProject } from '../src/ndaxProject.js';
function fixture() {
  const created = [],
    listeners = new Map();
  globalThis.document = {
    hidden: false,
    addEventListener: (k, v) => listeners.set(k, v),
    removeEventListener: (k, v) => {
      if (listeners.get(k) === v) listeners.delete(k);
    },
    createElement: (tag) => {
      assert.equal(tag, 'video');
      const events = new Map(),
        attrs = new Map();
      const video = {
        readyState: 0,
        videoWidth: 0,
        videoHeight: 0,
        error: null,
        paused: true,
        playCalls: 0,
        loadCalls: 0,
        events,
        setAttribute: (k, v) => attrs.set(k, v),
        getAttribute: (k) => attrs.get(k),
        removeAttribute(k) {
          attrs.delete(k);
          if (k === 'src') this.src = '';
        },
        addEventListener: (k, v) => events.set(k, v),
        removeEventListener: (k, v) => {
          if (events.get(k) === v) events.delete(k);
        },
        play() {
          this.playCalls++;
          this.paused = false;
          return Promise.resolve();
        },
        pause() {
          this.paused = true;
        },
        load() {
          this.loadCalls++;
        },
      };
      created.push(video);
      return video;
    },
  };
  const motionListeners = new Map(),
    motion = {
      matches: false,
      addEventListener: (k, v) => motionListeners.set(k, v),
      removeEventListener: (k, v) => {
        if (motionListeners.get(k) === v) motionListeners.delete(k);
      },
    };
  globalThis.matchMedia = () => motion;
  const p = { id: 'movie', cover: '/poster.webp', coverVideo: '/movie.mp4' },
    poster = new THREE.Texture({ width: 3360, height: 2400 });
  const card = {
    p,
    tex: poster,
    el: {
      dataset: {},
      _vrect: { left: 100, top: 100, width: 600, height: 430, right: 700, bottom: 530 },
    },
    mesh: new THREE.Mesh(new THREE.PlaneGeometry(1, 1), createCardMaterial(poster, 3360, 2400)),
  };
  const scene = new PortfolioScene({}, {}, [p], {});
  Object.assign(scene, {
    cards: [card],
    width: 1280,
    height: 720,
    H: 10,
    geo: card.mesh.geometry,
    caseMotionQuery: motion,
  });
  scene.registry.set(p.id, card);
  scene.rail = scene.makeRail();
  const ready = () => {
    const video = created[0];
    Object.assign(video, { readyState: 2, videoWidth: 1920, videoHeight: 1280 });
    scene.syncPreviewVideos();
    return video;
  };
  const dispose = () => {
    scene.disposePreviewVideo(card);
    scene.rail.material.dispose();
    card.mesh.material.dispose();
    card.mesh.geometry.dispose();
    poster.dispose();
  };
  return { scene, card, poster, created, motion, listeners, motionListeners, ready, dispose };
}
test('Ndax selects an existing concise original movie and keeps its dark still cover', () => {
  const selected = ndaxProject.media.find((m) => m.src === ndaxProject.coverVideo);
  assert.equal(selected?.type, 'video');
  assert.equal(selected.width, 1920);
  assert.equal(selected.height, 1280);
  assert.ok(selected.duration > 7 && selected.duration < 8);
  assert.ok(ndaxProject.cover.endsWith('.webp'));
});
test('poster remains through loading and zero dimensions before the first valid frame upload', () => {
  const f = fixture();
  f.scene.syncPreviewVideos();
  const v = f.created[0],
    e = f.scene.previewVideos.get('movie');
  assert.equal(v.muted, true);
  assert.equal(v.loop, true);
  assert.equal(v.playsInline, true);
  assert.equal(v.src, '/movie.mp4');
  assert.equal(f.card.mesh.material.uniforms.u_texture.value, f.poster);
  assert.equal(e.texture, undefined);
  v.readyState = 2;
  f.scene.syncPreviewVideos();
  assert.equal(e.texture, undefined);
  f.ready();
  assert.equal(f.card.mesh.material.uniforms.u_texture.value, e.texture);
  assert.equal(e.texture.isVideoTexture, true);
  assert.ok(e.texture.version > 0);
  assert.deepEqual(f.card.mesh.material.uniforms.u_size.value.toArray(), [1920, 1280]);
  assert.equal(f.card.el.dataset.previewVideo, 'playing');
  f.dispose();
});
test('decode error restores a valid poster sampler', () => {
  const f = fixture();
  f.scene.syncPreviewVideos();
  const v = f.ready();
  v.error = { code: 3 };
  v.events.get('error')();
  f.scene.syncPreviewVideos();
  assert.equal(v.paused, true);
  assert.equal(f.card.mesh.material.uniforms.u_texture.value, f.poster);
  assert.deepEqual(f.card.mesh.material.uniforms.u_size.value.toArray(), [3360, 2400]);
  assert.equal(f.card.el.dataset.previewVideo, 'error');
  f.dispose();
});
test('offscreen, filtered, overlay and active-case previews pause while FLIP retains its valid frame', () => {
  const f = fixture();
  f.scene.syncPreviewVideos();
  const v = f.ready();
  f.card.el._vrect = { left: 1400, top: 100, width: 600, height: 430, right: 2000, bottom: 530 };
  f.scene.syncPreviewVideos();
  assert.equal(v.paused, true);
  f.card.el._vrect = { left: 100, top: 100, width: 600, height: 430, right: 700, bottom: 530 };
  f.scene.syncPreviewVideos();
  assert.equal(v.paused, false);
  f.scene.visibleIds.clear();
  f.scene.syncPreviewVideos();
  assert.equal(v.paused, true);
  f.scene.visibleIds.add('movie');
  f.scene.syncPreviewVideos();
  f.scene.state.overlay = 'filters';
  f.scene.syncPreviewVideos();
  assert.equal(v.paused, true);
  f.scene.state.overlay = null;
  f.scene.syncPreviewVideos();
  f.scene.state.project = { id: 'movie' };
  f.scene.syncPreviewVideos();
  assert.equal(v.paused, true);
  assert.equal(f.card.previewTexture.isVideoTexture, true);
  f.scene.state.project = null;
  f.scene.syncPreviewVideos();
  assert.equal(v.paused, false);
  assert.equal(f.created.length, 1);
  f.dispose();
});
test('hidden and reduced-motion policies skip initial requests and immediately pause existing video', () => {
  const f = fixture();
  f.motion.matches = true;
  f.scene.syncPreviewVideos();
  assert.equal(f.created.length, 0);
  f.motion.matches = false;
  document.hidden = true;
  f.scene.syncPreviewVideos();
  assert.equal(f.created.length, 0);
  document.hidden = false;
  f.scene.watchCaseVideos();
  f.scene.syncPreviewVideos();
  const v = f.ready();
  document.hidden = true;
  f.listeners.get('visibilitychange')();
  assert.equal(v.paused, true);
  document.hidden = false;
  f.motion.matches = true;
  f.motionListeners.get('change')();
  f.scene.syncPreviewVideos();
  assert.equal(v.paused, true);
  assert.equal(f.card.previewTexture, null);
  assert.equal(f.card.mesh.material.uniforms.u_texture.value, f.poster);
  f.scene.stopCaseVideos();
  assert.equal(f.listeners.size, 0);
  assert.equal(f.motionListeners.size, 0);
  f.dispose();
});
test('Full hover reuses the same decoded texture and existing crossfade with intrinsic dimensions', () => {
  const f = fixture();
  f.card.mesh.visible = false;
  f.scene.state.mode = 'full';
  f.scene.rail.visible = true;
  f.scene.railProjectId = 'movie';
  f.scene.syncPreviewVideos();
  const v = f.ready(),
    e = f.scene.previewVideos.get('movie'),
    u = f.scene.rail.material.uniforms;
  assert.equal(v.paused, false);
  assert.equal(u.u_texB.value, e.texture);
  assert.deepEqual(u.u_sizeB.value.toArray(), [1920, 1280]);
  assert.equal(u.u_fade.value, 0);
  assert.equal(f.card.mesh.material.uniforms.u_texture.value, u.u_texB.value);
  assert.equal(f.created.length, 1);
  f.scene.rail.visible = false;
  f.scene.syncPreviewVideos();
  assert.equal(v.paused, true);
  f.dispose();
});
test('disposal detaches media, removes listeners, disposes texture and restores rail samplers', () => {
  const f = fixture();
  f.scene.syncPreviewVideos();
  const v = f.ready(),
    e = f.scene.previewVideos.get('movie');
  f.scene.rail.material.uniforms.u_texB.value = e.texture;
  let disposed = false;
  e.texture.addEventListener('dispose', () => (disposed = true));
  f.scene.disposePreviewVideo(f.card);
  assert.equal(disposed, true);
  assert.equal(v.paused, true);
  assert.equal(v.src, '');
  assert.equal(v.loadCalls, 1);
  assert.equal(v.events.size, 0);
  assert.equal(f.scene.previewVideos.size, 0);
  assert.equal(f.scene.rail.material.uniforms.u_texB.value, f.poster);
  assert.equal(f.card.mesh.material.uniforms.u_texture.value, f.poster);
  f.dispose();
});
test('late play resolution cannot restart an offscreen preview', async () => {
  const f = fixture();
  f.scene.syncPreviewVideos();
  const v = f.created[0];
  await Promise.resolve();
  v.pause();
  f.scene.previewVideos.get('movie').playAttempted = false;
  let finish;
  v.play = () =>
    new Promise((resolve) => {
      finish = () => {
        v.paused = false;
        resolve();
      };
    });
  f.scene.syncPreviewVideos();
  f.card.el._parked = true;
  f.scene.syncPreviewVideos();
  finish();
  await Promise.resolve();
  assert.equal(v.paused, true);
  f.dispose();
});
