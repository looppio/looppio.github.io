import test from 'node:test';
import assert from 'node:assert/strict';
import { createVirtualScroll, createVerticalScroll, wrap } from '../src/reference/scroll.js';

function fixture({
  axis = 'y',
  count = 3,
  itemSize = 600,
  gap = 20,
  width = 1000,
  height = 800,
  top = 0,
} = {}) {
  const listeners = new Map();
  const classes = new Set();
  const win = {
    listeners,
    devicePixelRatio: 1,
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) {
      listeners.get(type)?.delete(callback);
    },
    getComputedStyle(element) {
      return element.computed || {};
    },
    requestAnimationFrame() {
      throw new Error('The scroll adapter must not own an RAF');
    },
    emit(type, fields = {}) {
      const event = {
        type,
        target: null,
        timeStamp: 1000,
        deltaY: 0,
        deltaX: 0,
        deltaMode: 0,
        clientX: 0,
        clientY: 0,
        button: 0,
        pointerType: 'mouse',
        prevented: false,
        stopped: false,
        preventDefault() {
          this.prevented = true;
        },
        stopPropagation() {
          this.stopped = true;
        },
        ...fields,
      };
      for (const callback of listeners.get(type) || []) callback(event);
      return event;
    },
  };
  const doc = {
    defaultView: win,
    documentElement: {
      clientWidth: width,
      clientHeight: height,
      classList: {
        toggle(name, value) {
          if (value) classes.add(name);
          else classes.delete(name);
        },
      },
    },
  };
  win.document = doc;
  const element = (left, y, w, h) => {
    const el = {
      ownerDocument: doc,
      tagName: 'DIV',
      style: { transform: '' },
      box: { left, top: y, width: w, height: h },
      children: [],
      get clientHeight() {
        return this.box.height;
      },
      get clientWidth() {
        return this.box.width;
      },
      closest() {
        return null;
      },
      contains(target) {
        return this === target || this.children.some((child) => child.contains(target));
      },
      getBoundingClientRect() {
        const move = this.style.transform.match(/translate3d\(([-.\d]+)px,\s*([-.\d]+)px/);
        const x = this.box.left + (move ? Number(move[1]) : 0);
        const y = this.box.top + (move ? Number(move[2]) : 0);
        return {
          ...this.box,
          left: x,
          top: y,
          right: x + this.box.width,
          bottom: y + this.box.height,
        };
      },
    };
    return el;
  };
  const outer = element(0, top, width, height);
  const inner = element(0, top, width, height);
  inner.computed = {
    rowGap: String(gap),
    columnGap: String(gap),
    paddingBottom: '0',
    paddingRight: '0',
  };
  const children = Array.from({ length: count }, (_, i) =>
    axis === 'x'
      ? element(i * (itemSize + gap), top + 100, itemSize, 300)
      : element(0, top + i * (itemSize + gap), width, itemSize),
  );
  for (const child of children) child.parentElement = inner;
  inner.children = children;
  inner.parentElement = outer;
  inner.scrollHeight = axis === 'y' ? count * (itemSize + gap) - gap : 300;
  outer.children = [inner];
  const create = (options) => createVirtualScroll({ container: outer, inner, axis, ...options });
  return { win, doc, outer, inner, children, element, classes, create };
}

test('per-element horizontal wrap remains continuous after many laps in both directions', () => {
  const f = fixture({ axis: 'x', itemSize: 400, gap: 10 });
  const scroll = f.create({ input: false });
  scroll.measure();
  assert.equal(scroll.length, 1230);
  scroll.reset(5 * 1230 + 900);
  assert.deepEqual(
    f.children.map((el) => el._vrect.left),
    [330, 740, -80],
  );
  const ordered = f.children.map((el) => el._vrect).sort((a, b) => a.left - b.left);
  assert.equal(ordered[1].left - ordered[0].right, 10);
  assert.equal(ordered[2].left - ordered[1].right, 10);
  scroll.reset(-7 * 1230 - 900);
  assert.deepEqual(
    f.children.map((el) => el._vrect.left),
    [-330, 80, 490],
  );
  assert.equal(scroll.current, -9510);
  assert.equal(scroll.progress, 330 / 1230);
  assert.equal(wrap(-830, 400, 400), -830);
  scroll.destroy();
});

