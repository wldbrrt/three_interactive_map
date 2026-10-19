import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { SCENE_CONFIG } from '../app/config.js';
import { getCompactPlaceName } from './getCompactPlaceName.js';

export function createPlaceLabel(place) {
  const element = document.createElement('div');
  element.className = 'place-label';
  const compactName = getCompactPlaceName(place, SCENE_CONFIG.compactNameMaxLength);
  element.textContent = compactName;
  element.dataset.compactName = compactName;
  element.dataset.fullName = place.name;
  element.title = place.name;
  element.setAttribute('aria-label', place.name);
  element.style.setProperty(
    '--compact-max-width',
    `${Math.max(42, Math.min(place.width * 11, SCENE_CONFIG.labelMaxWidth))}px`,
  );

  const label = new CSS2DObject(element);
  label.position.set(0, SCENE_CONFIG.storeHeight / 2 + 0.08, 0);

  return label;
}