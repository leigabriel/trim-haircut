import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { MAX_PIXEL_RATIO, watchVisibility } from '../../../lib/threeStage';
import './ToolModel.css';

const TOOLS_URL = '/models/barber-tools/Barber_Tool.gltf';
// Longer hold, shorter fade: the scene is still for most of its life, and every
// transition is a stretch where the compositor has work to do.
const HOLD_MS = 2800;
const FADE_MS = 520;
const FILL = 0.78;
const MAX_TURN = 0.55;
/** Below this the yaw is visually settled, so the loop can stop. */
const SETTLE = 0.0008;
/** Gap between resting-texture uploads, so one tool never blocks a frame. */
const WARM_GAP_MS = 320;

// Smootherstep, so the fade has no start or stop tick.
const ease = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Texture slots a MeshStandardMaterial can hold. */
const TEXTURE_SLOTS = [
  'map',
  'normalMap',
  'aoMap',
  'roughnessMap',
  'metalnessMap',
  'emissiveMap',
  'alphaMap',
  'bumpMap',
];

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

/**
 * The hero's turntable of barber tools.
 *
 * The scene is deliberately lazy: it renders only while something is moving.
 * The old loop drew sixty frames a second from mount until unmount, even
 * through the two second hold where the image does not change, and even with
 * the tab in the background. Here the loop stops when the yaw settles and the
 * next switch is handed to a timer, so idle cost is one wake-up per cycle.
 *
 * Only the lead tool is uploaded up front. Warming all seven in one render
 * uploaded twenty large maps in a single frame, which was the 1.3 second
 * freeze at first paint; the rest are warmed from idling timers.
 */
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

    let disposed = false;
    let isVisible = true;

    const scene = new THREE.Scene();
    // Tools face +Z, so the camera sits on Z looking back.
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.setClearAlpha(0);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(2, 3, 4);
    scene.add(keyLight);

    // Metals need an environment or they render near black.
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envMap = pmrem.fromScene(room, 0.04).texture;
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

    // Loop controls. A frame is requested, not owned: nothing runs between them.
    let raf = 0;
    let holdTimer = 0;
    let warmTimer = 0;
    let needsRender = true;
    // False until the lead's program and maps are on the GPU. Drawing earlier
    // would block on the same shader link the async compile is waiting for.
    let isWarm = false;

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

    const renderNow = () => {
      if (disposed || !isWarm) return;
      renderer.render(scene, camera);
      needsRender = false;
    };

    const requestFrame = () => {
      if (raf || disposed || document.hidden || !isVisible) return;
      raf = window.requestAnimationFrame(tick);
    };

    const stopLoop = () => {
      window.clearTimeout(holdTimer);
      if (raf) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    // Deadline, not a countdown: pointer moves during the hold re-arm this
    // without pushing the next switch further out.
    const armHold = () => {
      window.clearTimeout(holdTimer);
      // Before the reveal there is no cycle to drive: the hero is behind the
      // intro and the tools are hidden.
      if (!isWarm || !revealedRef.current || phase !== 'idle' || tools.length === 0) return;

      const remaining = Math.max(0, holdStart + HOLD_MS - performance.now());
      holdTimer = window.setTimeout(() => {
        if (disposed || phase !== 'idle') return;
        phase = 'out';
        phaseStart = performance.now();
        from = active;
        needsRender = true;
        requestFrame();
      }, remaining);
    };

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      // 0 until the stylesheet lands; ResizeObserver calls back after.
      if (!clientWidth || !clientHeight) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      frame();
      needsRender = true;
      requestFrame();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url, loaded, total) => {
      callbacks.current.onProgress?.(total > 0 ? Math.min(1, loaded / total) : 0);
    };

    // Uploads a resting tool's maps without drawing it. Spreading these out is
    // what keeps the first visible frame of each tool from stalling.
    const warm = (tool: Tool) => {
      tool.materials.forEach((material) => {
        const slots = material as unknown as Record<string, unknown>;
        TEXTURE_SLOTS.forEach((slot) => {
          const value = slots[slot];
          if (value instanceof THREE.Texture) renderer.initTexture(value);
        });
      });
    };

    const warmRest = (index: number) => {
      if (disposed || index >= tools.length) return;
      warmTimer = window.setTimeout(() => {
        if (disposed) return;
        warm(tools[index]);
        warmRest(index + 1);
      }, WARM_GAP_MS);
    };

    new GLTFLoader(manager).load(TOOLS_URL, (gltf) => {
      if (disposed) return;

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

      active = 0;
      from = 0;
      phase = 'idle';
      holdStart = performance.now();
      resize();

      revealRef.current = () => {
        // isEntered can arrive before the shaders finish; the warm-up below
        // calls this again once they are ready.
        if (!isWarm) return;

        const start = performance.now();
        holdStart = start;
        phase = 'in';
        phaseStart = start;
        from = active;
        needsRender = true;
        requestFrame();
      };

      // Warm the lead behind the intro: only its maps, and only one render.
      // A hair above zero so the mesh is drawn (and its textures uploaded) but
      // still invisible, which keeps the later fade from flashing.
      applyOpacity(tools[0], 0.01);

      // compileAsync links in the driver and polls the completion flag, so the
      // program build no longer blocks the intro's counter. Rendering before
      // it resolves would block on exactly the same work.
      void renderer
        .compileAsync(scene, camera)
        .then(() => {
          if (disposed) return;

          isWarm = true;
          renderNow();

          callbacks.current.onProgress?.(1);
          callbacks.current.onReady?.();

          if (revealedRef.current) {
            // Loaded after the intro ended: fade it in now.
            revealRef.current?.();
          } else {
            applyOpacity(tools[0], 0);
          }

          warmRest(1);
        });
    });

    const handlePointerMove = (event: PointerEvent) => {
      const next = (event.clientX / window.innerWidth - 0.5) * 2;
      if (Math.abs(next - pointer.x) < 0.002) return;
      pointer.x = next;
      requestFrame();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      pointer.x = event.key === 'ArrowLeft' ? -1 : 1;
      requestFrame();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopLoop();
        return;
      }

      if (!isVisible) return;
      needsRender = true;
      requestFrame();
      armHold();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Ionic keeps previous pages mounted, so gate the loop.
    const stopWatching = watchVisibility(mount, (visible) => {
      isVisible = visible;

      if (!visible) {
        stopLoop();
        return;
      }

      needsRender = true;
      requestFrame();
      armHold();
    });

    function tick() {
      raf = 0;
      if (disposed || document.hidden || !isVisible) return;

      const now = performance.now();
      let isFading = false;

      if (tools.length > 0) {
        if (phase === 'out') {
          const t = Math.min(1, (now - phaseStart) / FADE_MS);
          paint(from, 1 - ease(t));
          needsRender = true;
          isFading = true;

          if (t >= 1) {
            applyOpacity(tools[from], 0);
            active = (from + 1) % tools.length;
            phase = 'in';
            phaseStart = now;
            frame();
          }
        } else if (phase === 'in') {
          const t = Math.min(1, (now - phaseStart) / FADE_MS);
          paint(active, ease(t));
          needsRender = true;
          isFading = true;

          if (t >= 1) {
            paint(active, 1);
            phase = 'idle';
            holdStart = now;
          }
        }
      }

      // Turn toward the cursor rather than spin. Once the gap is below the
      // settle threshold there is nothing left to draw.
      const yaw = -pointer.x * MAX_TURN;
      const delta = yaw - pivot.rotation.y;
      if (Math.abs(delta) > SETTLE) {
        pivot.rotation.y += delta * 0.12;
        needsRender = true;
      }

      if (needsRender) renderNow();

      if (isFading) {
        requestFrame();
      } else {
        armHold();
      }
    }

    return () => {
      disposed = true;
      stopLoop();
      window.clearTimeout(warmTimer);
      revealRef.current = null;
      observer.disconnect();
      stopWatching();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
      room.dispose();
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
