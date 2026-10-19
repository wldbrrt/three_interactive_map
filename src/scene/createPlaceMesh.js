import * as THREE from 'three';
import { SCENE_CONFIG } from '../app/config.js';

export function createPlaceMesh(place) {
  const geometry = new THREE.BoxGeometry(
    place.width,
    SCENE_CONFIG.storeHeight,
    place.depth,
  );
  const material = new THREE.MeshStandardMaterial({
    color: place.color,
    emissive: 0x000000,
    roughness: 0.72,
    metalness: 0.02,
  });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.set(place.x, SCENE_CONFIG.storeHeight / 2, place.z);
  mesh.userData.placeId = place.id;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}