import { clamp, mix } from './motion.js';

// Literal Expo easeIn registered by the GSAP version in DZyj3ghP.js:4.
export const bootExpoIn = (t) => Math.pow(2, 10 * (t - 1)) * t + Math.pow(t, 6) * (1 - t);
export const bootExpoOut = (t) => 1 - bootExpoIn(1 - clamp(t));
export const bootExpoInOut = (t) => {
  t = clamp(t);
  return t < 0.5 ? bootExpoIn(t * 2) / 2 : 1 - bootExpoIn((1 - t) * 2) / 2;
};
export const BOOT_REVEAL = Object.freeze({
  flight: 1.5,
  stagger: 0.05,
  labelsAt: 0.75,
  labelsDuration: 0.7,
  restAt: 1.15,
  restDuration: 1.25,
  fullStep: 0.03,
  fullMaxDelay: 0.55,
  fullDuration: 1.1,
  retire: 0.3,
});
const copyRect = (r) =>
  r && [r.left, r.top, r.width, r.height].every(Number.isFinite) && r.width > 0 && r.height > 0
    ? { left: r.left, top: r.top, width: r.width, height: r.height }
    : null;

/** Source jB.boot/UF.attach/fly, operating on the existing card meshes only. */
export default class BootReveal {
  constructor(scene, { enabled = false } = {}) {
    this.scene = scene;
    this.phase = enabled ? 'waiting' : 'complete';
    this.enabled = enabled;
    this.elapsed = 0;
    this.progress = 0;
    this.entries = [];
    this.rest = [];
    this.completed = !enabled;
    this.disposed = false;
    this.motion = enabled ? globalThis.matchMedia?.('(prefers-reduced-motion: reduce)') : null;
  }
  get pending() {
    return !this.disposed && this.phase !== 'complete';
  }
  get waiting() {
    return this.pending && this.phase === 'waiting';
  }
  get revealing() {
    return this.pending && this.phase === 'revealing';
  }
  setProgress(progress) {
    if (this.pending && Number.isFinite(progress))
      this.progress = Math.max(this.progress, clamp(progress));
  }
  get document() {
    return this.scene.host?.ownerDocument || globalThis.document;
  }
  style(element) {
    return (
      this.document?.defaultView?.getComputedStyle?.(element) ||
      globalThis.getComputedStyle?.(element) ||
      {}
    );
  }
  rect(element) {
    return copyRect(element?._vrect || element?.getBoundingClientRect?.());
  }
  onScreen(rect) {
    return (
      rect &&
      rect.left < this.scene.width &&
      rect.top < this.scene.height &&
      rect.left + rect.width > 0 &&
      rect.top + rect.height > 0
    );
  }
  release(rects = []) {
    const s = this.scene;
    if (!this.waiting || s.destroyed || s.bootReady !== true) return false;
    const bars = (Array.isArray(rects) ? rects : []).map(copyRect).filter(Boolean).slice(0, 3);
    this.mode = s.state.project ? 'project' : s.state.mode === 'full' ? 'full' : 'featured';
    this.elapsed = 0;
    this.phase = 'revealing';
    this.finished = false;
    const center = (s.small ? s.height : s.width) / 2,
      axis = (r) => (s.small ? r.top + r.height / 2 : r.left + r.width / 2);
    let targets = [];
    if (this.mode === 'project') {
      targets = Array.from(
        this.document?.querySelectorAll?.(
          '.case-view [data-gl="sheet"],.case-view [data-gl="related"]',
        ) || [],
      )
        .map((el) => ({
          card: s.registry.get(el.dataset.id),
          element: el,
          rect: this.rect(el),
          kind: el.dataset.gl,
        }))
        .filter((t) => t.card && t.rect);
      // A direct route can render its sheet before related slots exist.
      if (!targets.some((t) => t.card.p.id === s.state.project.id && t.kind === 'sheet')) {
        const element = this.document?.querySelector?.('[data-flip-target="true"]'),
          card = s.registry.get(s.state.project.id),
          rect = this.rect(element);
        if (card && rect) targets.push({ card, element, rect, kind: 'sheet' });
      }
    } else if (this.mode === 'featured') {
      targets = s.cards
        .filter((card) => s.visibleIds.has(card.p.id) && !card.el.hidden && !card.el._parked)
        .map((card) => ({ card, element: card.el, rect: this.rect(card.el), kind: 'card' }))
        .filter((t) => t.rect);
    } else
      targets = s.cards
        .slice(0, bars.length)
        .map((card) => ({ card, element: null, rect: null, kind: 'retiring' }));
    if (this.mode !== 'full')
      targets = targets
        .sort((a, b) => Math.abs(axis(a.rect) - center) - Math.abs(axis(b.rect) - center))
        .slice(0, bars.length)
        .sort((a, b) => axis(a.rect) - axis(b.rect));
    this.entries = targets.slice(0, bars.length).map((target, index) => {
      const from = bars[index],
        pose = s.pose(from),
        mesh = target.card.mesh;
      const entry = {
        ...target,
        index,
        from,
        position: pose.position.clone(),
        scale: pose.scale.clone(),
        quaternion: mesh.quaternion.clone().identity(),
        radius: 20,
      };
      const barElement = this.document?.querySelectorAll?.('.boot-loader-bar')?.[index];
      entry.radius = parseFloat(barElement ? this.style(barElement).borderRadius : 20) || 20;
      return entry;
    });
    const selected = new Set(this.entries.map((entry) => entry.card));
    this.rest =
      this.mode === 'featured'
        ? s.cards.filter(
            (card) =>
              s.visibleIds.has(card.p.id) &&
              !selected.has(card) &&
              this.onScreen(this.rect(card.el)),
          )
        : [];
    this.rest.sort(
      (a, b) => Math.abs(axis(this.rect(a.el)) - center) - Math.abs(axis(this.rect(b.el)) - center),
    );
    if (this.mode === 'full') {
      const count =
        this.document?.querySelectorAll?.('.full-index button[data-project-id]')?.length || 0;
      this.duration = Math.max(
        BOOT_REVEAL.retire,
        BOOT_REVEAL.fullDuration +
          Math.min(Math.max(0, count - 1) * BOOT_REVEAL.fullStep, BOOT_REVEAL.fullMaxDelay),
      );
    } else
      this.duration = this.entries.length
        ? Math.max(
            BOOT_REVEAL.flight + (this.entries.length - 1) * BOOT_REVEAL.stagger,
            this.rest.length
              ? BOOT_REVEAL.restAt +
                  (this.rest.length - 1) * BOOT_REVEAL.stagger +
                  BOOT_REVEAL.restDuration
              : 0,
          )
        : 0;
    if (this.mode === 'project') {
      s.pendingTransition = false;
      s.projectId = s.state.project.id;
    }
    this.apply();
    return true;
  }
  advance(dt) {
    if (!this.revealing) return;
    if (this.motion?.matches || this.scene.caseMotionQuery?.matches) this.elapsed = this.duration;
    else this.elapsed += Math.max(0, Number.isFinite(dt) ? dt : 0);
    this.finished = this.elapsed + 1e-9 >= this.duration;
    if (this.finished) this.elapsed = Math.max(this.elapsed, this.duration);
  }
  get hudAlpha() {
    return this.phase === 'complete'
      ? 1
      : this.waiting
        ? 0
        : bootExpoOut(clamp((this.elapsed - BOOT_REVEAL.labelsAt) / BOOT_REVEAL.labelsDuration));
  }
  get contentAlpha() {
    if (this.phase === 'complete') return 1;
    if (this.waiting) return 0;
    return this.mode === 'project'
      ? bootExpoOut(clamp((this.elapsed - 0.85) / 0.45))
      : bootExpoOut(clamp(this.elapsed / 0.45));
  }
  hide() {
    const s = this.scene;
    for (const card of s.cards) {
      card.mesh.visible = false;
      if (card.label) card.label.mesh.visible = false;
      if (card.hit) card.hit.style.display = 'none';
    }
    if (s.rail) s.rail.visible = false;
    for (const entry of s.caseMedia?.values?.() || []) entry.mesh.visible = false;
    if (s.progressGL) s.progressGL.renderer.domElement.style.display = 'none';
    if (s.veil) s.veil.material.uniforms.u_alpha.value = 0;
  }
  apply() {
    if (!this.pending || this.disposed) return;
    this.hide();
    if (this.waiting) return;
    const s = this.scene;
    if (this.mode === 'featured')
      for (let i = 0; i < this.rest.length; i++) {
        const card = this.rest[i],
          rect = this.rect(card.el);
        if (!rect || !s.visibleIds.has(card.p.id)) continue;
        const p = clamp(
            (this.elapsed - BOOT_REVEAL.restAt - i * BOOT_REVEAL.stagger) /
              BOOT_REVEAL.restDuration,
          ),
          ease = bootExpoOut(p),
          mesh = card.mesh,
          u = mesh.material.uniforms;
        s.applyRect(mesh, rect);
        mesh.quaternion.identity();
        s.sheetUniforms(u);
        mesh.position.x +=
          Math.sign(rect.left + rect.width / 2 - s.width / 2 || 1) * s.W * 0.5 * (1 - ease);
        u.u_alpha.value = 1 - Math.pow(1 - clamp(p * 2), 2);
        u.u_white.value = 0;
        u.u_shade.value = 1;
        u.u_scrim.value = 1;
        u.u_corner.value = (parseFloat(this.style(card.el).borderRadius) || 0) / rect.height;
        u.u_clipOn.value = 0;
        mesh.renderOrder = 10;
        mesh.visible = p > 0;
        this.label(card, this.hudAlpha);
      }
    for (const entry of this.entries) {
      const { card, from, index, kind } = entry,
        mesh = card.mesh,
        u = mesh.material.uniforms;
      if (kind === 'retiring') {
        s.applyRect(mesh, from);
        mesh.quaternion.identity();
        s.sheetUniforms(u, 0);
        u.u_white.value = 1;
        u.u_wash.value.setRGB(1, 1, 1);
        u.u_shade.value = 0;
        u.u_alpha.value = 1 - bootExpoOut(clamp(this.elapsed / BOOT_REVEAL.retire));
        u.u_corner.value = entry.radius / from.height;
        u.u_clipOn.value = 0;
        u.u_scrim.value = 0;
        mesh.renderOrder = 100;
        mesh.visible = u.u_alpha.value > 0.0001;
        continue;
      }
      const target = this.rect(entry.element);
      if (!target) continue;
      const p =
          this.motion?.matches || s.caseMotionQuery?.matches
            ? 1
            : clamp((this.elapsed - index * BOOT_REVEAL.stagger) / BOOT_REVEAL.flight),
        d = bootExpoInOut(p),
        pose = s.pose(target);
      mesh.position.lerpVectors(entry.position, pose.position, d);
      mesh.scale.lerpVectors(entry.scale, pose.scale, d);
      mesh.quaternion.slerpQuaternions(entry.quaternion, entry.quaternion, d);
      u.u_res.value.set(mesh.scale.x, mesh.scale.y);
      s.sheetUniforms(u, kind === 'card' ? d : 0);
      u.u_bulgeA.value = 0;
      u.u_hover.value = 0;
      u.u_white.value = mix(1, kind === 'card' ? 0 : 1, Math.min(1, d * 1.08));
      u.u_shade.value = kind === 'card' ? d : 0;
      u.u_alpha.value = mix(1, kind === 'related' ? 0.3 : 1, d);
      u.u_scrim.value = kind === 'card' ? this.hudAlpha : 0;
      u.u_clipOn.value = 0;
      // The original sheet was white. Its approved dark palette follows this
      // same wash during a direct case entrance without altering case images.
      const wash = kind === 'card' ? 1 : mix(1, 0.031, d);
      u.u_wash.value.setRGB(wash, wash, wash);
      const radius = parseFloat(this.style(entry.element).borderRadius) || 0;
      u.u_corner.value =
        mix(entry.radius, radius, d) / Math.max(1, mix(from.height, target.height, d));
      mesh.renderOrder = kind === 'related' ? 90 : 100;
      mesh.visible = true;
      if (kind === 'card') this.label(card, this.hudAlpha);
    }
    if (this.mode === 'full') this.fullText();
  }
  label(card, alpha) {
    if (!card.label) return;
    const s = this.scene,
      label = card.label,
      rect = this.rect(card.el),
      rem = parseFloat(this.style(this.document?.documentElement).fontSize) || 10;
    s.resizeLabel?.(label, rect?.width || 1, rect?.height || 1, rem);
    label.mesh.position.copy(card.mesh.position);
    label.mesh.scale.copy(card.mesh.scale);
    label.mesh.quaternion.copy(card.mesh.quaternion);
    const u = label.mesh.material.uniforms;
    s.sheetUniforms(u, card.mesh.material.uniforms.u_sheetP.value);
    u.u_res.value.set(card.mesh.scale.x, card.mesh.scale.y);
    u.u_alpha.value = alpha;
    label.mesh.renderOrder = card.mesh.renderOrder + 1;
    label.mesh.visible = card.mesh.visible && alpha > 0;
  }
  fullText() {
    let index = 0;
    for (const entry of this.scene.fullField?.entries?.values?.() || []) {
      const u = entry.material.uniforms;
      u.u_progress.value = clamp(
        (this.elapsed - Math.min(index++ * BOOT_REVEAL.fullStep, BOOT_REVEAL.fullMaxDelay)) /
          BOOT_REVEAL.fullDuration,
      );
      u.u_slide.value = 0;
    }
  }
  park(card) {
    const s = this.scene,
      mesh = card.mesh,
      u = mesh.material.uniforms,
      rect = this.rect(card.el);
    mesh.visible = false;
    mesh.renderOrder = 10;
    u.u_alpha.value = 0;
    u.u_clipOn.value = 0;
    u.u_white.value = 0;
    u.u_hover.value = 0;
    // Retired bars must not retain a tiny centre pose if a route later reuses
    // the registry entry. Only normal layout synchronization may show it again.
    if (rect) {
      s.applyRect(mesh, rect);
      mesh.quaternion.identity();
      s.sheetUniforms(u);
      u.u_corner.value = (parseFloat(this.style(card.el).borderRadius) || 0) / rect.height;
    }
    if (card.label) {
      card.label.mesh.visible = false;
      card.label.mesh.renderOrder = 11;
      card.label.mesh.material.uniforms.u_alpha.value = 0;
    }
    if (card.hit) card.hit.style.display = 'none';
  }
  afterRender() {
    if (!this.pending || this.disposed || this.scene.destroyed) return;
    this.scene.callbacks.onBootRevealFrame?.({
      phase: this.phase,
      progress: this.waiting
        ? this.progress
        : clamp(this.duration ? this.elapsed / this.duration : 1),
      contentAlpha: this.contentAlpha,
      hudAlpha: this.hudAlpha,
    });
    if (!this.revealing || !this.finished || this.completed) return;
    this.completed = true;
    this.phase = 'complete';
    if (this.mode === 'full') this.scene.modeAlpha = 0;
    const kept = new Set(
      this.mode === 'featured'
        ? [
            ...this.entries.filter((entry) => entry.kind === 'card').map((entry) => entry.card),
            ...this.rest,
          ]
        : this.mode === 'project'
          ? this.entries.filter((entry) => entry.kind === 'sheet').map((entry) => entry.card)
          : [],
    );
    for (const card of this.scene.cards) {
      if (!kept.has(card)) {
        this.park(card);
        continue;
      }
      card.mesh.material.uniforms.u_clipOn.value = 0;
      card.mesh.renderOrder = 10;
      if (card.label) card.label.mesh.renderOrder = 11;
    }
    for (const entry of this.scene.fullField?.entries?.values?.() || []) {
      entry.material.uniforms.u_progress.value = 1;
      entry.material.uniforms.u_slide.value = 0;
    }
    if (this.mode === 'project' && this.scene.state.phase === 'opening') {
      this.scene.state = { ...this.scene.state, phase: 'settled' };
      this.scene.pendingTransition = false;
      this.scene.callbacks.onTransitionEnd?.('opening');
    }
    this.scene.callbacks.onBootRevealFrame?.({
      phase: 'complete',
      progress: 1,
      contentAlpha: 1,
      hudAlpha: 1,
    });
    if (!this.disposed && !this.scene.destroyed) this.scene.callbacks.onBootRevealComplete?.();
  }
  dispose() {
    this.disposed = true;
    this.entries = [];
    this.rest = [];
  }
}
