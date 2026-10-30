import { useCallback, useEffect, useRef, useState } from 'react';

import { MEDIAPIPE_MODEL_URL, MEDIAPIPE_WASM_URL } from '../face/config';
import { FACE_OVAL } from '../face/landmarks';
import type { LandmarkPoint } from '../face/landmarks';
import type { HairGeometry } from './hairGeometry';
import { paintHair, FALLBACK_HAIR } from './hairPaint';
import type { Layer, Point2, Rgb } from './hairPaint';
import { HeadFitter } from './headFit';
import type { HeadFit } from './headFit';
import { FrameSmoother, estimateFrame, estimateZSign, workingPoint } from './headPose';
import { getHaircut } from './haircuts';
import type { HaircutId } from './haircuts';

/**
 * The camera, the face tracker and the per-frame hair painter.
 *
 * Same rule as useFaceScanner: every device resource is owned here, so teardown
 * has one home. Tracks stopped, landmarker closed, loop cancelled, on unmount
 * and on stop. Miss one and the camera light stays on after the customer leaves.
 */

export type FilterStatus = 'idle' | 'loading' | 'requesting-camera' | 'live' | 'error';

export interface FilterState {
  status: FilterStatus;
  error: string | null;
  /** What to tell the customer, or null when the face is tracked and fitted. */
  guidance: string | null;
}

const IDLE: FilterState = { status: 'idle', error: null, guidance: null };

type Landmarker = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => { faceLandmarks?: LandmarkPoint[][] };
  close: () => void;
};

/** Frames with no face before the fit is thrown away and taken again. */
const LOST_FRAMES = 45;
/** How frontal the head must be while the fit is taken. */
const FIT_MAX_YAW = 0.22;
const FIT_MAX_PITCH = 0.28;
/** Votes needed before the landmark z direction is trusted. */
const Z_VOTES = 6;

const describeError = (cause: unknown): string => {
  const name = (cause as { name?: string })?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access was blocked. Allow it in your browser settings and try again.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera found on this device.';
    case 'NotReadableError':
    case 'AbortError':
      return 'The camera is already in use by another app. Close it and try again.';
    default:
      return cause instanceof Error
        ? cause.message
        : 'The camera filter could not start. Try again in a moment.';
  }
};

const makeLayer = (width: number, height: number): Layer => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the filter.');
  return { canvas, ctx };
};

export interface HairFilter extends FilterState {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  start: () => Promise<void>;
  stop: () => void;
  /** Saves the current frame, filter included, as a PNG. Null when nothing is live. */
  capture: () => Promise<Blob | null>;
}

