/**
 * Display names are free-form labels, not account identifiers. They are only
 * trimmed and whitespace-collapsed; the database has no shape constraint.
 */
export const DISPLAY_NAME_MAX_LENGTH = 80;

export const normaliseDisplayName = (input: string): string =>
  input.trim().replace(/\s+/g, ' ');

export type DisplayNameResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export const validateDisplayName = (input: string): DisplayNameResult => {
  const value = normaliseDisplayName(input);

  if (!value) return { ok: false, error: 'Enter a name.' };
  if (value.length > DISPLAY_NAME_MAX_LENGTH) {
    return { ok: false, error: `Use at most ${DISPLAY_NAME_MAX_LENGTH} characters.` };
  }
  return { ok: true, value };
};