test('interpolation uses exponential .1 response, bounds catch-up, and rounds to .01 CSS px', () => {
  const f = fixture();
  const scroll = f.create({ input: false });
  scroll.measure();
  scroll.push(100);
  assert.equal(scroll.tick(1).current, 10);
  assert.equal(scroll.tick(20).current, 27.1);
  assert.equal(scroll.tick(0).current, 27.1);
  assert.equal(scroll.tick(0.5).current, 30.84);
  assert.equal(scroll.velocity, 69.16);
  scroll.destroy();
});

test('desktop horizontal tanh limits target lag instead of clamping the carousel', () => {
  const f = fixture({ axis: 'x', itemSize: 400, gap: 10 });
  const scroll = f.create({ input: false });
  scroll.measure();
  scroll.reset(100000);
  scroll.push(100000);
  assert.equal(scroll.target, 101000);
  assert.equal(scroll.current, 100000);
  assert.equal(scroll.tick(1).current, 100100);
  scroll.push(-100000);
  assert.equal(scroll.target, 99100);
  f.doc.documentElement.clientWidth = 649;
  scroll.reset(0);
  scroll.push(10000);
  assert.equal(scroll.target, 10000, 'the <=649px branch has no desktop lag limiter');
  scroll.destroy();
});

test('finite column clamps input and reports real normalized progress at both ends', () => {
  const f = fixture();
  const reported = [];
  const scroll = createVerticalScroll({
    outer: f.outer,
    inner: f.inner,
    finite: true,
    input: false,
    onProgress: (value) => reported.push(value),
  });
  scroll.measure();
  assert.equal(scroll.length, 1860);
  assert.equal(scroll.maxScroll, 1040);
  scroll.reset(100000);
  assert.equal(scroll.current, 1040);
  assert.equal(scroll.progress, 1);
  scroll.push(-100000);
  assert.equal(scroll.target, 0);
  assert.equal(scroll.tick(2).current, 842.4);
  assert.ok(Math.abs(scroll.progress - 0.81) < 1e-12);
  scroll.reset(-1000);
  assert.equal(scroll.current, 0);
  assert.equal(reported.at(-1), 0);
  scroll.destroy();
});

test('vertical lead, inner row gap and viewport offset participate in the source length', () => {
  const f = fixture({ count: 2, top: 100 });
  const lead = f.element(0, 100, 1000, 200);
  lead.parentElement = f.outer;
  f.outer.children.unshift(lead);
  f.inner.box.top = 320;
  f.children.forEach((el, index) => {
    el.box.top = 320 + index * 620;
  });
  const scroll = createVerticalScroll({
    outer: f.outer,
    inner: f.inner,
    lead,
    finite: true,
    input: false,
  });
  scroll.measure();
  assert.equal(scroll.records.length, 3);
  assert.equal(scroll.length, 1460);
  assert.equal(scroll.maxScroll, 640);
  scroll.center(0);
  assert.equal(scroll.current, 120, 'index zero centers the first media item, after lead');
  assert.equal(f.children[0]._vrect.top, 200);
  scroll.destroy();
});

test('measure removes prior transforms and keeps DOM rects independent of renderer DPR', () => {
  const f = fixture({ axis: 'x', itemSize: 400, gap: 10 });
  const scroll = f.create({ input: false });
  scroll.measure();
  scroll.reset(200);
  const first = { ...f.children[0]._vrect };
  f.win.devicePixelRatio = 2;
  scroll.measure();
  assert.deepEqual(f.children[0]._vrect, first);
  assert.equal(f.children[0].style.transform, 'translate3d(-200px, 0px, 0px)');
  assert.equal(f.children[0]._vrect.width, 400);
  scroll.destroy();
});

test('resize preserves an explicitly centered item and recomputes finite bounds', () => {
  const f = fixture();
  const scroll = f.create({ finite: true, input: false });
  scroll.measure();
  scroll.center(1);
  assert.equal(scroll.current, 520);
  f.outer.box.height = 1000;
  f.doc.documentElement.clientHeight = 1000;
  scroll.measure();
  assert.equal(scroll.current, 420);
  assert.equal(scroll.target, 420);
  assert.equal(scroll.maxScroll, 840);
  assert.equal(f.children[1]._vrect.top + 300, 500);
  scroll.destroy();
});

