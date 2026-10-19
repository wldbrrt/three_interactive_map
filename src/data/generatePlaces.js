const STORE_TYPES = [
  'Магазин одежды',
  'Кофейня',
  'Книжный магазин',
  'Магазин электроники',
  'Косметика',
  'Спортивный магазин',
  'Ресторан',
  'Ювелирный салон',
  'Детский магазин',
  'Дом и интерьер',
];

const COLORS = [
  0xd98667, 0x4e9a86, 0x668ec2, 0xd4aa49, 0x8c78ad,
  0xc56d83, 0x788e4c, 0x4e9da8, 0xc27c42, 0x6d8193,
];

function createRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function generatePlaces({ count = 100, seed = 42 } = {}) {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError('count must be a non-negative integer.');
  }

  if (!Number.isFinite(seed)) {
    throw new TypeError('seed must be a finite number.');
  }

  const random = createRandom(seed);

  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const width = 3 + Math.floor(random() * 9) / 2;
    const depth = 3 + Math.floor(random() * 7) / 2;

    return {
      id: `shop_${String(number).padStart(3, '0')}`,
      name: `${STORE_TYPES[index % STORE_TYPES.length]} ${String(number).padStart(2, '0')}`,
      width,
      depth,
      color: COLORS[Math.floor(random() * COLORS.length)],
    };
  });
}

export function validatePlaces(places) {
  if (!Array.isArray(places)) {
    throw new TypeError('places must be an array.');
  }

  const ids = new Set();

  for (const [index, place] of places.entries()) {
    if (!place || typeof place !== 'object' || Array.isArray(place)) {
      throw new TypeError(`Place at index ${index} must be an object.`);
    }

    if (typeof place.id !== 'string' || place.id.trim() === '') {
      throw new TypeError(`Place at index ${index} must have a non-empty string ID.`);
    }

    if (ids.has(place.id)) {
      throw new Error(`Duplicate place ID: ${place.id}.`);
    }
    ids.add(place.id);

    if (typeof place.name !== 'string' || place.name.trim() === '') {
      throw new TypeError(`Place ${place.id} must have a non-empty name.`);
    }

    if (!Number.isFinite(place.width) || place.width <= 0) {
      throw new RangeError(`Place ${place.id} must have a positive finite width.`);
    }

    if (!Number.isFinite(place.depth) || place.depth <= 0) {
      throw new RangeError(`Place ${place.id} must have a positive finite depth.`);
    }

    if (!Number.isInteger(place.color) || place.color < 0 || place.color > 0xffffff) {
      throw new RangeError(`Place ${place.id} must have a valid 24-bit integer color.`);
    }
  }

  return places;
}