import { generatePlaces } from './data/generatePlaces.js';
import { gridLayout } from './layout/gridLayout.js';
import { SCENE_CONFIG } from './app/config.js';
import { createScene } from './scene/createScene.js';
import { createPlaceMesh } from './scene/createPlaceMesh.js';
import { createPlaceLabel } from './scene/createLabels.js';
import './styles/main.css';

const canvasContainer = document.querySelector('#canvas-container');
const labelsContainer = document.querySelector('#labels-container');

if (!canvasContainer || !labelsContainer) {
  throw new Error('Required scene containers are missing from index.html.');
}

const places = gridLayout(generatePlaces());
const bounds = places.reduce((result, place) => ({
  width: Math.max(result.width, place.x + place.width / 2),
  depth: Math.max(result.depth, place.z + place.depth / 2),
}), { width: 0, depth: 0 });

const app = createScene({ canvasContainer, labelsContainer, bounds });

for (const place of places) {
  const mesh = createPlaceMesh(place);
  mesh.add(createPlaceLabel(place));
  app.placesGroup.add(mesh);
}

function disposeScene() {
  app.dispose();
}

if (import.meta.hot) {
  import.meta.hot.dispose(disposeScene);
}

window.addEventListener('pagehide', disposeScene, { once: true });