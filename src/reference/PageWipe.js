import * as THREE from 'three';
import { sourceEase } from './motion.js';

// Source NU and _U, extracted statically with Babel AST from DZyj3ghP.js.
// No source application code, CMS or navigation is evaluated.
export const SOURCE_WIPE_VERTEX =
  'varying vec2 vUv;\n\n// Fullscreen pass. The quad is already in clip space (-1..1), so there is no\n// camera to apply and no model matrix worth multiplying by — the vertices go\n// straight through.\nvoid main() {\n\tvUv = uv;\n\tgl_Position = vec4(position.xy, 0.0, 1.0);\n}\n';
export const SOURCE_WIPE_FRAGMENT =
  "// ── The wipe ──\n//\n// The page transition for every navigation the flip does not cover. The black\n// hole's disc (see post/frag.frag), opened from the centre of the screen until\n// it has swallowed the corners — with the NEW page inside it instead of\n// nothing. The rim is the hole's rim: the same lens on the same leash, the same\n// lobed boundary, the same channel split. What differs is that it never sits\n// still, and it is capped: the Einstein radius stops growing with the disc, so\n// the ring reads the same at a tenth of the width as at half of it, and the\n// mirrored sample never leaves the frame.\n//\n// A stack of up to three SHEETS, back to front, each showing inside its own\n// disc; the back sheet's disc is the whole frame. What a sheet IS depends on\n// which side of the canvas its page draws on:\n//\n//   capture  a GL page that has left, rendered once at the moment it went (see\n//            Wipe.capture) — frozen pixels, lensed live.\n//   live     the scene this frame — a GL page arriving.\n//   dom      a page that paints in markup, ABOVE the canvas. Here it is a hole\n//            in the composite (black), and the very same disc, written as a\n//            clip-path off the same numbers, opens it in the DOM (see\n//            Wipe.clip). The two agree to the pixel because they are one\n//            formula evaluated twice.\n\nuniform sampler2D u_a;    // capture slot A\nuniform sampler2D u_b;    // capture slot B\nuniform sampler2D u_live; // the scene, this frame\nuniform vec2 u_aspect;\nuniform vec2 u_center;\nuniform float u_time;\nuniform float u_full;   // the radius that clears the corners, width-share\n\n// The stack, back to front. kind: 0 empty, 1 capture A, 2 capture B, 3 live,\n// 4 dom. p: the disc's progress, 0 shut, 1 past the corners.\nuniform float u_kind[3];\nuniform float u_p[3];\n\nuniform float u_lens;  // Einstein radius as a multiple of the disc's...\nuniform float u_emax;  // ...capped here, width-share\nuniform float u_reach; // how far past a rim the pull survives\nuniform float u_wave;  // how far a rim lobes off the circle\nuniform float u_aberr; // channel split at the rim, as a share of the lens\nuniform float u_bulge; // an arriving page's swell against its own rim\nuniform float u_shift; // the rim fringe: how far the channels part, width-share\nuniform float u_band;  // ...and how far from the rim the parting reaches\nuniform float u_glint;  // the rim's own light: brightness\nuniform float u_glintW; // ...and half-width, width-share\nuniform float u_px;     // one CSS px, width-share — the hairline's floor\nuniform float u_dim;   // how far a page darkens under the rim opening over it\n\nvarying vec2 vUv;\n\n#define PI 3.14159265\n\n// Radius as a share of the viewport's WIDTH — the hole's unit, for the hole's\n// reason: every constant here is quoted in it, and the fluid rem scale the\n// layout runs on is width-driven too.\nfloat widthUnit() {\n\treturn u_aspect.x;\n}\n\n// The rim's wander, IDENTICAL to the hole's: three soft lobes beating against\n// five. Wipe.lobes is the JS twin the clip-path is cut from, and the two\n// must not drift — change one, change both.\nfloat lobes(float a) {\n\treturn sin(a * 3.0 + u_time * 0.7) * 0.6 + sin(a * 5.0 - u_time * 0.45) * 0.4;\n}\n\n// A sheet's disc at this angle. The lobes are silenced at both ends by\n// sin(PI * p): a shut disc is a point and a finished one is a circle past the\n// corners — a boundary still wobbling as it clears the frame would leave a\n// corner flickering.\nfloat radius(float p, float n) {\n\treturn p * u_full + n * sin(PI * clamp(p, 0.0, 1.0));\n}\n\n// A direction and a radius back to the uv that holds it, then the sheet's\n// pixels there. Off the frame there is nothing to have bent: OPAQUE black,\n// to match the targets every sheet was cleared to (see Core.tick).\nvec4 grab(float kind, vec2 dir, float rad) {\n\tvec2 uv = (dir * rad * widthUnit()) / u_aspect + u_center;\n\n\tif (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0, 0.0, 0.0, 1.0);\n\n\tif (kind < 1.5) return texture2D(u_a, uv);\n\tif (kind < 2.5) return texture2D(u_b, uv);\n\treturn texture2D(u_live, uv);\n}\n\n// How far a pixel outside a rim is dragged toward it — the hole's one line of\n// astrophysics, see post/frag.frag for the working.\nfloat pull(float t, float e, float fall) {\n\treturn fall * (e * e) / max(t, 0.001);\n}\n\n// One sheet's colour at this pixel, lensed by the two rims that concern it:\n//\n//   rOut  the disc opening OVER it. Content near that rim is pulled into it —\n//         the leaver falling into the ring — and darkens under it, the shadow\n//         the arriving page casts.\n//   rIn   its own disc, while it is still opening. Content just inside swells\n//         toward the rim, magnified out of the centre, and relaxes flat as the\n//         disc fills the frame.\n//\n// A dom sheet is black by construction: the markup is doing its drawing.\nvec3 shade(float kind, float rIn, float pIn, float rOut, float t, vec2 dir) {\n\tif (kind < 0.5 || kind > 3.5) return vec3(0.0);\n\n\tfloat b = t;\n\tfloat bR = t;\n\tfloat bB = t;\n\n\tfloat fall = 0.0;\n\n\tif (rOut > 0.0) {\n\t\tfloat e = min(rOut * u_lens, u_emax);\n\t\tfloat split = e * u_aberr;\n\n\t\tfall = 1.0 - smoothstep(rOut, rOut + u_reach, t);\n\n\t\tb -= pull(t, e, fall);\n\t\tbR -= pull(t, e + split, fall);\n\t\tbB -= pull(t, e - split, fall);\n\t}\n\n\tif (rIn > 0.0 && rIn < 100.0) {\n\t\tfloat w = (1.0 - smoothstep(rIn - u_reach, rIn, t)) * (1.0 - pIn);\n\t\tfloat s = 1.0 - u_bulge * w;\n\n\t\tb *= s;\n\t\tbR *= s;\n\t\tbB *= s;\n\t}\n\n\t// ── The fringe ──\n\t//\n\t// The channels part along a rim, on both sides of it, and close again\n\t// within u_band: red sampled a touch nearer the centre than green, blue\n\t// a touch further — the order the hole's lens splits them in, with a\n\t// reach of its own so it reads AS the edge rather than as a tint on the\n\t// page. A sheet between two rims takes the nearer. A dom sheet gets none\n\t// (markup cannot split), so a rim against one carries the fringe on its\n\t// GL side only.\n\tfloat near = 0.0;\n\n\tif (rOut > 0.0) near = max(near, 1.0 - smoothstep(0.0, u_band, abs(t - rOut)));\n\tif (rIn > 0.0 && rIn < 100.0) near = max(near, 1.0 - smoothstep(0.0, u_band, abs(t - rIn)));\n\n\tfloat part = u_shift * near;\n\n\tbR -= part;\n\tbB += part;\n\n\tvec3 col = vec3(grab(kind, dir, bR).r, grab(kind, dir, b).g, grab(kind, dir, bB).b);\n\n\treturn col * (1.0 - u_dim * fall);\n}\n\n// ── The rim's own light ──\n//\n// Where both sides of a rim are black the edge vanishes: nothing to bend,\n// no channels to part. So every rim carries a hairline of its own — a soft\n// line of light straddling the boundary, dispersed the way the fringe is:\n// red a touch outside, green on the line, blue a touch inside. Content or\n// not, the disc has an edge. Never thinner than a pixel and a half, so it\n// cannot alias; silenced while the disc is still a point, because a glowing\n// dot at screen centre is not an edge. Additive, so on white it simply\n// clips and the fringe carries the edge there instead.\nvec3 glint(float d, float p) {\n\tfloat w = max(u_glintW, 1.5 * u_px);\n\tfloat s = w;\n\n\tfloat g = exp(-(d * d) / (w * w));\n\tfloat r = exp(-((d - s) * (d - s)) / (w * w));\n\tfloat b = exp(-((d + s) * (d + s)) / (w * w));\n\n\treturn vec3(r, g, b) * u_glint * smoothstep(0.0, 0.03, p);\n}\n\n// The disc's edge: a pixel and a half of AA, exactly as the hole cuts its\n// horizon.\nfloat inside(float d) {\n\tfloat aa = max(fwidth(d), 0.0001);\n\treturn 1.0 - smoothstep(-aa, aa, d);\n}\n\nvoid main() {\n\tvec2 q = (vUv - u_center) * u_aspect;\n\n\tfloat t = length(q) / widthUnit();\n\tvec2 dir = length(q) > 0.00001 ? normalize(q) : vec2(1.0, 0.0);\n\tfloat n = lobes(atan(q.y, q.x)) * u_wave;\n\n\tbool has1 = u_kind[1] > 0.5;\n\tbool has2 = u_kind[2] > 0.5;\n\n\tfloat r1 = has1 ? radius(u_p[1], n) : -1.0;\n\tfloat r2 = has2 ? radius(u_p[2], n) : -1.0;\n\n\t// Back to front, each disc mixed over what is behind it. The back sheet\n\t// has no rim of its own (1e3 skips the swell), only the one opening over\n\t// it.\n\tvec3 c = shade(u_kind[0], 1000.0, 1.0, r1, t, dir);\n\n\tif (has1) c = mix(c, shade(u_kind[1], r1, u_p[1], r2, t, dir), inside(t - r1));\n\tif (has2) c = mix(c, shade(u_kind[2], r2, u_p[2], -1.0, t, dir), inside(t - r2));\n\n\t// The rims' light, over the composite — see glint().\n\tif (has1) c += glint(t - r1, u_p[1]);\n\tif (has2) c += glint(t - r2, u_p[2]);\n\n\t// Opaque, for the reason every clear in Core.tick is: the frame IS\n\t// opaque, and a meaningless alpha carried to the backbuffer darkens\n\t// everything semi-transparent on the way.\n\tgl_FragColor = vec4(c, 1.0);\n}\n";

