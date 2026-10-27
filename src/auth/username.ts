/**
 * Usernames are lowercase letters, digits and underscores.
 *
 * This mirrors the profiles.username check constraint exactly. Drifting from it
 * caused two bugs: a stricter client stripped digits and underscores before the
 * availability check, so "leigabriel2005" was checked (and saved) as
 * "leigabriel", and a broader client would only fail at save time.
 *
 * 3 characters is the floor because shorter names collide almost immediately.
 */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 24;

export const normaliseUsername = (input: string): string => input.trim().toLowerCase();

/**
 * What the field shows while typing: characters the pattern would reject are
 * dropped as they are typed, so the input can never hold a value
 * `validateUsername` refuses. A pasted "Lei_Gabriel2005" therefore lands as
 * "lei_gabriel2005" rather than an error.
 */
export const toUsernameInput = (input: string): string =>
  normaliseUsername(input)
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, USERNAME_MAX_LENGTH);

export type UsernameResult = { ok: true; value: string } | { ok: false; error: string };

export const validateUsername = (input: string): UsernameResult => {
  const value = normaliseUsername(input);

  if (!value) return { ok: false, error: 'Enter a username.' };
  if (value.length < USERNAME_MIN_LENGTH) {
    return { ok: false, error: `Use at least ${USERNAME_MIN_LENGTH} characters.` };
  }
  if (value.length > USERNAME_MAX_LENGTH) {
    return { ok: false, error: `Use at most ${USERNAME_MAX_LENGTH} characters.` };
  }
  if (!USERNAME_PATTERN.test(value)) {
    return { ok: false, error: 'Use lowercase letters, numbers and underscores only.' };
  }
  return { ok: true, value };
};
