/**
 * Where MediaPipe's WASM runtime and model are fetched from.
 *
 * Pinned to the exact installed version. jsdelivr resolves a bare version tag
 * at request time, so leaving it unpinned means a patch release can change the
 * runtime under a deployed app with no code change.
 */
export const MEDIAPIPE_VERSION = '1.1.0';

export const MEDIAPIPE_WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;

export const MEDIAPIPE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

/** Below this the reading is too close to call. Matches classify.ts. */
export const MIN_CONFIDENCE = 60;

/** Yaw beyond this, in radians, distorts the widths enough to reject. ~20deg. */
export const MAX_YAW = 0.35;

/** jawOpen blendshape above this counts as a grin rather than a neutral face. */
export const MAX_JAW_OPEN = 0.35;

/** Detection is throttled to this, because detectForVideo blocks the main thread. */
export const DETECT_INTERVAL_MS = 90;

/** Consecutive good samples before the reading resolves on its own. */
export const RESOLVE_AFTER = 24;

/** Consecutive bad frames before the guidance is dropped, to stop it flickering. */
export const GUIDANCE_HYSTERESIS = 8;