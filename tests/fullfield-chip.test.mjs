import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import FullField, { FULL_FIELD } from '../src/reference/FullField.js';

function fixture({ dpr = 2, nativeDpr = dpr, path = true } = {}) {
  const ops = [],
    classes = new Set(),
    vars = {
      '--case-fill': 'rgba(255,255,255,.10)',
      '--case-stroke': 'rgba(255,255,255,.16)',
      '--case-radius': '12px',
    };
  const state = {
    left: 100,
    top: 180,
    width: 170,
    height: 44,
    labelX: 13,
    labelY: 11,
    labelWidth: 120,
    labelHeight: 22,
    iconX: 142,
    iconY: 14,
  };
  const rect = (left, top, width, height) => ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  });
  const ctx = {
    setTransform(...a) {
      ops.push(['transform', ...a]);
    },
    clearRect(...a) {
      ops.push(['clear', ...a]);
    },
    beginPath() {},
    roundRect(...a) {
      ops.push(['roundRect', ...a]);
    },
    rect(...a) {
      ops.push(['rect', ...a]);
    },
    clip() {},
    save() {},
    restore() {},
    translate(...a) {
      ops.push(['translate', ...a]);
    },
    scale(...a) {
      ops.push(['scale', ...a]);
    },
    fill(p) {
      ops.push(['fill', this.fillStyle, p?.d]);
    },
    stroke() {
      ops.push(['stroke', this.strokeStyle, this.lineWidth]);
    },
    fillText(...a) {
      ops.push(['text', ...a]);
    },
    measureText() {
      return { fontBoundingBoxAscent: 14, fontBoundingBoxDescent: 4 };
    },
    moveTo(...a) {
      ops.push(['moveTo', ...a]);
    },
    lineTo(...a) {
      ops.push(['lineTo', ...a]);
    },
    letterSpacing: 'normal',
    textRendering: 'auto',
  };
  const font = {
    font: '400 18px DM Sans',
    fontSize: '18px',
    fontFamily: 'DM Sans',
    fontStyle: 'normal',
    fontWeight: '400',
    letterSpacing: '-.3px',
    lineHeight: '22px',
    textTransform: 'none',
  };
  const css = {
    ...font,
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '9px',
    paddingBottom: '9px',
    borderTopWidth: '1px',
    borderTopLeftRadius: '12px',
    columnGap: '9px',
    getPropertyValue: (n) => vars[n] || '',
  };
  Object.defineProperty(css, 'backgroundColor', {
    get: () => (classes.has('gl-text-ready') ? 'transparent' : vars['--case-fill']),
  });
  Object.defineProperty(css, 'borderColor', {
    get: () => (classes.has('gl-text-ready') ? 'transparent' : vars['--case-stroke']),
  });
  const label = {
    textContent: 'Ndax',
    computed: font,
    getBoundingClientRect: () =>
      rect(
        state.left + state.labelX,
        state.top + state.labelY,
        state.labelWidth,
        state.labelHeight,
      ),
  };
  const svg = {
    computed: { width: '16px', height: '16px', opacity: '0' },
    getBoundingClientRect: () => rect(state.left + state.iconX, state.top + state.iconY, 16, 16),
    getAttribute: (n) => (n === 'viewBox' ? '0 0 256 256' : null),
    querySelectorAll: () => [
      { getAttribute: (n) => (n === 'd' ? 'M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66' : null) },
    ],
  };
  const viewport = {
    clientWidth: 720,
    clientHeight: 400,
    computed: { visibility: 'visible', display: 'flex' },
    getBoundingClientRect: () => rect(40, 100, 720, 400),
  };
  const element = {
    isConnected: true,
    dataset: { title: 'Ndax', filterMatch: 'false' },
    textContent: 'Ndax',
    style: { color: 'white', webkitTextFillColor: '', textShadow: '' },
    classList: {
      add: (n) => classes.add(n),
      remove: (n) => classes.delete(n),
      contains: (n) => n === 'case-link' || classes.has(n),
    },
    querySelector: (s) => (s === '.case-link-label' ? label : s === 'svg' ? svg : null),
    closest: () => viewport,
    getBoundingClientRect: () => rect(state.left, state.top, state.width, state.height),
    computed: css,
  };
  const doc = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
    defaultView: {
      devicePixelRatio: nativeDpr,
      getComputedStyle: (e) => e.computed,
      Path2D: path
        ? class {
            constructor(d) {
              this.d = d;
            }
          }
        : undefined,
    },
  };
  const renderer = {
    domElement: { ownerDocument: doc },
    getSize: (v) => v.set(800, 600),
    getDrawingBufferSize: (v) => v.set(800 * dpr, 600 * dpr),
    getPixelRatio: () => dpr,
  };
  const camera = new THREE.PerspectiveCamera(53.4, 800 / 600, 0.1, 2000);
  camera.position.z = 41.18;
  const scene = new THREE.Scene(),
    field = new FullField(scene, camera, renderer),
    rail = new THREE.Mesh(
      new THREE.PlaneGeometry(),
      new THREE.ShaderMaterial({ uniforms: { u_reveal: { value: 1 }, u_corner: { value: 0.03 } } }),
    );
  rail.scale.set(10, 6, 1);
  const update = (options = {}) =>
    field.update({ elements: [element], rail, presence: 1, dt: 1 / 60, ...options });
  const dispose = () => {
    field.dispose();
    rail.geometry.dispose();
    rail.material.dispose();
  };
  return {
    ops,
    classes,
    vars,
    state,
    css,
    element,
    label,
    svg,
    field,
    rail,
    viewport,
    view: doc.defaultView,
    update,
    dispose,
    entry: () => field.entries.get(element),
  };
}

