import * as THREE from 'three';
import { RAIL_VERTEX, RAIL_FRAGMENT, REFERENCE_HOLE } from './shaders.js';
import { LensPass, createCardMaterial, createProgressMaterial } from './PostProcess.js';
import PageWipe from './PageWipe.js';
import PointerTrail from './PointerTrail.js';
import FullField from './FullField.js';
import AnimatedSky from './AnimatedSky.js';
import BootReveal from './BootReveal.js';
import { createVirtualScroll } from './scroll.js';
import { sourceEase, clamp, mix, deformPoint, smooth } from './motion.js';

export function caseVideoFrameReady(video) {
  return Boolean(
    video && !video.error && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0,
  );
}
export function caseMediaIsParked(element) {
  for (let current = element; current; current = current.parentElement)
    if (current._parked) return true;
  return false;
}

// React host for the source BU + jB render pipeline. Units, geometry, easing,
// deformation and per-element wrapping stay in the source's coordinate system.
export default class PortfolioScene {
  constructor(host, track, projects, callbacks) {
    Object.assign(this, { host, track, projects, callbacks });
    this.state = {
      mode: 'featured',
      overlay: null,
      project: null,
      phase: 'settled',
      filtersOpen: false,
    };
    this.cards = [];
    this.registry = new Map();
    this.visibleIds = new Set(projects.map((p) => p.id));
    this.destroyed = false;
    this.clock = 0;
    this.last = 0;
    this.hole = { p: 0, s: 0 };
    this.holeTween = null;
    this.holeElement = null;
    this.holeGroup = null;
    this.holeRetarget = null;
    this.holeGeometry = { center: [0.5, 0.5], radius: null };
    this.pointerPeak = 0;
    this.flight = null;
    this.projectId = null;
    this.velocity = 0;
    this.bulge = 0;
    this.modeAlpha = 1;
    this.pointer = { x: 0, y: 0, seen: false };
    this.railState = { x: null, y: null, vx: 0, vy: 0, reveal: 0, alpha: 0, index: -1, fade: 0 };
    this.cleanup = [];
    this.caseMedia = new Map();
    this.previewVideos = new Map();
    this.mediaLoader = new THREE.TextureLoader();
    this.bootReveal = new BootReveal(this, { enabled: Boolean(callbacks.bootEnabled) });
  }
  async start() {
    this.bootLoaded = 0;
    this.bootTotal = this.projects.length + 3;
    this.bootReady = false;
    this.callbacks.onBootProgress?.({
      loaded: 0,
      total: this.bootTotal,
      phase: 'Loading portfolio',
    });
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0xffffff, 1);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.host.prepend(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.over = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(53.4, 1, 0.1, 2000);
    this.camera.position.z = 41.18;
    this.camera.updateMatrixWorld();
    this.geo = new THREE.PlaneGeometry(1, 1, 24, 24);
    this.post = new LensPass(this.renderer);
    this.wipe = new PageWipe(this.renderer);
    this.pointerTrail = new PointerTrail(this.post, () => ({
      width: this.width,
      height: this.height,
      mouse: matchMedia('(hover: hover) and (pointer: fine)').matches,
    }));
    const loader = new THREE.TextureLoader();
    this.background = new AnimatedSky(this.scene, this.host);
    await this.background.start();
    if (this.destroyed) return;
    this.bootStep('Loading fonts');
    await document.fonts.ready;
    if (this.destroyed) return;
    this.bootStep('Loading projects');
    await Promise.all(
      this.projects.map(async (p, i) => {
        const tex = await loader.loadAsync(p.cover).catch(() => {
          const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
          blank.needsUpdate = true;
          blank.userData.loadFailed = true;
          return blank;
        });
        if (this.destroyed) {
          tex.dispose();
          return;
        }
        // Reference textures are sampled directly without a second output transfer.
        tex.colorSpace = THREE.NoColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        const el = this.track.children[i];
        el.style.setProperty(
          '--aspect',
          (p.coverWidth || tex.image.width) / (p.coverHeight || tex.image.height),
        );
        if (tex.userData.loadFailed) el.dataset.preview = 'unavailable';
        const material = createCardMaterial(tex, tex.image.width, tex.image.height);
        material.uniforms.u_backdrop?.value.setRGB(0.059, 0.059, 0.059);
        material.uniforms.u_dent.value = 0.1;
        const mesh = new THREE.Mesh(this.geo, material);
        mesh.frustumCulled = false;
        mesh.renderOrder = 10;
        mesh.layers.enable(1);
        this.scene.add(mesh);
        const label = this.makeLabel(p);
        label.mesh.layers.enable(1);
        this.scene.add(label.mesh);
        const hit = document.createElement('button');
        hit.className = 'gallery-hitarea';
        hit.setAttribute('aria-label', `Open ${p.title}`);
        hit.tabIndex = -1;
        this.host.append(hit);
        const entry = { p, el, mesh, tex, label, hit, aspect: tex.image.width / tex.image.height };
        this.cards[i] = entry;
        this.registry.set(p.id, entry);
        hit.onclick = (e) => this.activate(p, e);
        hit.onpointerenter = () => (entry.hover = true);
        hit.onpointerleave = () => (entry.hover = false);
        this.bootStep('Loading projects');
      }),
    );
    if (this.destroyed) return;
    this.resize();
    this.createScroll();
    this.watchCaseVideos();
    this.onResize = () => {
      this.invalidateLensReady();
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {
        const wasSmall = this.small;
        this.resize();
        if (wasSmall !== this.small) this.createScroll();
        else this.measure();
      }, 100);
    };
    window.addEventListener('resize', this.onResize);
    this.onPointer = (e) => {
      this.trackOverlayPointer(e);
      this.pointer = { x: e.clientX, y: e.clientY, seen: true, type: e.pointerType };
      this.pointerTrail.move(e.clientX, e.clientY, e.pointerType);
    };
    window.addEventListener('pointermove', this.onPointer);
    this.onLeave = (e) => this.pointerTrail.leave(e);
    document.documentElement.addEventListener('pointerleave', this.onLeave);
    this.watchOverlayDismiss();
    this.rail = this.makeRail();
    this.scene.add(this.rail);
    this.fullField = new FullField(this.scene, this.camera, this.renderer);
    this.veil = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader:
          'varying vec2 vUv;uniform float u_alpha;void main(){float g=smoothstep(.74,1.,vUv.y);g=max(g,smoothstep(.26,0.,vUv.y));gl_FragColor=vec4(vec3(1.),u_alpha*g*g);}',
        uniforms: { u_alpha: { value: 0 } },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.veil.renderOrder = 30;
    this.veil.frustumCulled = false;
    this.scene.add(this.veil);
    this.startRenderLoop();
  }
  // Keep animation time local to visible frames. A background tab must not
  // accumulate an enormous virtual-scroll ratio or fast-forward a lens flight.
  startRenderLoop() {
    if (this.destroyed) return;
    this.stopRenderLoop();
    const doc = this.host.ownerDocument || document;
    this.renderDocument = doc;
    const onFrame = (t) => {
      if (this.onFrame !== onFrame) return;
      this.raf = null;
      if (this.destroyed || doc.hidden) {
        this.last = 0;
        return;
      }
      try {
        this.tick(t);
      } catch (error) {
        this.callbacks.onBootError?.(error);
        console.error('Portfolio render:', error);
      }
    };
    this.onFrame = onFrame;
    this.onRenderVisibility = () => {
      this.last = 0;
      if (doc.hidden) {
        if (this.raf != null) cancelAnimationFrame(this.raf);
        this.raf = null;
      } else this.requestFrame();
    };
    doc.addEventListener('visibilitychange', this.onRenderVisibility);
    this.onRenderVisibility();
  }
  requestFrame() {
    if (this.destroyed || !this.onFrame || this.renderDocument?.hidden || this.raf != null) return;
    this.raf = requestAnimationFrame(this.onFrame);
  }
  stopRenderLoop() {
    if (this.raf != null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.last = 0;
    this.renderDocument?.removeEventListener('visibilitychange', this.onRenderVisibility);
    this.renderDocument = null;
    this.onRenderVisibility = null;
    this.onFrame = null;
  }
  refreshLayoutStyles() {
    // These values only change with layout, not the shared shader deformation.
    // Cache them with measurement instead of asking CSS twice per visible card.
    if (!this.cards.some(Boolean)) return;
    this.rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    for (const card of this.cards) {
      if (card) card.cornerRadius = parseFloat(getComputedStyle(card.el).borderRadius) || 0;
    }
  }
  bootStep(phase) {
    if (this.destroyed || this.bootReady) return;
    this.bootLoaded = Math.min(this.bootTotal, this.bootLoaded + 1);
    this.callbacks.onBootProgress?.({ loaded: this.bootLoaded, total: this.bootTotal, phase });
  }
  setBootProgress(progress) {
    this.bootReveal.setProgress(progress);
  }
  releaseBoot(rects) {
    return this.bootReveal.release(rects);
  }
  createScroll() {
    const old = this.scroll;
    const oldAxis = old?.axis;
    old?.destroy();
    this.scroll = createVirtualScroll({
      container: this.host,
      inner: this.track,
      items: () => this.visibleElements(),
      axis: this.small ? 'y' : 'x',
      finite: false,
      enabled: () =>
        !this.bootReveal.pending &&
        this.visibleIds.size > 1 &&
        !this.state.filtersOpen &&
        !this.state.overlay &&
        !this.state.project &&
        this.state.mode === 'featured',
      onUpdate: (s) => {
        this.velocity = s.velocity;
        const b = Math.tanh(s.velocity / (this.small ? 500 : 900));
        this.bulge = b * Math.abs(b) * 0.22 * this.H;
      },
    });
    this.scroll.axis = this.small ? 'y' : 'x';
    this.measure();
    if (this.visibleIds.size > 1) {
      if (old && oldAxis === this.scroll.axis) this.scroll.reset(old.current);
      else this.scroll.center(0);
    }
  }
  resize() {
    this.invalidateLensReady();
    this.width = document.documentElement.clientWidth;
    this.height = document.documentElement.clientHeight;
    this.small = this.width <= 649;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.H = Math.tan((53.4 * Math.PI) / 360) * 41.18;
    this.W = this.H * this.camera.aspect;
    this.post.resize(this.width, this.height, this.dpr);
    this.wipe?.resize(this.width, this.height, this.dpr);
    this.background?.resize(this.width, this.height);
  }
  visibleElements() {
    return Array.from(this.track.children).filter((el) => this.visibleIds.has(el.dataset.id));
  }
  setFilters(ids) {
    const known = new Set(this.projects.map((p) => p.id)),
      next = new Set(ids == null ? known : Array.from(ids).filter((id) => known.has(id)));
    if (next.size === this.visibleIds.size && [...next].every((id) => this.visibleIds.has(id)))
      return;
    this.visibleIds = next;
    for (const el of this.track.children) {
      const hidden = !next.has(el.dataset.id);
      el.hidden = hidden;
      el.style.display = hidden ? 'none' : '';
      if (hidden) {
        el._vrect = null;
        el._parked = true;
      }
    }
    for (const card of this.cards) {
      if (!card || next.has(card.p.id)) continue;
      card.hover = false;
      card.label.mesh.visible = false;
      card.hit.style.display = 'none';
      if (this.state.project?.id !== card.p.id && this.flight?.card !== card)
        card.mesh.visible = false;
    }
    this.measure();
    if (next.size > 1) this.scroll?.center(0);
  }
  measure() {
    this.refreshLayoutStyles();
    this.scroll?.measure();
    if (this.visibleIds.size > 1) return;
    this.scroll?.reset(0);
    this.velocity = 0;
    this.bulge = 0;
    const el = this.visibleElements()[0];
    if (!el) return;
    // A one-item loop wraps its own centre outside the viewport. Keep its real
    // DOM plane centred and its input disabled, without duplicating the project.
    el.style.transform = '';
    const base = el.getBoundingClientRect(),
      view = this.host.getBoundingClientRect(),
      left = view.left + (view.width - base.width) / 2,
      top = view.top + (view.height - base.height) / 2;
    el.style.transform = `translate3d(${left - base.left}px, ${top - base.top}px, 0px)`;
    el._vrect = {
      left,
      top,
      width: base.width,
      height: base.height,
      right: left + base.width,
      bottom: top + base.height,
    };
    el._parked = false;
  }
  setState(next) {
    const prev = this.state;
    this.state = { ...prev, ...next };
    if (prev.mode !== this.state.mode && this.post && !this.state.project) {
      this.wipe.capture(this.post.target.texture);
      this.wipe.start();
    }
    if (prev.overlay !== this.state.overlay) {
      this.invalidateLensReady();
      const group = this.state.overlay,
        element = group ? document.getElementById(`${group}-panel`) : null;
      if (group) {
        if (prev.overlay && this.hole.p > 0.05) this.retargetHole(element, group);
        else this.bindHole(element, group);
      } else {
        this.holeElement = null;
        this.holeRetarget = null;
      }
      if (Boolean(prev.overlay) !== Boolean(group))
        this.holeTween = {
          from: this.hole.p,
          to: group ? 1 : 0,
          start: this.clock,
          duration: group ? 0.85 : 0.65,
        };
      this.pointerTrail?.refreshShields();
    }
    if (prev.project?.id !== this.state.project?.id) {
      this.pointerPeak = 0;
      this.pointerTrail?.refreshShields();
    }
    if (prev.project?.id !== this.state.project?.id || prev.phase !== this.state.phase) {
      this.pendingTransition = true;
    }
  }
  holeTarget(element = this.holeElement) {
    const width = this.width || document.documentElement.clientWidth || 1,
      height = this.height || document.documentElement.clientHeight || 1,
      disc = this.host.querySelector('.lens-disc')?.getBoundingClientRect();
    if (element?.isConnected) {
      const rect = element.getBoundingClientRect();
      // The source binds a circular DOM disc around its text. These React panels
      // contain controls too, so derive that disc's envelope from the real layout.
      const diameter = Math.max(disc?.width || 0, Math.hypot(rect.width, rect.height) + 32);
      return {
        center: [(rect.left + rect.width / 2) / width, 1 - (rect.top + rect.height / 2) / height],
        radius: diameter / 2 / width,
      };
    }
    return {
      center: disc
        ? [(disc.left + disc.width / 2) / width, 1 - (disc.top + disc.height / 2) / height]
        : [0.5, 0.5],
      radius: disc?.width ? disc.width / 2 / width : 0.11,
    };
  }
  bindHole(element, group = null) {
    this.holeElement = element || null;
    this.holeGroup = group;
    this.holeRetarget = null;
    this.holeGeometry = this.holeTarget();
  }
  retargetHole(element, group = null) {
    if (!element || element === this.holeElement) return;
    this.holeRetarget = {
      from: {
        center: [...this.holeGeometry.center],
        radius: this.holeGeometry.radius ?? this.holeTarget().radius,
      },
      start: this.clock,
    };
    this.holeElement = element;
    this.holeGroup = group;
  }
  syncHole() {
    const target = this.holeTarget();
    if (this.holeRetarget) {
      const p = sourceEase(clamp((this.clock - this.holeRetarget.start) / 0.85)),
        from = this.holeRetarget.from;
      this.holeGeometry = {
        center: [
          mix(from.center[0], target.center[0], p),
          mix(from.center[1], target.center[1], p),
        ],
        radius: mix(from.radius, target.radius, p),
      };
      if (p >= 1) this.holeRetarget = null;
    } else if (this.holeElement?.isConnected || this.holeGeometry.radius === null)
      this.holeGeometry = target;
    const panel = this.holeElement,
      geometry = this.holeGeometry,
      width = this.width || document.documentElement.clientWidth || 1,
      height = this.height || document.documentElement.clientHeight || 1;
    let ready = false;
    if (this.state.overlay && panel?.isConnected && !this.holeRetarget) {
      const rect = panel.getBoundingClientRect(),
        cx = geometry.center[0] * width,
        cy = (1 - geometry.center[1]) * height;
      const required =
        Math.max(
          ...[rect.left, rect.right ?? rect.left + rect.width].flatMap((x) =>
            [rect.top, rect.bottom ?? rect.top + rect.height].map((y) =>
              Math.hypot(x - cx, y - cy),
            ),
          ),
        ) / width;
      // Worst-case original breath/lobes, so ready remains stable at full open.
      const safeRadius =
        this.hole.p * geometry.radius * (1 - REFERENCE_HOLE.breath) -
        REFERENCE_HOLE.wave * Math.abs(Math.sin(Math.PI * clamp(this.hole.p)));
      ready = safeRadius >= required;
    }
    this.lensReadyCandidate = ready;
    if (!ready) {
      this.lensStableFrames = 0;
      this.lensFrameSignature = null;
      this.publishLensReady(false);
    }
    return this.holeGeometry;
  }
  publishLensReady(ready) {
    const parent = this.host.closest?.('.portfolio') || this.host.parentElement;
    if (!parent) return;
    parent.dataset.lensReady = String(ready);
    parent.style.setProperty('--lens-content-opacity', ready ? '1' : '0');
  }
  outsideLens(x, y) {
    const width = this.width || document.documentElement.clientWidth || 1,
      height = this.height || document.documentElement.clientHeight || 1,
      geometry = this.holeGeometry.radius === null ? this.holeTarget() : this.holeGeometry;
    const dx = (x / width - geometry.center[0]) * (1 + this.hole.s),
      dy = (((1 - y / height - geometry.center[1]) * height) / width) * (1 - this.hole.s),
      angle = Math.atan2(dy, dx),
      p = clamp(this.hole.p);
    const lobes =
      Math.sin(angle * 3 + this.clock * 0.7) * 0.6 + Math.sin(angle * 5 - this.clock * 0.45) * 0.4;
    const radius =
      p * geometry.radius * (1 + REFERENCE_HOLE.breath * Math.sin(this.clock * 1.6)) +
      lobes * REFERENCE_HOLE.wave * Math.sin(Math.PI * p);
    return Math.hypot(dx, dy) > radius + REFERENCE_HOLE.reach;
  }
  overlayClickIgnored(target) {
    const doc = this.host.ownerDocument || document;
    return Boolean(
      doc.querySelector?.('[data-portfolio-popover]') ||
        target?.closest?.('.center-panel,.site-header,.site-footer,footer'),
    );
  }
  trackOverlayPointer(event) {
    const down = this.overlayPointer;
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) down.moved = true;
  }
  watchOverlayDismiss() {
    if (this.onOverlayDown) return;
    const doc = this.host.ownerDocument || document;
    this.overlayDocument = doc;
    this.onOverlayDown = (event) => {
      this.overlayPointer = null;
      if (
        !this.state.overlay ||
        this.state.project ||
        event.button !== 0 ||
        event.isPrimary === false ||
        this.overlayClickIgnored(event.target)
      )
        return;
      this.overlayPointer = {
        x: event.clientX,
        y: event.clientY,
        group: this.state.overlay,
        moved: false,
        outside: this.outsideLens(event.clientX, event.clientY),
      };
    };
    this.onOverlayCancel = () => {
      this.overlayPointer = null;
    };
    this.onOverlayClick = (event) => {
      const down = this.overlayPointer;
      this.overlayPointer = null;
      if (
        !down ||
        !down.outside ||
        down.moved ||
        event.detail === 0 ||
        event.defaultPrevented ||
        down.group !== this.state.overlay ||
        this.overlayClickIgnored(event.target) ||
        Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6 ||
        !this.outsideLens(event.clientX, event.clientY)
      )
        return;
      this.callbacks.onDismissOverlay?.();
    };
    doc.addEventListener('pointerdown', this.onOverlayDown, true);
    doc.addEventListener('pointercancel', this.onOverlayCancel, true);
    doc.addEventListener('click', this.onOverlayClick, true);
  }
  stopOverlayDismiss() {
    const doc = this.overlayDocument;
    if (!doc) return;
    doc.removeEventListener('pointerdown', this.onOverlayDown, true);
    doc.removeEventListener('pointercancel', this.onOverlayCancel, true);
    doc.removeEventListener('click', this.onOverlayClick, true);
    this.overlayPointer = null;
    this.overlayDocument = null;
    this.onOverlayDown = null;
    this.onOverlayCancel = null;
    this.onOverlayClick = null;
  }
  invalidateLensReady() {
    this.lensReadyCandidate = false;
    this.lensStableFrames = 0;
    this.lensFrameSignature = null;
    this.publishLensReady(false);
  }
  publishRenderedLensReady() {
    const width = document.documentElement.clientWidth,
      height = document.documentElement.clientHeight,
      canvas = this.renderer?.domElement?.getBoundingClientRect(),
      dpr = this.renderer?.getPixelRatio?.();
    const matched =
      this.width === width &&
      this.height === height &&
      this.post?.width === width &&
      this.post?.height === height &&
      Math.abs((canvas?.width || 0) - width) < 0.5 &&
      Math.abs((canvas?.height || 0) - height) < 0.5 &&
      this.post?.dpr === dpr;
    if (!matched || !this.lensReadyCandidate) {
      this.lensStableFrames = 0;
      this.lensFrameSignature = null;
      this.publishLensReady(false);
      return;
    }
    const signature = [
      width,
      height,
      dpr,
      this.holeGroup,
      ...this.holeGeometry.center.map((n) => n.toFixed(5)),
      this.holeGeometry.radius.toFixed(5),
    ].join(':');
    this.lensStableFrames =
      signature === this.lensFrameSignature ? (this.lensStableFrames || 0) + 1 : 1;
    this.lensFrameSignature = signature;
    this.publishLensReady(this.lensStableFrames >= 2);
  }
  activate(p, event) {
    if (
      this.bootReveal.pending ||
      this.state.filtersOpen ||
      this.state.overlay ||
      this.state.project ||
      !this.visibleIds.has(p.id)
    )
      return;
    if (this.scroll?.dragged || event?.defaultPrevented) return;
    this.callbacks.onOpen(p);
  }
  pose(rect) {
    return {
      position: new THREE.Vector3(
        -this.W + (this.W * 2 * (rect.left + rect.width / 2)) / this.width,
        this.H - (this.H * 2 * (rect.top + rect.height / 2)) / this.height,
        0,
      ),
      scale: new THREE.Vector3(
        (this.W * 2 * rect.width) / this.width,
        (this.H * 2 * rect.height) / this.height,
        1,
      ),
    };
  }
  rect(mesh) {
    return {
      left: ((mesh.position.x - mesh.scale.x / 2 + this.W) / (this.W * 2)) * this.width,
      top: ((this.H - mesh.position.y - mesh.scale.y / 2) / (this.H * 2)) * this.height,
      width: (mesh.scale.x / (this.W * 2)) * this.width,
      height: (mesh.scale.y / (this.H * 2)) * this.height,
    };
  }
  applyRect(mesh, rect) {
    const p = this.pose(rect);
    mesh.position.copy(p.position);
    mesh.scale.copy(p.scale);
    mesh.material.uniforms.u_res.value.set(p.scale.x, p.scale.y);
  }
  sheetUniforms(u, p = 1) {
    const v = Math.abs(Math.tanh(this.velocity / (this.small ? 245 : 550))) ** 2;
    u.u_sheetW.value = this.small ? 0 : this.W;
    u.u_sheetD.value = this.small ? 0 : this.W * 0.2 * (1 + 1.1 * v);
    u.u_sheetT.value = 1.15;
    u.u_sheetC.value = 1;
    u.u_sheetV.value = v;
    u.u_sheetP.value = p;
    u.u_leanA.value = this.small ? 0 : this.W * -0.12;
    u.u_leanW.value = this.small ? 0 : this.W;
    u.u_bulgeA.value = this.small ? this.bulge * 1.3 : 0;
    u.u_bulgeH.value = this.H;
  }
  makeLabel(project) {
    // Labels occupy the exact card plane, so every vertex shares its position,
    // hover dent, sheet bend and perspective. A separate short strip drifts.
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.NoColorSpace;
    const m = createCardMaterial(tex, 1, 1);
    m.fragmentShader = `uniform sampler2D u_texture;uniform float u_alpha;varying vec2 vUv;void main(){vec4 t=texture2D(u_texture,vUv);gl_FragColor=vec4(t.rgb,t.a*u_alpha);}`;
    m.uniforms.u_shade.value = 0;
    const mesh = new THREE.Mesh(this.geo, m);
    mesh.frustumCulled = false;
    mesh.renderOrder = 11;
    return {
      mesh,
      tex,
      canvas,
      title: project.title,
      tags: project.tags || [project.category],
      width: 0,
      height: 0,
    };
  }
  resizeLabel(label, width, height, rem) {
    const pixelW = Math.max(1, Math.round(width * 2)),
      pixelH = Math.max(1, Math.round(height * 2));
    if (label.width === pixelW && label.height === pixelH && label.rem === rem) return;
    label.tex.dispose();
    const c = label.canvas;
    c.width = pixelW;
    c.height = pixelH;
    label.width = pixelW;
    label.height = pixelH;
    label.rem = rem;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    const pad = 2 * rem,
      radius = 1.25 * rem,
      cx = width - pad - radius,
      cy = height - pad - radius;
    ctx.fillStyle = '#fff';
    ctx.font = `500 ${(this.small ? 1.6 : 1.8) * rem}px "DM Sans"`;
    ctx.textBaseline = 'middle';
    ctx.fillText(label.title, pad, cy, width - 2 * pad - 4 * rem);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 0.13 * rem;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 0.42 * rem, cy);
    ctx.lineTo(cx + 0.42 * rem, cy);
    ctx.moveTo(cx + 0.08 * rem, cy - 0.34 * rem);
    ctx.lineTo(cx + 0.42 * rem, cy);
    ctx.lineTo(cx + 0.08 * rem, cy + 0.34 * rem);
    ctx.stroke();
    ctx.font = `500 ${1.05 * rem}px "DM Sans"`;
    ctx.textBaseline = 'middle';
    let x = pad,
      y = pad;
    const tagH = 2.2 * rem;
    for (const tag of label.tags) {
      const text = tag.toUpperCase(),
        w = ctx.measureText(text).width + 1.7 * rem;
      if (x + w > width - pad) {
        x = pad;
        y += tagH + 0.5 * rem;
      }
      ctx.fillStyle = 'rgba(0,0,0,.65)';
      ctx.beginPath();
      ctx.roundRect(x, y, w, tagH, tagH / 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(text, x + 0.85 * rem, y + tagH / 2);
      x += w + 0.5 * rem;
    }
    label.tex.needsUpdate = true;
  }
  previewSurface(card) {
    const texture = card.previewTexture || card.tex,
      image = texture.image;
    return {
      texture,
      width: image.videoWidth || image.width || 1,
      height: image.videoHeight || image.height || 1,
    };
  }
  setRailSurface(card, index = this.cards.indexOf(card)) {
    if (!this.rail || !card) return;
    const r = this.railState,
      u = this.rail.material.uniforms,
      surface = this.previewSurface(card);
    if (index !== r.index || u.u_texB.value !== surface.texture) {
      u.u_texA.value = u.u_texB.value;
      u.u_sizeA.value.copy(u.u_sizeB.value);
      u.u_texB.value = surface.texture;
      u.u_sizeB.value.set(surface.width, surface.height);
      r.index = index;
      r.fade = 0;
      u.u_fade.value = 0;
    }
  }
  pausePreviewVideos() {
    for (const entry of this.previewVideos.values()) {
      entry.playWanted = false;
      entry.playAttempted = false;
      entry.video.pause();
    }
  }
  disposePreviewVideo(card) {
    const entry = this.previewVideos.get(card.p.id);
    if (!entry) return;
    entry.retired = true;
    entry.playWanted = false;
    entry.video.pause();
    entry.video.removeEventListener('error', entry.onError);
    card.previewTexture = null;
    const surface = this.previewSurface(card),
      u = card.mesh.material.uniforms;
    u.u_texture.value = surface.texture;
    u.u_size.value.set(surface.width, surface.height);
    if (entry.texture && this.rail) {
      const rail = this.rail.material.uniforms;
      for (const side of ['A', 'B'])
        if (rail[`u_tex${side}`].value === entry.texture) {
          rail[`u_tex${side}`].value = surface.texture;
          rail[`u_size${side}`].value.set(surface.width, surface.height);
        }
    }
    entry.texture?.dispose();
    entry.video.removeAttribute('src');
    entry.video.load();
    this.previewVideos.delete(card.p.id);
    delete card.el.dataset.previewVideo;
    delete card.el.dataset.previewTime;
  }
  syncPreviewVideos() {
    const policy = !document.hidden && !this.caseMotionQuery?.matches;
    for (const card of this.cards) {
      if (!card) continue;
      const source =
        typeof card.p.coverVideo === 'string' ? card.p.coverVideo : card.p.coverVideo?.src;
      let entry = this.previewVideos.get(card.p.id);
      if (entry && entry.source !== source) {
        this.disposePreviewVideo(card);
        entry = null;
      }
      if (!source && !entry) continue;
      const r = card.el._vrect || card.el.getBoundingClientRect(),
        inViewport =
          r.width > 0 &&
          r.height > 0 &&
          r.left < this.width &&
          r.top < this.height &&
          (r.right ?? r.left + r.width) > 0 &&
          (r.bottom ?? r.top + r.height) > 0;
      const available =
        policy &&
        this.visibleIds.has(card.p.id) &&
        !this.state.project &&
        !this.flight &&
        !this.state.overlay &&
        !this.state.filtersOpen;
      const featured =
        this.state.mode === 'featured' && card.mesh.visible && !card.el._parked && inViewport;
      const full =
        this.state.mode === 'full' && this.rail?.visible && this.railProjectId === card.p.id;
      const wanted = available && (featured || full);
      if (!entry && wanted) {
        const video = document.createElement('video');
        video.muted = video.defaultMuted = true;
        video.loop = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';
        video.setAttribute('playsinline', '');
        entry = { video, source, loaded: false };
        entry.onError = () => {
          entry.failed = true;
          video.pause();
        };
        video.addEventListener('error', entry.onError);
        video.src = source;
        this.previewVideos.set(card.p.id, entry);
      }
      if (!entry) continue;
      this.syncCasePlayback(entry, wanted && !entry.failed);
      entry.loaded = policy && !entry.failed && caseVideoFrameReady(entry.video);
      if (entry.loaded && !entry.texture) {
        const tex = new THREE.VideoTexture(entry.video);
        tex.colorSpace = THREE.NoColorSpace;
        tex.minFilter = tex.magFilter = THREE.LinearFilter;
        tex.needsUpdate = true;
        entry.texture = tex;
      }
      card.previewTexture = entry.loaded ? entry.texture : null;
      const surface = this.previewSurface(card),
        u = card.mesh.material.uniforms;
      u.u_texture.value = surface.texture;
      u.u_size.value.set(surface.width, surface.height);
      card.el.dataset.previewVideo =
        entry.failed || entry.video.error
          ? 'error'
          : entry.loaded
            ? entry.video.paused
              ? 'paused'
              : 'playing'
            : 'poster';
      if (import.meta.env?.DEV)
        card.el.dataset.previewTime = Number(entry.video.currentTime || 0).toFixed(3);
    }
    if (this.railProjectId) this.setRailSurface(this.registry.get(this.railProjectId));
  }
  makeRail() {
    const m = new THREE.ShaderMaterial({
      vertexShader: RAIL_VERTEX,
      fragmentShader: RAIL_FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        u_texA: { value: this.cards[0].tex },
        u_texB: { value: this.cards[0].tex },
        u_sizeA: { value: new THREE.Vector2(1, 1) },
        u_sizeB: { value: new THREE.Vector2(1, 1) },
        u_fade: { value: 0 },
        u_res: { value: new THREE.Vector2(1, 1) },
        u_alpha: { value: 1 },
        u_corner: { value: 0.03 },
        u_reveal: { value: 0 },
        u_shadeY: { value: 0.5 },
        u_shade: { value: 0.6 },
        u_backdrop: { value: new THREE.Color(1, 1, 1) },
        u_bulgeA: { value: 0 },
        u_bulgeH: { value: this.H },
      },
    });
    const mesh = new THREE.Mesh(this.geo, m);
    mesh.frustumCulled = false;
    mesh.renderOrder = 20;
    mesh.visible = false;
    return mesh;
  }
  syncRail(dt) {
    if (!this.rail) return;
    const r = this.railState,
      p = this.pointer;
    // Touch and compact layouts never claim the cursor preview, including after
    // resizing a desktop view while its rail was already visible.
    if (
      this.width <= 767 ||
      p?.type === 'touch' ||
      !matchMedia('(hover: hover) and (pointer: fine)').matches
    ) {
      r.reveal = 0;
      this.rail.visible = false;
      this.rail.material.uniforms.u_reveal.value = 0;
      this.railProjectId = null;
      return;
    }
    const buttons = [...document.querySelectorAll('.full-index button[data-project-id]')];
    const follow = 1 - Math.exp(-10 * dt);
    let reveal = 0;
    if (
      this.state.mode === 'full' &&
      !this.state.project &&
      !this.state.overlay &&
      !this.state.filtersOpen &&
      p?.seen !== false &&
      buttons.length
    ) {
      const rects = buttons.map((e) => e.getBoundingClientRect()),
        left = Math.min(...rects.map((r) => r.left)),
        right = Math.max(...rects.map((r) => r.right)),
        top = Math.min(...rects.map((r) => r.top)),
        bottom = Math.max(...rects.map((r) => r.bottom));
      const dist = Math.hypot(
        Math.max(left - p.x, 0, p.x - right),
        Math.max(top - p.y, 0, p.y - bottom),
      );
      reveal = 1 - smooth(0, 14 * (this.rem || 16), dist);
    }
    const hovered = this.cards[this.state.hovered ?? 0],
      card = buttons.some((button) => button.dataset.projectId === hovered?.p.id)
        ? hovered
        : this.registry.get(buttons[0]?.dataset.projectId) || hovered || this.cards[0],
      index = this.cards.indexOf(card),
      u = this.rail.material.uniforms;
    this.railProjectId = card.p.id;
    r.reveal = mix(r.reveal, reveal, follow);
    this.rail.visible = r.reveal > 0.001 && !this.flight;
    this.setRailSurface(card, index);
    r.fade = Math.min(1, r.fade + dt / 0.35);
    u.u_fade.value = 1 - (1 - r.fade) ** 2;
    u.u_reveal.value = r.reveal;
    u.u_alpha.value = 1;
    if (!this.rail.visible) return;
    const prevX = r.x ?? p.x,
      prevY = r.y ?? p.y;
    r.x = mix(prevX, p.x, follow);
    r.y = mix(prevY, p.y, follow);
    const h = 20 * (this.rem || 16),
      aspect = r.aspect == null ? card.aspect : mix(r.aspect, card.aspect, 1 - Math.exp(-9 * dt));
    r.aspect = aspect;
    this.applyRect(this.rail, {
      left: r.x - (h * aspect) / 2,
      top: r.y - h / 2,
      width: h * aspect,
      height: h,
    });
    const worldPerPixel = (this.H * 2) / this.height;
    r.vx = mix(r.vx, ((r.x - prevX) * worldPerPixel) / Math.max(dt, 0.001), 1 - Math.exp(-8 * dt));
    r.vy = mix(r.vy, (-(r.y - prevY) * worldPerPixel) / Math.max(dt, 0.001), 1 - Math.exp(-8 * dt));
    this.rail.rotation.x = -Math.tanh(r.vy / 25) * 0.35;
    this.rail.rotation.y =
      Math.tanh(r.vx / 25) * 0.35 + (1 - r.reveal) * (p.x < this.width / 2 ? 1 : -1) * 0.35;
    const row = buttons
      .find((button) => button.dataset.projectId === card.p.id)
      ?.getBoundingClientRect();
    if (row) u.u_shadeY.value = 1 - (row.top + row.height / 2 - (r.y - h / 2)) / h;
  }
  startTransition() {
    const { project, phase } = this.state;
    if (!project) return;
    const card = this.registry.get(project.id),
      target = document.querySelector('[data-flip-target="true"]');
    if (!card || !target) return;
    const mesh = card.mesh,
      u = mesh.material.uniforms;
    if (phase === 'opening') {
      // A Full hover rail hands its actual rect and quaternion to the shared plane.
      if (this.state.mode === 'full' && this.rail?.visible) {
        this.applyRect(mesh, this.rect(this.rail));
        mesh.quaternion.copy(this.rail.quaternion);
        u.u_sheetP.value = 0;
        u.u_white.value = 0;
      } else if (this.projectId && this.projectId !== project.id) {
        this.applyRect(mesh, {
          left: this.width * 1.1,
          top: this.height * 0.1,
          width: this.width * 0.8,
          height: this.height * 0.8,
        });
        u.u_sheetP.value = 0;
        u.u_white.value = 1;
      }
      this.projectId = project.id;
    }
    if (phase !== 'opening' && phase !== 'closing') {
      this.pendingTransition = false;
      return;
    }
    this.flight = {
      card,
      start: this.clock,
      phase,
      from: this.rect(mesh),
      fromPosition: mesh.position.clone(),
      fromScale: mesh.scale.clone(),
      quat: mesh.quaternion.clone(),
      white: u.u_white.value,
      shade: u.u_shade.value,
      sheet: u.u_sheetP.value,
      corner: u.u_corner.value,
      element: target,
    };
    mesh.renderOrder = 100;
    mesh.visible = true;
    u.u_wash.value.setRGB(0.031, 0.031, 0.031);
    this.pendingTransition = false;
  }
  syncFlight() {
    if (!this.flight) return;
    const f = this.flight,
      { mesh, el } = f.card,
      u = mesh.material.uniforms,
      p = sourceEase(clamp((this.clock - f.start) / 1));
    const target =
      f.phase === 'opening'
        ? f.element.getBoundingClientRect()
        : el._vrect || el.getBoundingClientRect();
    const rect = {
      left: mix(f.from.left, target.left, p),
      top: mix(f.from.top, target.top, p),
      width: mix(f.from.width, target.width, p),
      height: mix(f.from.height, target.height, p),
    };
    this.applyRect(mesh, rect);
    mesh.quaternion.slerpQuaternions(f.quat, new THREE.Quaternion(), p);
    this.sheetUniforms(u, mix(f.sheet, f.phase === 'opening' ? 0 : 1, p));
    u.u_bulgeA.value = 0;
    u.u_white.value = mix(f.white, f.phase === 'opening' ? 1 : 0, Math.min(1, p * 1.08));
    u.u_shade.value = mix(f.shade, f.phase === 'opening' ? 0 : 1, p);
    u.u_alpha.value = 1;
    const targetRadius =
      parseFloat(getComputedStyle(f.phase === 'opening' ? f.element : el).borderRadius) || 0;
    u.u_corner.value = mix(f.corner * f.from.height, targetRadius, p) / Math.max(1, rect.height);
    if (p >= 0.9999) {
      mesh.renderOrder = 10;
      this.flight = null;
      if (f.phase === 'closing') this.projectId = null;
      this.callbacks.onTransitionEnd(f.phase);
    }
  }
  syncHit(card) {
    const { mesh, hit } = card;
    if (
      this.bootReveal.pending ||
      this.state.filtersOpen ||
      this.state.overlay ||
      this.state.project ||
      this.state.mode === 'full' ||
      !this.visibleIds.has(card.p.id) ||
      !mesh.visible
    ) {
      hit.style.display = 'none';
      return;
    }
    mesh.updateMatrixWorld();
    const points = [];
    for (const side of [0, 1, 2, 3])
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        let x, y;
        if (side === 0) {
          x = t - 0.5;
          y = 0.5;
        }
        if (side === 1) {
          x = 0.5;
          y = 0.5 - t;
        }
        if (side === 2) {
          x = 0.5 - t;
          y = -0.5;
        }
        if (side === 3) {
          x = -0.5;
          y = t - 0.5;
        }
        const world = new THREE.Vector3(x, y, 0).applyMatrix4(mesh.matrixWorld),
          d = deformPoint(world, mesh.material.uniforms),
          v = new THREE.Vector3(d.x, d.y, d.z).project(this.camera);
        points.push({ x: (v.x * 0.5 + 0.5) * this.width, y: (0.5 - v.y * 0.5) * this.height });
      }
    const left = Math.min(...points.map((p) => p.x)),
      top = Math.min(...points.map((p) => p.y)),
      width = Math.max(...points.map((p) => p.x)) - left,
      height = Math.max(...points.map((p) => p.y)) - top;
    Object.assign(hit.style, {
      display: 'block',
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      clipPath: `polygon(${points.map((p) => `${((p.x - left) / width) * 100}% ${((p.y - top) / height) * 100}%`).join(',')})`,
    });
  }
  watchCaseVideos() {
    this.caseMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    this.onCaseVideoPolicy = () => {
      if (document.hidden || this.caseMotionQuery.matches) {
        this.pauseCaseVideos();
        this.pausePreviewVideos();
      }
    };
    this.onCaseVideoGesture = () => {
      for (const entry of [...this.caseMedia.values(), ...this.previewVideos.values()])
        if (entry.playFailed) {
          entry.playFailed = false;
          entry.playAttempted = false;
        }
    };
    document.addEventListener('visibilitychange', this.onCaseVideoPolicy);
    this.caseMotionQuery.addEventListener('change', this.onCaseVideoPolicy);
    document.addEventListener('pointerdown', this.onCaseVideoGesture, { passive: true });
    document.addEventListener('keydown', this.onCaseVideoGesture);
  }
  stopCaseVideos() {
    document.removeEventListener('visibilitychange', this.onCaseVideoPolicy);
    this.caseMotionQuery?.removeEventListener('change', this.onCaseVideoPolicy);
    document.removeEventListener('pointerdown', this.onCaseVideoGesture);
    document.removeEventListener('keydown', this.onCaseVideoGesture);
    this.pauseCaseVideos();
    this.pausePreviewVideos();
  }
  pauseCaseVideos() {
    for (const entry of this.caseMedia.values())
      if (entry.video) {
        entry.playWanted = false;
        entry.playAttempted = false;
        entry.video.pause();
      }
  }
  syncCasePlayback(entry, visible) {
    const video = entry.video;
    if (!video) return;
    entry.playWanted = Boolean(
      visible && !document.hidden && !this.caseMotionQuery?.matches && !video.error,
    );
    if (!entry.playWanted) {
      entry.playAttempted = false;
      if (!video.paused) video.pause();
      return;
    }
    if (!video.paused || entry.playAttempted) return;
    entry.playAttempted = true;
    try {
      Promise.resolve(video.play())
        .then(() => {
          if (entry.retired || !entry.playWanted) video.pause();
        })
        .catch(() => {
          entry.playFailed = true;
        });
    } catch {
      entry.playFailed = true;
    }
  }
  retireCaseMedia(key, entry) {
    entry.retired = true;
    entry.playWanted = false;
    entry.video?.pause();
    entry.dom?.classList.remove('gl-media-ready');
    entry.texture?.dispose();
    entry.mesh.material.dispose();
    this.scene.remove(entry.mesh);
    this.caseMedia.delete(key);
  }
  syncCase() {
    const view = document.querySelector('.case-view'),
      sheet = view?.querySelector('.case-sheet');
    const active = this.state.project && this.registry.get(this.state.project.id);
    for (const entry of this.caseMedia.values()) {
      entry.mesh.visible = false;
      entry.frameSeen = false;
    }
    if (!sheet || !active) {
      for (const [key, entry] of this.caseMedia) this.retireCaseMedia(key, entry);
      return;
    }
    view.classList.add('gl-case-ready');
    for (const [key, e] of this.caseMedia) {
      if (
        !key.startsWith(this.state.project.id + ':') ||
        !e.el?.isConnected ||
        !e.dom?.isConnected ||
        e.dom.getAttribute('src') !== e.source
      )
        this.retireCaseMedia(key, e);
    }
    const rect = sheet.getBoundingClientRect(),
      radius = parseFloat(getComputedStyle(sheet).borderRadius) || 0,
      velocity = Number(view.dataset.scrollVelocity) || 0,
      b = Math.tanh(velocity / (this.small ? 500 : 900)),
      bulge = b * Math.abs(b) * 0.22 * this.H;
    if (!this.flight && this.state.phase === 'settled') {
      this.applyRect(active.mesh, rect);
      active.mesh.quaternion.identity();
      const u = active.mesh.material.uniforms;
      this.sheetUniforms(u, 0);
      u.u_bulgeA.value = bulge * 0.3;
      u.u_bulgeH.value = this.H;
      u.u_alpha.value = 1;
      u.u_white.value = 1;
      u.u_shade.value = 0;
      u.u_wash.value.setRGB(0.031, 0.031, 0.031);
      u.u_corner.value = radius / rect.height;
      active.mesh.visible = true;
      active.mesh.renderOrder = 100;
    }
    if (this.state.phase !== 'settled') {
      this.pauseCaseVideos();
      return;
    }
    const casePlayable = !document.querySelector('.lightbox, [data-lightbox-open="true"]');
    for (const el of view.querySelectorAll('.case-media-item')) {
      const video = el.querySelector('video'),
        img = video ? null : el.querySelector('img'),
        src = video?.getAttribute('src') || img?.getAttribute('src');
      if (!src) continue;
      if (/\.gif(?:$|\?)/i.test(src)) {
        img?.classList.remove('gl-media-ready');
        continue;
      }
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      const parked = caseMediaIsParked(el),
        slot = el.dataset?.caseSlot ?? Array.from(el.parentElement.children).indexOf(el),
        key = this.state.project.id + ':' + src + ':' + slot;
      let entry = this.caseMedia.get(key);
      if (
        !entry &&
        (parked || r.top > rect.bottom + rect.height || r.bottom < rect.top - rect.height)
      )
        continue;
      if (!entry) {
        const m = createCardMaterial(null, 1, 1);
        m.uniforms.u_white.value = 0;
        m.uniforms.u_shade.value = 0;
        m.uniforms.u_sheetP.value = 0;
        const mesh = new THREE.Mesh(this.geo, m);
        mesh.frustumCulled = false;
        mesh.renderOrder = 110;
        mesh.visible = false;
        this.scene.add(mesh);
        entry = { mesh, loaded: false, el, dom: video || img, source: src, video };
        this.caseMedia.set(key, entry);
        if (!video)
          this.mediaLoader.load(src, (tex) => {
            if (this.destroyed || entry.retired) {
              tex.dispose();
              return;
            }
            if (Math.max(tex.image.width, tex.image.height) > 2560) {
              const scale = 2560 / Math.max(tex.image.width, tex.image.height),
                canvas = document.createElement('canvas');
              canvas.width = Math.round(tex.image.width * scale);
              canvas.height = Math.round(tex.image.height * scale);
              canvas.getContext('2d').drawImage(tex.image, 0, 0, canvas.width, canvas.height);
              tex.image = canvas;
              tex.needsUpdate = true;
            }
            tex.colorSpace = THREE.NoColorSpace;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            entry.texture = tex;
            m.uniforms.u_texture.value = tex;
            m.uniforms.u_size.value.set(tex.image.width, tex.image.height);
            entry.loaded = true;
          });
      }
      entry.frameSeen = true;
      const visible =
        !parked &&
        r.bottom > Math.max(0, rect.top) &&
        r.top < Math.min(this.height, rect.bottom) &&
        r.right > Math.max(0, rect.left) &&
        r.left < Math.min(this.width, rect.right);
      if (video) {
        this.syncCasePlayback(entry, visible && casePlayable);
        entry.loaded = caseVideoFrameReady(video);
        if (!entry.loaded) {
          video.classList.remove('gl-media-ready');
          continue;
        }
        if (!entry.texture) {
          const tex = new THREE.VideoTexture(video);
          tex.colorSpace = THREE.NoColorSpace;
          tex.minFilter = tex.magFilter = THREE.LinearFilter;
          tex.needsUpdate = true;
          entry.texture = tex;
          entry.mesh.material.uniforms.u_texture.value = tex;
        }
      }
      if (!entry.loaded) continue;

      if (img) img.classList.add('gl-media-ready');
      if (video) {
        entry.mesh.material.uniforms.u_size.value.set(
          video.videoWidth || r.width,
          video.videoHeight || r.height,
        );
        video.classList.add('gl-media-ready');
      }
      if (
        (video && !visible) ||
        parked ||
        r.top > rect.bottom + rect.height * 0.5 ||
        r.bottom < rect.top - rect.height * 0.5
      )
        continue;
      this.applyRect(entry.mesh, r);
      const u = entry.mesh.material.uniforms;
      this.sheetUniforms(u, 0);
      u.u_sheetW.value = 0;
      u.u_sheetD.value = 0;
      u.u_leanW.value = 0;
      u.u_bulgeA.value = bulge * 1.3;
      u.u_bulgeH.value = this.H;
      u.u_alpha.value = 1;
      u.u_clipOn.value = 1;
      u.u_clip.value.set(
        rect.left * this.dpr,
        (this.height - rect.bottom) * this.dpr,
        rect.width * this.dpr,
        rect.height * this.dpr,
      );
      u.u_clipR.value = radius * this.dpr;
      u.u_clipBow.value = (bulge * 0.3) / 41.18;
      u.u_clipWarp.value.set(
        (this.width * this.dpr) / 2,
        (this.height * this.dpr) / 2,
        (this.height * this.dpr) / 2,
      );
      entry.mesh.visible = true;
    }
    for (const entry of this.caseMedia.values())
      if (entry.video && !entry.frameSeen) this.syncCasePlayback(entry, false);
  }
  syncProgress(dt) {
    const el = document.querySelector('[data-gl-progress]');
    if (!el) {
      if (this.progressGL) {
        this.progressGL.element?.classList.remove('gl-progress-ready');
        this.progressGL.renderer.domElement.remove();
        this.progressGL.element = null;
      }
      return;
    }
    if (this.progressGLFailed) return;
    if (!this.progressGL) {
      try {
        // A DOM-contained canvas is above the case surface. Rendering this in the
        // main overScene would leave it underneath the opaque case DOM.
        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: 'low-power',
        });
        renderer.autoClear = false;
        renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
        renderer.setClearColor(0x000000, 0);
        renderer.debug.onShaderError = () => {
          this.progressGLFailed = true;
          this.progressGL?.element?.classList.remove('gl-progress-ready');
          renderer.domElement.style.display = 'none';
        };
        const geometry = new THREE.PlaneGeometry(1, 1),
          material = createProgressMaterial({ color: 0xffffff });
        const scene = new THREE.Scene(),
          camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 2);
        camera.position.z = 1;
        const mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;
        scene.add(mesh);
        Object.assign(renderer.domElement.style, {
          position: 'absolute',
          inset: '0',
          width: '100%',
          height: '100%',
          display: 'block',
          pointerEvents: 'none',
        });
        renderer.domElement.setAttribute('aria-hidden', 'true');
        const gl = {
          renderer,
          geometry,
          material,
          scene,
          camera,
          mesh,
          element: null,
          draw: 0,
          value: 0,
          read: undefined,
          out: 1,
          outEnd: 1,
          rev: false,
          reset: null,
        };
        gl.lost = (event) => {
          event.preventDefault();
          this.progressGLFailed = true;
          gl.element?.classList.remove('gl-progress-ready');
          renderer.domElement.style.display = 'none';
        };
        renderer.domElement.addEventListener('webglcontextlost', gl.lost);
        this.progressGL = gl;
      } catch {
        this.progressGLFailed = true;
        return;
      }
    }
    const gl = this.progressGL,
      rect = el.getBoundingClientRect();
    if (gl.element !== el) {
      gl.element?.classList.remove('gl-progress-ready');
      gl.element = el;
      el.appendChild(gl.renderer.domElement);
      gl.draw = 0;
      gl.read = undefined;
      gl.value = 0;
      gl.out = 1;
      gl.outEnd = 1;
      gl.rev = false;
      gl.reset = null;
    }
    const visible = this.state.phase === 'settled' && rect.width > 0 && rect.height > 0;
    gl.renderer.domElement.style.display = visible ? 'block' : 'none';
    if (!visible) {
      el.classList.remove('gl-progress-ready');
      return;
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (gl.width !== rect.width || gl.height !== rect.height || gl.dpr !== dpr) {
      gl.width = rect.width;
      gl.height = rect.height;
      gl.dpr = dpr;
      gl.renderer.setPixelRatio(dpr);
      gl.renderer.setSize(rect.width, rect.height, false);
    }
    const progress = clamp(Number(el.dataset.progress) || 0),
      previous = gl.read;
    gl.read = progress;
    // Literal jB.setProgress reset thresholds/duration: X0=.5, Jf=.5,
    // Qf=expo.out. Ordinary scroll updates the same head without restarting it.
    if (previous !== undefined && progress < previous - 0.5) {
      gl.rev = false;
      gl.out = 0;
      gl.outEnd = 1;
      gl.reset = { kind: 'forward', start: this.clock };
    } else if (previous !== undefined && progress > previous + 0.5) {
      gl.rev = true;
      gl.out = progress;
      gl.outEnd = progress;
      gl.reset = { kind: 'backward', start: this.clock, out: progress, value: gl.value };
    }
    if (gl.rev) gl.outEnd = progress;
    else gl.value = progress;
    if (gl.reset) {
      const t = clamp((this.clock - gl.reset.start) / 0.5),
        ease = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      if (gl.reset.kind === 'forward') gl.out = ease;
      else {
        gl.out = gl.reset.out * (1 - ease);
        gl.value = gl.reset.value * (1 - ease);
      }
      if (t === 1) {
        if (gl.reset.kind === 'backward') {
          gl.rev = false;
          gl.out = 1;
          gl.outEnd = 1;
          gl.value = progress;
        }
        gl.reset = null;
      }
    }
    gl.draw = Math.min(1, gl.draw + dt / 0.85);
    const draw = sourceEase(gl.draw),
      u = gl.material.uniforms,
      css = getComputedStyle(el);
    const border =
      parseFloat(css.getPropertyValue('--progress-border')) || parseFloat(css.borderTopWidth) || 2;
    u.u_res.value.set(rect.width, rect.height);
    u.u_corner.value = (Math.min(rect.width, rect.height) * 0.5) / rect.height;
    u.u_border.value = border / rect.height;
    u.u_ink.value.set(el.dataset.progressColor || css.color || '#ffffff');
    u.u_alpha.value = 1;
    u.u_p.value = gl.value;
    u.u_out.value = gl.out;
    u.u_outEnd.value = gl.outEnd;
    u.u_draw.value = draw;
    u.u_spin.value = -(1 - draw) * 0.25;
    u.u_track.value = 0.2;
    gl.renderer.setRenderTarget(null);
    gl.renderer.clear();
    gl.renderer.render(gl.scene, gl.camera);
    if (!this.progressGLFailed) el.classList.add('gl-progress-ready');
  }
  tick(t) {
    if (this.destroyed || document.hidden) {
      this.last = 0;
      return;
    }
    const elapsed = this.last ? (t - this.last) / 1000 : 1 / 60,
      dt = Math.min(elapsed, 1 / 20),
      ratio = elapsed * 60;
    this.last = t;
    this.clock += dt;
    this.bootReveal.advance(elapsed);
    this.scroll?.tick(ratio);
    window.dispatchEvent(
      new CustomEvent('portfolio-tick', { detail: { ratio, dt, time: this.clock } }),
    );
    const targetAlpha = this.state.mode === 'featured' ? 1 : 0;
    this.modeAlpha = mix(this.modeAlpha, targetAlpha, 1 - Math.exp(-8 * dt));
    if (!this.bootReveal.waiting)
      for (const card of this.cards) {
        const { mesh, el, label } = card,
          u = mesh.material.uniforms,
          isFlight = this.flight?.card === card;
        if (!isFlight) {
          const active = this.state.project?.id === card.p.id;
          mesh.visible =
            this.visibleIds.has(card.p.id) &&
            !this.state.project &&
            this.modeAlpha > 0.001 &&
            !el._parked;
          if (mesh.visible) {
            mesh.renderOrder = 10;
            const hover = card.hover ? 1 : 0;
            if (card.hoverTarget !== hover) {
              card.hoverTarget = hover;
              card.hoverTween = { from: u.u_hover.value, to: hover, start: this.clock };
            }
            if (card.hoverTween) {
              const hp = clamp((this.clock - card.hoverTween.start) / 0.5),
                he = hp === 1 ? 1 : 1 - Math.pow(2, -10 * hp);
              u.u_hover.value = mix(card.hoverTween.from, card.hoverTween.to, he);
            }
            const rect = el._vrect || el.getBoundingClientRect();
            this.applyRect(mesh, rect);
            mesh.quaternion.identity();
            this.sheetUniforms(u);
            u.u_corner.value = (card.cornerRadius || 0) / rect.height;
            u.u_white.value = 0;
            u.u_alpha.value = this.modeAlpha;
            u.u_shade.value = 1;
            u.u_scrim.value = 1;
            this.resizeLabel(label, rect.width, rect.height, this.rem || 16);
            this.applyRect(label.mesh, rect);
            this.sheetUniforms(label.mesh.material.uniforms);
            label.mesh.material.uniforms.u_hover.value = u.u_hover.value;
            label.mesh.material.uniforms.u_dent.value = u.u_dent.value;
            label.mesh.material.uniforms.u_alpha.value = this.modeAlpha;
          } else if (active && this.state.phase === 'settled') mesh.visible = true;
        }
        label.mesh.visible =
          this.visibleIds.has(card.p.id) && mesh.visible && !isFlight && !this.state.project;
        this.syncHit(card);
      }
    if (!this.bootReveal.pending) {
      this.syncRail(dt);
      this.syncPreviewVideos();
    } else {
      this.pauseCaseVideos();
      this.pausePreviewVideos();
    }
    const fullButtons = Array.from(
        document.querySelectorAll('.full-index button[data-project-id]'),
      ),
      fullHovered = fullButtons.findIndex(
        (button) => button.dataset.projectId === this.railProjectId,
      );
    this.fullField.update({
      elements: fullButtons,
      rail: this.rail,
      hovered: fullHovered,
      presence: this.railState.reveal,
      dt,
      enabled:
        !this.bootReveal.waiting &&
        this.state.mode === 'full' &&
        !this.state.project &&
        !this.state.overlay,
      alpha: 1,
    });
    if (!this.bootReveal.pending) {
      if (this.pendingTransition) this.startTransition();
      this.syncFlight();
      this.syncCase();
      this.syncProgress(dt);
    }
    this.bootReveal.apply();
    if (this.holeTween) {
      const h = this.holeTween,
        p = sourceEase(clamp((this.clock - h.start) / h.duration));
      this.hole.p = mix(h.from, h.to, p);
      this.hole.s = h.to ? 0 : -0.1 * p;
      if (p >= 0.9999) this.holeTween = null;
    }

    this.veil.material.uniforms.u_alpha.value =
      !this.bootReveal.pending &&
      this.small &&
      !this.state.project &&
      this.state.mode === 'featured'
        ? 0.15
        : 0;
    this.renderer.setRenderTarget(this.post.target);
    this.renderer.setClearColor(0xffffff, 1);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    const hole = this.syncHole(),
      pointer = this.pointerTrail.tick(dt, this.hole.p),
      sceneTexture = this.wipe.render(this.post.target.texture, { dt });
    this.post.render(sceneTexture, {
      progress: this.bootReveal.pending ? 0 : this.hole.p,
      time: this.clock,
      center: hole.center,
      radius: hole.radius,
      squash: this.hole.s,
      ...(this.bootReveal.pending ? {} : pointer),
    });
    this.renderer.render(this.over, this.camera);
    this.publishRenderedLensReady();
    if (!this.bootReady) {
      this.bootStep('Portfolio ready');
      this.bootReady = true;
      this.callbacks.onBootReady?.();
    }
    this.bootReveal.afterRender();
    if (import.meta.env?.DEV) {
      this.pointerPeak = Math.max(this.pointerPeak, this.pointerTrail.ball.e);
      Object.assign(this.host.dataset, {
        pointerEnergy: this.pointerTrail.ball.e.toFixed(5),
        pointerAmplitude: (pointer.trail?.amplitude || 0).toFixed(5),
        pointerPeak: this.pointerPeak.toFixed(5),
        pointerBall: this.post.u.u_ballA.value.toFixed(5),
        pointerWarp: this.post.u.u_ballWarp.value.toFixed(5),
        pointerShade: this.post.u.u_ballShade.value.toFixed(5),
        pointerTrailFrames: String(this.post.trailFrames),
        holeGroup: this.holeGroup || '',
        holeProgress: this.hole.p.toFixed(5),
        holeRadius: hole.radius.toFixed(5),
      });
    }
    this.requestFrame();
  }
  dispose() {
    this.destroyed = true;
    this.bootReveal.dispose();
    this.stopOverlayDismiss();
    this.stopCaseVideos();
    this.stopRenderLoop();
    clearTimeout(this.resizeTimer);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onPointer);
    document.documentElement.removeEventListener('pointerleave', this.onLeave);
    this.pointerTrail?.dispose();
    this.scroll?.destroy();
    for (const c of this.cards) {
      if (!c) continue;
      this.disposePreviewVideo(c);
      c.mesh.material.dispose();
      c.tex.dispose();
      c.label.tex.dispose();
      c.label.mesh.material.dispose();
      c.hit.remove();
    }
    for (const [key, e] of this.caseMedia) this.retireCaseMedia(key, e);
    this.geo?.dispose();
    this.rail?.material.dispose();
    this.progressMesh?.material.dispose();
    if (this.progressGL) {
      const g = this.progressGL;
      g.element?.classList.remove('gl-progress-ready');
      g.renderer.domElement.removeEventListener('webglcontextlost', g.lost);
      g.geometry.dispose();
      g.material.dispose();
      g.renderer.dispose();
      g.renderer.domElement.remove();
      this.progressGL = null;
    }
    this.veil?.material.dispose();
    this.veil?.geometry.dispose();
    this.fullField?.dispose();
    this.background?.dispose();
    this.post?.dispose();
    this.wipe?.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}
