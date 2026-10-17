export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

export const normaliseUsername = (input: string): string => input.trim().toLowerCase();

export type UsernameResult = { ok: true; value: string } | { ok: false; error: string };

export const validateUsername = (input: string): UsernameResult => {
  const value = normaliseUsername(input);

  if (!value) return { ok: false, error: 'Enter a username.' };
  if (value.length < 3) return { ok: false, error: 'Use at least 3 characters.' };
  if (value.length > 24) return { ok: false, error: 'Use at most 24 characters.' };
  if (!USERNAME_PATTERN.test(value)) {
    return { ok: false, error: 'Use lowercase letters, numbers and underscores only.' };
  }
  return { ok: true, value };
};