import * as THREE from 'three';
import { SCENE_CONFIG } from '../app/config.js';

export function getLabelZoomState(zoomScale, cameraDistance, config = SCENE_CONFIG) {
  if (!Number.isFinite(zoomScale) || zoomScale < 0) {
    throw new RangeError('zoomScale must be a non-negative finite number.');
  }

  if (!Number.isFinite(cameraDistance) || cameraDistance < 0) {
    throw new RangeError('cameraDistance must be a non-negative finite number.');
  }

  return {
    visible: cameraDistance <= config.labelHideDistance,
    scale: Number(THREE.MathUtils.clamp(
      1 + (zoomScale - 1) * config.labelScalePerZoom,
      config.labelMinScale,
      config.labelMaxScale,
    ).toFixed(2)),
  };
}

export function isPlaceLabelEmphasized(placeId, hoveredId, selectedId) {
  return placeId === hoveredId || placeId === selectedId;
}

export function getPlaceLabelRenderOrder(placeId, hoveredId, selectedId) {
  if (placeId === hoveredId) {
    return 2;
  }

  return placeId === selectedId ? 1 : 0;
}

function setStyleValue(element, property, value) {
  if (element.style.getPropertyValue(property) !== value) {
    element.style.setProperty(property, value);
  }
}

export function createLabelController({
  placesGroup,
  cameraController,
  config = SCENE_CONFIG,
}) {
  const entries = [];
  let hoveredId = null;
  let selectedId = null;
  let zoomState = getLabelZoomState(
    cameraController.labelScale,
    cameraController.labelDistance,
    config,
  );

  placesGroup.traverse((object) => {
    if (!object.isCSS2DObject || !object.parent?.isMesh) {
      return;
    }

    entries.push({
      placeId: object.parent.userData.placeId,
      label: object,
      element: object.element,
      scale: null,
      visible: null,
    });
  });

  function updateMaxWidth(entry, expanded) {
    const baseWidth = Number.parseFloat(
      entry.element.style.getPropertyValue('--compact-max-width'),
    );
    const maxWidth = expanded
      ? config.labelExpandedMaxWidth
      : Math.min(config.labelMaxWidth, baseWidth);
    setStyleValue(
      entry.element,
      '--label-max-width',
      `${(maxWidth * zoomState.scale).toFixed(2)}px`,
    );
  }

  function updateEntry(entry) {
    const expanded = isPlaceLabelEmphasized(entry.placeId, hoveredId, selectedId);
    const renderOrder = getPlaceLabelRenderOrder(entry.placeId, hoveredId, selectedId);
    const { element } = entry;

    if (entry.label.renderOrder !== renderOrder) {
      entry.label.renderOrder = renderOrder;
    }

    if (entry.expanded !== expanded) {
      element.textContent = expanded
        ? element.dataset.fullName
        : element.dataset.compactName;
      element.classList.toggle('place-label--expanded', expanded);
      setStyleValue(
        element,
        '--label-padding-x',
        `${expanded ? config.labelExpandedPaddingX : config.labelPaddingX}px`,
      );
      setStyleValue(
        element,
        '--label-padding-y',
        `${expanded ? config.labelExpandedPaddingY : config.labelPaddingY}px`,
      );
      setStyleValue(
        element,
        '--label-line-height',
        String(expanded ? config.labelExpandedLineHeight : config.labelLineHeight),
      );
      updateMaxWidth(entry, expanded);
      entry.expanded = expanded;
    }

    if (entry.scale !== zoomState.scale) {
      setStyleValue(element, '--label-scale', zoomState.scale.toFixed(3));
      setStyleValue(
        element,
        '--label-font-size',
        `${config.labelFontSize * zoomState.scale}px`,
      );
      updateMaxWidth(entry, expanded);
      entry.scale = zoomState.scale;
    }

    const visible = zoomState.visible || expanded;
    if (entry.visible !== visible) {
      entry.label.visible = visible;
      entry.visible = visible;
    }
  }

  function updateEntries(placeIds) {
    for (const entry of entries) {
      if (placeIds.has(entry.placeId)) {
        updateEntry(entry);
      }
    }
  }

  return {
    update(camera) {
      if (camera !== cameraController.camera) {
        throw new Error('Label controller must be updated with the active camera.');
      }

      zoomState = getLabelZoomState(
        cameraController.labelScale,
        cameraController.labelDistance,
        config,
      );

      for (const entry of entries) {
        updateEntry(entry);
      }
    },
    setHoveredId(nextHoveredId) {
      const previousHoveredId = hoveredId;
      hoveredId = nextHoveredId;
      updateEntries(new Set([previousHoveredId, nextHoveredId]));
    },
    setSelectedId(nextSelectedId) {
      const previousSelectedId = selectedId;
      selectedId = nextSelectedId;
      updateEntries(new Set([previousSelectedId, nextSelectedId]));
    },
    dispose() {
      entries.length = 0;
    },
  };
}
