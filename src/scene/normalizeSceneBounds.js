import { SCENE_CONFIG } from '../app/config.js';

export function normalizeSceneBounds(bounds) {
  if (!bounds || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.depth)
    || bounds.width < 0 || bounds.depth < 0) {
    throw new TypeError('Scene bounds must have non-negative finite width and depth.');
  }

  if (bounds.width === 0 && bounds.depth === 0) {
    return {
      width: SCENE_CONFIG.emptySceneSize,
      depth: SCENE_CONFIG.emptySceneSize,
    };
  }

  return bounds;
}