export const useHairFilter = (haircutId: HaircutId, color: Rgb = FALLBACK_HAIR): HairFilter => {
  const [state, setState] = useState<FilterState>(IDLE);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<Landmarker | null>(null);
  const rafRef = useRef<number | null>(null);

  // The frame loop is built once; these carry what changes under it.
  const haircutRef = useRef(haircutId);
  const colorRef = useRef(color);
  const fitRef = useRef<HeadFit | null>(null);
  const geometryRef = useRef<{ id: HaircutId; geometry: HairGeometry } | null>(null);
  const guidanceRef = useRef<string | null>(null);

  haircutRef.current = haircutId;
  colorRef.current = color;

  const setGuidance = useCallback((guidance: string | null) => {
    if (guidanceRef.current === guidance) return;
    guidanceRef.current = guidance;
    setState((previous) => ({ ...previous, guidance }));
  }, []);

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

    fitRef.current = null;
    geometryRef.current = null;
    guidanceRef.current = null;
  }, []);

  const stop = useCallback(() => {
    release();
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setState(IDLE);
  }, [release]);

  const run = useCallback(
    (width: number, height: number) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const out = canvas?.getContext('2d');
      if (!canvas || !video || !out) return;

      canvas.width = width;
      canvas.height = height;
      const layer = makeLayer(width, height);

      const smoother = new FrameSmoother();
      const fitter = new HeadFitter();
      let zSign: 1 | -1 = 1;
      let zVotes = 0;
      let zTally = 0;
      let zLocked = false;
      let lost = 0;
      let lastVideoTime = -1;
      let lastLandmarks: LandmarkPoint[] | null = null;

      const step = (timestamp: number) => {
        rafRef.current = requestAnimationFrame(step);

        const landmarker = landmarkerRef.current;
        if (!landmarker || video.readyState < 2) return;

        // The video draws every frame, but the tracker only runs on a new
        // video frame: detecting twice on the same image is wasted work.
        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          try {
            lastLandmarks = landmarker.detectForVideo(video, timestamp).faceLandmarks?.[0] ?? null;
          } catch (cause) {
            release();
            setState({
              status: 'error',
              error: cause instanceof Error ? cause.message : 'Face tracking failed.',
              guidance: null,
            });
            return;
          }
        }

        // The preview is mirrored like a selfie. The tracker works on the
        // unmirrored image, so the hair is painted unmirrored and flipped with
        // the video, which keeps the two registered.
        out.setTransform(-1, 0, 0, 1, width, 0);
        out.drawImage(video, 0, 0, width, height);
        out.setTransform(1, 0, 0, 1, 0, 0);

        const landmarks = lastLandmarks;
        if (!landmarks) {
          lost += 1;
          if (lost > LOST_FRAMES) {
            // Gone long enough that the next face may be someone else.
            fitter.reset();
            smoother.reset();
            fitRef.current = null;
            geometryRef.current = null;
            lost = LOST_FRAMES;
          }
          setGuidance('Move into frame so your face is visible');
          return;
        }
        lost = 0;

        if (!zLocked) {
          const vote = estimateZSign(landmarks, width, height);
          if (vote !== 0) {
            zTally += vote;
            zVotes += 1;
            zSign = zTally >= 0 ? 1 : -1;
            if (zVotes >= Z_VOTES) zLocked = true;
          }
        }

        const raw = estimateFrame(landmarks, width, height, zSign);
        if (!raw) return;
        const frame = smoother.update(raw, timestamp);

        if (!fitRef.current) {
          const frontal = Math.abs(frame.ez.x) < FIT_MAX_YAW && Math.abs(frame.ez.y) < FIT_MAX_PITCH;
          if (!frontal) {
            setGuidance('Look straight at the camera for a moment');
            return;
          }
          fitter.add(frame, landmarks, width, height, zSign);
          setGuidance('Hold still, fitting the cut to your head');
          if (fitter.isReady) fitRef.current = fitter.result();
          return;
        }

        setGuidance(null);

        const cached = geometryRef.current;
        if (!cached || cached.id !== haircutRef.current) {
          geometryRef.current = {
            id: haircutRef.current,
            geometry: getHaircut(haircutRef.current).build(fitRef.current),
          };
        }

        const face: Point2[] = [];
        for (const index of FACE_OVAL) {
          const point = workingPoint(landmarks, index, width, height, 1);
          if (point) face.push({ x: point.x, y: point.y });
        }

        // Painted into a mirrored context so it lands on the flipped video.
        out.setTransform(-1, 0, 0, 1, width, 0);
        paintHair(out, layer, geometryRef.current!.geometry, frame, colorRef.current, face);
        out.setTransform(1, 0, 0, 1, 0, 0);
      };

      rafRef.current = requestAnimationFrame(step);
    },
    [release, setGuidance],
  );

  const start = useCallback(async () => {
    release();
    setState({ ...IDLE, status: 'loading' });

    let landmarker: Landmarker;
    try {
      // Dynamic import: the runtime is a separate chunk, fetched only when
      // someone opens the camera.
      const vision = await import('@mediapipe/tasks-vision');
      const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
      landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MEDIAPIPE_MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
    } catch (cause) {
      setState({
        status: 'error',
        error: `Could not load the face tracker. Check your connection and try again.${
          cause instanceof Error ? ` (${cause.message})` : ''
        }`,
        guidance: null,
      });
      return;
    }

    landmarkerRef.current = landmarker;
    setState({ ...IDLE, status: 'requesting-camera' });

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch (cause) {
      release();
      setState({ status: 'error', error: describeError(cause), guidance: null });
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) {
      release();
      setState({ status: 'error', error: 'The camera view could not be mounted.', guidance: null });
      return;
    }

    try {
      video.srcObject = stream;
      await video.play();
    } catch (cause) {
      release();
      setState({ status: 'error', error: describeError(cause), guidance: null });
      return;
    }

    setState({ status: 'live', error: null, guidance: null });
    run(video.videoWidth || 1280, video.videoHeight || 720);
  }, [release, run]);

  const capture = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        const canvas = canvasRef.current;
        if (!canvas || !canvas.width) {
          resolve(null);
          return;
        }
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      }),
    [],
  );

  useEffect(() => release, [release]);

  return { ...state, videoRef, canvasRef, start, stop, capture };
};

export type { Rgb };