const DURATION = 1.25;
const MAX_SHEETS = 3;
const RING_POINTS = 128;
const PAD = 0.01;
const WAVE = 0.05;
const OUTER_POLYGON = '0 0,100% 0,100% 100%,0 100%,0 0';
const COPY_FRAGMENT = `uniform sampler2D u_texture; varying vec2 vUv;
void main(){ gl_FragColor=texture2D(u_texture,vUv); }`;
const adaptedFragment = `uniform vec3 u_backdrop;\n${SOURCE_WIPE_FRAGMENT}`
  .replace('return vec4(0.0, 0.0, 0.0, 1.0);', 'return vec4(u_backdrop, 1.0);')
  .replace('return vec3(0.0);', 'return u_backdrop;');
const clamp = (value) => Math.max(0, Math.min(1, value));

/**
 * Three-layer version of the source NU page wipe.
 *
 * const wipe = new PageWipe(renderer);
 * wipe.resize(cssWidth, cssHeight, dpr);
 * wipe.capture(oldSceneTexture); // GPU snapshot, never a canvas readback
 * wipe.start();                 // source centre, UV coordinates
 * const texture = wipe.render(liveSceneTexture, { dt }); // feed to LensPost
 * wipe.render(liveSceneTexture, { dt, target: null });   // draw screen instead
 *
 * Omitted target returns an internal output texture. A RenderTarget draws
 * there and returns its texture. Explicit null draws the default framebuffer.
 * All state belongs to this module; it installs no RAF, event or timer.
 */