test('finite resize clamps the target while allowing the old current value to ease back', () => {
  const f = fixture();
  const scroll = f.create({ finite: true, input: false });
  scroll.measure();
  scroll.reset(1000);
  f.outer.box.height = 1200;
  scroll.measure();
  assert.equal(scroll.maxScroll, 640);
  assert.equal(scroll.target, 640);
  assert.equal(scroll.current, 1000);
  assert.equal(scroll.tick(2).current, 931.6);
  assert.equal(scroll.progress, 1);
  scroll.destroy();
});

test('offscreen parking waits one frame and reset force-unparks every item', () => {
  const f = fixture({ axis: 'x', count: 8, itemSize: 400, gap: 10 });
  const scroll = f.create({ input: false });
  scroll.measure();
  const far = f.children[5];
  assert.equal(far._parked, false);
  scroll.tick(1);
  assert.equal(far._parked, false);
  scroll.tick(1);
  assert.equal(far._parked, true);
  scroll.reset(2000);
  assert.equal(far._parked, false);
  scroll.destroy();
});

test('case wheel retains its source gain and .22 queue dissipation', () => {
  const f = fixture();
  const scroll = createVerticalScroll({ outer: f.outer, inner: f.inner });
  scroll.measure();
  f.win.emit('wheel', { target: f.children[0], deltaY: 100, timeStamp: 1000 });
  assert.equal(scroll.target, 0, 'input waits for the host tick');
  scroll.tick(1);
  assert.ok(Math.abs(scroll.target - 55) < 1e-10);
  scroll.tick(1);
  assert.ok(Math.abs(scroll.target - 97.9) < 1e-10);
  scroll.destroy();
});

test('case wheel line/page units and fast trackpad packets retain their behavior', () => {
  const f = fixture();
  const scroll = createVerticalScroll({ outer: f.outer, inner: f.inner });
  scroll.measure();
  f.win.emit('wheel', { deltaY: 1, deltaMode: 1, timeStamp: 1000 });
  scroll.tick(1);
  assert.equal(scroll.target, 20);
  scroll.reset(0);
  f.win.emit('wheel', { deltaY: 1, deltaMode: 2, timeStamp: 1010 });
  scroll.tick(1);
  assert.equal(scroll.target, 1000);
  scroll.reset(0);
  f.win.emit('wheel', { deltaY: 10, timeStamp: 1020 });
  scroll.tick(1);
  assert.equal(scroll.target, 12.5);
  scroll.destroy();
});

test('desktop horizontal trackpad wheel moves actual card rects in both directions', () => {
  const f = fixture({ axis: 'x', itemSize: 400, gap: 10 });
  const scroll = f.create();
  scroll.measure();
  f.win.emit('wheel', { target: f.children[0], deltaX: 10, deltaY: 0, timeStamp: 1000 });
  scroll.tick(1);
  assert.ok(
    scroll.target > 12 && scroll.target < 12.5,
    'horizontal input retains desktop tanh lag',
  );
  assert.equal(scroll.current, 1.25);
  assert.equal(f.children[0]._vrect.left, -1.25);
  scroll.reset(0);
  f.win.emit('wheel', { target: f.children[0], deltaX: -10, deltaY: 0, timeStamp: 1010 });
  scroll.tick(1);
  assert.equal(scroll.current, -1.25);
  assert.equal(f.children[0]._vrect.left, 1.25);
  scroll.destroy();
});

test('horizontal mixed-axis wheel sums signed deltas once and allows cancellation', () => {
  const f = fixture({ axis: 'x', itemSize: 400, gap: 10 });
  const scroll = f.create();
  scroll.measure();
  f.win.emit('wheel', { deltaX: 8, deltaY: 12, timeStamp: 1000 });
  scroll.tick(1);
  assert.equal(scroll.current, 2.5);
  scroll.reset(0);
  f.win.emit('wheel', { deltaX: 12, deltaY: -8, timeStamp: 1010 });
  scroll.tick(1);
  assert.equal(scroll.current, 0.5);
  scroll.reset(0);
  f.win.emit('wheel', { deltaX: 12, deltaY: -12, timeStamp: 1020 });
  scroll.tick(1);
  assert.equal(scroll.target, 0);
  assert.equal(scroll.current, 0);
  scroll.destroy();
});

