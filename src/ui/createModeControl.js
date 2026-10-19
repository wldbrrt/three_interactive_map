export function createModeControl(button, cameraController) {
  function updateButton() {
    const isPlanView = cameraController.mode === '2d';
    const nextMode = isPlanView ? '3D' : '2D';

    button.textContent = nextMode === '2D' ? 'План 2D' : 'Перспектива 3D';
    button.setAttribute('aria-label', `Переключить режим на ${nextMode}`);
    button.setAttribute('aria-pressed', String(isPlanView));
  }

  function toggleMode() {
    cameraController.toggle();
    updateButton();
  }

  button.addEventListener('click', toggleMode);
  updateButton();

  return {
    toggle: toggleMode,
    dispose() {
      button.removeEventListener('click', toggleMode);
    },
  };
}