import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createCameraController } from './cameraController.js';

function createControls(target) {
  return {
    target: target.clone(),
    enabled: true,
    update() {},
  };
}

function createController(cameraPosition = new THREE.Vector3(55, 75, 100)) {
  const target = new THREE.Vector3(20, 0, 40);
  const perspectiveCamera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 2000);
  perspectiveCamera.position.copy(cameraPosition);
  perspectiveCamera.lookAt(target);

  const orthographicCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
  orthographicCamera.position.copy(target).add(new THREE.Vector3(0, 100, 0));
  orthographicCamera.up.set(0, 0, -1);
  orthographicCamera.lookAt(target);

  const perspectiveControls = createControls(target);
  const orthographicControls = createControls(target);
  const controller = createCameraController({
    perspectiveCamera,
    orthographicCamera,
    perspectiveControls,
    orthographicControls,
    bounds: { width: 40, depth: 80 },
    target,
  });

  return {
    controller,
    perspectiveCamera,
    orthographicCamera,
    perspectiveControls,
    orthographicControls,
  };
}

test('switches between perspective and orthographic modes and restores controls', () => {
  const {
    controller,
    perspectiveCamera,
    orthographicCamera,
    perspectiveControls,
    orthographicControls,
  } = createController();

  controller.setMode('2d', 0);
  assert.equal(controller.mode, '2d');
  assert.equal(perspectiveControls.enabled, false);

  controller.update(400);
  assert.equal(controller.activeMode, '2d');
  assert.equal(controller.camera, orthographicCamera);
  controller.update(800);
  assert.equal(controller.isTransitioning, false);
  assert.equal(orthographicControls.enabled, true);

  controller.setMode('3d', 1000);
  controller.update(1400);
  assert.equal(controller.activeMode, '3d');
  assert.equal(controller.camera, perspectiveCamera);
  controller.update(1800);
  assert.equal(controller.isTransitioning, false);
  assert.equal(perspectiveControls.enabled, true);
});

test('a repeated toggle during a transition returns smoothly to the active mode', () => {
  const { controller, perspectiveControls } = createController();

  controller.setMode('2d', 0);
  controller.update(120);
  controller.setMode('3d', 120);
  controller.update(600);

  assert.equal(controller.activeMode, '3d');
  assert.equal(controller.mode, '3d');
  assert.equal(controller.isTransitioning, false);
  assert.equal(perspectiveControls.enabled, true);
});

test('resizes both camera projections for the new aspect ratio', () => {
  const { controller, perspectiveCamera, orthographicCamera } = createController();

  controller.resize(0.5);

  assert.equal(perspectiveCamera.aspect, 0.5);
  assert.ok(orthographicCamera.right - orthographicCamera.left > 0);
  assert.ok(orthographicCamera.top - orthographicCamera.bottom > 0);
});

test('normalizes label zoom for perspective and orthographic cameras', () => {
  const {
    controller,
    perspectiveCamera,
    orthographicCamera,
    perspectiveControls,
  } = createController();

  assert.equal(controller.labelScale, 1);
  const perspectiveDistance = perspectiveCamera.position.distanceTo(perspectiveControls.target);
  assert.equal(controller.labelDistance, perspectiveDistance);
  perspectiveCamera.position.copy(perspectiveControls.target).add(
    new THREE.Vector3(0, perspectiveDistance / 2, 0),
  );
  assert.equal(controller.labelScale, 2);

  controller.setMode('2d', 0);
  controller.update(326.4);
  controller.update(680);
  assert.equal(controller.labelScale, 1);
  assert.equal(
    controller.labelDistance,
    (orthographicCamera.top - orthographicCamera.bottom) / orthographicCamera.zoom,
  );
  orthographicCamera.zoom *= 1.5;
  assert.equal(controller.labelScale, 1.5);
});

test('derives the 2D plan orientation from the side of the 3D camera', () => {
  const firstView = createController(new THREE.Vector3(55, 75, 100));
  const secondView = createController(new THREE.Vector3(100, 75, 55));

  firstView.controller.setMode('2d', 0);
  secondView.controller.setMode('2d', 0);
  firstView.controller.update(326.4);
  secondView.controller.update(326.4);

  assert.ok(Math.abs(firstView.orthographicCamera.up.x - secondView.orthographicCamera.up.x) > 0.1);
  assert.ok(Math.abs(firstView.orthographicCamera.up.z - secondView.orthographicCamera.up.z) > 0.1);
  assert.ok(Math.abs(firstView.orthographicCamera.up.y) < 1e-8);
  assert.ok(Math.abs(secondView.orthographicCamera.up.y) < 1e-8);

  firstView.controller.update(800);
  secondView.controller.update(800);
  firstView.controller.setMode('3d', 1000);
  secondView.controller.setMode('3d', 1000);
  firstView.controller.update(1400);
  secondView.controller.update(1400);

  assert.ok(firstView.orthographicCamera.up.distanceTo(secondView.orthographicCamera.up) > 0.1);
});

test('fades shadows out in 2D and back in during the reverse transition', () => {
  const { controller } = createController();

  assert.equal(controller.shadowIntensity, 1);

  controller.setMode('2d', 0);
  controller.update(163);
  assert.ok(controller.shadowIntensity < 1 && controller.shadowIntensity > 0);

  controller.update(326.4);
  assert.ok(controller.shadowIntensity > 0);
  controller.update(503.2);
  assert.ok(controller.shadowIntensity < 0.5 && controller.shadowIntensity > 0);
  controller.update(680);
  assert.equal(controller.shadowIntensity, 0);

  controller.setMode('3d', 1000);
  controller.update(1163);
  assert.ok(controller.shadowIntensity > 0 && controller.shadowIntensity < 1);

  controller.update(1326.4);
  assert.ok(controller.shadowIntensity < 1);
  controller.update(1503.2);
  assert.ok(controller.shadowIntensity > 0.5 && controller.shadowIntensity < 1);
  controller.update(1680);
  assert.equal(controller.shadowIntensity, 1);
});