test('large horizontal wheel packets use the same queued dissipation as vertical wheel on the gallery', () => {
  const a = fixture({ axis: 'x', itemSize: 400, gap: 10 });
  const b = fixture({ axis: 'x', itemSize: 400, gap: 10 });
  const horizontal = a.create(),
    vertical = b.create();
  horizontal.measure();
  vertical.measure();
  a.win.emit('wheel', { deltaX: 100, deltaY: 0, timeStamp: 1000 });
  b.win.emit('wheel', { deltaX: 0, deltaY: 100, timeStamp: 1000 });
  for (let frame = 0; frame < 12; frame += 1) {
    horizontal.tick(1);
    vertical.tick(1);
    assert.equal(horizontal.target, vertical.target);
    assert.equal(horizontal.current, vertical.current);
    assert.deepEqual(a.children[0]._vrect, b.children[0]._vrect);
  }
  assert.ok(horizontal.current > 0);
  horizontal.destroy();
  vertical.destroy();
});

test('horizontal wheel line/page units normalize both axes and ignore pinch zoom', () => {
  const f = fixture({ axis: 'x', itemSize: 400, gap: 10 });
  const scroll = f.create();
  scroll.measure();
  f.win.emit('wheel', { deltaX: 1, deltaY: 0, deltaMode: 1, timeStamp: 1000 });
  scroll.tick(1);
  assert.equal(scroll.current, 2);
  scroll.reset(0);
  f.win.emit('wheel', { deltaX: 1, deltaY: 0, deltaMode: 2, timeStamp: 1010 });
  scroll.tick(1);
  assert.ok(
    scroll.current > 10 && scroll.current < 12,
    'page packets are normalized and smoothed rather than jumping a page',
  );
  scroll.reset(0);
  f.win.emit('wheel', { deltaX: 10, deltaY: 10, ctrlKey: true, timeStamp: 1020 });
  scroll.tick(1);
  assert.equal(scroll.target, 0);
  assert.equal(scroll.current, 0);
  scroll.destroy();
});

test('finite vertical case ignores horizontal wheel and keeps mixed gestures on deltaY', () => {
  const f = fixture();
  const scroll = f.create({ finite: true });
  scroll.measure();
  f.win.emit('wheel', { deltaX: 100, deltaY: 0, timeStamp: 1000 });
  scroll.tick(1);
  assert.equal(scroll.target, 0);
  f.win.emit('wheel', { deltaX: -1000, deltaY: 10, timeStamp: 1010 });
  scroll.tick(1);
  assert.equal(scroll.target, 12.5);
  assert.equal(scroll.current, 1.25);
  assert.equal(f.children[0]._vrect.top, -1.25);
  scroll.destroy();
});

test('case touch retains source gain and release behavior; cancel drops the impulse', () => {
  const f = fixture();
  const scroll = createVerticalScroll({ outer: f.outer, inner: f.inner });
  scroll.measure();
  f.win.emit('touchstart', { target: f.children[0], targetTouches: [{ clientY: 500 }] });
  f.win.emit('touchmove', { targetTouches: [{ clientY: 490 }] });
  assert.equal(scroll.target, 32.5);
  f.win.emit('touchend');
  assert.equal(scroll.target, 382.5);
  scroll.reset(0);
  f.win.emit('touchstart', { targetTouches: [{ clientY: 500 }] });
  f.win.emit('touchmove', { targetTouches: [{ clientY: 490 }] });
  f.win.emit('touchcancel');
  f.win.emit('touchend');
  assert.equal(scroll.target, 32.5);
  scroll.destroy();
});

test('mouse drag requires source >10px axis dominance, then uses 1.5 movement and recent 12x momentum', () => {
  const f = fixture({ axis: 'x', width: 500 });
  const scroll = f.create();
  scroll.measure();
  f.win.emit('pointerdown', { target: f.children[0], clientX: 100, clientY: 100 });
  assert.equal(f.win.emit('pointermove', { clientX: 91, clientY: 101 }).prevented, false);
  assert.equal(f.win.emit('pointermove', { clientX: 80, clientY: 130 }).prevented, false);
  f.win.emit('pointermove', { clientX: 70, clientY: 105, timeStamp: 120 });
  assert.equal(scroll.target, 0, 'the threshold-crossing point becomes drag origin');
  f.win.emit('pointermove', { clientX: 60, clientY: 105, timeStamp: 130 });
  assert.equal(scroll.target, 15);
  assert.equal(f.classes.has('grabbing'), true);
  f.win.emit('pointerup', { timeStamp: 150 });
  assert.equal(scroll.target, 195);
  assert.equal(f.classes.has('grabbing'), false);
  const firstClick = f.win.emit('click');
  assert.equal(firstClick.prevented, true);
  assert.equal(firstClick.stopped, true);
  assert.equal(f.win.emit('click').prevented, false);
  scroll.destroy();
});

