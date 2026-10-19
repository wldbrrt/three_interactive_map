import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  createSelectionOutline,
  hasPointerMoved,
  resolveSelectedId,
} from './picking.js';

test('outlines all twelve box edges at configured pixel width without replacing the store material', () => {
  const material = new THREE.MeshStandardMaterial({ color: 0x4e9a86 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 3), material);
  const outline = createSelectionOutline(mesh, 1280, 720);

  assert.ok(outline.isLineSegments2);
  assert.equal(outline.name, 'selection-outline');
  assert.equal(outline.userData.isSelectionOutline, true);
  assert.equal(outline.material.color.getHex(), 0xfff000);
  assert.equal(outline.material.linewidth, 2.5);
  assert.deepEqual(outline.material.resolution.toArray(), [1280, 720]);
  assert.equal(outline.geometry.attributes.instanceStart.count, 12);
  assert.ok(outline.scale.x > 1);
  assert.equal(outline.material.depthTest, true);
  assert.equal(mesh.material, material);

  outline.geometry.dispose();
  outline.material.dispose();
  mesh.geometry.dispose();
  material.dispose();
});

test('keeps selection on empty clicks and repeated clicks on the same place', () => {
  assert.equal(resolveSelectedId('shop_005', null), 'shop_005');
  assert.equal(resolveSelectedId('shop_005', 'shop_005'), 'shop_005');
});

test('moves selection only when a different place is clicked', () => {
  assert.equal(resolveSelectedId('shop_005', 'shop_017'), 'shop_017');
  assert.equal(resolveSelectedId(null, 'shop_017'), 'shop_017');
});

test('distinguishes camera drags from clicks using a small pointer threshold', () => {
  const start = { x: 20, y: 30 };

  assert.equal(hasPointerMoved(start, { x: 23, y: 33 }), false);
  assert.equal(hasPointerMoved(start, { x: 26, y: 30 }), true);
  assert.equal(hasPointerMoved(null, { x: 26, y: 30 }), false);
});