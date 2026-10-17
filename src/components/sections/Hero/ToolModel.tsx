import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { watchVisibility } from '../../../lib/threeStage';
import './ToolModel.css';

const TOOLS_URL = '/models/barber-tools/Barber_Tool.gltf';
const HOLD_MS = 2000;
// One tool at a time: overlapping models z-fight.
const FADE_MS = 620;
const FILL = 0.78;
const MAX_TURN = 0.7;

// Smootherstep, so the fade has no start or stop tick.
const ease = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

interface Tool {
  root: THREE.Group;
  holder: THREE.Group;
  radius: number;
  materials: THREE.Material[];
  isScissor: boolean;
}

// Scissors read small beside the bulkier tools.
const SCISSOR_BOOST = 1.45;

interface ToolModelProps {
  isEntered: boolean;
  onProgress?: (ratio: number) => void;
  onReady?: () => void;
}

const ToolModel: React.FC<ToolModelProps> = ({ isEntered, onProgress, onReady }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  // Set once models load, called when the hero is on screen.
  const revealRef = useRef<(() => void) | null>(null);
  const revealedRef = useRef(isEntered);
  // Ref, so a parent re-render does not re-run the mount effect.
  const callbacks = useRef({ onProgress, onReady });
  callbacks.current = { onProgress, onReady };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    // Tools face +Z, so the camera sits on Z looking back.
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearAlpha(0);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(2, 3, 4);
    scene.add(keyLight);

    // Metals need an environment or they render near black.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envMap;
    scene.environmentIntensity = 0.75;

    const pivot = new THREE.Group();
    scene.add(pivot);

    const pointer = new THREE.Vector2();
    const tools: Tool[] = [];
    let active = -1;
    // Fade states, strictly sequential.
    let phase: 'idle' | 'out' | 'in' = 'idle';
    let phaseStart = 0;
    let holdStart = 0;
    // Tool fading out, so only two are written per frame.
    let from = 0;

    // Touches one tool, not all seven.
    const applyOpacity = (tool: Tool | undefined, value: number) => {
      if (!tool) return;
      tool.root.visible = value > 0.002;
      tool.materials.forEach((material) => {
        material.opacity = value;
      });
    };

    const paint = (index: number, value: number) => {
      applyOpacity(tools[index], value);
    };

    // Tools differ in size, so reframe on every switch.
    const frame = () => {
      const tool = tools[active];
      if (!tool) return;
      const radius = tool.radius / (tool.isScissor ? SCISSOR_BOOST : 1);
      const needed = (2 * radius) / FILL;
      const half = Math.tan((camera.fov * Math.PI) / 360);
      camera.position.z = Math.max(needed / (2 * half), needed / (2 * half * camera.aspect));
      camera.lookAt(0, 0, 0);
    };

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      // 0 until the stylesheet lands; ResizeObserver calls back after.
      if (!clientWidth || !clientHeight) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      frame();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url, loaded, total) => {
      callbacks.current.onProgress?.(total > 0 ? Math.min(1, loaded / total) : 0);
    };

    new GLTFLoader(manager).load(TOOLS_URL, (gltf) => {
      gltf.scene.updateWorldMatrix(true, true);

      const meshes: THREE.Mesh[] = [];
      gltf.scene.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) meshes.push(node as THREE.Mesh);
      });

      meshes.forEach((mesh) => {
        // root carries the yaw, holder the authored placement.
        const root = new THREE.Group();
        const holder = new THREE.Group();
        holder.position.setFromMatrixPosition(mesh.matrixWorld);
        holder.quaternion.setFromRotationMatrix(mesh.matrixWorld);
        holder.scale.setFromMatrixScale(mesh.matrixWorld);

        // Both scissor meshes.
        const isScissor = /scissors/i.test(mesh.name ?? '');

        const copy = mesh.clone(true);
        const materials: THREE.Material[] = [];
        copy.traverse((node) => {
          const part = node as THREE.Mesh;
          if (!part.isMesh) return;
          part.material = Array.isArray(part.material)
            ? part.material.map((material) => material.clone())
            : part.material?.clone();
          const list = Array.isArray(part.material) ? part.material : [part.material];
          list.forEach((material) => {
            if (!material) return;
            material.transparent = true;
            material.opacity = 0;
            materials.push(material);
          });
        });
        holder.add(copy);
        root.add(holder);

        // Yaw anything facing the camera so it lies flat.
        let box = new THREE.Box3().setFromObject(root);
        if (box.getSize(new THREE.Vector3()).z > box.getSize(new THREE.Vector3()).x) {
          holder.rotateY(Math.PI / 2);
          box = new THREE.Box3().setFromObject(root);
        }

        root.position.sub(box.getCenter(new THREE.Vector3()));
        const radius = box.getBoundingSphere(new THREE.Sphere()).radius;

        pivot.add(root);
        tools.push({ root, holder, radius, materials, isScissor });
      });

      if (tools.length === 0) return;
      const lead = tools.findIndex((tool) => tool.isScissor);
      if (lead > 0) tools.unshift(...tools.splice(lead, 1));

      revealRef.current = () => {
        const start = performance.now();
        holdStart = start;
        phase = 'in';
        phaseStart = start;
        from = active;
      };

      active = 0;
      from = 0;
      resize();

      // Warm every tool before the reveal. compile() skips invisible
      // objects, so without this the 2048px maps upload on the first visible
      // frame and the model shatters.
      tools.forEach((tool) => {
        tool.root.visible = true;
        tool.materials.forEach((material) => {
          material.opacity = 1;
        });
      });
      renderer.compile(scene, camera);
      renderer.render(scene, camera);

      tools.forEach((tool, index) => {
        applyOpacity(tool, index === 0 && revealedRef.current ? 1 : 0);
      });

      if (revealedRef.current) {
        holdStart = performance.now();
        phaseStart = holdStart;
      }

      callbacks.current.onProgress?.(1);
      callbacks.current.onReady?.();
    });

    const handlePointerMove = (event: PointerEvent) => {
      pointer.set((event.clientX / window.innerWidth - 0.5) * 2, 0);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      pointer.x = event.key === 'ArrowLeft' ? -1 : 1;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('keydown', handleKeyDown);

    // Ionic keeps previous pages mounted, so gate the loop.
    let isVisible = true;
    const stopWatching = watchVisibility(mount, (visible) => {
      isVisible = visible;
    });

    let frame2 = 0;
    const tick = () => {
      frame2 = requestAnimationFrame(tick);
      if (document.hidden || !isVisible) return;
      const now = performance.now();

      if (tools.length > 0) {
        if (phase === 'idle') {
          if (now - holdStart > HOLD_MS) {
            phase = 'out';
            phaseStart = now;
            from = active;
          }
        } else if (phase === 'out') {
          const t = Math.min(1, (now - phaseStart) / FADE_MS);
          paint(from, 1 - ease(t));
          if (t >= 1) {
            applyOpacity(tools[from], 0);
            active = (from + 1) % tools.length;
            phase = 'in';
            phaseStart = now;
            frame();
          }
        } else {
          const t = Math.min(1, (now - phaseStart) / FADE_MS);
          paint(active, ease(t));
          if (t >= 1) {
            paint(active, 1);
            phase = 'idle';
            holdStart = now;
          }
        }
      }

      // Turn toward the cursor rather than spin.
      const yaw = -pointer.x * MAX_TURN;
      pivot.rotation.y += (yaw - pivot.rotation.y) * 0.06;
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame2);
      revealRef.current = null;
      observer.disconnect();
      stopWatching();
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('keydown', handleKeyDown);
      pivot.traverse((node) => {
        const mesh = node as THREE.Mesh;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => {
          Object.values(material ?? {}).forEach((value) => {
            if (value instanceof THREE.Texture) value.dispose();
          });
          material?.dispose();
        });
      });
      renderer.dispose();
      envMap.dispose();
      pmrem.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (!isEntered || revealedRef.current) return;
    revealedRef.current = true;
    revealRef.current?.();
  }, [isEntered]);

  return <div ref={mountRef} className="trim-tools" aria-hidden="true" />;
};

export default ToolModel;