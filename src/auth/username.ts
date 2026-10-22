/**
 * Usernames are letters only.
 *
 * Digits and underscores were allowed originally, but every real name typed
 * into the form was a run of letters, so the extra characters only ever showed
 * up as a rejected paste. Keeping the rule to a-z makes the allowed shape
 * obvious from the field itself and matches the site's lowercase identity.
 *
 * 3 characters is the floor because shorter names collide almost immediately.
 */
export const USERNAME_PATTERN = /^[a-z]{3,24}$/;

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 24;

export const normaliseUsername = (input: string): string => input.trim().toLowerCase();

/**
 * What the field shows while typing: everything the pattern would reject is
 * dropped as it is typed, so the input can never hold a value `validateUsername`
 * refuses. Pasting "Lei_MX" therefore lands as "leimx" rather than an error.
 */
export const toUsernameInput = (input: string): string =>
  normaliseUsername(input).replace(/[^a-z]/g, '').slice(0, USERNAME_MAX_LENGTH);

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
    return { ok: false, error: 'Use lowercase letters only.' };
  }
  return { ok: true, value };
};
