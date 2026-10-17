import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { afterPaint, createStage, disposeNode, watchVisibility } from '../../../lib/threeStage';
import './Scissors.css';

const TOOLS_URL = '/models/barber-tools/Barber_Tool.gltf';

// How far the pointer can swing the scissors, either side of centre.
const MAX_TURN = 0.55;

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
 */
const Scissors: React.FC<ScissorsProps> = ({ fill = 0.72, offsetY = 0 }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let isAlive = true;
    let isVisible = true;
    let frame = 0;
    let teardown: (() => void) | null = null;

    const pointer = new THREE.Vector2();

    const cancelBuild = afterPaint(() => {
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

      const resize = () => {
        if (!mount.clientWidth || !mount.clientHeight) return;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(mount.clientWidth, mount.clientHeight, false);
        camera.aspect = mount.clientWidth / mount.clientHeight;
        camera.updateProjectionMatrix();
        fit();
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
      });

      const handlePointerMove = (event: PointerEvent) => {
        pointer.set((event.clientX / window.innerWidth - 0.5) * 2, 0);
      };

      window.addEventListener('pointermove', handlePointerMove);

      // Ionic keeps previous pages mounted, so gate the loop.
      const stopWatching = watchVisibility(mount, (visible) => {
        isVisible = visible;
      });

      const tick = () => {
        frame = requestAnimationFrame(tick);
        if (document.hidden || !isVisible) return;

        const target = -pointer.x * MAX_TURN;
        pivot.rotation.y += (target - pivot.rotation.y) * 0.05;
        pivot.rotation.x = -pointer.y * 0.06;

        renderer.render(scene, camera);
      };
      tick();

      teardown = () => {
        window.cancelAnimationFrame(frame);
        window.removeEventListener('pointermove', handlePointerMove);
        observer.disconnect();
        stopWatching();
        disposeNode(pivot);
        stage.dispose();
      };
    });

    return () => {
      isAlive = false;
      cancelBuild();
      teardown?.();
    };
  }, [fill, offsetY]);

  return <div ref={mountRef} className="trim-scissors" aria-hidden="true" />;
};

export default Scissors;