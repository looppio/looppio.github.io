/*
 * Reference port, read statically from jesperlandberg.com on 2026-10-26.
 * work/reference-source/mriNB3Nt.js: ie / m / C / j / A / E (horizontal).
 * work/reference-source/CSMsEA09.js: at (vertical), lt (mouse drag), V (lerp).
 * work/reference-source/DZyj3ghP.js: hz, near source offset 1098179 (input).
 * The original bundle is never imported or executed. Vue refs, event bus and
 * its autonomous RAF are replaced by explicit elements, one shared input hub
 * and tick(frameRatio). Positions and _vrect are always DOM CSS pixels.
 */

const hubs = new WeakMap();
const ignoredKeys = /^(input|textarea|select|button|a|summary|audio|video)$/i;
const clamp = (min, max, value) => Math.min(Math.max(value, min), max);
const resolve = (value) => (typeof value === 'function' ? value() : (value?.value ?? value));
const roundPixel = (value) => Math.round(value * 100) / 100;

// GSAP utils.wrap's numerical branch, including arbitrary positive/negative laps.
export function wrap(min, max, value) {
  const range = max - min;
  return range > 0 ? ((range + ((value - min) % range)) % range) + min : min;
}

function rect(element) {
  const r = element.getBoundingClientRect();
  return {
    left: r.left,
    top: r.top,
    width: r.width,
    height: r.height,
    right: r.left + r.width,
    bottom: r.top + r.height,
  };
}

function sharedInputHub(win) {
  if (hubs.has(win)) return hubs.get(win);
  const clients = new Set();
  let pointerOwner = null;
  let touchOwner = null;
  let clickOwner = null;
  const choose = (event) => {
    const active = [...clients].filter((client) => client.active());
    return active.reverse().find((client) => client.contains(event.target)) || active[0];
  };
  const rootClass = (name, enabled) =>
    win.document?.documentElement?.classList?.toggle(name, enabled);
  const cancelPointer = () => {
    pointerOwner?.pointerCancel();
    pointerOwner = null;
    rootClass('grabbing', false);
  };
  const handlers = {
    wheel(event) {
      choose(event)?.wheel(event);
    },
    touchstart(event) {
      touchOwner = choose(event) || null;
      touchOwner?.touchStart(event);
    },
    touchmove(event) {
      touchOwner?.touchMove(event);
    },
    touchend(event) {
      touchOwner?.touchEnd(event);
      touchOwner = null;
    },
    touchcancel() {
      touchOwner?.touchCancel();
      touchOwner = null;
    },
    keydown(event) {
      choose(event)?.key(event);
    },
    pointerdown(event) {
      if (pointerOwner || event.button !== 0 || event.pointerType !== 'mouse') return;
      pointerOwner = choose(event) || null;
      clickOwner = null;
      pointerOwner?.pointerDown(event);
    },
    pointermove(event) {
      if (!pointerOwner) return;
      const dragging = pointerOwner.pointerMove(event);
      if (dragging) {
        clickOwner = pointerOwner;
        rootClass('grabbing', true);
      }
    },
    pointerup(event) {
      pointerOwner?.pointerUp(event);
      pointerOwner = null;
      rootClass('grabbing', false);
    },
    pointercancel() {
      cancelPointer();
    },
    click(event) {
      const owner = clickOwner;
      clickOwner = null;
      // Keyboard activation is deliberate. Pointer taps on a moving gallery
      // stop the ribbon; they must not open whichever card slid underneath.
      if (event.detail === 0) return;
      const blocked =
        owner ||
        [...clients].find((client) => client.contains(event.target) && client.blocksClick?.());
      if (!blocked) return;
      blocked.consumeClick?.();
      event.preventDefault();
      event.stopPropagation();
    },
  };
  const options = {
    wheel: { passive: true },
    touchstart: { passive: true },
    touchmove: { passive: true },
    touchend: { passive: true },
    touchcancel: { passive: true },
    pointermove: { passive: false },
    click: true,
  };
  for (const [type, handler] of Object.entries(handlers))
    win.addEventListener(type, handler, options[type]);
  const hub = {
    add(client) {
      clients.add(client);
      rootClass('grabbable', true);
    },
    cancel(client) {
      if (pointerOwner === client) cancelPointer();
      if (touchOwner === client) {
        touchOwner.touchCancel();
        touchOwner = null;
      }
      if (clickOwner === client) clickOwner = null;
    },
    remove(client) {
      hub.cancel(client);
      clients.delete(client);
      if (clients.size) return;
      for (const [type, handler] of Object.entries(handlers))
        win.removeEventListener(type, handler, options[type]);
      rootClass('grabbable', false);
      rootClass('grabbing', false);
      hubs.delete(win);
    },
  };
  hubs.set(win, hub);
  return hub;
}

