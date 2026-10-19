import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import './styles/main.css';

const canvasContainer = document.querySelector('#canvas-container');
const labelsContainer = document.querySelector('#labels-container');

if (!canvasContainer || !labelsContainer) {
  throw new Error('Required scene containers are missing from index.html.');
}

const scene = new THREE.Scene();
scene.background = new THREE.Color('#eef1ee');

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
camera.position.set(16, 18, 22);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.setAttribute('aria-label', 'Холст 3D-сцены');
canvasContainer.append(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.setAttribute('aria-hidden', 'true');
labelsContainer.append(labelRenderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x7b8580, 2));

const keyLight = new THREE.DirectionalLight(0xffffff, 2);
keyLight.position.set(8, 16, 10);
scene.add(keyLight);

const grid = new THREE.GridHelper(24, 24, 0x8d9992, 0xcbd2cd);
grid.position.y = 0;
scene.add(grid);

function resizeScene() {
  const width = canvasContainer.clientWidth;
  const height = canvasContainer.clientHeight;

  if (width === 0 || height === 0) {
    return;
  }

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  labelRenderer.setSize(width, height);
}

const resizeObserver = new ResizeObserver(resizeScene);
resizeObserver.observe(canvasContainer);
resizeScene();

renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
});

function disposeScene() {
  resizeObserver.disconnect();
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

if (import.meta.hot) {
  import.meta.hot.dispose(disposeScene);
}

window.addEventListener('pagehide', disposeScene, { once: true });