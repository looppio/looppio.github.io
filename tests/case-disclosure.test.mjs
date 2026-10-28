import test from 'node:test';
import assert from 'node:assert/strict';
import { collapsedDisclosureHeight } from '../src/reference/caseDisclosure.js';

test('a paragraph clips at three actual text lines independently of its full length', () => {
  assert.equal(collapsedDisclosureHeight(20, [{ height: 220, marginTop: 0 }]), 60);
});

test('three short bullets include both list gaps instead of clipping the third line', () => {
  assert.equal(
    collapsedDisclosureHeight(20, [
      { height: 20, marginTop: 0 },
      { height: 20, marginTop: 6 },
      { height: 20, marginTop: 6 },
      { height: 20, marginTop: 6 },
    ]),
    72,
  );
});

test('a wrapped second bullet consumes the remaining lines and shorter lists keep natural height', () => {
  assert.equal(
    collapsedDisclosureHeight(18, [
      { height: 18, marginTop: 0 },
      { height: 54, marginTop: 5 },
    ]),
    59,
  );
  assert.equal(collapsedDisclosureHeight(18, [{ height: 36, marginTop: 0 }]), 36);
  assert.equal(collapsedDisclosureHeight(0, [{ height: 36 }]), 0);
  assert.equal(collapsedDisclosureHeight(18, []), 0);
});