export default class PageWipe {
  constructor(renderer, { backdrop = 0xffffff } = {}) {
    if (!renderer?.render) throw new TypeError('PageWipe requires a Three renderer');
    this.renderer = renderer;
    this.sheets = [];
    this.slots = [null, null];
    this.output = null;
    this.time = 0;
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.full = 1;
    this.origin = new THREE.Vector2(0.5, 0.5);
    this.disposed = false;
    this.captureSerial = 0;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();
    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.material = new THREE.ShaderMaterial({
      vertexShader: SOURCE_WIPE_VERTEX,
      fragmentShader: adaptedFragment,
      uniforms: {
        u_a: { value: null },
        u_b: { value: null },
        u_live: { value: null },
        u_aspect: { value: new THREE.Vector2(1, 1) },
        u_center: { value: this.origin },
        u_time: { value: 0 },
        u_full: { value: 1 },
        u_kind: { value: [0, 0, 0] },
        u_p: { value: [1, 0, 0] },
        u_lens: { value: 1.5 },
        u_emax: { value: 0.12 },
        u_reach: { value: 0.09 },
        u_wave: { value: WAVE },
        u_aberr: { value: 0.004 },
        u_bulge: { value: 0.12 },
        u_shift: { value: 0.006 },
        u_band: { value: 0.05 },
        u_glint: { value: 0.3 },
        u_glintW: { value: 0.0015 },
        u_px: { value: 1 },
        u_dim: { value: 0.35 },
        u_backdrop: { value: new THREE.Color(backdrop) },
      },
      depthTest: false,
      depthWrite: false,
      transparent: false,
      blending: THREE.NoBlending,
      toneMapped: false,
    });
    this.copyMaterial = new THREE.ShaderMaterial({
      vertexShader: SOURCE_WIPE_VERTEX,
      fragmentShader: COPY_FRAGMENT,
      uniforms: { u_texture: { value: null } },
      depthTest: false,
      depthWrite: false,
      transparent: false,
      blending: THREE.NoBlending,
      toneMapped: false,
    });
    this.quad = new THREE.Mesh(this.geometry, this.material);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    const size = renderer.getSize?.(new THREE.Vector2()) || new THREE.Vector2(1, 1);
    this.resize(size.x, size.y, renderer.getPixelRatio?.() || 1);
  }

