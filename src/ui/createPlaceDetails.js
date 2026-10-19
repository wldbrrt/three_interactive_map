function formatCoordinate(value) {
  return Number(value.toFixed(2)).toString();
}

export function createPlaceDetails(panel, onClearSelection = () => {}) {
  const title = panel.querySelector('[data-place-name]');
  const id = panel.querySelector('[data-place-id]');
  const position = panel.querySelector('[data-place-position]');
  const dimensions = panel.querySelector('[data-place-dimensions]');
  const closeButton = panel.querySelector('[data-close-details]');

  if (!title || !id || !position || !dimensions || !closeButton) {
    throw new Error('Place details panel is missing required elements.');
  }

  function clear() {
    onClearSelection();
    panel.hidden = true;
    panel.removeAttribute('data-visible');
  }

  function render(place) {
    if (!place) {
      panel.hidden = true;
      panel.removeAttribute('data-visible');
      return;
    }

    title.textContent = place.name;
    id.textContent = place.id;
    position.textContent = `X ${formatCoordinate(place.x)} / Z ${formatCoordinate(place.z)}`;
    dimensions.textContent = `${formatCoordinate(place.width)} × ${formatCoordinate(place.depth)}`;
    panel.hidden = false;
    panel.setAttribute('data-visible', 'true');
  }

  closeButton.addEventListener('click', clear);

  return {
    render,
    dispose() {
      closeButton.removeEventListener('click', clear);
      clear();
    },
  };
}