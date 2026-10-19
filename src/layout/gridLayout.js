import { validatePlaces } from '../data/generatePlaces.js';

export const DEFAULT_LAYOUT_OPTIONS = Object.freeze({
  maxRowWidth: 40,
  gap: 0.5,
});

function validateLayoutOptions({ maxRowWidth, gap }) {
  if (!Number.isFinite(maxRowWidth) || maxRowWidth <= 0) {
    throw new RangeError('maxRowWidth must be a positive finite number.');
  }

  if (!Number.isFinite(gap) || gap < 0) {
    throw new RangeError('gap must be a non-negative finite number.');
  }
}

export function gridLayout(places, options = {}) {
  validatePlaces(places);

  const { maxRowWidth, gap } = { ...DEFAULT_LAYOUT_OPTIONS, ...options };
  validateLayoutOptions({ maxRowWidth, gap });

  let usedWidth = 0;
  let rowZ = 0;
  let rowDepth = 0;

  return places.map((place) => {
    if (usedWidth > 0 && usedWidth - gap + place.width > maxRowWidth) {
      rowZ += rowDepth + gap;
      usedWidth = 0;
      rowDepth = 0;
    }

    const positionedPlace = {
      ...place,
      x: usedWidth + place.width / 2,
      z: rowZ + place.depth / 2,
    };

    usedWidth += place.width + gap;
    rowDepth = Math.max(rowDepth, place.depth);

    return positionedPlace;
  });
}

export function findOverlaps(places, gap = 0) {
  validatePlaces(places);

  if (!Number.isFinite(gap) || gap < 0) {
    throw new RangeError('gap must be a non-negative finite number.');
  }

  for (const place of places) {
    if (!Number.isFinite(place.x) || !Number.isFinite(place.z)) {
      throw new TypeError(`Place ${place.id} must have finite x and z coordinates.`);
    }
  }

  const overlaps = [];

  for (let firstIndex = 0; firstIndex < places.length; firstIndex += 1) {
    const first = places[firstIndex];

    for (let secondIndex = firstIndex + 1; secondIndex < places.length; secondIndex += 1) {
      const second = places[secondIndex];
      const separationX = Math.abs(first.x - second.x) - (first.width + second.width) / 2;
      const separationZ = Math.abs(first.z - second.z) - (first.depth + second.depth) / 2;

      if (separationX < gap && separationZ < gap) {
        overlaps.push({ firstId: first.id, secondId: second.id });
      }
    }
  }

  return overlaps;
}