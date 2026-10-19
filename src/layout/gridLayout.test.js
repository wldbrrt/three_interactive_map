import assert from 'node:assert/strict';
import test from 'node:test';
import { generatePlaces, validatePlaces } from '../data/generatePlaces.js';
import { findOverlaps, gridLayout } from './gridLayout.js';

test('generates 100 reproducible places with unique IDs and valid dimensions', () => {
  const places = generatePlaces();

  assert.equal(places.length, 100);
  assert.deepEqual(generatePlaces(), places);
  assert.equal(new Set(places.map(({ id }) => id)).size, 100);
  assert.ok(places.every(({ width, depth, color }) => (
    width > 0 && depth > 0 && Number.isInteger(color) && color <= 0xffffff
  )));
});

test('layout assigns rectangle centers without mutating source data', () => {
  const places = generatePlaces({ count: 4 });
  const original = structuredClone(places);
  const positioned = gridLayout(places, { maxRowWidth: 10, gap: 0.5 });

  assert.deepEqual(places, original);
  assert.ok(positioned.every(({ x, z }) => Number.isFinite(x) && Number.isFinite(z)));
  assert.deepEqual(findOverlaps(positioned, 0.5), []);
});

test('places all 100 generated stores without overlap and with the configured gap', () => {
  const positioned = gridLayout(generatePlaces(), { maxRowWidth: 40, gap: 0.5 });

  assert.equal(positioned.length, 100);
  assert.deepEqual(findOverlaps(positioned, 0.5), []);
});

test('places an item wider than the row on its own row', () => {
  const places = [
    { id: 'a', name: 'A', width: 4, depth: 3, color: 0x123456 },
    { id: 'b', name: 'B', width: 12, depth: 5, color: 0x234567 },
    { id: 'c', name: 'C', width: 4, depth: 2, color: 0x345678 },
  ];
  const positioned = gridLayout(places, { maxRowWidth: 10, gap: 0.5 });

  assert.equal(positioned[1].x, positioned[1].width / 2);
  assert.ok(positioned[1].z > positioned[0].z);
  assert.ok(positioned[2].z > positioned[1].z);
  assert.deepEqual(findOverlaps(positioned, 0.5), []);
});

test('packs items up to the row width without adding an extra gap', () => {
  const places = [
    { id: 'a', name: 'A', width: 4, depth: 3, color: 0x123456 },
    { id: 'b', name: 'B', width: 5.5, depth: 2, color: 0x234567 },
    { id: 'c', name: 'C', width: 1, depth: 2, color: 0x345678 },
  ];
  const positioned = gridLayout(places, { maxRowWidth: 10, gap: 0.5 });

  assert.equal(positioned[1].x, 4 + 0.5 + 5.5 / 2);
  assert.equal(positioned[2].x, positioned[2].width / 2);
  assert.ok(positioned[2].z > positioned[1].z);
  assert.deepEqual(findOverlaps(positioned, 0.5), []);
});

test('allows an empty array', () => {
  assert.deepEqual(gridLayout([]), []);
  assert.deepEqual(findOverlaps([]), []);
});

test('rejects duplicate IDs and invalid dimensions', () => {
  const validPlace = { id: 'same', name: 'Shop', width: 2, depth: 3, color: 0xffffff };

  assert.throws(() => validatePlaces([validPlace, { ...validPlace }]), /Duplicate place ID/);
  assert.throws(() => gridLayout([{ ...validPlace, width: 0 }]), /positive finite width/);
  assert.throws(() => gridLayout([{ ...validPlace, depth: -1 }]), /positive finite depth/);
});

test('rejects invalid layout settings and generator arguments', () => {
  assert.throws(() => gridLayout([], { maxRowWidth: 0 }), /maxRowWidth/);
  assert.throws(() => gridLayout([], { gap: -1 }), /gap/);
  assert.throws(() => generatePlaces({ count: -1 }), /count/);
  assert.throws(() => generatePlaces({ seed: Number.NaN }), /seed/);
});

test('detects overlapping rectangles and insufficient gap', () => {
  const places = [
    { id: 'a', name: 'A', width: 4, depth: 4, color: 0x123456, x: 0, z: 0 },
    { id: 'b', name: 'B', width: 4, depth: 4, color: 0x234567, x: 3.75, z: 0 },
    { id: 'c', name: 'C', width: 4, depth: 4, color: 0x345678, x: 8.2, z: 0 },
  ];

  assert.deepEqual(findOverlaps(places), [{ firstId: 'a', secondId: 'b' }]);
  assert.deepEqual(findOverlaps(places, 0.5), [
    { firstId: 'a', secondId: 'b' },
    { firstId: 'b', secondId: 'c' },
  ]);
  assert.throws(() => findOverlaps([{ ...places[0], x: undefined }]), /finite x and z/);
});