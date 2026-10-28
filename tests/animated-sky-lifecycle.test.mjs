import test from 'node:test';
import assert from 'node:assert/strict';
import AnimatedSky from '../src/reference/AnimatedSky.js';

const flush = () => new Promise((resolve) => setImmediate(resolve));
function fixture(t) {
  const saved = ['document', 'matchMedia'].map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ]);
  t.after(() => {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  const doc = { hidden: false, removeEventListener() {} },
    motion = { matches: false, removeEventListener() {} };
  globalThis.document = doc;
  globalThis.matchMedia = () => motion;
  const requests = [];
  let ready = 0,
    pauses = 0;
  const video = {
    paused: true,
    readyState: 2,
    play() {
      return new Promise((resolve, reject) =>
        requests.push({
          resolve: () => {
            video.paused = false;
            resolve();
          },
          reject,
        }),
      );
    },
    pause() {
      video.paused = true;
      pauses++;
    },
    removeEventListener() {},
    removeAttribute() {},
    load() {},
    remove() {},
  };
  const scene = { background: 'video' },
    sky = new AnimatedSky(scene, {});
  Object.assign(sky, {
    video,
    poster: { dispose() {} },
    texture: { dispose() {} },
    onReady() {
      ready++;
      scene.background = sky.texture;
    },
  });
  return { sky, video, scene, doc, motion, requests, ready: () => ready, pauses: () => pauses };
}

test('background sky shares a pending autoplay request and does not replay an active video', async (t) => {
  const f = fixture(t);
  f.sky.syncPlayback();
  f.sky.syncPlayback();
  f.sky.syncPlayback();
  assert.equal(f.requests.length, 1);
  f.requests[0].resolve();
  await flush();
  assert.equal(f.ready(), 1);
  f.sky.syncPlayback();
  assert.equal(f.requests.length, 1, 'an already playing video needs no new play promise');
  assert.equal(f.video.paused, false);
});

for (const reason of ['hidden', 'reduced motion', 'disposed']) {
  test(`a delayed play result cannot reactivate the sky when ${reason}`, async (t) => {
    const f = fixture(t);
    f.sky.syncPlayback();
    if (reason === 'hidden') {
      f.doc.hidden = true;
      f.sky.syncPlayback();
    } else if (reason === 'reduced motion') {
      f.motion.matches = true;
      f.sky.syncPlayback();
    } else f.sky.dispose();
    assert.equal(f.video.paused, true);
    f.requests[0].resolve();
    await flush();
    assert.equal(f.video.paused, true, 'late autoplay remains paused');
    assert.equal(f.ready(), 0, 'late autoplay cannot attach a video texture');
    if (reason === 'reduced motion') assert.equal(f.scene.background, f.sky.poster);
  });
}

test('a previous play promise cannot clear a newer resume attempt', async (t) => {
  const f = fixture(t);
  f.sky.syncPlayback();
  f.doc.hidden = true;
  f.sky.syncPlayback();
  f.doc.hidden = false;
  f.sky.syncPlayback();
  assert.equal(f.requests.length, 2);
  const current = f.sky.playRequest;
  f.requests[0].resolve();
  await flush();
  assert.equal(f.sky.playRequest, current);
  assert.equal(f.ready(), 0);
  f.requests[1].resolve();
  await flush();
  assert.equal(f.ready(), 1);
  assert.equal(f.sky.playRequest, null);
});

test('blocked autoplay keeps the poster and can retry on the next gesture', async (t) => {
  const f = fixture(t);
  f.video.readyState = 0;
  f.sky.syncPlayback();
  f.requests[0].reject(new Error('Autoplay is blocked'));
  await flush();
  assert.equal(f.scene.background, f.sky.poster);
  assert.equal(f.sky.playRequest, null);
  f.sky.syncPlayback();
  assert.equal(f.requests.length, 2);
  f.video.readyState = 2;
  f.requests[1].resolve();
  await flush();
  assert.equal(f.ready(), 1);
});
