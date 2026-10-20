import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { SCENE_CONFIG } from '../app/config.js';
import { createCameraController } from './cameraController.js';
import { createLabelController } from './labelController.js';
import { normalizeSceneBounds } from './normalizeSceneBounds.js';

function getFitDistance(camera, bounds, target) {
  const inverseRotation = camera.quaternion.clone().invert();
  const verticalTangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const horizontalTangent = verticalTangent * camera.aspect;
  let fitDistance = 0;

  for (const x of [0, bounds.width]) {
    for (const y of [0, SCENE_CONFIG.storeHeight]) {
      for (const z of [0, bounds.depth]) {
        const point = new THREE.Vector3(x, y, z)
          .sub(target)
          .applyQuaternion(inverseRotation);
        fitDistance = Math.max(
          fitDistance,
          point.z + Math.abs(point.x) / horizontalTangent,
          point.z + Math.abs(point.y) / verticalTangent,
        );
      }
    }
  }

  return fitDistance * SCENE_CONFIG.cameraFitMargin;
}

export function createScene({ canvasContainer, labelsContainer, bounds }) {
  bounds = normalizeSceneBounds(bounds);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_CONFIG.sceneBackground);

  const placesGroup = new THREE.Group();
  placesGroup.name = 'places';
  scene.add(placesGroup);

  const center = new THREE.Vector3(bounds.width / 2, 0, bounds.depth / 2);
  const camera = new THREE.PerspectiveCamera(SCENE_CONFIG.cameraFov, 1, 0.1, 2000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', 'Холст 3D-сцены торгового центра');
  canvasContainer.append(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.setAttribute('aria-hidden', 'true');
  labelsContainer.append(labelRenderer.domElement);

  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x738078, 2.1);
  scene.add(hemisphereLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
  const baseHemisphereIntensity = hemisphereLight.intensity;
  const baseDirectionalIntensity = keyLight.intensity;
  keyLight.position.set(center.x + bounds.width * 0.3, 36, center.z - bounds.depth * 0.2);
  keyLight.castShadow = true;
  keyLight.shadow.radius = 3;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -bounds.width;
  keyLight.shadow.camera.right = bounds.width;
  keyLight.shadow.camera.top = bounds.depth;
  keyLight.shadow.camera.bottom = -bounds.depth;
  scene.add(keyLight);

  const floorWidth = bounds.width + SCENE_CONFIG.floorPadding * 2;
  const floorDepth = bounds.depth + SCENE_CONFIG.floorPadding * 2;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(floorWidth, floorDepth),
    new THREE.MeshStandardMaterial({
      color: SCENE_CONFIG.sceneBackground,
      roughness: 0.95,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(center.x, -0.04, center.z);
  floor.receiveShadow = true;
  scene.add(floor);

  const gridSize = Math.ceil(Math.max(floorWidth, floorDepth));
  const grid = new THREE.GridHelper(
    gridSize,
    Math.max(1, Math.ceil(gridSize / 4)),
    0xaab5ad,
    0xcbd2cd,
  );
  grid.position.set(center.x, -0.025, center.z);
  scene.add(grid);

  const maxDimension = Math.max(bounds.width, bounds.depth);
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const distanceForHeight = maxDimension / (2 * Math.tan(verticalFov / 2));
  const distance = distanceForHeight * SCENE_CONFIG.cameraFitMargin;
  const viewDirection = new THREE.Vector3(1.3, 1.2, 1.5).normalize();
  camera.position.copy(center).addScaledVector(viewDirection, distance);
  camera.lookAt(center);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(center);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8;
  controls.maxDistance = distance * 2.5;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.update();

  const orthographicCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
  orthographicCamera.position.copy(center).add(new THREE.Vector3(0, 1, 0));
  orthographicCamera.up.set(0, 0, -1);
  orthographicCamera.lookAt(center);

  const orthographicControls = new OrbitControls(orthographicCamera, renderer.domElement);
  orthographicControls.target.copy(center);
  orthographicControls.enableDamping = true;
  orthographicControls.dampingFactor = 0.08;
  orthographicControls.enableRotate = false;
  orthographicControls.enablePan = true;
  orthographicControls.minZoom = 0.55;
  orthographicControls.maxZoom = 4;
  orthographicControls.enabled = false;
  orthographicControls.update();

  let activeCamera = camera;
  let activeControls = controls;
  const cameraController = createCameraController({
    perspectiveCamera: camera,
    orthographicCamera,
    perspectiveControls: controls,
    orthographicControls,
    bounds,
    target: center,
    onChange: ({ camera: nextCamera, controls: nextControls }) => {
      activeCamera = nextCamera;
      activeControls = nextControls;
    },
  });
  let labelsNeedUpdate = true;

  function markLabelsNeedUpdate() {
    labelsNeedUpdate = true;
  }

  function resize() {
    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;

    if (width === 0 || height === 0) {
      return;
    }

    labelsNeedUpdate = true;
    cameraController.resize(width / height);

    const currentDistance = camera.position.distanceTo(controls.target);
    const fitDistance = getFitDistance(camera, bounds, controls.target);

    if (cameraController.activeMode === '3d' && currentDistance < fitDistance) {
      const viewDirection = camera.position.clone().sub(controls.target).normalize();
      camera.position.copy(controls.target).addScaledVector(viewDirection, fitDistance);
      controls.update();
    }
    renderer.setSize(width, height);
    labelRenderer.setSize(width, height);
  }

  controls.addEventListener('change', markLabelsNeedUpdate);
  orthographicControls.addEventListener('change', markLabelsNeedUpdate);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvasContainer);
  resize();

  let labelController = null;

  function setLabelController(controller) {
    labelController = controller;
    labelsNeedUpdate = true;
  }

  renderer.setAnimationLoop(() => {
    const cameraWasTransitioning = cameraController.isTransitioning;
    cameraController.update();
    const controlsChanged = activeControls.update();
    const directionalFactor = cameraController.shadowIntensity;
    keyLight.intensity = baseDirectionalIntensity * directionalFactor;
    hemisphereLight.intensity = baseHemisphereIntensity
      + baseDirectionalIntensity * (1 - directionalFactor);
    renderer.render(scene, activeCamera);

    if (
      labelController
      && (
        labelsNeedUpdate
        || cameraWasTransitioning
        || cameraController.isTransitioning
        || controlsChanged
      )
    ) {
      labelController.update(activeCamera);
      labelsNeedUpdate = false;
    }

    labelRenderer.render(scene, activeCamera);
  });

  function dispose() {
    resizeObserver.disconnect();
    controls.removeEventListener('change', markLabelsNeedUpdate);
    orthographicControls.removeEventListener('change', markLabelsNeedUpdate);
    labelController?.dispose();
    controls.dispose();
    orthographicControls.dispose();
    renderer.setAnimationLoop(null);
    scene.traverse((object) => {
      object.geometry?.dispose();

      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose());
      } else {
        object.material?.dispose();
      }
    });
    renderer.dispose();
    renderer.domElement.remove();
    labelRenderer.domElement.remove();
  }

  return {
    scene,
    placesGroup,
    cameraController,
    controls: [controls, orthographicControls],
    setLabelController,
    renderer,
    labelRenderer,
    dispose,
  };
}