test('mouse release after 100ms does not add stale momentum', () => {
  const f = fixture();
  const scroll = f.create();
  scroll.measure();
  f.win.emit('pointerdown', { clientX: 10, clientY: 100, timeStamp: 0 });
  f.win.emit('pointermove', { clientX: 10, clientY: 80, timeStamp: 10 });
  f.win.emit('pointermove', { clientX: 10, clientY: 70, timeStamp: 20 });
  f.win.emit('pointerup', { timeStamp: 120 });
  assert.equal(scroll.target, 15);
  scroll.destroy();
});

test('keyboard uses source page size and leaves form controls, links and modified shortcuts alone', () => {
  const f = fixture();
  const scroll = f.create();
  scroll.measure();
  assert.equal(f.win.emit('keydown', { key: 'ArrowDown' }).prevented, true);
  f.win.emit('keydown', { key: 'PageDown' });
  assert.equal(scroll.target, 820);
  f.win.emit('keydown', { key: ' ', shiftKey: true });
  assert.equal(scroll.target, 100);
  for (const tagName of ['INPUT', 'TEXTAREA', 'BUTTON', 'A']) {
    assert.equal(f.win.emit('keydown', { key: 'ArrowDown', target: { tagName } }).prevented, false);
  }
  f.win.emit('keydown', { key: 'ArrowDown', metaKey: true });
  f.win.emit('keydown', { key: 'ArrowDown', target: { isContentEditable: true } });
  assert.equal(scroll.target, 100);
  scroll.destroy();
});

test('input lock leaves frame interpolation running and prevents vertical input during case scrub', () => {
  const f = fixture();
  let blocked = false;
  const scroll = f.create({ blocked: () => blocked });
  scroll.measure();
  scroll.push(100);
  blocked = true;
  f.win.emit('keydown', { key: 'ArrowDown' });
  scroll.tick(1);
  assert.equal(scroll.target, 100);
  assert.equal(scroll.current, 10);
  blocked = false;
  f.outer.closest = (selector) => (selector === '[data-scrubbing="true"]' ? f.outer : null);
  scroll.push(100);
  assert.equal(scroll.target, 100);
  scroll.destroy();
});

test('controllers share one listener set, disabling drops pending input, final destroy removes everything', () => {
  const f = fixture();
  const first = f.create();
  const second = f.create({ enabled: false });
  first.measure();
  assert.equal(f.win.listeners.get('wheel').size, 1);
  assert.equal(f.win.listeners.get('keydown').size, 1);
  f.win.emit('keydown', { key: 'ArrowDown' });
  assert.equal(first.target, 100);
  assert.equal(second.target, 0);
  f.win.emit('wheel', { deltaY: 100 });
  first.setEnabled(false);
  first.setEnabled(true);
  first.tick(1);
  assert.equal(
    first.target,
    first.current,
    'queued wheel input and user momentum stop while disabled',
  );
  first.destroy();
  assert.equal(f.win.listeners.get('wheel').size, 1);
  assert.equal('_vrect' in f.children[0], false);
  assert.equal(f.children[0].style.transform, '');
  second.setEnabled(true);
  second.measure();
  f.win.emit('keydown', { key: 'ArrowDown' });
  assert.equal(second.target, 100);
  second.destroy();
  second.destroy();
  assert.equal(
    [...f.win.listeners.values()].every((callbacks) => callbacks.size === 0),
    true,
  );
  assert.equal(f.classes.has('grabbable'), false);
});

test('route enabled getter drops frozen wheel packets before the view reopens', () => {
  const f = fixture();
  let enabled = true;
  const scroll = f.create({ enabled: () => enabled });
  scroll.measure();
  f.win.emit('wheel', { deltaY: 100 });
  enabled = false;
  scroll.tick(1);
  enabled = true;
  scroll.tick(1);
  assert.equal(scroll.target, 0);
  assert.equal(scroll.current, 0);
  scroll.destroy();
});

