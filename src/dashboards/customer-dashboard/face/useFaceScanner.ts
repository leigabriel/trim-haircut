import { useCallback, useEffect, useRef, useState } from 'react';

import { classifyFace } from './classify';
import type { Classification } from './classify';
import {
  DETECT_INTERVAL_MS,
  GUIDANCE_HYSTERESIS,
  MAX_JAW_OPEN,
  MAX_YAW,
} from './config';
import type { FaceMeasurements, LandmarkPoint } from './landmarks';
import { FACE_OVAL, MeasurementAverager, measureFace } from './landmarks';
import { scanProgress, shouldResolve } from './scan';
import { MEDIAPIPE_MODEL_URL, MEDIAPIPE_WASM_URL } from './config';

/**
 * The camera and the model, and nothing else.
 *
 * Owns every device resource the feature touches so that teardown has exactly
 * one home. Everything is released on unmount and whenever the customer stops
 * scanning: tracks stopped, the landmarker closed, the loop cancelled. Miss one
 * and the camera light stays on after the customer navigates away, which is the
 * failure mode that makes a browser camera feature untrustworthy.
 */

export type ScannerStatus =
  | 'idle'
  | 'loading'
  | 'requesting-camera'
  | 'scanning'
  | 'sampling'
  | 'resolved'
  | 'error';

export interface FaceScanResult {
  classification: Classification;
  measurements: FaceMeasurements;
  /** The captured frame, for the overlay. Cleared on restart. */
  preview: string | null;
}

export interface ScannerState {
  status: ScannerStatus;
  error: string | null;
  /** Live landmark outline for the canvas overlay. */
  overlay: LandmarkPoint[] | null;
  /** What to tell the customer to do, or null when the frame is usable. */
  guidance: string | null;
  /** Running measurement, shown live while sampling. */
  measurements: FaceMeasurements | null;
  result: FaceScanResult | null;
  /** 0-1 through the sampling window. */
  progress: number;
}

const IDLE: ScannerState = {
  status: 'idle',
  error: null,
  overlay: null,
  guidance: null,
  measurements: null,
  result: null,
  progress: 0,
};

type FaceLandmarkerInstance = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => {
    faceLandmarks?: LandmarkPoint[][];
    facialTransformationMatrixes?: { data: Float32Array | number[] }[];
    faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[];
  };
  close: () => void;
};

/**
 * Yaw from the facial transformation matrix, in radians.
 *
 * The matrix is row-major and column 3 carries the translation, so the yaw is
 * read from element 2. Absolute value because turning either way is equally
 * bad for a width measurement.
 */
const readYaw = (matrix: { data: Float32Array | number[] } | undefined): number => {
  if (!matrix) return 0;
  const { data } = matrix;
  if (!data || data.length < 9) return 0;
  return Math.abs(data[2]);
};

const readBlendshape = (
  result: { faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[] },
  name: string,
): number => {
  const shapes = result.faceBlendshapes?.[0]?.categories;
  return shapes?.find((entry) => entry.categoryName === name)?.score ?? 0;
};

const describeError = (cause: unknown): string => {
  const name = (cause as { name?: string })?.name ?? '';

  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access was blocked. Allow it in your browser settings, or upload a photo instead.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera found on this device. You can upload a photo instead.';
    case 'NotReadableError':
    case 'AbortError':
      return 'The camera is already in use by another app. Close it and try again.';
    default:
      return cause instanceof Error
        ? cause.message
        : 'The analyzer could not start. Try again in a moment.';
  }
};

export interface UseFaceScannerOptions {
  /** Fired once a scan resolves, before the customer has chosen to keep it. */
  onResolved?: (result: FaceScanResult) => void;
}

export interface FaceScanner extends ScannerState {
  /** Attach to the <video> that shows the preview. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  start: () => Promise<void>;
  stop: () => void;
  /** Analyse a still image instead of a live feed. */
  analyseImage: (file: File) => Promise<void>;
  /** Discard everything and start over. */
  restart: () => void;
}

