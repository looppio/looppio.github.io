import test from 'node:test';
import assert from 'node:assert/strict';
import LensChrome, { lensChromeClip, lensCoversPoint } from '../src/reference/lensChrome.js';
import PortfolioScene from '../src/reference/PortfolioScene.js';

const phone = {
  width: 390,
  height: 580,
  center: [0.5, 0.5],
  radius: 0.72,
  progress: 1,
  time: 0,
  squash: 0,
};
const control = (left, top, width, height, inert = false) => ({
  inert,
  getBoundingClientRect: () => ({ left, top, width, height }),
});

test('short phone: covered header/dock regions disappear while outside corners remain interactive', () => {
  assert.equal(lensCoversPoint(195, 24, phone), true);
  assert.equal(lensCoversPoint(195, 550, phone), true);
  assert.equal(lensCoversPoint(10, 10, phone), false);
  assert.equal(lensCoversPoint(380, 10, phone), false);
  assert.equal(lensChromeClip({ ...phone, progress: 0 }), 'none');
  assert.equal(lensCoversPoint(195, 290, { ...phone, progress: 0 }), false);
});

test('clip contour and hit boundary agree while opening, retargeting, breathing and squashing closed', () => {
  for (const field of [
    phone,
    { ...phone, progress: 0.5, time: 3.2 },
    { ...phone, center: [0.3, 0.7], progress: 0.8, squash: -0.06, time: 12 },
  ]) {
    const clip = lensChromeClip(field);
    assert.match(clip, /^path\(evenodd,/);
    const contour = clip.slice(clip.indexOf('Z') + 1);
    const points = [...contour.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)];
    assert.equal(points.length, 128);
    const cx = field.width * field.center[0],
      cy = field.height * (1 - field.center[1]);
    for (const [, xString, yString] of points) {
      const x = Number(xString),
        y = Number(yString);
      assert.equal(lensCoversPoint(cx + (x - cx) * 0.99, cy + (y - cy) * 0.99, field), true);
      assert.equal(lensCoversPoint(cx + (x - cx) * 1.01, cy + (y - cy) * 1.01, field), false);
    }
  }
});

test('only fully covered controls become inert; closing, resize and disposal restore original state', () => {
  const hidden = control(170, 20, 50, 30),
    visible = control(0, 0, 20, 20);
  const partial = control(5, 20, 180, 30),
    alreadyInert = control(170, 530, 50, 30, true);
  const chrome = { style: {}, querySelectorAll: () => [hidden, visible, partial, alreadyInert] };
  const occlusion = new LensChrome({ querySelector: () => chrome });
  occlusion.update(phone);
  assert.equal(hidden.inert, true);
  assert.equal(visible.inert, false);
  assert.equal(partial.inert, false);
  assert.equal(alreadyInert.inert, true);
  assert.match(chrome.style.clipPath, /^path\(evenodd,/);
  occlusion.invalidate();
  occlusion.update({ ...phone, height: 1000, radius: 0.4 });
  assert.equal(hidden.inert, false);
  occlusion.update(phone);
  occlusion.update({ ...phone, progress: 0 });
  assert.equal(hidden.inert, false);
  assert.equal(alreadyInert.inert, true);
  assert.equal(chrome.style.clipPath, 'none');
  occlusion.update(phone);
  occlusion.dispose();
  assert.equal(hidden.inert, false);
  assert.equal(chrome.style.clipPath, '');
});

test('closing lens blocks card activation and covered chrome without disabling uncovered retargets', () => {
  let opened = 0;
  const scene = new PortfolioScene({}, {}, [{ id: 'a' }], { onOpen: () => opened++ });
  scene.width = phone.width;
  scene.height = phone.height;
  scene.holeGeometry = { center: phone.center, radius: phone.radius };
  scene.hole.p = 0.6;
  scene.activate({ id: 'a' }, {});
  assert.equal(opened, 0, 'React overlay removal must not unlock the still-closing lens');
  scene.hole.p = 1;
  let blocked = 0;
  const event = {
    detail: 1,
    target: { closest: () => true },
    clientX: 195,
    clientY: 24,
    preventDefault: () => blocked++,
    stopPropagation() {},
  };
  assert.equal(scene.blockCoveredChrome(event), true);
  assert.equal(blocked, 1);
  assert.equal(scene.blockCoveredChrome({ ...event, clientX: 10, clientY: 10 }), false);
  scene.hole.p = 0;
  scene.activate({ id: 'a' }, {});
  assert.equal(opened, 1);
});