test('chip background, inset border, measured label and Phosphor path share one warped raster', () => {
  const f = fixture();
  f.update();
  const e = f.entry();
  assert.equal(f.css.backgroundColor, 'transparent');
  assert.equal(f.css.borderColor, 'transparent');
  assert.ok(
    f.ops.some((op) => JSON.stringify(op) === JSON.stringify(['roundRect', 7, 5, 170, 44, 12])),
  );
  assert.ok(
    f.ops.some(
      (op) => JSON.stringify(op) === JSON.stringify(['roundRect', 7.5, 5.5, 169, 43, 11.5]),
    ),
  );
  assert.ok(f.ops.some((op) => op[0] === 'fill' && op[1] === f.vars['--case-fill']));
  assert.ok(
    f.ops.some((op) => op[0] === 'stroke' && op[1] === f.vars['--case-stroke'] && op[2] === 1),
  );
  assert.ok(
    f.ops.some((op) => op[0] === 'text' && op[1] === 'Ndax' && op[2] === 20 && op[3] === 32),
  );
  assert.ok(f.ops.some((op) => op[0] === 'translate' && op[1] === 149 && op[2] === 19));
  assert.ok(
    f.ops.some((op) => op[0] === 'fill' && op[1] === '#fff' && op[2]?.startsWith('M200,64')),
  );
  assert.equal(e.mesh.geometry.attributes.position.count, 33 * 9);
  assert.ok(e.material.uniforms.u_avoidP.value > 0);
  assert.equal(e.material.uniforms.u_avoidF.value.y, FULL_FIELD.amp);
  assert.deepEqual(e.material.uniforms.u_clip.value.toArray(), [80, 200, 1440, 800]);
  f.dispose();
});

test('filter-match and hover CSS variables invalidate the raster without reading transparent DOM paint', () => {
  const f = fixture();
  f.update();
  let version = f.entry().texture.version;
  f.update();
  assert.equal(f.entry().texture.version, version);
  f.vars['--case-fill'] = 'rgba(255,255,255,.22)';
  f.vars['--case-stroke'] = 'rgba(255,255,255,.42)';
  f.element.dataset.filterMatch = 'true';
  f.update();
  assert.ok(f.entry().texture.version > version);
  version = f.entry().texture.version;
  f.vars['--case-fill'] = 'rgba(255,255,255,.24)';
  f.vars['--case-stroke'] = 'rgba(255,255,255,.48)';
  f.update();
  assert.ok(f.entry().texture.version > version);
  assert.ok(f.ops.some((op) => op[0] === 'fill' && op[1] === 'rgba(255,255,255,.24)'));
  f.dispose();
});

test('computed filter opacity applies immediately to the whole GPU chip without disabling its DOM target', () => {
  const f = fixture();
  f.css.opacity = '1';
  f.update();
  assert.equal(f.entry().material.uniforms.u_alpha.value, 1);
  f.element.dataset.filterMatch = 'false';
  f.css.opacity = '0.72';
  f.update();
  assert.equal(f.entry().material.uniforms.u_alpha.value, 0.72);
  assert.equal(f.entry().mesh.visible, true);
  assert.equal(f.element.style.pointerEvents, undefined);
  f.element.dataset.filterMatch = 'true';
  f.css.opacity = '1';
  f.update();
  assert.equal(f.entry().material.uniforms.u_alpha.value, 1);
  delete f.element.dataset.filterMatch;
  f.css.opacity = '1';
  f.update();
  assert.equal(f.entry().material.uniforms.u_alpha.value, 1);
  f.css.opacity = '0.72';
  f.update({ alpha: 0.5 });
  assert.equal(f.entry().material.uniforms.u_alpha.value, 0.36);
  f.dispose();
});

