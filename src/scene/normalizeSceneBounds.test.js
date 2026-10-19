import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSceneBounds } from './normalizeSceneBounds.js';

test('provides a finite framing area for an empty scene', () => {
  assert.deepEqual(normalizeSceneBounds({ width: 0, depth: 0 }), { width: 12, depth: 12 });
});

test('keeps bounds for a populated scene', () => {
  const bounds = { width: 40.5, depth: 87 };
  assert.equal(normalizeSceneBounds(bounds), bounds);
});

test('rejects invalid scene bounds', () => {
  assert.throws(() => normalizeSceneBounds({ width: -1, depth: 2 }), /non-negative finite/);
  assert.throws(() => normalizeSceneBounds({ width: 1, depth: Number.NaN }), /non-negative finite/);
});