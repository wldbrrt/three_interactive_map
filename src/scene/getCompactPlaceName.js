export function getCompactPlaceName(place, maxLength = 14) {
  if (typeof place?.shortName === 'string' && place.shortName.trim() !== '') {
    return place.shortName.trim();
  }

  const name = typeof place?.name === 'string' ? place.name.trim() : '';
  const characters = Array.from(name);

  if (characters.length <= maxLength) {
    return name;
  }

  return `${characters.slice(0, Math.max(0, maxLength - 1)).join('').trimEnd()}…`;
}