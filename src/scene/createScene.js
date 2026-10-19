import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { SCENE_CONFIG } from '../app/config.js';
import { createCameraController } from './cameraController.js';

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
  const viewDirection = new THREE.Vector3(0.3, 3.2, 1).normalize();
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

  let labelsNeedLayout = true;
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
      markLabelsDirty();
    },
  });
  const raycaster = new THREE.Raycaster();
  const labelWorldPosition = new THREE.Vector3();
  const cameraToLabel = new THREE.Vector3();
  const meshWorldPosition = new THREE.Vector3();

  function markLabelsDirty() {
    labelsNeedLayout = true;
  }

  function layoutLabels() {
    const labels = placesGroup.children.flatMap((mesh) => mesh.children
      .filter((child) => child.isCSS2DObject)
      .map((label) => ({ mesh, label, element: label.element })));
    const labelScale = THREE.MathUtils.clamp(
      cameraController.labelScale,
      0.85,
      SCENE_CONFIG.labelMaxScale,
    );
    const showFullNames = labelScale >= SCENE_CONFIG.labelFullNameScale;

    for (const { mesh, label, element } of labels) {
      mesh.getWorldPosition(meshWorldPosition);
      const directionToCamera = activeCamera.position.clone().sub(meshWorldPosition);
      const isSideView = Math.abs(directionToCamera.y) / directionToCamera.length() < 0.72;

      if (!isSideView) {
        label.position.set(0, SCENE_CONFIG.storeHeight / 2 + 0.08, 0);
      } else if (Math.abs(directionToCamera.x) > Math.abs(directionToCamera.z)) {
        label.position.set(
          Math.sign(directionToCamera.x) * (mesh.geometry.parameters.width / 2 + 0.04),
          SCENE_CONFIG.storeHeight / 2,
          0,
        );
      } else {
        label.position.set(
          0,
          SCENE_CONFIG.storeHeight / 2,
          Math.sign(directionToCamera.z) * (mesh.geometry.parameters.depth / 2 + 0.04),
        );
      }

      const expanded = showFullNames;
      element.textContent = expanded ? element.dataset.fullName : element.dataset.compactName;
      element.classList.toggle('place-label--expanded', expanded);
      element.style.setProperty('--label-scale', labelScale.toFixed(3));
      element.style.maxWidth = expanded
        ? `${Math.min(SCENE_CONFIG.labelExpandedMaxWidth, 150 * labelScale)}px`
        : 'var(--compact-max-width)';
    }

    scene.updateMatrixWorld(true);

    labels.sort((first, second) => (
      first.mesh.position.distanceToSquared(activeCamera.position)
      - second.mesh.position.distanceToSquared(activeCamera.position)
    ));

    const occupied = [];

    for (const { mesh, label, element } of labels) {
      label.getWorldPosition(labelWorldPosition);
      cameraToLabel.subVectors(labelWorldPosition, activeCamera.position);
      const labelDistance = cameraToLabel.length();
      raycaster.set(camera.position, cameraToLabel.normalize());
      raycaster.far = Math.max(0, labelDistance - 0.05);

      const occluded = raycaster.intersectObjects(placesGroup.children, false)
        .some(({ object }) => object !== mesh);

      element.style.visibility = occluded ? 'hidden' : 'visible';

      if (occluded || element.style.display === 'none') {
        continue;
      }

      const rect = element.getBoundingClientRect();
      const paddedRect = {
        left: rect.left - 2,
        right: rect.right + 2,
        top: rect.top - 2,
        bottom: rect.bottom + 2,
      };
      const intersects = occupied.some((other) => (
        paddedRect.left < other.right
        && paddedRect.right > other.left
        && paddedRect.top < other.bottom
        && paddedRect.bottom > other.top
      ));

      if (intersects) {
        element.style.visibility = 'hidden';
      } else {
        occupied.push(paddedRect);
      }
    }
  }

  controls.addEventListener('change', markLabelsDirty);
  orthographicControls.addEventListener('change', markLabelsDirty);

  function resize() {
    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;

    if (width === 0 || height === 0) {
      return;
    }

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
    markLabelsDirty();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvasContainer);
  resize();

  renderer.setAnimationLoop(() => {
    cameraController.update();
    activeControls.update();
    const directionalFactor = cameraController.shadowIntensity;
    keyLight.intensity = baseDirectionalIntensity * directionalFactor;
    hemisphereLight.intensity = baseHemisphereIntensity
      + baseDirectionalIntensity * (1 - directionalFactor);
    renderer.render(scene, activeCamera);
    labelRenderer.render(scene, activeCamera);

    if (labelsNeedLayout) {
      layoutLabels();
      labelsNeedLayout = false;
    }
  });

  function dispose() {
    resizeObserver.disconnect();
    controls.removeEventListener('change', markLabelsDirty);
    orthographicControls.removeEventListener('change', markLabelsDirty);
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
    renderer,
    labelRenderer,
    dispose,
  };
}