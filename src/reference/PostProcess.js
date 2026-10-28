import * as THREE from 'three';
import {
  LENS_VERTEX,
  LENS_FRAGMENT,
  TRAIL_FRAGMENT,
  CARD_VERTEX,
  CARD_FRAGMENT,
  PROGRESS_VERTEX,
  PROGRESS_FRAGMENT,
  RAIL_VERTEX,
  RAIL_FRAGMENT,
  REFERENCE_HOLE,
} from './shaders.js';

/**
 * Minimal Three adapter for reference class gU, not a geometric ring.
 * GLSL and field equations originate in DZyj3ghP.js. The original application
 * is never imported. The approved UI fill is white by default. Exact-output
 * shortcuts skip inactive fields and pixels without visible refraction.
 *
 * Pipeline: render scene to pass.target -> pass.render(pass.target.texture, opts)
 * -> render the over/DOM UI. render leaves the selected output target active.
 * Center is bottom-left UV; radius is disc CSS width / (2 * viewport CSS width).
 * Opening/closing .85/.65s and the reference easing belong to the caller.
 */
export class LensPass {
  constructor(renderer, { backdrop = 0xffffff, depthBuffer = true } = {}) {
    this.renderer = renderer;
    this.width = this.height = this.dpr = 1;
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      colorSpace: THREE.NoColorSpace,
      depthBuffer,
      stencilBuffer: false,
    });
    this.empty = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.empty.needsUpdate = true;
    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();
    this.material = new THREE.ShaderMaterial({
      vertexShader: LENS_VERTEX,
      fragmentShader: LENS_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      uniforms: {
        u_scene: { value: this.target.texture },
        u_aspect: { value: new THREE.Vector2(1, 1) },
        u_time: { value: 0 },
        u_center: { value: new THREE.Vector2(0.5, 0.5) },
        u_p: { value: 0 },
        u_radius: { value: REFERENCE_HOLE.radius },
        u_lens: { value: REFERENCE_HOLE.lens },
        u_reach: { value: REFERENCE_HOLE.reach },
        u_orbit: { value: REFERENCE_HOLE.orbit },
        u_wave: { value: REFERENCE_HOLE.wave },
        u_aberr: { value: REFERENCE_HOLE.aberration },
        u_squash: { value: 0 },
        u_breath: { value: REFERENCE_HOLE.breath },
        u_ballA: { value: 0 },
        u_ballWarp: { value: 0.1 },
        u_ballShade: { value: 1.2 },
        u_ballEdge: { value: new THREE.Vector2(0.22, 0.5) },
        u_trail: { value: this.empty },
        u_trailTexel: { value: new THREE.Vector2(1 / 256, 1 / 256) },
        u_backdrop: { value: new THREE.Color(backdrop) },
      },
    });
    this.u = this.uniforms = this.material.uniforms;
    // The source shader returns an opaque, unchanged scene when both fields
    // are zero. Use that exact result without running its inactive lens math.
    this.copyMaterial = new THREE.ShaderMaterial({
      vertexShader: LENS_VERTEX,
      fragmentShader:
        'uniform sampler2D u_scene;varying vec2 vUv;void main(){gl_FragColor=vec4(texture2D(u_scene,vUv).rgb,1.0);}',
      uniforms: { u_scene: this.u.u_scene },
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(this.geometry, this.material);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.trailSide = 0;
    this.trailFrames = 0;
    this.trailFresh = false;
    this.trailDiss = 2.4;
    this.trailDiffuse = 40;
    this.trail = Array.from(
      { length: 2 },
      () =>
        new THREE.WebGLRenderTarget(256, 256, {
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          type: THREE.HalfFloatType,
          colorSpace: THREE.NoColorSpace,
          depthBuffer: false,
          stencilBuffer: false,
        }),
    );
    this.trailMaterial = new THREE.ShaderMaterial({
      vertexShader: LENS_VERTEX,
      fragmentShader: TRAIL_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        u_prev: { value: this.empty },
        u_texel: { value: new THREE.Vector2(1 / 256, 1 / 256) },
        u_decay: { value: 1 },
        u_diff: { value: 0 },
        u_pos: { value: new THREE.Vector2(0.5, 0.5) },
        u_amp: { value: 0 },
        u_rad: { value: 0.025 },
        u_aspect: { value: 1 },
      },
    });
    this.trailScene = new THREE.Scene();
    this.trailScene.add(new THREE.Mesh(this.geometry, this.trailMaterial));
    this._clearColor = new THREE.Color();
    this.disposed = false;
  }

  resize(width, height, dpr = this.renderer.getPixelRatio()) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dpr = Math.max(0.1, dpr);
    this.target.setSize(
      Math.max(1, Math.round(width * dpr)),
      Math.max(1, Math.round(height * dpr)),
    );
    this.u.u_aspect.value.set(this.width / this.height, 1);
    const trailHeight = Math.max(1, Math.round((256 * this.height) / this.width));
    this.trail.forEach((target) => target.setSize(256, trailHeight));
    this.trailFresh = false;
    this.trailMaterial.uniforms.u_texel.value.set(1 / 256, 1 / trailHeight);
    this.trailMaterial.uniforms.u_aspect.value = this.width / this.height;
    this.u.u_trailTexel.value.set(1 / 256, 1 / trailHeight);
  }

  /** Optional original ping-pong pointer field. Main hole does not require it. */
  stepTrail(dt, { position, amplitude = 0, radius = 0.025 } = {}) {
    const renderer = this.renderer;
    const previousTarget = renderer.getRenderTarget();
    const previousAlpha = renderer.getClearAlpha();
    renderer.getClearColor(this._clearColor);
    const previousAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    try {
      if (!this.trailFresh) {
        renderer.setClearColor(0x000000, 1);
        this.trail.forEach((target) => {
          renderer.setRenderTarget(target);
          renderer.clear();
        });
        this.trailFresh = true;
      }
      const from = this.trail[this.trailSide],
        to = this.trail[1 - this.trailSide];
      const u = this.trailMaterial.uniforms;
      if (position) u.u_pos.value.set(position.x ?? position[0], position.y ?? position[1]);
      u.u_amp.value = amplitude;
      u.u_rad.value = radius;
      u.u_prev.value = from.texture;
      u.u_decay.value = Math.exp(-this.trailDiss * dt);
      u.u_diff.value = 1 - Math.exp(-this.trailDiffuse * dt);
      renderer.setRenderTarget(to);
      renderer.render(this.trailScene, this.camera);
      this.trailFrames += 1;
      this.trailSide = 1 - this.trailSide;
      this.u.u_trail.value = to.texture;
    } finally {
      renderer.setRenderTarget(previousTarget);
      renderer.setClearColor(this._clearColor, previousAlpha);
      renderer.autoClear = previousAutoClear;
    }
  }

  render(
    texture = this.target.texture,
    {
      progress = 0,
      time = 0,
      center = [0.5, 0.5],
      radius = REFERENCE_HOLE.radius,
      squash = 0,
      backdrop,
      target = null,
      clear = true,
      ball = 0,
      trail = null,
      delta = 1 / 60,
    } = {},
  ) {
    if (this.disposed) return;
    if (trail) this.stepTrail(Math.min(Math.max(delta, 0), 1 / 20), trail);
    this.u.u_scene.value = texture;
    this.u.u_p.value = progress;
    this.u.u_time.value = time;
    this.u.u_center.value.set(center.x ?? center[0], center.y ?? center[1]);
    this.u.u_radius.value = radius;
    this.u.u_squash.value = squash;
    this.u.u_ballA.value = ball;
    this.quad.material = progress <= 0 && ball <= 0.001 ? this.copyMaterial : this.material;
    if (backdrop !== undefined) this.u.u_backdrop.value.set(backdrop);
    const autoClear = this.renderer.autoClear;
    this.renderer.autoClear = false;
    try {
      this.renderer.setRenderTarget(target);
      if (clear) this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
    } finally {
      this.renderer.autoClear = autoClear;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.target.dispose();
    this.trail.forEach((target) => target.dispose());
    this.material.dispose();
    this.copyMaterial.dispose();
    this.trailMaterial.dispose();
    this.geometry.dispose();
    this.empty.dispose();
  }
}