/**
 * container is the viewport, inner is its untransformed layout track.
 * items may be an array, NodeList or getter; default is inner.children.
 * finite/enabled may be booleans or getters. No RAF or resize listener is owned.
 * Call measure after layout/resize, then tick(ratio) from the shared app RAF.
 */
export function createVirtualScroll({
  container,
  items,
  inner,
  lead = null,
  axis = 'y',
  finite = false,
  enabled = true,
  blocked = false,
  input = true,
  inputProfile = 'gallery',
  ease = 0.1,
  onUpdate,
  onProgress,
  onVelocity,
} = {}) {
  if (!container) throw new TypeError('createVirtualScroll requires a viewport container');
  if (axis !== 'x' && axis !== 'y') throw new TypeError('Scroll axis must be x or y');
  const win = container.ownerDocument?.defaultView ?? globalThis.window;
  const styleOf = (element) => win?.getComputedStyle?.(element) ?? {};
  const original = new Map();
  let records = [];
  let viewport = null;
  let track = inner || null;
  let length = 0;
  let maxScroll = 0;
  let current = 0;
  let target = 0;
  let delta = 0;
  let overrideEnabled = null;
  let destroyed = false;
  let centeredIndex = null;
  let centeredSize = 0;
  let pendingWheel = 0;
  let steppedWheel = 0;
  let wheelEvent = null;
  let previousWheelTime = 0;
  let trackpadTime = -500;
  let touchY = 0;
  let touchX = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchAxis = null;
  let touchTracking = false;
  let touchDragging = false;
  let touchTime = 0;
  let touchVelocity = 0;
  let touchDelta = 0;
  let suppressClick = false;
  let galleryMotion = false;
  let wheelKind = null;
  let wheelMagnitude = 0;
  let downX = 0;
  let downY = 0;
  let pointerPosition = 0;
  let pointerDelta = 0;
  let pointerTime = 0;
  let dragging = false;
  const active = () => !destroyed && Boolean(overrideEnabled ?? resolve(enabled));
  // The source's F.nav input lock is supplied by the host. Case scrub can also
  // use its existing data attribute, without pausing the column's interpolation.
  const acceptsInput = () =>
    active() && !resolve(blocked) && !container.closest?.('[data-scrubbing="true"]');
  const isFinite = () => Boolean(resolve(finite));
  const galleryInput = () => inputProfile === 'gallery' && !isFinite();
  const screenWidth = () => win?.document?.documentElement?.clientWidth || viewport?.width || 0;
  const screenHeight = () => win?.document?.documentElement?.clientHeight || viewport?.height || 0;
  // Browser bars in WKWebView can shrink the visible area without resizing
  // the layout viewport. Limit input travel to that area, not card geometry.
  const inputExtent = (dimension) => {
    const sizes = [
      win?.visualViewport?.[dimension],
      win?.document?.documentElement?.[dimension === 'width' ? 'clientWidth' : 'clientHeight'],
      viewport?.[dimension],
    ].filter((size) => Number.isFinite(size) && size > 0);
    return sizes.length ? Math.min(...sizes) : 0;
  };
  const touchGain = () =>
    Math.min(inputExtent('width'), inputExtent('height')) <= 649 ? 1.1 : 1.25;
  const moving = () =>
    galleryMotion &&
    (Math.abs(target - current) > 2 ||
      Math.abs(delta) > 0.5 ||
      Math.abs(pendingWheel) > 0.5 ||
      Math.abs(steppedWheel) > 0.5);
  function stopMomentum() {
    target = current;
    delta = pendingWheel = steppedWheel = 0;
    wheelEvent = null;
    galleryMotion = false;
  }
  const progress = () =>
    isFinite()
      ? maxScroll > 0
        ? clamp(0, 1, current / maxScroll)
        : 0
      : length > 0
        ? wrap(0, length, current) / length
        : 0;
  const state = () => ({
    current,
    target,
    velocity: target - current,
    delta,
    progress: progress(),
    length,
    maxScroll,
    enabled: active(),
    axis,
  });
  const notify = () => {
    const value = state();
    onVelocity?.(value.velocity);
    onProgress?.(value.progress);
    onUpdate?.(value);
    return value;
  };

  function layout(force = false) {
    if (!viewport || length <= 0) return;
    const padding =
      axis === 'x' ? screenWidth() * 0.5 : (container.clientHeight || viewport.height) * 0.25;
    const finiteNow = isFinite();
    for (const record of records) {
      const offset = finiteNow ? current : wrap(-(length - record.end), record.end, current);
      // Source deliberately parks on the second consecutive offscreen frame.
      if ((offset > record.start - padding && offset < record.end + padding) || force) {
        record.out = false;
        record.el._parked = false;
      } else if (record.out) {
        record.el._parked = true;
        continue;
      } else record.out = true;
      const r = record.el._vrect || (record.el._vrect = {});
      r.left = record.base.left - (axis === 'x' ? offset : 0);
      r.top = record.base.top - (axis === 'y' ? offset : 0);
      r.width = record.base.width;
      r.height = record.base.height;
      r.right = r.left + r.width;
      r.bottom = r.top + r.height;
      record.el.style.transform =
        axis === 'x'
          ? `translate3d(${-offset}px, 0px, 0px)`
          : `translate3d(0px, ${-offset}px, 0px)`;
    }
  }

  function elements() {
    const supplied = resolve(items);
    const list = supplied
      ? Array.from(supplied)
      : Array.from(track?.children ?? container.children ?? []);
    const leadElement = resolve(lead);
    return [...new Set(leadElement ? [leadElement, ...list] : list)].filter(Boolean);
  }

  function measure() {
    if (destroyed) return state();
    const list = elements();
    track ||= list.find((element) => element !== resolve(lead))?.parentElement || container;
    for (const element of list) {
      if (!original.has(element))
        original.set(element, {
          transform: element.style.transform,
          vrect: element._vrect,
          parked: element._parked,
          hadRect: Object.prototype.hasOwnProperty.call(element, '_vrect'),
          hadParked: Object.prototype.hasOwnProperty.call(element, '_parked'),
        });
    }
    for (const element of new Set([...records.map((record) => record.el), ...list])) {
      element.style.transform = '';
      element._vrect = null;
    }
    viewport = rect(container);
    const size = axis === 'x' ? screenWidth() : viewport.height;
    records = list.map((element) => {
      const base = rect(element);
      return {
        el: element,
        base,
        out: true,
        start: axis === 'x' ? base.left - size : base.top - viewport.top - size,
        end: axis === 'x' ? base.right : base.bottom - viewport.top,
      };
    });
    if (!records.length) {
      length = maxScroll = current = target = 0;
      return notify();
    }
    const computed = styleOf(track);
    const gap = parseFloat(axis === 'x' ? computed.columnGap : computed.rowGap) || 0;
    if (axis === 'x') {
      length = records.at(-1).end + gap - records[0].base.left;
      maxScroll = Math.max(
        0,
        Math.max(...records.map((record) => record.end)) -
          viewport.right +
          (parseFloat(computed.paddingRight) || 0),
      );
    } else {
      const trackRect = rect(track);
      length =
        (track.scrollHeight ||
          Math.max(...records.map((record) => record.base.bottom)) - trackRect.top) + gap;
      const leadElement = resolve(lead);
      if (leadElement) length += trackRect.top - rect(leadElement).top;
      maxScroll = Math.max(
        0,
        Math.max(...records.map((record) => record.end)) +
          (parseFloat(computed.paddingBottom) || 0) -
          viewport.height,
      );
    }
    length = Math.max(0, length);
    if (isFinite()) {
      if (target < 0 || target > length) target = wrap(0, length, target);
      if (current < 0 || current > length) current = wrap(0, length, current);
      target = clamp(0, maxScroll, target);
    }
    if (centeredIndex !== null && Math.abs(size - centeredSize) > 0.5) return center(centeredIndex);
    layout(true);
    return notify();
  }

  function push(deltaY = 0, deltaX = 0, event) {
    if (!acceptsInput() || event?.ctrlKey) return;
    const amount = axis === 'x' ? deltaY + deltaX : deltaY;
    if (!Number.isFinite(amount)) return;
    target = isFinite() ? clamp(0, maxScroll, target + amount) : target + amount;
    // mriNB3Nt.ie.A limits lag, not carousel position or number of laps.
    const width = screenWidth();
    if (axis === 'x' && !isFinite() && width > 649)
      target = current + Math.tanh((target - current) / width) * width;
  }

  function flushWheel(ratio) {
    if (steppedWheel) {
      const decay = galleryInput() ? 0.14 : 0.22;
      const portion = steppedWheel * (1 - Math.pow(1 - decay, Math.min(ratio || 0, 4)));
      pendingWheel += portion;
      steppedWheel -= portion;
      if (Math.abs(steppedWheel) < 0.05) {
        pendingWheel += steppedWheel;
        steppedWheel = 0;
      }
    }
    if (!pendingWheel) return;
    const amount = pendingWheel;
    pendingWheel = 0;
    push(amount, 0, wheelEvent);
    wheelEvent = null;
  }

  function tick(frameRatio = 1) {
    if (!active()) {
      // The original hz queue keeps draining even when a route's scroll
      // consumer is disabled. Do not retain a frozen wheel packet for reopening.
      pendingWheel = steppedWheel = touchDelta = pointerDelta = delta = 0;
      wheelEvent = null;
      hub?.cancel(client);
      suppressClick = false;
      if (galleryInput() && galleryMotion) stopMomentum();
      return state();
    }
    const ratio = Number.isFinite(frameRatio) ? Math.max(0, frameRatio) : 0;
    flushWheel(ratio);
    const previous = current;
    // Exponential decay keeps the response consistent at 30/60/120 Hz.
    // Bound catch-up after a visible-frame stall instead of jumping to target.
    const blend = 1 - Math.pow(1 - clamp(0, 1, ease), Math.min(ratio, 2));
    current = roundPixel(current + (target - current) * blend);
    delta = current - previous;
    layout();
    return notify();
  }

  function reset(value = 0) {
    if (destroyed) return state();
    current = target = isFinite() ? clamp(0, maxScroll, value) : value;
    delta = pendingWheel = steppedWheel = touchDelta = pointerDelta = 0;
    wheelEvent = null;
    suppressClick = galleryMotion = touchDragging = touchTracking = false;
    touchAxis = null;
    touchVelocity = 0;
    layout(true);
    return notify();
  }

  function center(index) {
    const record = records[index + (resolve(lead) ? 1 : 0)];
    if (destroyed || !record || !viewport) return state();
    let value =
      axis === 'x'
        ? (record.start + screenWidth() + record.end) / 2 - screenWidth() / 2
        : record.base.top - viewport.top + (record.base.height - viewport.height) / 2;
    if (isFinite()) value = clamp(0, maxScroll, value);
    centeredIndex = index;
    centeredSize = axis === 'x' ? screenWidth() : viewport.height;
    return reset(value);
  }

  const pointerCoordinate = (event) => (axis === 'x' ? event.clientX : event.clientY);
  const client = {
    active: acceptsInput,
    contains: (targetElement) => Boolean(targetElement && container.contains?.(targetElement)),
    wheel(event) {
      if (!acceptsInput() || event.ctrlKey) return;
      const scale =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? galleryInput()
              ? inputExtent('height')
              : screenHeight()
            : 1;
      // ie consumes deltaY + deltaX. Carry both physical wheel axes into its
      // existing normalized queue; the vertical at consumer still uses Y only.
      const amount = ((event.deltaY || 0) + (axis === 'x' ? event.deltaX || 0 : 0)) * scale;
      const since = event.timeStamp - previousWheelTime;
      if (!galleryInput()) {
        if (since < 30) trackpadTime = event.timeStamp;
        const discrete =
          Math.abs(amount) >= 40 && since >= 30 && event.timeStamp - trackpadTime >= 500;
        if (discrete) steppedWheel += amount * 1.25 * 2;
        else pendingWheel += amount * 1.25;
      } else {
        // A burst of equal, coarse packets is still a mouse wheel even when
        // delivered rapidly. Variable/fractional pixel packets keep the good
        // trackpad path and its existing 1.25 gain.
        const magnitude = Math.abs(amount),
          coarse = magnitude >= 40 && Number.isInteger(amount),
          repeatedStep = wheelKind === 'wheel' && Math.abs(magnitude - wheelMagnitude) < 0.01,
          discrete =
            coarse &&
            (event.deltaMode !== 0 ||
              repeatedStep ||
              (since >= 30 && event.timeStamp - trackpadTime >= 500));
        if (discrete) {
          if (steppedWheel && Math.sign(steppedWheel) !== Math.sign(amount)) {
            steppedWheel = 0;
            target = current + (target - current) * 0.35;
          }
          const extent = inputExtent(axis === 'x' ? 'width' : 'height');
          steppedWheel = clamp(
            -extent * 0.75,
            extent * 0.75,
            steppedWheel +
              clamp(
                -(event.deltaMode === 2 ? extent : 240),
                event.deltaMode === 2 ? extent : 240,
                amount,
              ) *
                1.1,
          );
          wheelKind = 'wheel';
        } else {
          if (since < 30 || !Number.isInteger(amount)) trackpadTime = event.timeStamp;
          pendingWheel += amount * 1.25;
          wheelKind = 'trackpad';
        }
        wheelMagnitude = magnitude;
        galleryMotion = true;
      }
      previousWheelTime = event.timeStamp;
      wheelEvent = event;
    },
    touchStart(event) {
      const point = event.targetTouches?.[0] ?? event;
      touchY = point.clientY;
      touchDelta = 0;
      if (!galleryInput()) return;
      touchTracking =
        acceptsInput() &&
        (event.targetTouches?.length ?? 1) === 1 &&
        (!event.target || client.contains(event.target));
      touchDragging = false;
      touchAxis = null;
      touchVelocity = 0;
      touchTime = event.timeStamp;
      touchStartX = touchX = point.clientX || 0;
      touchStartY = touchY;
      suppressClick = touchTracking && moving();
      if (touchTracking) stopMomentum();
    },
    touchMove(event) {
      if (!acceptsInput()) return;
      const point = event.targetTouches?.[0] ?? event;
      if (!galleryInput()) {
        touchDelta = touchY - point.clientY;
        touchY = point.clientY;
        push(touchDelta * 3.25, 0, event);
        return;
      }
      if (!touchTracking) return;
      if ((event.targetTouches?.length ?? 1) !== 1) {
        client.touchCancel();
        return;
      }
      const x = point.clientX || 0,
        y = point.clientY,
        dx = touchStartX - x,
        dy = touchStartY - y;
      if (!touchAxis) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
        // Horizontal ribbons accept a horizontal iPad swipe or the familiar
        // vertical swipe, but lock once so diagonal jitter cannot add both.
        touchAxis = axis === 'x' && Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      touchDelta = touchAxis === 'x' ? touchX - x : touchY - y;
      const elapsed = clamp(1, 50, event.timeStamp - touchTime || 1000 / 60),
        velocity = clamp(-1.8, 1.8, touchDelta / elapsed),
        smoothing = 1 - Math.exp(-elapsed / 45);
      touchVelocity += (velocity - touchVelocity) * smoothing;
      touchX = x;
      touchY = y;
      touchTime = event.timeStamp;
      if (Math.abs(touchDelta) > 0) {
        touchDragging = suppressClick = galleryMotion = true;
        push(touchDelta * touchGain(), 0, event);
        const extent = inputExtent(axis === 'x' ? 'width' : 'height');
        target = current + clamp(-extent * 0.45, extent * 0.45, target - current);
      }
    },
    touchEnd(event) {
      if (!galleryInput()) {
        if (touchDelta) push(touchDelta * 35, 0, event);
      } else if (touchTracking && touchDragging && event.timeStamp - touchTime < 80) {
        const extent = inputExtent(axis === 'x' ? 'width' : 'height'),
          impulse = clamp(-extent * 0.35, extent * 0.35, touchVelocity * touchGain() * 180);
        push(impulse, 0, event);
        target = current + clamp(-extent * 0.55, extent * 0.55, target - current);
      }
      touchDelta = touchVelocity = 0;
      touchTracking = touchDragging = false;
      touchAxis = null;
    },
    touchCancel() {
      touchDelta = touchVelocity = 0;
      touchTracking = touchDragging = false;
      touchAxis = null;
    },
    blocksClick() {
      return galleryInput() && acceptsInput() && (suppressClick || touchDragging || moving());
    },
    consumeClick() {
      suppressClick = false;
    },
    key(event) {
      if (event.metaKey || event.ctrlKey || event.altKey || (event.shiftKey && event.key !== ' '))
        return;
      const element = event.target;
      if (element && (element.isContentEditable || ignoredKeys.test(element.tagName))) return;
      const page = screenHeight() * 0.9;
      let amount;
      switch (event.key) {
        case 'ArrowDown':
          amount = 100;
          break;
        case 'ArrowUp':
          amount = -100;
          break;
        case 'PageDown':
          amount = page;
          break;
        case 'PageUp':
          amount = -page;
          break;
        case ' ':
          amount = event.shiftKey ? -page : page;
          break;
        default:
          return;
      }
      event.preventDefault();
      push(amount, 0, event);
    },
    pointerDown(event) {
      if (galleryInput()) {
        suppressClick = (!event.target || client.contains(event.target)) && moving();
        if (suppressClick) stopMomentum();
      }
      downX = event.clientX;
      downY = event.clientY;
      pointerDelta = 0;
      dragging = false;
    },
    pointerMove(event) {
      if (!acceptsInput()) return false;
      if (!dragging) {
        const dx = Math.abs(event.clientX - downX);
        const dy = Math.abs(event.clientY - downY);
        const primary = axis === 'x' ? dx : dy;
        const cross = axis === 'x' ? dy : dx;
        if (primary <= 10 || primary <= cross) return false;
        dragging = true;
        if (galleryInput()) suppressClick = galleryMotion = true;
        pointerPosition = pointerCoordinate(event);
      }
      event.preventDefault();
      const position = pointerCoordinate(event);
      pointerDelta = (pointerPosition - position) * 1.5;
      pointerTime = event.timeStamp;
      pointerPosition = position;
      if (pointerDelta)
        push(axis === 'y' ? pointerDelta : 0, axis === 'x' ? pointerDelta : 0, event);
      return true;
    },
    pointerUp(event) {
      if (dragging && pointerDelta && event.timeStamp - pointerTime < 100) {
        push(axis === 'y' ? pointerDelta * 12 : 0, axis === 'x' ? pointerDelta * 12 : 0, event);
      }
      dragging = false;
      pointerDelta = 0;
    },
    pointerCancel() {
      dragging = false;
      pointerDelta = 0;
    },
  };
  const hub = input && win?.addEventListener ? sharedInputHub(win) : null;
  hub?.add(client);

  return {
    measure,
    tick,
    center,
    reset,
    push,
    setEnabled(value) {
      overrideEnabled = Boolean(value);
      if (!overrideEnabled) {
        pendingWheel = steppedWheel = touchDelta = pointerDelta = delta = 0;
        wheelEvent = null;
        hub?.cancel(client);
        suppressClick = false;
        if (galleryInput() && galleryMotion) stopMomentum();
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      hub?.remove(client);
      for (const [element, previous] of original) {
        element.style.transform = previous.transform;
        if (previous.hadRect) element._vrect = previous.vrect;
        else delete element._vrect;
        if (previous.hadParked) element._parked = previous.parked;
        else delete element._parked;
      }
      records = [];
      original.clear();
      pendingWheel = steppedWheel = touchDelta = pointerDelta = 0;
    },
    get current() {
      return current;
    },
    get target() {
      return target;
    },
    get velocity() {
      return target - current;
    },
    get delta() {
      return delta;
    },
    get dragged() {
      return dragging || touchDragging || (galleryInput() && (suppressClick || moving()));
    },
    get progress() {
      return progress();
    },
    get length() {
      return length;
    },
    get maxScroll() {
      return maxScroll;
    },
    get enabled() {
      return active();
    },
    get records() {
      return records;
    },
  };
}

export function createVerticalScroll({ outer, inner, ...options } = {}) {
  return createVirtualScroll({
    inputProfile: 'case',
    ...options,
    container: outer,
    inner,
    axis: 'y',
  });
}
