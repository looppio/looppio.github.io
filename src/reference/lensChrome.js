import { REFERENCE_HOLE } from './shaders.js';

// DOM chrome is composited after the opaque WebGL canvas. Cut its covered
// region out using the same width-based field as the real lens, including the
// refractive rim. Unlike a CSS mask, a clip path also excludes pointer hits.
const clamp = (value) => Math.max(0, Math.min(1, value));
const point = (value) => Number(value.toFixed(2));

export function lensRadiusAt(angle, { progress, radius, time = 0 }) {
  const p = clamp(progress);
  const lobes = Math.sin(angle * 3 + time * 0.7) * 0.6 + Math.sin(angle * 5 - time * 0.45) * 0.4;
  return (
    p * radius * (1 + REFERENCE_HOLE.breath * Math.sin(time * 1.6)) +
    lobes * REFERENCE_HOLE.wave * Math.sin(Math.PI * p) +
    REFERENCE_HOLE.reach
  );
}

export function lensCoversPoint(x, y, field) {
  if (!(field.progress > 0)) return false;
  const { width, height, center, squash = 0 } = field;
  const dx = (x / width - center[0]) * (1 + squash);
  const dy = ((height * (1 - center[1]) - y) / width) * (1 - squash);
  return Math.hypot(dx, dy) <= lensRadiusAt(Math.atan2(dy, dx), field);
}

export function lensChromeClip(field) {
  if (!(field.progress > 0)) return 'none';
  const { width, height, center, squash = 0 } = field;
  const cx = center[0] * width;
  const cy = (1 - center[1]) * height;
  const edge = [];
  // At phone/tablet dimensions 128 samples keep the contour within a CSS
  // pixel. It follows breath, lobes, retargeting and the closing squash.
  for (let i = 0; i < 128; i += 1) {
    const angle = (i / 128) * Math.PI * 2;
    const radius = Math.max(0, lensRadiusAt(angle, field)) * width;
    edge.push(
      `${i ? 'L' : 'M'}${point(cx + (Math.cos(angle) * radius) / (1 + squash))} ${point(cy - (Math.sin(angle) * radius) / (1 - squash))}`,
    );
  }
  return `path(evenodd, "M0 0H${width}V${height}H0Z${edge.join('')}Z")`;
}

export default class LensChrome {
  constructor(root) {
    this.root = root;
    this.controls = [];
    this.dirty = true;
    this.clip = 'none';
  }

  invalidate() {
    this.dirty = true;
  }

  restore() {
    for (const item of this.controls) {
      if (item.blocked) item.element.inert = item.inert;
      item.blocked = false;
    }
  }

  update(field) {
    const chrome = this.root?.querySelector?.('.site-chrome');
    if (!chrome) return;
    if (chrome !== this.chrome) {
      this.dispose();
      this.chrome = chrome;
      this.dirty = true;
    }
    if (this.dirty && field.progress > 0) {
      this.restore();
      this.controls = Array.from(chrome.querySelectorAll('a,button')).map((element) => ({
        element,
        rect: element.getBoundingClientRect(),
        inert: element.inert,
        blocked: false,
      }));
      this.dirty = false;
    }
    const clip = lensChromeClip(field);
    if (clip !== this.clip) {
      chrome.style.clipPath = clip;
      chrome.style.webkitClipPath = clip;
      this.clip = clip;
    }
    // Clipping handles partial controls at the exact touched point. Fully
    // covered controls also leave the keyboard/accessibility focus sequence.
    for (const item of this.controls) {
      const { left, top, width, height } = item.rect;
      const blocked =
        width > 0 &&
        height > 0 &&
        [0, 0.5, 1].every((x) =>
          [0, 0.5, 1].every((y) => lensCoversPoint(left + width * x, top + height * y, field)),
        );
      if (blocked !== item.blocked) {
        item.element.inert = blocked || item.inert;
        item.blocked = blocked;
      }
    }
    if (field.progress <= 0) this.dirty = true;
  }

  dispose() {
    this.restore();
    if (this.chrome) {
      this.chrome.style.clipPath = '';
      this.chrome.style.webkitClipPath = '';
    }
    this.chrome = null;
    this.controls = [];
    this.clip = 'none';
  }
}
