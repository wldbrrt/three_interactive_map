import * as THREE from 'three';
import { SCENE_CONFIG } from '../app/config.js';

const SWITCH_PROGRESS = 0.48;

function easeInOut(progress) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - ((-2 * progress + 2) ** 3) / 2;
}

function getTopDownUp(camera) {
  const cameraRight = new THREE.Vector3(1, 0, 0)
    .applyQuaternion(camera.quaternion);
  cameraRight.y = 0;

  if (cameraRight.lengthSq() < 1e-8) {
    return new THREE.Vector3(0, 0, -1);
  }

  cameraRight.normalize();
  return new THREE.Vector3(cameraRight.z, 0, -cameraRight.x);
}

export function createCameraController({
  perspectiveCamera,
  orthographicCamera,
  perspectiveControls,
  orthographicControls,
  bounds,
  target,
  onChange = () => {},
}) {
  let activeMode = '3d';
  let activeCamera = perspectiveCamera;
  let activeControls = perspectiveControls;
  let transition = null;
  let aspect = perspectiveCamera.aspect;
  let orthographicBaseHeight = Math.max(bounds.depth, bounds.width / aspect) * 1.12;
  let stableOrthographicZoom = 1;
  let shadowIntensity = 1;
  let savedPerspectivePose = {
    position: perspectiveCamera.position.clone(),
    quaternion: perspectiveCamera.quaternion.clone(),
    target: target.clone(),
    up: perspectiveCamera.up.clone(),
  };

  function setOrthographicFrustum(height) {
    orthographicBaseHeight = height;
    orthographicCamera.left = -(height * aspect) / 2;
    orthographicCamera.right = (height * aspect) / 2;
    orthographicCamera.top = height / 2;
    orthographicCamera.bottom = -height / 2;
    orthographicCamera.updateProjectionMatrix();
  }

  function getTargetFitHeight() {
    return Math.max(bounds.depth, bounds.width / aspect) * 1.12;
  }

  function switchActiveCamera(mode) {
    activeMode = mode;
    activeCamera = mode === '3d' ? perspectiveCamera : orthographicCamera;
    activeControls = mode === '3d' ? perspectiveControls : orthographicControls;
    perspectiveControls.enabled = mode === '3d';
    orthographicControls.enabled = mode === '2d';
    activeControls.target.copy(transition.currentTarget);
    activeControls.update();
    onChange({ mode, camera: activeCamera, controls: activeControls });
  }

  function prepareTopDownPerspective(baseHeight) {
    const distance = baseHeight / (2 * Math.tan(THREE.MathUtils.degToRad(perspectiveCamera.fov / 2)));
    perspectiveCamera.position.copy(transition.currentTarget).add(new THREE.Vector3(0, distance, 0));
    perspectiveCamera.up.copy(orthographicCamera.up);
    perspectiveCamera.lookAt(transition.currentTarget);
    perspectiveCamera.updateProjectionMatrix();
  }

  function beginTransition(mode, now = performance.now()) {
    const currentTarget = activeControls.target.clone();

    if (mode === '2d' && activeMode === '3d') {
      savedPerspectivePose = {
        position: perspectiveCamera.position.clone(),
        quaternion: perspectiveCamera.quaternion.clone(),
        target: currentTarget.clone(),
        up: perspectiveCamera.up.clone(),
      };

      const distance = perspectiveCamera.position.distanceTo(currentTarget);
      const baseHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(perspectiveCamera.fov / 2));
      const topDownCamera = perspectiveCamera.clone();
      topDownCamera.position.copy(currentTarget).add(new THREE.Vector3(0, distance, 0));
      const topDownUp = getTopDownUp(perspectiveCamera);
      topDownCamera.up.copy(topDownUp);
      topDownCamera.lookAt(currentTarget);

      transition = {
        targetMode: mode,
        phase: 'perspective-to-top',
        startTime: now,
        duration: SCENE_CONFIG.cameraTransitionDuration * SWITCH_PROGRESS,
        startPosition: perspectiveCamera.position.clone(),
        startQuaternion: perspectiveCamera.quaternion.clone(),
        endPosition: topDownCamera.position.clone(),
        endQuaternion: topDownCamera.quaternion.clone(),
        topDownUp,
        currentTarget,
        baseHeight,
        startShadowIntensity: shadowIntensity,
        endShadowIntensity: SWITCH_PROGRESS,
        startZoom: orthographicCamera.zoom,
        endZoom: baseHeight / getTargetFitHeight(),
      };
      activeControls.enabled = false;
      return;
    }

    if (mode === '3d' && activeMode === '2d') {
      transition = {
        targetMode: mode,
        phase: 'orthographic-to-top',
        startTime: now,
        duration: SCENE_CONFIG.cameraTransitionDuration * SWITCH_PROGRESS,
        currentTarget,
        startZoom: orthographicCamera.zoom,
        endZoom: 1,
        baseHeight: orthographicBaseHeight,
        startShadowIntensity: shadowIntensity,
        endShadowIntensity: 1 - SWITCH_PROGRESS,
      };
      activeControls.enabled = false;
    }
  }

  function returnToActiveMode(mode, now) {
    if (mode === '3d') {
      transition = {
        targetMode: mode,
        phase: 'perspective-to-saved',
        startTime: now,
        duration: SCENE_CONFIG.cameraTransitionDuration * 0.6,
        currentTarget: perspectiveControls.target.clone(),
        startTarget: perspectiveControls.target.clone(),
        startPosition: perspectiveCamera.position.clone(),
        startQuaternion: perspectiveCamera.quaternion.clone(),
        startShadowIntensity: shadowIntensity,
        endShadowIntensity: 1,
      };
    } else {
      transition = {
        targetMode: mode,
        phase: 'orthographic-zoom-restore',
        startTime: now,
        duration: SCENE_CONFIG.cameraTransitionDuration * 0.6,
        currentTarget: orthographicControls.target.clone(),
        startZoom: orthographicCamera.zoom,
        endZoom: stableOrthographicZoom,
        startShadowIntensity: shadowIntensity,
        endShadowIntensity: 0,
      };
    }

    activeControls.enabled = false;
  }

  function setMode(mode, now) {
    if (mode !== '2d' && mode !== '3d') {
      throw new RangeError(`Unknown camera mode: ${mode}.`);
    }

    if (mode === activeMode && !transition) {
      return;
    }

    if (transition?.targetMode === mode) {
      return;
    }

    const wasTransitioning = transition !== null;

    if (wasTransitioning) {
      transition = null;
      activeControls.enabled = true;
    }

    if (mode === activeMode) {
      if (wasTransitioning) {
        returnToActiveMode(mode, now ?? performance.now());
      }
      return;
    }

    beginTransition(mode, now);
  }

  function toggle(now) {
    const currentDestination = transition?.targetMode ?? activeMode;
    setMode(currentDestination === '3d' ? '2d' : '3d', now);
  }

  function update(now = performance.now()) {
    if (!transition) {
      return;
    }

    const progress = THREE.MathUtils.clamp((now - transition.startTime) / transition.duration, 0, 1);
    const eased = easeInOut(progress);
    shadowIntensity = THREE.MathUtils.lerp(
      transition.startShadowIntensity,
      transition.endShadowIntensity,
      eased,
    );

    if (transition.phase === 'perspective-to-top') {
      perspectiveCamera.position.lerpVectors(transition.startPosition, transition.endPosition, eased);
      perspectiveCamera.quaternion.slerpQuaternions(
        transition.startQuaternion,
        transition.endQuaternion,
        eased,
      );

      if (progress >= 1) {
        setOrthographicFrustum(transition.baseHeight);
        orthographicCamera.position.copy(transition.currentTarget).add(
          new THREE.Vector3(0, transition.baseHeight, 0),
        );
        orthographicCamera.up.copy(transition.topDownUp);
        orthographicCamera.lookAt(transition.currentTarget);
        orthographicCamera.zoom = transition.startZoom;
        orthographicCamera.updateProjectionMatrix();
        transition.phase = 'orthographic-zoom-in';
        transition.startTime = now;
        transition.duration = SCENE_CONFIG.cameraTransitionDuration * (1 - SWITCH_PROGRESS);
        transition.startShadowIntensity = shadowIntensity;
        transition.endShadowIntensity = 0;
        switchActiveCamera('2d');
      }
      return;
    }

    if (transition.phase === 'orthographic-zoom-in') {
      orthographicCamera.zoom = THREE.MathUtils.lerp(transition.startZoom, transition.endZoom, eased);
      orthographicCamera.updateProjectionMatrix();

      if (progress >= 1) {
        stableOrthographicZoom = transition.endZoom;
        shadowIntensity = transition.endShadowIntensity;
        transition = null;
        orthographicControls.enabled = true;
        onChange({ mode: activeMode, camera: activeCamera, controls: activeControls });
      }
      return;
    }

    if (transition.phase === 'orthographic-zoom-restore') {
      orthographicCamera.zoom = THREE.MathUtils.lerp(transition.startZoom, transition.endZoom, eased);
      orthographicCamera.updateProjectionMatrix();

      if (progress >= 1) {
        shadowIntensity = transition.endShadowIntensity;
        transition = null;
        orthographicControls.enabled = true;
        onChange({ mode: activeMode, camera: activeCamera, controls: activeControls });
      }
      return;
    }

    if (transition.phase === 'orthographic-to-top') {
      orthographicCamera.zoom = THREE.MathUtils.lerp(transition.startZoom, transition.endZoom, eased);
      orthographicCamera.updateProjectionMatrix();

      if (progress >= 1) {
        prepareTopDownPerspective(transition.baseHeight);
        transition.phase = 'perspective-to-saved';
        transition.startTime = now;
        transition.duration = SCENE_CONFIG.cameraTransitionDuration * (1 - SWITCH_PROGRESS);
        transition.startShadowIntensity = shadowIntensity;
        transition.endShadowIntensity = 1;
        transition.startPosition = perspectiveCamera.position.clone();
        transition.startQuaternion = perspectiveCamera.quaternion.clone();
        transition.startTarget = transition.currentTarget.clone();
        switchActiveCamera('3d');
      }
      return;
    }

    perspectiveCamera.position.lerpVectors(
      transition.startPosition,
      savedPerspectivePose.position,
      eased,
    );
    perspectiveCamera.quaternion.slerpQuaternions(
      transition.startQuaternion,
      savedPerspectivePose.quaternion,
      eased,
    );
    perspectiveControls.target.lerpVectors(
      transition.startTarget,
      savedPerspectivePose.target,
      eased,
    );
    perspectiveControls.update();

    if (progress >= 1) {
      perspectiveCamera.up.copy(savedPerspectivePose.up);
      perspectiveControls.enabled = true;
      shadowIntensity = transition.endShadowIntensity;
      transition = null;
      onChange({ mode: activeMode, camera: activeCamera, controls: activeControls });
    }
  }

  function resize(nextAspect) {
    aspect = nextAspect;
    perspectiveCamera.aspect = aspect;
    perspectiveCamera.updateProjectionMatrix();

    if (activeMode === '2d' || transition?.targetMode === '2d') {
      const visibleHeight = orthographicBaseHeight / orthographicCamera.zoom;
      setOrthographicFrustum(Math.max(getTargetFitHeight(), visibleHeight));
      orthographicCamera.updateProjectionMatrix();
    } else {
      orthographicCamera.left = -(orthographicBaseHeight * aspect) / 2;
      orthographicCamera.right = (orthographicBaseHeight * aspect) / 2;
      orthographicCamera.updateProjectionMatrix();
    }
  }

  orthographicControls.enabled = false;
  perspectiveControls.enabled = true;

  return {
    get mode() {
      return transition?.targetMode ?? activeMode;
    },
    get activeMode() {
      return activeMode;
    },
    get camera() {
      return activeCamera;
    },
    get controls() {
      return activeControls;
    },
    get isTransitioning() {
      return transition !== null;
    },
    get labelScale() {
      if (activeMode === '2d') {
        const baselineZoom = transition?.targetMode === '2d'
          ? transition.endZoom
          : stableOrthographicZoom;
        return orthographicCamera.zoom / baselineZoom;
      }

      return savedPerspectivePose.position.distanceTo(savedPerspectivePose.target)
        / perspectiveCamera.position.distanceTo(perspectiveControls.target);
    },
    get labelDistance() {
      if (activeMode === '2d') {
        return orthographicBaseHeight / orthographicCamera.zoom;
      }

      return perspectiveCamera.position.distanceTo(perspectiveControls.target);
    },
    get shadowIntensity() {
      return shadowIntensity;
    },
    setMode,
    toggle,
    update,
    resize,
  };
}