test('borderless fully rounded chips clamp their radius and follow centered child geometry', () => {
  const f = fixture();
  f.vars['--case-radius'] = '999px';
  f.vars['--case-stroke'] = 'transparent';
  f.css.borderTopWidth = '0px';
  f.state.labelX = 25;
  f.state.labelWidth = 95;
  f.state.iconX = 129;
  f.update();
  assert.ok(f.ops.some((op) => op[0] === 'roundRect' && op[5] === 22));
  assert.equal(
    f.ops.some((op) => op[0] === 'stroke'),
    false,
  );
  assert.ok(f.ops.some((op) => op[0] === 'text' && op[2] === 32));
  assert.ok(f.ops.some((op) => op[0] === 'translate' && op[1] === 136));
  f.dispose();
});

test('fallback arrow keeps Phosphor diagonal and head when Path2D is unavailable', () => {
  const f = fixture({ path: false });
  f.update();
  assert.ok(f.ops.some((op) => op[0] === 'moveTo' && op[1] === 64 && op[2] === 192));
  assert.ok(f.ops.some((op) => op[0] === 'lineTo' && op[1] === 192 && op[2] === 64));
  assert.ok(f.ops.some((op) => op[0] === 'lineTo' && op[1] === 192 && op[2] === 168));
  f.dispose();
});

test('moving the scrollport preserves relative layout and disabled GPU restores DOM fallback', () => {
  const f = fixture({ dpr: 1 });
  f.update();
  const version = f.entry().texture.version;
  f.state.top -= 20;
  f.update();
  assert.equal(f.entry().texture.version, version);
  assert.equal(f.classes.has('gl-text-ready'), true);
  f.update({ enabled: false });
  assert.equal(f.entry().mesh.visible, false);
  assert.equal(f.classes.has('gl-text-ready'), false);
  assert.equal(f.element.style.color, 'white');
  assert.equal(f.css.backgroundColor, f.vars['--case-fill']);
  f.dispose();
});

test('idle pills use native paint while keeping current raster, opacity and geometry for effects', () => {
  const f = fixture({ dpr: 1 });
  const idle = { rail: null, presence: 0 };
  f.css.opacity = '0.72';
  f.update(idle);
  const entry = f.entry();
  assert.equal(entry.mesh.visible, false);
  assert.equal(entry.rasterVisible, true);
  assert.equal(f.classes.has('gl-text-ready'), false);
  assert.equal(f.element.style.color, 'white');
  assert.equal(f.css.backgroundColor, f.vars['--case-fill']);
  assert.equal(entry.material.uniforms.u_alpha.value, 0.72);
  assert.ok(f.ops.some((op) => op[0] === 'text' && op[1] === 'Ndax'));
  assert.equal(f.element.style.pointerEvents, undefined);
  assert.equal(f.element.tabIndex, undefined);

  const version = entry.texture.version;
  const y = entry.mesh.position.y;
  f.state.top -= 30;
  f.update(idle);
  assert.ok(entry.mesh.position.y > y);
  assert.equal(entry.texture.version, version);
  f.vars['--case-fill'] = 'rgba(255,255,255,.36)';
  f.update(idle);
  assert.ok(entry.texture.version > version);
  assert.equal(entry.mesh.visible, false);
  assert.equal(f.classes.has('gl-text-ready'), false);
  f.dispose();
});

test('external effects switch the whole pill to cached GPU paint and return to native when settled', () => {
  const f = fixture();
  const idle = { rail: null, presence: 0 };
  f.update(idle);
  const entry = f.entry();
  const version = entry.texture.version;
  f.update({ ...idle, forceRaster: true });
  assert.equal(entry.mesh.visible, true);
  assert.equal(f.classes.has('gl-text-ready'), true);
  assert.equal(f.element.style.color, 'transparent');
  assert.equal(f.css.backgroundColor, 'transparent');
  assert.equal(entry.texture.version, version);
  f.update(idle);
  assert.equal(entry.mesh.visible, false);
  assert.equal(f.classes.has('gl-text-ready'), false);
  assert.equal(entry.texture.version, version);
  f.dispose();
});

