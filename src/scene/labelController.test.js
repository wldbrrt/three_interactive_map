import assert from 'node:assert/strict';
import test from 'node:test';
import { SCENE_CONFIG } from '../app/config.js';
import {
  createLabelController,
  getLabelZoomState,
  getPlaceLabelRenderOrder,
  isPlaceLabelEmphasized,
} from './labelController.js';

test('hides labels only beyond the configured camera distance', () => {
  assert.equal(getLabelZoomState(1, SCENE_CONFIG.labelHideDistance).visible, true);
  assert.equal(getLabelZoomState(1, SCENE_CONFIG.labelHideDistance + 0.01).visible, false);
});

test('narrows labels when zooming out and widens them when zooming in', () => {
  const zoomedOut = getLabelZoomState(0.5, SCENE_CONFIG.labelHideDistance);
  const zoomedIn = getLabelZoomState(2, SCENE_CONFIG.labelHideDistance);

  assert.ok(zoomedOut.scale < zoomedIn.scale);
  assert.equal(getLabelZoomState(100, 1).scale, SCENE_CONFIG.labelMaxScale);
  assert.equal(getLabelZoomState(0, 1).scale, 0.82);
});

test('expands a label only for the hovered or selected place', () => {
  assert.equal(isPlaceLabelEmphasized('shop_001', 'shop_001', null), true);
  assert.equal(isPlaceLabelEmphasized('shop_001', null, 'shop_001'), true);
  assert.equal(isPlaceLabelEmphasized('shop_001', 'shop_002', null), false);
});

test('puts hovered labels above selected and regular labels', () => {
  assert.equal(getPlaceLabelRenderOrder('shop_001', 'shop_001', 'shop_002'), 2);
  assert.equal(getPlaceLabelRenderOrder('shop_002', 'shop_001', 'shop_002'), 1);
  assert.equal(getPlaceLabelRenderOrder('shop_003', 'shop_001', 'shop_002'), 0);
});

test('shows the hovered or selected label even beyond the hide distance', () => {
  const styleValues = new Map([['--compact-max-width', '60px']]);
  const element = {
    dataset: {
      compactName: 'Магазин…',
      fullName: 'Магазин одежды',
    },
    style: {
      getPropertyValue: (property) => styleValues.get(property) ?? '',
      setProperty: (property, value) => styleValues.set(property, value),
    },
    classList: { toggle() {} },
    textContent: 'Магазин…',
  };
  const label = { isCSS2DObject: true, element, parent: { isMesh: true, userData: { placeId: 'shop_001' } }, visible: true };
  const camera = {};
  const cameraController = {
    camera,
    labelScale: 1,
    labelDistance: SCENE_CONFIG.labelHideDistance + 1,
  };
  const controller = createLabelController({
    placesGroup: { traverse: (callback) => callback(label) },
    cameraController,
  });

  controller.update(camera);
  assert.equal(label.visible, false);
  assert.equal(label.renderOrder, 0);

  controller.setHoveredId('shop_001');
  assert.equal(label.visible, true);
  assert.equal(label.renderOrder, 2);
  assert.equal(element.textContent, 'Магазин одежды');

  controller.setHoveredId(null);
  assert.equal(label.visible, false);

  controller.setSelectedId('shop_001');
  assert.equal(label.visible, true);
  assert.equal(label.renderOrder, 1);
  assert.equal(element.textContent, 'Магазин одежды');

  controller.dispose();
});