test('unequal-width cards keep every cyclic gap across one thousand large bidirectional jumps', () => {
  const f = fixture({ axis: 'x', itemSize: 400, gap: 10 });
  f.children[1].box.width = 600;
  f.children[2].box.left = 1020;
  f.children[2].box.width = 300;
  const scroll = f.create({ input: false });
  scroll.measure();
  assert.equal(scroll.length, 1330);
  let seed = 713;
  for (let iteration = 0; iteration < 1000; iteration += 1) {
    seed = (seed * 16807) % 2147483647;
    scroll.reset((seed % 20000000) - 10000000 + 0.25);
    const ordered = f.children.map((el) => el._vrect).sort((a, b) => a.left - b.left);
    assert.ok(Math.abs(ordered[1].left - ordered[0].right - 10) < 1e-7);
    assert.ok(Math.abs(ordered[2].left - ordered[1].right - 10) < 1e-7);
    assert.ok(Math.abs(ordered[0].left + scroll.length - ordered[2].right - 10) < 1e-7);
    assert.ok(scroll.progress >= 0 && scroll.progress < 1);
  }
  scroll.destroy();
});

test('phone gallery follows a finger near 1:1 with bounded, velocity-based release', () => {
  const f = fixture({ width: 390, height: 844, itemSize: 300 });
  const scroll = f.create();
  scroll.measure();
  f.win.emit('touchstart', {
    target: f.children[0],
    timeStamp: 1000,
    targetTouches: [{ clientX: 100, clientY: 500 }],
  });
  f.win.emit('touchmove', { timeStamp: 1016, targetTouches: [{ clientX: 100, clientY: 460 }] });
  assert.equal(scroll.target, 44);
  assert.equal(scroll.dragged, true);
  f.win.emit('touchend', { timeStamp: 1032 });
  assert.ok(
    scroll.target > 44 && scroll.target < 200,
    'release continues gently, not last-packet ×35',
  );
  const click = f.win.emit('click', { target: f.children[0], detail: 1 });
  assert.equal(click.prevented, true);
  assert.equal(click.stopped, true);
  scroll.tick(1);
  assert.ok(scroll.delta > 0);
  assert.equal(scroll.dragged, true, 'drag rejection survives pointer release through inertia');
  for (let i = 0; i < 180; i++) scroll.tick(1);
  assert.equal(scroll.dragged, false);
  f.win.emit('touchstart', {
    target: f.children[0],
    timeStamp: 5000,
    targetTouches: [{ clientX: 100, clientY: 500 }],
  });
  f.win.emit('touchend', { timeStamp: 5016 });
  assert.equal(f.win.emit('click', { target: f.children[0], detail: 1 }).prevented, false);
  scroll.destroy();
});

test('touch release distance is independent of 30 Hz versus 60 Hz input packet frequency', () => {
  const ends = [];
  for (const interval of [16, 32]) {
    const f = fixture({ width: 390, height: 844 });
    const scroll = f.create();
    scroll.measure();
    f.win.emit('touchstart', {
      target: f.children[0],
      timeStamp: 1000,
      targetTouches: [{ clientX: 100, clientY: 500 }],
    });
    for (let time = interval; time <= 160; time += interval)
      f.win.emit('touchmove', {
        timeStamp: 1000 + time,
        targetTouches: [{ clientX: 100, clientY: 500 - time * 0.625 }],
      });
    f.win.emit('touchend', { timeStamp: 1170 });
    ends.push(scroll.target);
    scroll.destroy();
  }
  assert.ok(Math.abs(ends[0] - ends[1]) < 0.001);
});

test('gallery inertia uses the visible viewport without changing layout measurements', () => {
  const results = [];
  for (const visibleHeight of [844, 580]) {
    const f = fixture({ width: 390, height: 844 });
    f.win.visualViewport = { width: 390, height: visibleHeight };
    const scroll = f.create();
    scroll.measure();
    const length = scroll.length;
    f.win.emit('touchstart', {
      target: f.children[0],
      timeStamp: 1000,
      targetTouches: [{ clientX: 100, clientY: 800 }],
    });
    f.win.emit('touchmove', { timeStamp: 1016, targetTouches: [{ clientX: 100, clientY: 0 }] });
    assert.equal(scroll.target, visibleHeight * 0.45);
    f.win.emit('touchend', { timeStamp: 1032 });
    assert.ok(scroll.target <= visibleHeight * 0.55);
    assert.equal(scroll.length, length);
    assert.equal(f.doc.documentElement.clientHeight, 844);
    results.push(scroll.target);
    scroll.destroy();
  }
  assert.ok(results[1] < results[0]);
  assert.ok(Math.abs(results[1] - 319) < 0.01);
});