  get active() {
    return this.sheets.length > 1 || this.sheets.some((sheet) => sheet.kind === 'capture');
  }

  get frozen() {
    return this.sheets.some((sheet) => sheet.kind === 'capture');
  }

  get progress() {
    return this.sheets.at(-1)?.p ?? 1;
  }

  get texture() {
    return this.output?.texture ?? null;
  }

  setBackdrop(color) {
    this.material.uniforms.u_backdrop.value.set(color);
  }

  resize(width, height, dpr = this.renderer.getPixelRatio?.() || 1) {
    if (!width || !height || this.disposed) return;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dpr = Math.max(0.1, dpr);
    this._updateFullRadius();
    const uniforms = this.material.uniforms;
    uniforms.u_aspect.value.set(this.width / this.height, 1);
    uniforms.u_px.value = 1 / this.width;
    const pixels = this._pixelSize();
    // Do not resize frozen slots: resizing a RenderTarget destroys its pixels.
    // Its normalized UV image remains a snapshot until it leaves the stack.
    this.output?.setSize(pixels.width, pixels.height);
    this.clip();
  }

  _pixelSize() {
    return {
      width: Math.max(1, Math.floor(this.width * this.dpr)),
      height: Math.max(1, Math.floor(this.height * this.dpr)),
    };
  }

  _updateFullRadius() {
    // At [.5,.5] this is source .5*sqrt(1+h*h/(w*w))+.01 exactly.
    // For an optional off-centre origin, use the farthest corner in the same
    // viewport-width units so the disc still clears every corner.
    const x = Math.max(this.origin.x, 1 - this.origin.x);
    const y = (Math.max(this.origin.y, 1 - this.origin.y) * this.height) / this.width;
    this.full = Math.sqrt(x * x + y * y) + PAD;
    this.material.uniforms.u_full.value = this.full;
  }