test('rail and blast retain GPU paint until their residual field decays', () => {
  for (const blast of [false, true]) {
    const f = fixture();
    f.update({ blast: blast ? f.rail : null });
    assert.equal(f.entry().mesh.visible, true);
    f.update({ rail: null, presence: 0 });
    assert.equal(f.entry().mesh.visible, true);
    assert.equal(f.classes.has('gl-text-ready'), true);
    for (let i = 0; i < 120; i += 1) f.update({ rail: null, presence: 0 });
    assert.equal(f.entry().mesh.visible, false);
    assert.equal(f.classes.has('gl-text-ready'), false);
    f.dispose();
  }
});

test('partial alpha and active bulge cannot bypass GPU paint', () => {
  const f = fixture();
  for (const effect of [{ alpha: 0.5 }, { bulge: 0.1 }, { presence: 1, dt: 0 }]) {
    f.update({ rail: null, presence: 0, ...effect });
    assert.equal(f.entry().mesh.visible, true);
    assert.equal(f.classes.has('gl-text-ready'), true);
  }
  f.dispose();
});

test('raster snapshots include cached idle pills after DOM unmount and restore visibility on failure', () => {
  const f = fixture();
  f.update({ rail: null, presence: 0 });
  const entry = f.entry();
  const position = entry.mesh.position.clone();
  f.element.isConnected = false;
  f.element.getBoundingClientRect = () => {
    throw new Error('Unmounted DOM must not be measured for a snapshot');
  };
  assert.equal(
    f.field.withRasterSnapshot(() => {
      assert.equal(entry.mesh.visible, true);
      assert.equal(f.classes.has('gl-text-ready'), false);
      assert.deepEqual(entry.mesh.position, position);
      return 'captured';
    }),
    'captured',
  );
  assert.equal(entry.mesh.visible, false);
  assert.throws(
    () =>
      f.field.withRasterSnapshot(() => {
        assert.equal(entry.mesh.visible, true);
        throw new Error('render failed');
      }),
    /render failed/,
  );
  assert.equal(entry.mesh.visible, false);
  assert.equal(f.classes.has('gl-text-ready'), false);
  f.dispose();
});

test('disabled, clipped and hidden entries never reappear in a raster snapshot', () => {
  for (const state of ['disabled', 'offscreen', 'hidden']) {
    const f = fixture();
    f.update({ rail: null, presence: 0 });
    if (state === 'offscreen') f.state.top = 2000;
    if (state === 'hidden') f.viewport.computed.visibility = 'hidden';
    f.update({ rail: null, presence: 0, enabled: state !== 'disabled' });
    f.field.withRasterSnapshot(() => assert.equal(f.entry().mesh.visible, false));
    assert.equal(f.classes.has('gl-text-ready'), false);
    f.dispose();
  }
});

test('effect rasters retain 2–3x native detail independently of the framebuffer budget', () => {
  for (const [dpr, nativeDpr, rasterDpr] of [
    [1, 1, 2],
    [0.84, 3, 3],
    [1.5, 4, 3],
  ]) {
    const f = fixture({ dpr, nativeDpr });
    f.update({ rail: null, presence: 0 });
    assert.equal(f.entry().canvas.width, 184 * rasterDpr);
    assert.equal(f.entry().canvas.height, 54 * rasterDpr);
    f.dispose();
  }
});

test('fractional pill dimensions use exact canvas-to-plane ratios and native DPR changes invalidate cache', () => {
  const f = fixture({ dpr: 0.84, nativeDpr: 2.75 });
  f.state.width = 170.25;
  f.state.height = 44.2;
  f.update({ rail: null, presence: 0 });
  const entry = f.entry();
  const planeWidth = f.state.width + entry.padX * 2;
  const planeHeight = f.state.height + entry.padY * 2;
  assert.equal(entry.canvas.width, Math.ceil(planeWidth * 2.75));
  assert.equal(entry.canvas.height, Math.ceil(planeHeight * 2.75));
  assert.deepEqual(
    f.ops.find((op) => op[0] === 'transform'),
    ['transform', entry.canvas.width / planeWidth, 0, 0, entry.canvas.height / planeHeight, 0, 0],
  );
  const version = entry.texture.version;
  f.view.devicePixelRatio = 3;
  f.update({ rail: null, presence: 0 });
  assert.ok(entry.texture.version > version);
  assert.equal(entry.canvas.width, Math.ceil(planeWidth * 3));
  f.dispose();
});
