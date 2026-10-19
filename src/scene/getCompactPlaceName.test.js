import assert from 'node:assert/strict';
import test from 'node:test';
import { getCompactPlaceName } from './getCompactPlaceName.js';

test('uses a provided non-empty short name', () => {
  assert.equal(getCompactPlaceName({ name: 'Магазин одежды', shortName: 'Мода' }), 'Мода');
  assert.equal(getCompactPlaceName({ name: 'Магазин одежды', shortName: ' Мода ' }), 'Мода');
});

test('truncates the full name to the configured length and appends an ellipsis', () => {
  assert.equal(getCompactPlaceName({ name: 'Магазин одежды' }, 10), 'Магазин о…');
});

test('counts Unicode characters rather than UTF-16 code units', () => {
  assert.equal(getCompactPlaceName({ name: 'Кафе 😀 на крыше' }, 9), 'Кафе 😀 н…');
});

test('keeps names within the limit and falls back when shortName is blank', () => {
  assert.equal(getCompactPlaceName({ name: 'Кофейня', shortName: '   ' }), 'Кофейня');
  assert.equal(getCompactPlaceName({ name: 'Кофейня' }), 'Кофейня');
});