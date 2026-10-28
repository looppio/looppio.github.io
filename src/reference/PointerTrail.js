/**
 * Literal state/math port of jB.watchBall/showBall/syncBall in the public
 * reference DZyj3ghP.js (AST offsets 1047257, 1047552 and 1058829).
 * The source application was parsed as data, never imported or executed.
 * Input listeners and the single animation clock are owned by PortfolioScene.
 */
export const POINTER_CONSTANTS = Object.freeze({
  bB: 0.04,
  $0: 4,
  AB: 40,
  SB: -0.045,
  MB: -1.2,
  TB: 0.22,
  EB: 0.5,
  PB: 0.03,
  Y0: 0.03,
  CB: 0.025,
  RB: 0.08,
  IB: 60,
});

const C = POINTER_CONSTANTS;
const finePointerQuery = '(hover: hover) and (pointer: fine)';
const power2Out = (progress) => 1 - Math.pow(1 - progress, 3);

/**
 * new PointerTrail(post, () => ({width, height, mouse}))
 * `ww`/`wh` are accepted as original source aliases. If `mouse` is omitted,
 * the original fine-hover media query is used. No width breakpoint disables
 * a real mouse: a narrow desktop window can still use the source effect.
 *
 * move(clientX, clientY, pointerType?) may receive a PointerEvent as third arg.
 * leave(event?) ignores pointerleave events with a relatedTarget, like source.
 * Spread tick(dtSeconds, holeProgress) into LensPass.render(texture, options).
 * Header buttons are shielded by marking their DOM with data-gl-shield.
 */
export class PointerTrail {
  constructor(post, viewport, { shieldSelector = '[data-gl-shield]' } = {}) {
    this.post = post;
    this.viewport = viewport;
    this.shieldSelector = shieldSelector;
    this.media = typeof window !== 'undefined' ? window.matchMedia(finePointerQuery) : null;
    this.ball = { p: 0, on: false, seen: false, tx: 0, ty: 0, sx: 0, sy: 0, e: 0, w: 1 };
    this.ballScan = 0;
    this.ballShield = [];
    this.time = 0;
    this.tween = null;
    this.active = false;
    this.disposed = false;
    post.trailDiss = C.$0;
    post.trailDiffuse = C.AB;
  }

  getViewport() {
    const value = (typeof this.viewport === 'function' ? this.viewport() : this.viewport) || {};
    return {
      width: Math.max(1, value.ww ?? value.width ?? this.post.width ?? 1),
      height: Math.max(1, value.wh ?? value.height ?? this.post.height ?? 1),
      mouse: value.mouse === undefined ? Boolean(this.media?.matches) : Boolean(value.mouse),
    };
  }

  show(on) {
    const ball = this.ball;
    if (ball.on === on) return;
    ball.on = on;
    if (!on) ball.seen = false;
    this.tween = { from: ball.p, to: on ? 1 : 0, start: this.time, duration: on ? 0.35 : 0.25 };
  }

  move(clientX, clientY, pointerType = 'mouse') {
    if (this.disposed) return;
    const type = typeof pointerType === 'object' ? pointerType?.pointerType : pointerType;
    if (type === 'touch' || !this.getViewport().mouse) return;
    const ball = this.ball;
    ball.tx = clientX;
    ball.ty = clientY;
    if (!ball.seen) {
      ball.seen = true;
      ball.sx = clientX;
      ball.sy = clientY;
    }
    this.show(true);
  }

  leave(event) {
    if (this.disposed || event?.relatedTarget) return;
    this.show(false);
  }

  /** Optional immediate refresh after a React route or overlay mounts. */
  refreshShields() {
    this.ballScan = 0;
  }

  tick(deltaSeconds, holeP = 0) {
    const dt = Math.min(Math.max(Number(deltaSeconds) || 0, 0), 1 / 20);
    if (this.disposed) return { ball: 0, trail: null, delta: dt };
    this.time += dt;
    const ball = this.ball;
    if (this.tween) {
      const p = Math.min(1, Math.max(0, (this.time - this.tween.start) / this.tween.duration));
      ball.p = this.tween.from + (this.tween.to - this.tween.from) * power2Out(p);
      if (p === 1) this.tween = null;
    }

    const viewport = this.getViewport();
    const u = this.post.u || this.post.uniforms || this.post.material.uniforms;
    if (!viewport.mouse) {
      this.show(false);
      ball.e = 0;
      this.active = this.post.trailOn = false;
      u.u_ballA.value = 0;
      u.u_ballWarp.value = 0;
      u.u_ballShade.value = 0;
      return { ball: 0, trail: null, delta: dt };
    }

    // Original energy decay, pointer lag, dead zone and squared tanh response.
    ball.e *= Math.exp(-C.$0 * dt);
    let amplitude = 0;
    if (ball.p > 0.001 && ball.seen) {
      const follow = 1 - Math.exp(-7 * dt);
      ball.sx += (ball.tx - ball.sx) * follow;
      ball.sy += (ball.ty - ball.sy) * follow;
      const lag = Math.hypot(ball.tx - ball.sx, ball.ty - ball.sy) / viewport.width;
      const response = Math.tanh(Math.max(0, lag - C.CB) / C.RB);
      amplitude = response * response;
    }
    ball.e = Math.max(ball.e, amplitude);

    if (--this.ballScan <= 0) {
      this.ballScan = C.IB;
      this.ballShield =
        typeof document === 'undefined' ? [] : [...document.querySelectorAll(this.shieldSelector)];
    }
    let distance = Infinity;
    for (const element of this.ballShield) {
      if (!element.isConnected || element.closest('[inert]')) continue;
      const rect = element.getBoundingClientRect();
      const dx = Math.max(rect.left - ball.tx, 0, ball.tx - (rect.left + rect.width));
      const dy = Math.max(rect.top - ball.ty, 0, ball.ty - (rect.top + rect.height));
      distance = Math.min(distance, Math.hypot(dx, dy));
    }
    const reach = C.PB * viewport.width;
    const weight = distance < reach ? C.Y0 + (1 - C.Y0) * (distance / reach) : 1;
    ball.w += (weight - ball.w) * (1 - Math.exp(-10 * dt));

    this.post.trailDiss = C.$0;
    this.post.trailDiffuse = C.AB;
    this.active = this.post.trailOn = ball.e > 0.004;
    const strength = ball.w * (1 - holeP);
    u.u_ballA.value = this.active ? ball.p : 0;
    u.u_ballWarp.value = C.SB * strength;
    u.u_ballShade.value = C.MB * strength;
    u.u_ballEdge.value.set(C.TB, C.EB);

    return {
      ball: this.active ? ball.p : 0,
      trail: this.active
        ? {
            position: [ball.tx / viewport.width, 1 - ball.ty / viewport.height],
            amplitude,
            radius: C.bB,
          }
        : null,
      delta: dt,
    };
  }

  dispose() {
    this.disposed = true;
    this.tween = null;
    this.ballShield.length = 0;
    this.active = false;
    this.post.trailOn = false;
    const u = this.post.u || this.post.uniforms || this.post.material?.uniforms;
    if (u?.u_ballA) u.u_ballA.value = 0;
  }
}

export default PointerTrail;
