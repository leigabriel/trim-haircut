import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import {
  MAX_PIXEL_RATIO,
  afterPaint,
  createStage,
  disposeNode,
  watchVisibility,
} from '../../../lib/threeStage';
import './Scissors.css';

const TOOLS_URL = '/models/barber-tools/Barber_Tool.gltf';

// How far the pointer can swing the scissors, either side of centre.
const MAX_TURN = 0.55;
/** Below this the turn is visually settled, so the loop can stop. */
const SETTLE = 0.0006;
/** Start building this far before the footer is on screen. */
const APPROACH_MARGIN = '320px 0px';

/**
 * The main scissors from the barber tools file, alone.
 *
 * The gltf holds seven props; this picks one. "single thinning scissors" also
 * matches a plain /scissors/i test, so it is excluded explicitly, otherwise
 * two tools render where one was asked for.
 */
const isMainScissors = (name: string) => /scissors/i.test(name) && !/thinning/i.test(name);

interface ScissorsProps {
  /**
   * Fraction of the mount the model spans. Above 1 it deliberately overflows,
   * which is how the model bleeds off the bottom of the footer.
   */
  fill?: number;
  /** Shifts the model vertically, as a fraction of the mount's height. */
  offsetY?: number;
}

/**
 * Footer backdrop. The scissors turn toward the pointer rather than spinning,
 * which reads as responsive without pulling attention off the copy.
 *
 * Built only as the footer approaches. It used to build and load on mount, so
 * the home page decoded the same 32MB of maps twice, in two WebGL contexts, at
 * the same moment. Here the hero is finished and paused by the time this runs.
 */
const Scissors: React.FC<ScissorsProps> = ({ fill = 0.72, offsetY = 0 }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let isAlive = true;
    let isVisible = true;
    let raf = 0;
    let teardown: (() => void) | null = null;
    let cancelBuild = () => {};

    const pointer = new THREE.Vector2();

    const build = () => {
      if (!isAlive) return;

      const stage = createStage(mount);
      if (!stage) return;
      const { scene, camera, renderer } = stage;

      const pivot = new THREE.Group();
      scene.add(pivot);

      const box = new THREE.Box3();
      const size = new THREE.Vector3();

      const fit = () => {
        if (size.lengthSq() === 0) return;
        const halfFov = Math.tan((camera.fov * Math.PI) / 360);
        const forHeight = size.y / 2 / halfFov;
        const forWidth = size.x / 2 / (halfFov * camera.aspect);
        camera.position.z = Math.max(forHeight, forWidth) / fill;
        // Offset in camera space, so the model drops without changing its size.
        pivot.position.y = -offsetY * size.y;
        camera.lookAt(0, 0, 0);
      };

      const render = () => {
        if (isAlive) renderer.render(scene, camera);
      };

      const requestFrame = () => {
        if (raf || !isAlive || document.hidden || !isVisible) return;
        raf = window.requestAnimationFrame(tick);
      };

      const resize = () => {
        if (!mount.clientWidth || !mount.clientHeight) return;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
        renderer.setSize(mount.clientWidth, mount.clientHeight, false);
        camera.aspect = mount.clientWidth / mount.clientHeight;
        camera.updateProjectionMatrix();
        fit();
        render();
      };

      const observer = new ResizeObserver(resize);
      observer.observe(mount);

      new GLTFLoader().load(TOOLS_URL, (gltf) => {
        if (!isAlive) return;

        gltf.scene.updateWorldMatrix(true, true);

        const meshes: THREE.Mesh[] = [];
        gltf.scene.traverse((node) => {
          if ((node as THREE.Mesh).isMesh) meshes.push(node as THREE.Mesh);
        });

        const source = meshes.find((mesh) => isMainScissors(mesh.name ?? ''));
        if (!source) return;

        // Cloned so this mount owns its own geometry and materials, which is
        // what makes disposeNode safe below.
        const copy = source.clone(true);
        copy.position.setFromMatrixPosition(source.matrixWorld);
        copy.quaternion.setFromRotationMatrix(source.matrixWorld);
        copy.scale.setFromMatrixScale(source.matrixWorld);
        pivot.add(copy);

        // Centre on the bounding box. Scaling instead would break the normals
        // on the thin blades.
        box.setFromObject(copy);
        box.getSize(size);
        copy.position.sub(box.getCenter(new THREE.Vector3()));
        fit();

        // compile() skips invisible objects, so the textures have to be warm
        // before the first visible frame or the model pops in shattered.
        renderer.compile(scene, camera);
        render();
      });

      const handlePointerMove = (event: PointerEvent) => {
        pointer.set((event.clientX / window.innerWidth - 0.5) * 2, 0);
        requestFrame();
      };

      const handleVisibilityChange = () => {
        if (!document.hidden) requestFrame();
      };

      window.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Ionic keeps previous pages mounted, so gate the loop.
      const stopWatching = watchVisibility(mount, (visible) => {
        isVisible = visible;
        if (visible) requestFrame();
      });

      function tick() {
        raf = 0;
        if (!isAlive || document.hidden || !isVisible) return;

        const target = -pointer.x * MAX_TURN;
        const delta = target - pivot.rotation.y;
        pivot.rotation.y += delta * 0.08;
        render();

        // Nothing left to draw once the turn has caught the pointer.
        if (Math.abs(delta) > SETTLE) requestFrame();
      }

      // Fit once the stylesheet has given the mount a box.
      resize();

      teardown = () => {
        window.cancelAnimationFrame(raf);
        window.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        observer.disconnect();
        stopWatching();
        disposeNode(pivot);
        stage.dispose();
      };
    };

    // Build on approach instead of on mount: the footer is far below the hero
    // and shares its model.
    const approach = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        approach.disconnect();
        cancelBuild = afterPaint(build);
      },
      { rootMargin: APPROACH_MARGIN },
    );
    approach.observe(mount);

    return () => {
      isAlive = false;
      approach.disconnect();
      cancelBuild();
      teardown?.();
    };
  }, [fill, offsetY]);

  return <div ref={mountRef} className="trim-scissors" aria-hidden="true" />;
};

export default Scissors;
