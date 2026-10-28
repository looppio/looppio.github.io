import test from 'node:test';
import assert from 'node:assert/strict';
import { LENS_FRAGMENT, LENS_FRAGMENT_SOURCE, REFERENCE_HOLE } from '../src/reference/shaders.js';
import { LensPass } from '../src/reference/PostProcess.js';

const main = LENS_FRAGMENT.slice(LENS_FRAGMENT.indexOf('void main()'));
const shortcutStart = main.indexOf('if (u_ballA <= 0.001');
const shortcutEnd = main.indexOf('// Frame dragging:', shortcutStart);
const shortcuts = main.slice(shortcutStart, shortcutEnd);
// These branches are scalar GLSL, also valid JavaScript after adapting return.
// Execute the emitted shader's guards, not a second hand-written predicate.
const evaluateShortcuts = new Function(
  'u_ballA',
  'u_p',
  'inside',
  'fall',
  'u_backdrop',
  'u_scene',
  'vUv',
  'vec4',
  'texture2D',
  `let gl_FragColor;\n${shortcuts.replaceAll('return;', 'return gl_FragColor;')}`,
);
const vec4 = (rgb, alpha) => [...rgb, alpha];
const sample = ([x, y]) => [x * x, y * y, 0.15 + x * y * 0.7];
function shortcut({ ball = 0, progress, inside, fall, backdrop, uv }) {
  let samples = 0;
  const color = evaluateShortcuts(
    ball,
    progress,
    inside,
    fall,
    backdrop,
    null,
    uv,
    vec4,
    (_, point) => {
      samples += 1;
      return { rgb: sample(point) };
    },
  );
  return { color, samples };
}
const smoothstep = (lo, hi, value) => {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

// Independent numeric evaluation of the reference lens on a non-uniform
// synthetic scene. AA is supplied so wide derivative footprints are covered
// as well as normal phone/desktop footprints; alpha must always end at one.
function referencePixel({ uv, aspect, center, progress, time, squash, aa, backdrop }) {
  const basis = [1 + squash, 1 - squash];
  const q = [(uv[0] - center[0]) * aspect * basis[0], (uv[1] - center[1]) * basis[1]];
  const length = Math.hypot(...q);
  const t = length / aspect;
  const dir = length > 0.00001 ? q.map((v) => v / length) : [1, 0];
  const angle = Math.atan2(q[1], q[0]);
  const lobes = Math.sin(angle * 3 + time * 0.7) * 0.6 + Math.sin(angle * 5 - time * 0.45) * 0.4;
  const r =
    progress * 0.35 * (1 + REFERENCE_HOLE.breath * Math.sin(time * 1.6)) +
    lobes * REFERENCE_HOLE.wave * Math.sin(3.14159265 * Math.max(0, Math.min(1, progress)));
  const e = r * REFERENCE_HOLE.lens;
  const fall = 1 - smoothstep(r, r + REFERENCE_HOLE.reach, t);
  const pull = (strength) => (fall * strength * strength) / Math.max(t, 0.001);
  const draw = pull(e);
  const spin = draw * REFERENCE_HOLE.orbit * Math.min(time, 15);
  const sdir = [
    Math.cos(spin) * dir[0] + Math.sin(spin) * dir[1],
    -Math.sin(spin) * dir[0] + Math.cos(spin) * dir[1],
  ];
  const grab = (rad) => {
    const point = [
      (sdir[0] * rad) / basis[0] + center[0],
      (sdir[1] * rad * aspect) / basis[1] + center[1],
    ];
    return point.some((v) => v < 0 || v > 1) ? backdrop : sample(point);
  };
  const split = e * REFERENCE_HOLE.aberration;
  const refracted = [grab(t - pull(e + split))[0], grab(t - draw)[1], grab(t - pull(e - split))[2]];
  const inside = 1 - smoothstep(-aa, aa, t - r);
  const color =
    progress <= 0 ? sample(uv) : refracted.map((v, i) => v * (1 - inside) + backdrop[i] * inside);
  return { color: [...color, 1], inside, fall };
}

function range(shader, start, end) {
  const a = shader.indexOf(start);
  const b = shader.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `shader must retain ${start} through ${end}`);
  return shader.slice(a, b);
}

test('lens computes AA before fragment returns and leaves the original ring and pointer equations intact', () => {
  assert.ok(shortcutStart > 0 && shortcutEnd > shortcutStart);
  assert.ok(main.indexOf('fwidth(d)') < shortcutStart);
  assert.equal(main.match(/fwidth\(d\)/g)?.length, 1);
  assert.equal(main.match(/float inside =/g)?.length, 1);
  assert.ok(main.indexOf('return;') < main.indexOf('vec4 cr = grab('));
  assert.equal(
    range(LENS_FRAGMENT, 'float draw =', '\n\t// Inside the horizon'),
    range(LENS_FRAGMENT_SOURCE, 'float draw =', '\n\t// Inside the horizon'),
  );
  assert.equal(
    LENS_FRAGMENT.slice(LENS_FRAGMENT.indexOf('if (u_ballA > 0.001)')),
    LENS_FRAGMENT_SOURCE.slice(LENS_FRAGMENT_SOURCE.indexOf('if (u_ballA > 0.001)')),
  );
  const pass = new LensPass({});
  assert.equal(pass.material.fragmentShader, LENS_FRAGMENT);
  pass.dispose();
});

test('emitted early returns match reference colors across viewport, squash, opening and AA footprints', () => {
  let opaque = 0;
  let exterior = 0;
  let full = 0;
  for (const aspect of [390 / 844, 1440 / 900])
    for (const progress of [0.0001, 0.1, 0.5, 1])
      for (const time of [0, 3, 30])
        for (const squash of [-0.3, 0, 0.3])
          for (const aa of [0.0001, 1 / 585, 0.2])
            for (let x = 0; x <= 10; x++)
              for (let y = 0; y <= 10; y++) {
                const input = {
                  uv: [(x + 0.5) / 11, (y + 0.5) / 11],
                  aspect,
                  center: [0.4, 0.6],
                  progress,
                  time,
                  squash,
                  aa,
                  backdrop: [0.08, 0.12, 0.22],
                };
                const expected = referencePixel(input);
                const actual = shortcut({ ...input, ...expected });
                if (!actual.color) {
                  full += 1;
                  continue;
                }
                for (let channel = 0; channel < 4; channel++)
                  assert.ok(Math.abs(actual.color[channel] - expected.color[channel]) < 1e-12);
                if (actual.samples === 0) opaque += 1;
                else {
                  assert.equal(actual.samples, 1);
                  exterior += 1;
                }
              }
  assert.ok(
    opaque > 100 && exterior > 100 && full > 100,
    'exercise fill, exterior and unchanged ring',
  );
});

test('AA edge and every active pointer retain the full path, including the exact threshold', () => {
  const input = { progress: 1, backdrop: [1, 1, 1], uv: [0.2, 0.7] };
  for (const inside of [0.00001, 0.5, 0.99999]) {
    const result = shortcut({ ...input, inside, fall: 0 });
    assert.equal(
      result.color,
      undefined,
      'zero envelope cannot bypass a partially covered AA pixel',
    );
  }
  for (const [inside, fall] of [
    [1, 1],
    [0, 0],
  ]) {
    assert.ok(shortcut({ ...input, inside, fall, ball: 0.001 }).color);
    assert.equal(shortcut({ ...input, inside, fall, ball: 0.001001 }).color, undefined);
    assert.equal(shortcut({ ...input, inside, fall, progress: 0 }).color, undefined);
  }
});