  _makeTarget(width, height) {
    const target = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
      colorSpace: THREE.NoColorSpace,
    });
    target.texture.generateMipmaps = false;
    target.texture.name = 'PortfolioPageWipe';
    return target;
  }

  _outputTarget() {
    const { width, height } = this._pixelSize();
    if (!this.output) this.output = this._makeTarget(width, height);
    else if (this.output.width !== width || this.output.height !== height)
      this.output.setSize(width, height);
    return this.output;
  }

  _renderMaterial(material, target) {
    const renderer = this.renderer;
    const previousTarget = renderer.getRenderTarget?.() ?? null;
    const previousMaterial = this.quad.material;
    const clearColor = renderer.getClearColor?.(new THREE.Color());
    const clearAlpha = renderer.getClearAlpha?.();
    const viewport = renderer.getViewport?.(new THREE.Vector4());
    const scissor = renderer.getScissor?.(new THREE.Vector4());
    const scissorTest = renderer.getScissorTest?.();
    const xrEnabled = renderer.xr?.enabled;
    try {
      if (renderer.xr) renderer.xr.enabled = false;
      this.quad.material = material;
      renderer.setRenderTarget(target);
      renderer.setScissorTest?.(false);
      renderer.setClearColor(this.material.uniforms.u_backdrop.value, 1);
      renderer.clear();
      renderer.render(this.scene, this.camera);
    } finally {
      this.quad.material = previousMaterial;
      renderer.setRenderTarget(previousTarget);
      if (clearColor) renderer.setClearColor(clearColor, clearAlpha ?? 1);
      if (viewport) renderer.setViewport(viewport);
      if (scissor) renderer.setScissor(scissor);
      if (scissorTest !== undefined) renderer.setScissorTest(scissorTest);
      if (renderer.xr) renderer.xr.enabled = xrEnabled;
    }
  }

  _copy(texture, target) {
    if (!texture?.isTexture)
      throw new TypeError('PageWipe requires a texture, not a scene or RenderTarget');
    if (target?.texture === texture)
      throw new Error('PageWipe cannot sample and write the same texture');
    this.copyMaterial.uniforms.u_texture.value = texture;
    this._renderMaterial(this.copyMaterial, target);
    return target?.texture ?? null;
  }

  _drop(sheet) {
    if (!sheet) return;
    if (sheet.el) sheet.el.style.clipPath = '';
    sheet.release?.();
    sheet.release = null;
    sheet.slot = -1;
  }

  _dropBack() {
    this._drop(this.sheets.shift());
    const first = this.sheets[0];
    if (first) {
      first.p = 1;
      first.started = true;
      first.elapsed = DURATION;
    }
  }

  /** Freeze the scene texture into one of the source's two GPU capture slots. */
  capture(texture) {
    if (this.disposed) return null;
    const pending = this.sheets.at(-1);
    if (pending && !pending.started) this._drop(this.sheets.pop());
    let slot = this.slots.findIndex(
      (_, slotIndex) =>
        !this.sheets.some((sheet) => sheet.kind === 'capture' && sheet.slot === slotIndex),
    );
    while (slot < 0 && this.sheets.length) {
      this._dropBack();
      slot = this.slots.findIndex(
        (_, slotIndex) =>
          !this.sheets.some((sheet) => sheet.kind === 'capture' && sheet.slot === slotIndex),
      );
    }
    const { width, height } = this._pixelSize();
    let snapshot = this.slots[slot];
    if (!snapshot || snapshot.width !== width || snapshot.height !== height) {
      snapshot?.dispose();
      snapshot = this.slots[slot] = this._makeTarget(width, height);
    }
    this._copy(texture, snapshot);
    const live = this.sheets.find((sheet) => sheet.kind === 'live');
    if (live) {
      live.kind = 'capture';
      live.slot = slot;
    } else
      this.sheets.push({ kind: 'capture', slot, p: 1, elapsed: DURATION, started: true, el: null });
    this.captureSerial += 1;
    this.clip();
    return snapshot.texture;
  }

  /** Start the arriving live page. Origin is normalized WebGL UV, bottom-left. */
  start(origin = [0.5, 0.5], { kind = 'live', element = null } = {}) {
    if (this.disposed) return false;
    if (!['live', 'dom'].includes(kind))
      throw new TypeError('PageWipe sheet kind must be live or dom');
    this.origin.set(clamp(origin[0] ?? 0.5), clamp(origin[1] ?? 0.5));
    this._updateFullRadius();
    const pending = this.sheets.at(-1);
    if (pending && !pending.started) this._drop(this.sheets.pop());
    if (!this.sheets.length) {
      // A DOM-only departure is the source's black/white back sheet. For GL
      // navigation call capture() before start() to retain the old scene.
      this.sheets.push({ kind: 'dom', p: 1, elapsed: DURATION, started: true, el: null });
    }
    for (; this.sheets.length >= MAX_SHEETS; ) this._dropBack();
    this.sheets.push({ kind, p: 0, elapsed: 0, started: true, el: element });
    this.clip();
    return true;
  }

  _advance(dt) {
    if (!this.sheets.length) return;
    const seconds = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    this.time += seconds;
    const completed = [];
    for (const sheet of this.sheets) {
      if (!sheet.started || sheet.elapsed >= DURATION) continue;
      sheet.elapsed = Math.min(DURATION, sheet.elapsed + seconds);
      sheet.p = sourceEase(sheet.elapsed / DURATION);
      if (sheet.elapsed >= DURATION) completed.push(sheet);
    }
    // A completed front sheet owns the frame; covered captures can go away.
    for (const sheet of completed) {
      const index = this.sheets.indexOf(sheet);
      if (index < 0) continue;
      for (const previous of this.sheets.splice(0, index)) this._drop(previous);
    }
    if (this.sheets.length === 1 && this.sheets[0].kind !== 'capture') this.rest();
    else this.clip();
  }

  /** Same CPU lobes and 128-segment even-odd polygon as source NU.clip. */
  lobes(angle) {
    return (
      Math.sin(angle * 3 + this.time * 0.7) * 0.6 + Math.sin(angle * 5 - this.time * 0.45) * 0.4
    );
  }

  ring(progress, width = this.width, height = this.height) {
    const p = clamp(progress);
    const amplitude = WAVE * Math.sin(Math.PI * p);
    const points = [];
    const centerX = this.origin.x * width;
    const centerY = (1 - this.origin.y) * height;
    for (let index = 0; index <= RING_POINTS; index += 1) {
      const angle = ((index % RING_POINTS) / RING_POINTS) * Math.PI * 2;
      const radius = (p * this.full + this.lobes(angle) * amplitude) * width;
      points.push(
        `${(centerX + radius * Math.cos(angle)).toFixed(1)}px ${(centerY - radius * Math.sin(angle)).toFixed(1)}px`,
      );
    }
    return points.join(',');
  }

  bind(element, { back = false } = {}) {
    const sheet = back
      ? this.sheets[0]
      : [...this.sheets].reverse().find((item) => item.kind === 'dom' && !item.el);
    if (!sheet) return false;
    sheet.el = element;
    this.clip();
    return true;
  }

  hold(element, release) {
    const sheet = this.sheets.find(
      (item) => item.kind === 'dom' && (item.el === element || !item.el),
    );
    if (!sheet) {
      release?.();
      return false;
    }
    sheet.el = element;
    sheet.release = release;
    return true;
  }

  clip() {
    if (!this.width || !this.height) return;
    this.sheets.forEach((sheet, index) => {
      if (!sheet.el) return;
      const next = this.sheets[index + 1];
      if (index === 0 && !next) {
        sheet.el.style.clipPath = '';
        return;
      }
      const own = index === 0 ? OUTER_POLYGON : this.ring(sheet.p);
      sheet.el.style.clipPath = next
        ? `polygon(evenodd,${own},${this.ring(next.p)})`
        : `polygon(${own})`;
    });
  }

  render(newTexture, { dt = 0, target } = {}) {
    if (this.disposed) return newTexture;
    this._advance(dt);
    if (!this.active) {
      if (target === undefined) return newTexture;
      return this._copy(newTexture, target);
    }
    const uniforms = this.material.uniforms;
    uniforms.u_live.value = newTexture;
    uniforms.u_a.value = this.slots[0]?.texture ?? newTexture;
    uniforms.u_b.value = this.slots[1]?.texture ?? newTexture;
    uniforms.u_time.value = this.time;
    for (let index = 0; index < MAX_SHEETS; index += 1) {
      const sheet = this.sheets[index];
      uniforms.u_kind.value[index] = !sheet
        ? 0
        : sheet.kind === 'capture'
          ? sheet.slot + 1
          : sheet.kind === 'live'
            ? 3
            : 4;
      uniforms.u_p.value[index] = sheet?.p ?? 0;
    }
    const output = target === undefined ? this._outputTarget() : target;
    if (
      output?.texture &&
      (output.texture === newTexture || this.slots.some((slot) => slot?.texture === output.texture))
    )
      throw new Error('PageWipe output must differ from its input textures');
    this._renderMaterial(this.material, output);
    return output?.texture ?? null;
  }

  abort() {
    if (this.disposed) return;
    this.rest();
  }

  rest() {
    for (const sheet of this.sheets) this._drop(sheet);
    this.sheets = [];
    for (let index = 0; index < this.slots.length; index += 1) {
      this.slots[index]?.dispose();
      this.slots[index] = null;
    }
    this.output?.dispose();
    this.output = null;
    this.time = 0;
  }

  dispose() {
    if (this.disposed) return;
    this.rest();
    this.disposed = true;
    this.geometry.dispose();
    this.material.dispose();
    this.copyMaterial.dispose();
  }
}