/** Reference gF material, with only the backdrop palette uniform added. */
export function createCardMaterial(texture, width = 1, height = 1, { backdrop = 0xffffff } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: CARD_VERTEX,
    fragmentShader: CARD_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      u_texture: { value: texture },
      u_size: { value: new THREE.Vector2(width, height) },
      u_res: { value: new THREE.Vector2(1, 1) },
      u_alpha: { value: 1 },
      u_shade: { value: 1 },
      u_shadeS: { value: 1 },
      u_corner: { value: 0 },
      u_hover: { value: 0 },
      u_dent: { value: 0 },
      u_white: { value: 0 },
      u_wash: { value: new THREE.Color(1, 1, 1) },
      u_scrim: { value: 0 },
      u_clip: { value: new THREE.Vector4() },
      u_clipR: { value: 0 },
      u_clipOn: { value: 0 },
      u_clipBow: { value: 0 },
      u_clipWarp: { value: new THREE.Vector3() },
      u_sheetW: { value: 0 },
      u_sheetD: { value: 0 },
      u_sheetV: { value: 0 },
      u_sheetT: { value: 1 },
      u_sheetC: { value: 1 },
      u_sheetP: { value: 1 },
      u_leanA: { value: 0 },
      u_leanW: { value: 0 },
      u_bulgeA: { value: 0 },
      u_bulgeH: { value: 0 },
      u_backdrop: { value: new THREE.Color(backdrop) },
    },
  });
}

/** Reference bF SDF progress material. Border/radius use fractions of plane height. */
export function createProgressMaterial({ color = 0x000000 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: PROGRESS_VERTEX,
    fragmentShader: PROGRESS_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      u_res: { value: new THREE.Vector2(1, 1) },
      u_alpha: { value: 0 },
      u_corner: { value: 0 },
      u_border: { value: 0 },
      u_p: { value: 0 },
      u_out: { value: 1 },
      u_outEnd: { value: 1 },
      u_draw: { value: 0 },
      u_spin: { value: 0 },
      u_track: { value: 0.2 },
      u_ink: { value: new THREE.Color(color) },
      u_clip: { value: new THREE.Vector4() },
      u_clipR: { value: 0 },
      u_clipOn: { value: 0 },
      u_clipBow: { value: 0 },
      u_clipWarp: { value: new THREE.Vector3() },
    },
  });
}

/** Reference LF crossfade/reveal material for the full-index hover image. */
export function createRailMaterial(texture, width = 1, height = 1, { backdrop = 0xffffff } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: RAIL_VERTEX,
    fragmentShader: RAIL_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      u_texA: { value: texture },
      u_texB: { value: texture },
      u_sizeA: { value: new THREE.Vector2(width, height) },
      u_sizeB: { value: new THREE.Vector2(width, height) },
      u_fade: { value: 0 },
      u_res: { value: new THREE.Vector2(1, 1) },
      u_alpha: { value: 0 },
      u_corner: { value: 0 },
      u_reveal: { value: 0 },
      u_shadeY: { value: 0.5 },
      u_shade: { value: 0 },
      u_bulgeA: { value: 0 },
      u_bulgeH: { value: 0 },
      u_backdrop: { value: new THREE.Color(backdrop) },
    },
  });
}

export default LensPass;
