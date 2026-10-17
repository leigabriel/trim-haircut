import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Shared plumbing for the three.js mounts. Building a renderer, an environment
 * and compiled materials blocks for seconds, which froze the page on every
 * navigation, so stages are built after the first paint and pause off screen.
 */

/** Defers work until after the new frame paints. */
export const afterPaint = (fn: () => void) => {
  let cancelled = false;
  const id = window.requestAnimationFrame(() => {
    // A second frame guarantees the paint landed.
    window.requestAnimationFrame(() => {
      if (!cancelled) fn();
    });
  });
  return () => {
    cancelled = true;
    window.cancelAnimationFrame(id);
  };
};

export interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  dispose: () => void;
}

/**
 * Builds the renderer, lights and environment. Null when the mount has no box
 * yet, which is normal during route transitions.
 */
export const createStage = (mount: HTMLElement, fov = 35): Stage | null => {
  if (!mount.clientWidth || !mount.clientHeight) return null;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, mount.clientWidth / mount.clientHeight, 0.1, 100);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearAlpha(0);
  mount.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 1));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
  keyLight.position.set(2, 3, 4);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
  rimLight.position.set(-3, -1, -3);
  scene.add(rimLight);

  // Without an environment, metal and acrylic render flat.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envMap;
  scene.environmentIntensity = 0.85;

  return {
    scene,
    camera,
    renderer,
    dispose: () => {
      renderer.dispose();
      envMap.dispose();
      pmrem.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    },
  };
};

/**
 * Whether an element is on screen. Ionic keeps previous pages mounted, so
 * without this their loops keep burning CPU.
 */
export const watchVisibility = (element: HTMLElement, onChange: (visible: boolean) => void) => {
  const observer = new IntersectionObserver(
    ([entry]) => onChange(entry.isIntersecting),
    { threshold: 0 },
  );
  observer.observe(element);
  return () => observer.disconnect();
};

/** Disposes GPU resources under a node, textures included. */
export const disposeNode = (node: THREE.Object3D) => {
  node.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      Object.values(material ?? {}).forEach((value) => {
        if (value instanceof THREE.Texture) value.dispose();
      });
      material?.dispose();
    });
  });
};