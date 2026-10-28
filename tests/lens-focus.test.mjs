import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreFocusAfterLens } from '../src/lensFocus.js';

function eventHub() {
  const listeners = new Map();
  return {
    addEventListener(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
    },
    removeEventListener(name, fn) {
      listeners.get(name)?.delete(fn);
    },
    fire(name, event = {}) {
      for (const fn of [...(listeners.get(name) || [])]) fn(event);
    },
    listenerCount: () => [...listeners.values()].reduce((n, set) => n + set.size, 0),
  };
}

function fixture() {
  const timers = new Map();
  const doc = { ...eventHub(), body: {}, documentElement: {}, hidden: false };
  const win = {
    ...eventHub(),
    getComputedStyle: (element) => element.style,
    setTimeout(fn, delay) {
      const id = {};
      timers.set(id, { fn, delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  const control = () => ({
    isConnected: true,
    inert: false,
    style: {},
    focuses: [],
    getClientRects: () => [{}],
    closest(selector) {
      return selector.includes('button') ? this : null;
    },
    focus(options) {
      this.focuses.push(options);
      doc.activeElement = this;
      doc.fire('focusin', { target: this });
    },
  });
  const target = control();
  doc.activeElement = control();
  const start = () => restoreFocusAfterLens(target, { window: win, document: doc });
  const tick = () => win.fire('portfolio-tick');
  const assertClean = () => {
    assert.equal(win.listenerCount() + doc.listenerCount(), 0);
    assert.equal(timers.size, 0);
  };
  return { target, doc, win, timers, control, start, tick, assertClean };
}

test('an uncovered trigger receives focus immediately without scrolling or waiting', () => {
  const f = fixture();
  f.start();
  assert.deepEqual(f.target.focuses, [{ preventScroll: true }]);
  f.assertClean();
});

test('an occluded trigger waits for a lens tick after it is uncovered, then restores focus once', () => {
  const f = fixture();
  f.target.inert = true;
  f.start();
  f.tick();
  assert.equal(f.target.focuses.length, 0);
  // Removing the closing panel naturally leaves focus on the body.
  f.doc.activeElement = f.doc.body;
  f.target.inert = false;
  f.tick();
  f.tick();
  assert.equal(f.doc.activeElement, f.target);
  assert.equal(f.target.focuses.length, 1);
  f.assertClean();
});

test('inherited inert, hidden layout, and disabled controls cannot receive return focus', () => {
  for (const blocked of ['ancestor', 'hidden', 'layout', 'disabled']) {
    const f = fixture();
    const closest = f.target.closest;
    if (blocked === 'ancestor') f.target.closest = () => ({});
    if (blocked === 'hidden') f.target.style.visibility = 'hidden';
    if (blocked === 'layout') f.target.getClientRects = () => [];
    if (blocked === 'disabled') f.target.disabled = true;
    f.start();
    f.tick();
    assert.equal(f.target.focuses.length, 0, blocked);
    f.target.closest = closest;
    f.target.style = {};
    f.target.getClientRects = () => [{}];
    f.target.disabled = false;
    f.tick();
    assert.equal(f.target.focuses.length, 1, blocked);
    f.assertClean();
  }
});

test('new focus, keyboard navigation, or another control click cancels return focus without trapping input', () => {
  for (const action of ['focusin', 'silent-focus', 'Tab', 'pointerdown']) {
    const f = fixture();
    f.target.inert = true;
    f.start();
    const other = f.control();
    let prevented = false;
    const event = { target: other, key: 'Tab', preventDefault: () => (prevented = true) };
    if (action === 'focusin') other.focus();
    else if (action === 'silent-focus') f.doc.activeElement = other;
    else f.doc.fire(action === 'Tab' ? 'keydown' : action, event);
    f.target.inert = false;
    f.tick();
    assert.equal(f.target.focuses.length, 0, action);
    assert.equal(prevented, false);
    f.assertClean();
  }
});

test('detachment, backgrounding, timeout, and explicit navigation cancellation release the pending request', () => {
  for (const action of ['detach', 'hidden', 'timeout', 'cancel']) {
    const f = fixture();
    f.target.inert = true;
    const cancel = f.start();
    if (action === 'detach') f.target.isConnected = false;
    if (action === 'hidden') {
      f.doc.hidden = true;
      f.doc.fire('visibilitychange');
    }
    if (action === 'timeout') {
      const timer = [...f.timers.values()][0];
      assert.equal(timer.delay, 2000);
      timer.fn();
    }
    if (action === 'cancel') cancel();
    f.target.inert = false;
    f.tick();
    assert.equal(f.target.focuses.length, 0, action);
    f.assertClean();
  }
});
