import { supabase } from '../../../lib/supabase';
import type { FaceMeasurements } from './landmarks';
import { isFaceShapeName } from './shapes';
import type { FaceShapeName } from './shapes';

/**
 * Read and write for the customer's own face reading.
 *
 * The client talks to the table directly under RLS, the same way chat does. No
 * edge function is involved, so there is no service-role path here and no way
 * for one customer's reading to be read through another's session.
 */

export type FaceProfileSource = 'manual' | 'scanned';

export interface FaceProfile {
  shape: FaceShapeName;
  source: FaceProfileSource;
  /** Null when the customer set the shape themselves. */
  confidence: number | null;
  measurements: FaceMeasurements | null;
  measured_at: string;
}

interface FaceProfileRow {
  shape: string;
  source: string;
  confidence: number | null;
  forehead_ratio: number | null;
  jaw_ratio: number | null;
  length_ratio: number | null;
  measured_at: string;
}

const COLUMNS =
  'shape, source, confidence, forehead_ratio, jaw_ratio, length_ratio, measured_at';

const toProfile = (row: FaceProfileRow): FaceProfile | null => {
  // A shape or source this build does not recognise is dropped rather than
  // passed on, so a row written by a newer client cannot render an unknown
  // label here.
  if (!isFaceShapeName(row.shape)) return null;
  if (row.source !== 'manual' && row.source !== 'scanned') return null;

  const hasMeasurements =
    row.forehead_ratio !== null &&
    row.jaw_ratio !== null &&
    row.length_ratio !== null;

  return {
    shape: row.shape,
    source: row.source,
    confidence: row.confidence,
    measurements: hasMeasurements
      ? {
          foreheadRatio: row.forehead_ratio as number,
          jawRatio: row.jaw_ratio as number,
          lengthRatio: row.length_ratio as number,
        }
      : null,
    measured_at: row.measured_at,
  };
};

/** The saved reading, or null when the customer has not set one. */
export const loadFaceProfile = async (): Promise<FaceProfile | null> => {
  const { data, error } = await supabase
    .from('face_profiles')
    .select(COLUMNS)
    .maybeSingle();

  // A missing row is a normal state, not a failure. Anything else is real.
  if (error) throw new Error(error.message);
  if (!data) return null;

  return toProfile(data as FaceProfileRow);
};

const upsert = async (
  values: Omit<FaceProfileRow, 'measured_at'>,
): Promise<FaceProfile> => {
  // Taken from the session rather than passed in, so a caller cannot attempt
  // a write against another customer's row even with RLS misconfigured.
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) throw new Error('Not signed in.');

  const { data: saved, error } = await supabase
    .from('face_profiles')
    .upsert(
      { user_id: data.user.id, ...values, measured_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    .select(COLUMNS)
    .single();

  if (error) throw new Error(error.message);

  const profile = toProfile(saved as FaceProfileRow);
  if (!profile) throw new Error('Saved an unreadable face shape.');
  return profile;
};

/**
 * The customer picked their own shape. Confidence and measurements go as null,
 * which the table constraint enforces too, so a UI bug cannot quietly attach
 * numbers to a shape nobody measured.
 */
export const saveManualShape = (shape: FaceShapeName): Promise<FaceProfile> =>
  upsert({
    shape,
    source: 'manual',
    confidence: null,
    forehead_ratio: null,
    jaw_ratio: null,
    length_ratio: null,
  });

export const saveScannedShape = (
  shape: FaceShapeName,
  confidence: number,
  measurements: FaceMeasurements,
): Promise<FaceProfile> =>
  upsert({
    shape,
    source: 'scanned',
    confidence,
    forehead_ratio: measurements.foreheadRatio,
    jaw_ratio: measurements.jawRatio,
    length_ratio: measurements.lengthRatio,
  });