import { useCallback, useEffect, useState } from 'react';

import { loadFaceProfile, saveManualShape, saveScannedShape } from './api';
import type { FaceProfile } from './api';
import type { Classification } from './classify';
import type { FaceMeasurements } from './landmarks';
import type { FaceShapeName } from './shapes';

export interface FaceProfileState {
  /** Null until the first read settles, so UI can tell "loading" from "unset". */
  profile: FaceProfile | null;
  isLoading: boolean;
  error: string | null;
  isSaving: boolean;
  shape: FaceShapeName | null;
  setShape: (shape: FaceShapeName) => Promise<boolean>;
  saveScan: (classification: Classification, measurements: FaceMeasurements) => Promise<boolean>;
  reload: () => Promise<void>;
}

/**
 * The customer's face shape, shared.
 *
 * Held by CustomerDashboard and passed down rather than fetched per section, so
 * a scan that lands in FaceShape is already reflected in Profile and
 * Recommendation when the customer clicks through to them. Three sections
 * reading independently is how a just-saved shape shows up as "not set" on the
 * next screen.
 */
export const useFaceProfile = (): FaceProfileState => {
  const [profile, setProfile] = useState<FaceProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setProfile(await loadFaceProfile());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your face shape.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * A failed save keeps the last good profile rather than clearing it, so a
   * transient network failure does not make the shape appear to vanish.
   */
  const runSave = useCallback(async (work: () => Promise<FaceProfile>) => {
    setIsSaving(true);
    setError(null);

    try {
      setProfile(await work());
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not save your face shape.',
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const setShape = useCallback(
    (shape: FaceShapeName) => runSave(() => saveManualShape(shape)),
    [runSave],
  );

  const saveScan = useCallback(
    (classification: Classification, measurements: FaceMeasurements) =>
      runSave(() => saveScannedShape(classification.shape, classification.confidence, measurements)),
    [runSave],
  );

  return {
    profile,
    isLoading,
    error,
    isSaving,
    shape: profile?.shape ?? null,
    setShape,
    saveScan,
    reload,
  };
};