test('input budgets ignore invalid visual viewport values and use a smaller measured container', () => {
  const f = fixture({ width: 390, height: 844 });
  f.win.visualViewport = { width: 0, height: Number.NaN };
  f.outer.box.height = 500;
  const scroll = f.create();
  scroll.measure();
  f.win.emit('touchstart', {
    target: f.children[0],
    timeStamp: 1000,
    targetTouches: [{ clientX: 100, clientY: 800 }],
  });
  f.win.emit('touchmove', { timeStamp: 1016, targetTouches: [{ clientX: 100, clientY: 0 }] });
  assert.equal(scroll.target, 225);
  scroll.destroy();
});

test('iPad horizontal ribbon accepts either swipe direction and locks its dominant touch axis', () => {
  const ends = [];
  for (const horizontal of [true, false]) {
    const f = fixture({ axis: 'x', width: 1024, height: 1366, itemSize: 400 });
    const scroll = f.create();
    scroll.measure();
    f.win.emit('touchstart', {
      target: f.children[0],
      timeStamp: 1000,
      targetTouches: [{ clientX: 800, clientY: 600 }],
    });
    f.win.emit('touchmove', {
      timeStamp: 1016,
      targetTouches: [horizontal ? { clientX: 740, clientY: 598 } : { clientX: 798, clientY: 540 }],
    });
    assert.ok(scroll.target > 70 && scroll.target < 75);
    ends.push(scroll.target);
    scroll.tick(1);
    assert.ok(f.children[0]._vrect.left < 0);
    if (horizontal) {
      const before = scroll.target;
      f.win.emit('touchmove', { timeStamp: 1032, targetTouches: [{ clientX: 739, clientY: 530 }] });
      assert.ok(
        scroll.target - before < 3,
        'cross-axis noise cannot accelerate a locked horizontal swipe',
      );
    }
    scroll.destroy();
  }
  assert.equal(ends[0], ends[1]);
});

test('tapping during momentum stops movement without opening a card; the following tap works', () => {
  const f = fixture({ width: 390, height: 844 });
  const scroll = f.create();
  scroll.measure();
  f.win.emit('touchstart', {
    target: f.children[0],
    timeStamp: 1000,
    targetTouches: [{ clientX: 100, clientY: 500 }],
  });
  f.win.emit('touchmove', { timeStamp: 1016, targetTouches: [{ clientX: 100, clientY: 450 }] });
  f.win.emit('touchend', { timeStamp: 1032 });
  scroll.tick(1);
  f.win.emit('touchstart', {
    target: f.children[1],
    timeStamp: 1050,
    targetTouches: [{ clientX: 100, clientY: 400 }],
  });
  assert.equal(scroll.target, scroll.current);
  f.win.emit('touchend', { timeStamp: 1070 });
  assert.equal(f.win.emit('click', { target: f.children[1], detail: 1 }).prevented, true);
  assert.equal(scroll.dragged, false);
  f.win.emit('touchstart', {
    target: f.children[1],
    timeStamp: 1100,
    targetTouches: [{ clientX: 100, clientY: 400 }],
  });
  f.win.emit('touchend', { timeStamp: 1120 });
  assert.equal(f.win.emit('click', { target: f.children[1], detail: 1 }).prevented, false);
  scroll.destroy();
});

test('gallery gesture protection leaves header controls and keyboard activation alone', () => {
  const f = fixture({ width: 390, height: 844 });
  const scroll = f.create();
  scroll.measure();
  f.win.emit('touchstart', {
    target: f.children[0],
    timeStamp: 1000,
    targetTouches: [{ clientX: 100, clientY: 500 }],
  });
  f.win.emit('touchmove', { timeStamp: 1016, targetTouches: [{ clientX: 100, clientY: 400 }] });
  f.win.emit('touchend', { timeStamp: 1032 });
  const header = f.element(0, 0, 100, 40);
  assert.equal(f.win.emit('click', { target: header, detail: 1 }).prevented, false);
  assert.equal(f.win.emit('click', { target: f.children[0], detail: 0 }).prevented, false);
  scroll.setEnabled(false);
  scroll.setEnabled(true);
  assert.equal(scroll.dragged, false);
  scroll.destroy();
});

