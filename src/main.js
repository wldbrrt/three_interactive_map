import { generatePlaces } from './data/generatePlaces.js';
import { gridLayout } from './layout/gridLayout.js';
import { createScene } from './scene/createScene.js';
import { createPlaceMesh } from './scene/createPlaceMesh.js';
import { createPlaceLabel } from './scene/createLabels.js';
import { createModeControl } from './ui/createModeControl.js';
import './styles/main.css';

const canvasContainer = document.querySelector('#canvas-container');
const labelsContainer = document.querySelector('#labels-container');
const modeToggle = document.querySelector('#mode-toggle');

if (!canvasContainer || !labelsContainer || !modeToggle) {
  throw new Error('Required scene containers or mode control are missing from index.html.');
}

const places = gridLayout(generatePlaces());
const bounds = places.reduce((result, place) => ({
  width: Math.max(result.width, place.x + place.width / 2),
  depth: Math.max(result.depth, place.z + place.depth / 2),
}), { width: 0, depth: 0 });

const app = createScene({ canvasContainer, labelsContainer, bounds });
const modeControl = createModeControl(modeToggle, app.cameraController);

for (const place of places) {
  const mesh = createPlaceMesh(place);
  mesh.add(createPlaceLabel(place));
  app.placesGroup.add(mesh);
}

function disposeScene() {
  modeControl.dispose();
  app.dispose();
}

function handleKeydown(event) {
  if (event.code !== 'Space' || event.defaultPrevented) {
    return;
  }

  const target = event.target;
  const isInteractiveTarget = target instanceof Element
    && target.closest('input, textarea, select, button, [contenteditable="true"]');

  if (isInteractiveTarget) {
    return;
  }

  event.preventDefault();
  modeControl.toggle();
}

window.addEventListener('keydown', handleKeydown);
window.addEventListener('pagehide', () => {
  window.removeEventListener('keydown', handleKeydown);
}, { once: true });

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener('keydown', handleKeydown);
    disposeScene();
  });
}

window.addEventListener('pagehide', disposeScene, { once: true });