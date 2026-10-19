import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { SCENE_CONFIG } from '../app/config.js';

export function resolveSelectedId(currentId, hitId) {
  return hitId ?? currentId;
}

export function hasPointerMoved(start, current, threshold = 5) {
  if (!start) {
    return false;
  }

  return Math.hypot(current.x - start.x, current.y - start.y) > threshold;
}

export function createSelectionOutline(mesh, width, height) {
  const edges = new THREE.EdgesGeometry(mesh.geometry);
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(Array.from(edges.attributes.position.array));
  edges.dispose();

  const material = new LineMaterial({
    color: SCENE_CONFIG.selectedOutlineColor,
    linewidth: SCENE_CONFIG.selectedOutlineWidth,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
  material.resolution.set(width, height);

  const outline = new LineSegments2(geometry, material);
  outline.scale.setScalar(SCENE_CONFIG.selectedOutlineScale);
  outline.name = 'selection-outline';
  outline.renderOrder = 3;
  outline.userData.isSelectionOutline = true;

  return outline;
}

export function createPicking({
  canvas,
  meshes,
  placesById,
  cameraController,
  controls,
  onSelectionChange = () => {},
}) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const originalEmissive = new Map();
  const meshesById = new Map();
  const outlinesById = new Map();
  let hoveredId = null;
  let selectedId = null;
  let pointerInside = false;
  let pointerDownPosition = null;
  let pointerDragged = false;

  const resizeObserver = new ResizeObserver(() => {
    const bounds = canvas.getBoundingClientRect();

    for (const outline of outlinesById.values()) {
      outline.material.resolution.set(bounds.width, bounds.height);
    }
  });

  for (const mesh of meshes) {
    const placeId = mesh.userData.placeId;
    meshesById.set(placeId, mesh);
    originalEmissive.set(placeId, mesh.material.emissive.clone());
  }

  function setVisualState(placeId, intensity) {
    const mesh = meshesById.get(placeId);

    if (!mesh) {
      return;
    }

    mesh.material.emissive.set(intensity > 0
      ? SCENE_CONFIG.hoverEmissiveColor
      : originalEmissive.get(placeId));
    mesh.material.emissiveIntensity = intensity;
  }

  function restorePlace(placeId) {
    if (placeId) {
      const mesh = meshesById.get(placeId);

      if (mesh) {
        mesh.material.emissive.copy(originalEmissive.get(placeId));
        mesh.material.emissiveIntensity = 0;
      }
    }
  }

  function applyVisualState(placeId) {
    if (!placeId) {
      return;
    }

    if (placeId === selectedId || placeId === hoveredId) {
      setVisualState(placeId, SCENE_CONFIG.hoverEmissiveIntensity);
    } else {
      restorePlace(placeId);
    }
  }

  function removeSelectionOutline(placeId) {
    const outline = outlinesById.get(placeId);
    const mesh = meshesById.get(placeId);

    if (!outline || !mesh) {
      return;
    }

    mesh.remove(outline);
    outline.geometry.dispose();
    outline.material.dispose();
    outlinesById.delete(placeId);
  }

  function addSelectionOutline(placeId) {
    const mesh = meshesById.get(placeId);

    if (!mesh || outlinesById.has(placeId)) {
      return;
    }

    const bounds = canvas.getBoundingClientRect();
    const outline = createSelectionOutline(mesh, bounds.width, bounds.height);
    mesh.add(outline);
    outlinesById.set(placeId, outline);
  }

  function updateSelectionOutline(previousId, nextId) {
    if (previousId && previousId !== nextId) {
      removeSelectionOutline(previousId);
    }

    if (nextId) {
      addSelectionOutline(nextId);
    }
  }

  function pick(event) {
    const bounds = canvas.getBoundingClientRect();

    if (bounds.width === 0 || bounds.height === 0) {
      return null;
    }

    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, cameraController.camera);

    const hit = raycaster.intersectObjects(meshes, false)[0];
    return hit?.object.userData.placeId ?? null;
  }

  function handlePointerMove(event) {
    pointerInside = true;
    if (pointerDownPosition && hasPointerMoved(pointerDownPosition, event)) {
      pointerDragged = true;
    }

    const nextHoveredId = pick(event);

    if (nextHoveredId === hoveredId) {
      return;
    }

    const previousHoveredId = hoveredId;
    hoveredId = nextHoveredId;
    applyVisualState(previousHoveredId);
    applyVisualState(hoveredId);
    canvas.style.cursor = hoveredId ? 'pointer' : 'grab';
  }

  function handlePointerLeave() {
    pointerInside = false;
    const previousHoveredId = hoveredId;
    hoveredId = null;
    applyVisualState(previousHoveredId);
    canvas.style.cursor = 'grab';
  }

  function handlePointerDown(event) {
    if (event.button !== 0) {
      return;
    }

    pointerDownPosition = { x: event.clientX, y: event.clientY };
    pointerDragged = false;
  }

  function handlePointerUp() {
    pointerDownPosition = null;
  }

  function handleClick(event) {
    if (pointerDragged) {
      pointerDragged = false;
      return;
    }

    if (!pointerInside) {
      pointerInside = true;
    }

    const hitId = pick(event);
    if (!hitId) {
      return;
    }

    const previousSelectedId = selectedId;
    selectedId = resolveSelectedId(selectedId, hitId);

    updateSelectionOutline(previousSelectedId, selectedId);
    applyVisualState(previousSelectedId);
    applyVisualState(selectedId);

    const place = selectedId ? placesById.get(selectedId) : null;
    onSelectionChange(place ?? null);

    if (place) {
      console.info({
        id: place.id,
        name: place.name,
        x: place.x,
        z: place.z,
        width: place.width,
        depth: place.depth,
      });
    }
  }

  function clearSelection() {
    const previousSelectedId = selectedId;
    selectedId = null;
    updateSelectionOutline(previousSelectedId, null);
    applyVisualState(previousSelectedId);
    onSelectionChange(null);
  }

  function handleCameraChange() {
    if (!pointerInside) {
      return;
    }

    const previousHoveredId = hoveredId;
    const nextHoveredId = pick({
      clientX: lastPointerX,
      clientY: lastPointerY,
    });
    hoveredId = nextHoveredId;
    applyVisualState(previousHoveredId);
    applyVisualState(hoveredId);
  }

  let lastPointerX = 0;
  let lastPointerY = 0;

  function trackPointer(event) {
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    handlePointerMove(event);
  }

  canvas.style.cursor = 'grab';
  resizeObserver.observe(canvas);
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', handlePointerUp);
  canvas.addEventListener('pointermove', trackPointer);
  canvas.addEventListener('pointerleave', handlePointerLeave);
  canvas.addEventListener('click', handleClick);
  controls.forEach((control) => control.addEventListener('change', handleCameraChange));

  return {
    get hoveredId() {
      return hoveredId;
    },
    get selectedId() {
      return selectedId;
    },
    clearSelection,
    dispose() {
      resizeObserver.disconnect();
      canvas.removeEventListener('pointermove', trackPointer);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerUp);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      canvas.removeEventListener('click', handleClick);
      controls.forEach((control) => control.removeEventListener('change', handleCameraChange));
      canvas.style.cursor = '';
      for (const mesh of meshes) {
        removeSelectionOutline(mesh.userData.placeId);
        mesh.material.emissive.copy(originalEmissive.get(mesh.userData.placeId));
        mesh.material.emissiveIntensity = 0;
      }
    },
  };
}