test('touch slop, pause, cancel and pinch do not create stale release impulses', () => {
  const f = fixture({ width: 390, height: 844 });
  const scroll = f.create();
  scroll.measure();
  const start = (time) =>
    f.win.emit('touchstart', {
      target: f.children[0],
      timeStamp: time,
      targetTouches: [{ clientX: 100, clientY: 500 }],
    });
  start(1000);
  f.win.emit('touchmove', { timeStamp: 1016, targetTouches: [{ clientX: 103, clientY: 497 }] });
  f.win.emit('touchend', { timeStamp: 1032 });
  assert.equal(scroll.target, 0);
  assert.equal(scroll.dragged, false);
  start(1100);
  f.win.emit('touchmove', { timeStamp: 1116, targetTouches: [{ clientX: 100, clientY: 480 }] });
  const before = scroll.target;
  f.win.emit('touchend', { timeStamp: 1300 });
  assert.equal(scroll.target, before, 'holding still before release adds no fling');
  scroll.reset(0);
  start(1400);
  f.win.emit('touchmove', { timeStamp: 1416, targetTouches: [{ clientX: 100, clientY: 480 }] });
  const cancelled = scroll.target;
  f.win.emit('touchcancel');
  f.win.emit('touchend', { timeStamp: 1432 });
  assert.equal(scroll.target, cancelled);
  scroll.reset(0);
  start(1500);
  f.win.emit('touchmove', {
    timeStamp: 1516,
    targetTouches: [
      { clientX: 100, clientY: 450 },
      { clientX: 150, clientY: 450 },
    ],
  });
  f.win.emit('touchend', { timeStamp: 1532 });
  assert.equal(scroll.target, 0);
  scroll.destroy();
});

test('equal rapid mouse-wheel notches stay smoothed rather than switching into the trackpad path', () => {
  const f = fixture({ axis: 'x' });
  const scroll = f.create();
  scroll.measure();
  for (let i = 0; i < 3; i++)
    f.win.emit('wheel', { target: f.children[0], timeStamp: 1000 + i * 10, deltaY: 100 });
  assert.equal(scroll.target, 0);
  scroll.tick(1);
  assert.ok(scroll.current > 4 && scroll.current < 5, 'all three notches enter the smooth queue');
  const deltas = [scroll.delta];
  for (let i = 0; i < 90; i++) {
    scroll.tick(1);
    deltas.push(scroll.delta);
  }
  assert.ok(scroll.current > 250 && scroll.current < 330);
  assert.ok(Math.max(...deltas) < 20);
  assert.ok(deltas.every((value, i) => i === 0 || Math.abs(value - deltas[i - 1]) < 4));
  scroll.destroy();
});

test('wheel reversal brakes pending forward impulses instead of fighting the new direction', () => {
  const f = fixture({ axis: 'x' });
  const scroll = f.create();
  scroll.measure();
  for (let i = 0; i < 5; i++) f.win.emit('wheel', { timeStamp: 1000 + i * 10, deltaY: 100 });
  scroll.tick(1);
  const before = scroll.current;
  f.win.emit('wheel', { timeStamp: 1060, deltaY: -100 });
  for (let i = 0; i < 30; i++) scroll.tick(1);
  assert.ok(scroll.current < before, 'reversed intent wins over the remaining forward wheel queue');
  scroll.destroy();
});

test('gallery decay matches elapsed time at 30, 60 and 120 Hz and bounds a stalled frame', () => {
  const positions = [];
  for (const hz of [30, 60, 120]) {
    const f = fixture();
    const scroll = f.create({ input: false });
    scroll.measure();
    scroll.push(1000);
    for (let i = 0; i < hz / 5; i++) scroll.tick(60 / hz);
    positions.push(scroll.current);
    scroll.destroy();
  }
  assert.ok(Math.max(...positions) - Math.min(...positions) < 0.06);
  const f = fixture();
  const scroll = f.create({ input: false });
  scroll.measure();
  scroll.push(1000);
  scroll.tick(600);
  assert.equal(scroll.current, 190);
  scroll.destroy();
});
