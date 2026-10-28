import test from 'node:test';
import assert from 'node:assert/strict';
import PortfolioScene from '../src/reference/PortfolioScene.js';

for (const [name, width, fineHover, pointerType] of [
  ['mobile with a mouse', 697, true, 'mouse'],
  ['phone', 390, false, 'touch'],
  ['large touch screen', 1200, false, 'touch'],
  ['touch input on a hybrid laptop', 1280, true, 'touch'],
])
  test(`All cases retires an active preview immediately on ${name}`, () => {
    const saved = globalThis.matchMedia;
    globalThis.matchMedia = () => ({ matches: fineHover });
    try {
      const scene = {
        width,
        pointer: { type: pointerType },
        railState: { reveal: 1 },
        railProjectId: 'zircuit',
        rail: { visible: true, material: { uniforms: { u_reveal: { value: 1 } } } },
      };
      PortfolioScene.prototype.syncRail.call(scene, 1 / 60);
      assert.equal(scene.rail.visible, false);
      assert.equal(scene.railState.reveal, 0);
      assert.equal(scene.rail.material.uniforms.u_reveal.value, 0);
      assert.equal(scene.railProjectId, null);
    } finally {
      if (saved) globalThis.matchMedia = saved;
      else delete globalThis.matchMedia;
    }
  });