export const useFaceScanner = (options: UseFaceScannerOptions = {}): FaceScanner => {
  const [state, setState] = useState<ScannerState>(IDLE);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarkerInstance | null>(null);
  const rafRef = useRef<number | null>(null);
  const averagerRef = useRef(new MeasurementAverager());
  const lastDetectRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const badFramesRef = useRef(0);
  const goodFramesRef = useRef(0);
  const resolvedRef = useRef(false);
  // Mirrored because the frame loop is created once and kept running. Reading
  // guidance from state would close over the value from whenever the loop was
  // built, so the first rejection would never clear.
  const guidanceRef = useRef<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const setGuidance = useCallback((guidance: string | null) => {
    if (guidanceRef.current === guidance) return;
    guidanceRef.current = guidance;
    setState((previous) => ({ ...previous, guidance }));
  }, []);

  /** Releases every device resource. Safe to call repeatedly. */
  const release = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    landmarkerRef.current?.close();
    landmarkerRef.current = null;

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }, []);

  const resetSampling = useCallback(() => {
    averagerRef.current.reset();
    lastVideoTimeRef.current = -1;
    badFramesRef.current = 0;
    goodFramesRef.current = 0;
    resolvedRef.current = false;
    guidanceRef.current = null;
  }, []);

  const finish = useCallback(
    (classification: Classification, measurements: FaceMeasurements, preview: string | null) => {
      const result: FaceScanResult = { classification, measurements, preview };

      setState((previous) => ({
        ...previous,
        status: 'resolved',
        guidance: null,
        progress: 1,
        result,
      }));

      optionsRef.current.onResolved?.(result);
    },
    [],
  );

  const stop = useCallback(() => {
    release();
    resetSampling();
    setState((previous) => ({ ...previous, status: 'idle', guidance: null }));
  }, [release, resetSampling]);

  const restart = useCallback(() => {
    release();
    resetSampling();
    setState(IDLE);
  }, [release, resetSampling]);

  /**
   * Feeds one detection into the pipeline. Shared by the live loop and the
   * still-image path so a photo cannot drift from the live behaviour.
   */
  const consume = useCallback(
    (
      landmarks: LandmarkPoint[],
      yaw: number,
      jawOpen: number,
      aspect: number,
      preview: string | null,
    ) => {
      const measurements = measureFace(landmarks, aspect);
      if (!measurements) return;

      if (yaw > MAX_YAW || jawOpen > MAX_JAW_OPEN) {
        badFramesRef.current += 1;
        goodFramesRef.current = 0;

        // Hysteresis, so guidance does not flicker on a single noisy frame.
        if (badFramesRef.current >= GUIDANCE_HYSTERESIS) {
          const guidance =
            yaw > MAX_YAW ? 'Turn to face the camera' : 'Relax your jaw, keep a neutral face';
          setState((previous) => ({ ...previous, status: 'scanning', measurements: null }));
          setGuidance(guidance);
        }
        return;
      }

      badFramesRef.current = 0;
      setGuidance(null);

      const averaged = averagerRef.current.add(measurements);
      goodFramesRef.current += 1;

      setState((previous) => ({
        ...previous,
        status: 'sampling',
        overlay: landmarks,
        measurements: averaged,
        progress: scanProgress(goodFramesRef.current),
      }));

      // Reads the same counter as the progress bar. It used to read the
      // averager's retained sample count, which saturates at its window, so the
      // bar filled to 100% and the scan never resolved.
      if (shouldResolve(goodFramesRef.current) && !resolvedRef.current) {
        resolvedRef.current = true;
        finish(classifyFace(averaged), averaged, preview);
      }
    },
    [finish, setGuidance],
  );

  const runLoop = useCallback(
    (aspect: number) => {
      const step = (timestamp: number) => {
        rafRef.current = requestAnimationFrame(step);

        const landmarker = landmarkerRef.current;
        const video = videoRef.current;
        if (!landmarker || !video || video.readyState < 2) return;

        // Throttled: detectForVideo blocks the main thread, and running it on
        // every animation frame makes the page stutter for no extra accuracy.
        if (timestamp - lastDetectRef.current < DETECT_INTERVAL_MS) return;
        if (video.currentTime === lastVideoTimeRef.current) return;

        lastDetectRef.current = timestamp;
        lastVideoTimeRef.current = video.currentTime;

        try {
          const result = landmarker.detectForVideo(video, timestamp);
          const landmarks = result.faceLandmarks?.[0];
          if (!landmarks) return;

          consume(
            landmarks,
            readYaw(result.facialTransformationMatrixes?.[0]),
            readBlendshape(result, 'jawOpen'),
            aspect,
            null,
          );
        } catch (cause) {
          setState((previous) => ({
            ...previous,
            status: 'error',
            error: cause instanceof Error ? cause.message : 'Detection failed.',
          }));
          release();
        }
      };

      rafRef.current = requestAnimationFrame(step);
    },
    [consume, release],
  );

  const start = useCallback(async () => {
    release();
    resetSampling();
    setState({ ...IDLE, status: 'loading' });

    let landmarker: FaceLandmarkerInstance;
    try {
      // Dynamic import so the ~12MB runtime is a separate chunk, fetched only
      // when someone actually opens the analyzer.
      const vision = await import('@mediapipe/tasks-vision');
      const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
      landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MEDIAPIPE_MODEL_URL },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
    } catch (cause) {
      setState({
        ...IDLE,
        status: 'error',
        // A failed CDN fetch is almost always the network, not the code, so
        // the cause is logged rather than surfaced verbatim to the customer.
        error: `Could not load the analyzer. Check your connection and try again.${
          cause instanceof Error ? ` (${cause.message})` : ''
        }`,
      });
      return;
    }

    landmarkerRef.current = landmarker;
    setState((previous) => ({ ...previous, status: 'requesting-camera' }));

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch (cause) {
      release();
      setState({ ...IDLE, status: 'error', error: describeError(cause) });
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) {
      release();
      setState({ ...IDLE, status: 'error', error: 'The camera view could not be mounted.' });
      return;
    }

    video.srcObject = stream;
    await video.play();

    const aspect = video.videoHeight / video.videoWidth || 1;
    setState((previous) => ({ ...previous, status: 'scanning' }));
    runLoop(aspect);
  }, [release, resetSampling, runLoop]);

  const analyseImage = useCallback(
    async (file: File) => {
      release();
      resetSampling();
      setState({ ...IDLE, status: 'loading' });

      try {
        const vision = await import('@mediapipe/tasks-vision');
        const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
        const imageLandmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MEDIAPIPE_MODEL_URL },
          runningMode: 'IMAGE',
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });

        const bitmap = await createImageBitmap(file);
        const aspect = bitmap.height / bitmap.width;

        const result = imageLandmarker.detect(bitmap);
        imageLandmarker.close();

        const landmarks = result.faceLandmarks?.[0];
        if (!landmarks) {
          setState({
            ...IDLE,
            status: 'error',
            error: 'No face found in that photo. Try one taken straight on, in even light.',
          });
          return;
        }

        consume(
          landmarks,
          readYaw(result.facialTransformationMatrixes?.[0]),
          readBlendshape(result, 'jawOpen'),
          aspect,
          URL.createObjectURL(file),
        );
      } catch (cause) {
        setState({
          ...IDLE,
          status: 'error',
          error: cause instanceof Error ? cause.message : 'That photo could not be read.',
        });
      }
    },
    [consume, release, resetSampling],
  );

  // Unmount is the guarantee that the camera is released, including when the
  // customer leaves the section rather than pressing stop.
  useEffect(() => release, [release]);

  return { ...state, videoRef, start, stop, restart, analyseImage };
};

/** Draws the face oval, for the canvas overlay. Pure so it can be reasoned about. */
export const drawOverlay = (
  context: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  width: number,
  height: number,
): void => {
  context.clearRect(0, 0, width, height);
  if (landmarks.length === 0) return;

  context.beginPath();
  for (let i = 0; i < FACE_OVAL.length; i += 1) {
    const point = landmarks[FACE_OVAL[i]];
    if (!point) continue;

    const x = point.x * width;
    const y = point.y * height;
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  context.stroke();
};