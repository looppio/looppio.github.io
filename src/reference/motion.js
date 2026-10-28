// Source: DZyj3ghP.js, ro/vU, jB.pose/sheet and Yu/Vl/Jl.
// CPU twins are used only for hit polygons. The rendering uses the original GLSL.
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const mix = (a, b, t) => a + (b - a) * t;
const curves = [
  [0, 0, 0.094, 0.026, 0.124, 0.127, 0.157, 0.29],
  [0.157, 0.29, 0.197, 0.486, 0.254, 0.8, 0.348, 0.884],
  [0.348, 0.884, 0.42, 0.949, 0.374, 1, 1, 1],
];
const cubic = (t, a, b, c, d) =>
  (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;
export function sourceEase(p) {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  for (const [a, b, c, d, e, f, g, h] of curves) {
    if (p > g) continue;
    let lo = 0,
      hi = 1;
    for (let n = 0; n < 20; n++) {
      let m = (lo + hi) / 2;
      cubic(m, a, c, e, g) < p ? (lo = m) : (hi = m);
    }
    return cubic((lo + hi) / 2, b, d, f, h);
  }
  return p;
}
export const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export function deformPoint(point, u) {
  let { x, y, z } = point;
  const v = (name) => u[name]?.value || 0,
    W = v('u_sheetW'),
    P = v('u_sheetP'),
    V = v('u_sheetV'),
    D = v('u_sheetD'),
    C = v('u_sheetC');
  if (W > 0.001) {
    const q = (x / W) * v('u_sheetT') - 0.2,
      gauss = Math.exp(-q * q),
      slope =
        mix(
          -2 * q * (2 - q * q),
          Math.PI * Math.cos(Math.PI * q) - 2 * q * Math.sin(Math.PI * q),
          C,
        ) * gauss;
    let angle = ((-0.16 * slope) / Math.PI) * C * P;
    if (V > 0.001 && P > 0.001)
      angle += 1.8 * V * smooth(0.3, 0.9, Math.abs(x / W)) * Math.sign(x / W) * P;
    const Y = y * Math.cos(angle) - z * Math.sin(angle),
      Z = y * Math.sin(angle) + z * Math.cos(angle);
    y = Y;
    z = Z - D * mix(1 - q * q, Math.sin(Math.PI * q), C) * gauss * P;
    y += 0.03 * x * P;
    if (V > 0.001) {
      const m = 1 - smooth(-1, 0.3, x / W);
      y += 0.1 * W * V * m * P;
      z += 0.2 * W * V * m * P;
    }
  }
  if (v('u_leanW') > 0.001 && P > 0.001) {
    const s = clamp(x / v('u_leanW'), -1, 1);
    z += v('u_leanA') * s * (1.5 - 0.5 * s * s) * P;
  }
  if (v('u_bulgeH') > 0.001) {
    const t = clamp(y / v('u_bulgeH'), -1, 1);
    z += v('u_bulgeA') * (1 - t * t);
  }
  return { x, y, z };
}
