/**
 * Validation for the email and password credential fields.
 *
 * Pure, like username.ts, so the rules can be reasoned about and tested without
 * a form or a network. Deliberately not a password-strength library: the rule is
 * "long enough and not obviously weak", which is what actually keeps an account
 * out of a credential-stuffing list, and a stricter meter pushes people toward
 * writing it on a sticky note.
 */

export type FieldResult = { ok: true; value: string } | { ok: false; error: string };

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Practical maximum: bcrypt (which Supabase uses) truncates input at 72 bytes,
 * so anything beyond that is silently ignored rather than adding strength.
 * Refusing it is honest, where pretending it helps is not.
 */
export const MAX_PASSWORD_LENGTH = 72;

/**
 * Deliberately permissive. The only reliable email check is sending a code to
 * it, which the verification step already does. Over-strict patterns reject
 * valid addresses far more often than they catch typos.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normaliseEmail = (input: string): string => input.trim().toLowerCase();

export const validateEmail = (input: string): FieldResult => {
  const value = normaliseEmail(input);

  if (!value) return { ok: false, error: 'Enter your email address.' };
  if (!EMAIL_PATTERN.test(value)) {
    return { ok: false, error: 'That does not look like an email address.' };
  }
  return { ok: true, value };
};

/** The subset of the character set worth rejecting outright. */
const FORBIDDEN_WHITESPACE = /\s/;

export const validatePassword = (input: string): FieldResult => {
  if (!input) return { ok: false, error: 'Choose a password.' };
  if (input.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (input.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, error: `Use at most ${MAX_PASSWORD_LENGTH} characters.` };
  }
  if (FORBIDDEN_WHITESPACE.test(input)) {
    return { ok: false, error: 'Use a password without spaces.' };
  }
  return { ok: true, value: input };
};

export const validateConfirmation = (password: string, confirmation: string): FieldResult => {
  if (!confirmation) return { ok: false, error: 'Type your password again.' };
  // Compared by value, not by reference, and never reported back.
  if (password !== confirmation) {
    return { ok: false, error: 'Those passwords do not match.' };
  }
  return { ok: true, value: confirmation };
};

/** Codes are digits only in the delivered email. */
export const normaliseCode = (input: string): string => input.replace(/\D/g, '');

export const CODE_LENGTH = 6;

export const validateCode = (input: string): FieldResult => {
  const value = normaliseCode(input);

  if (!value) return { ok: false, error: 'Enter the code from your email.' };
  if (value.length !== CODE_LENGTH) {
    return { ok: false, error: `The code is ${CODE_LENGTH} digits.` };
  }
  return { ok: true, value };
};

export interface RegistrationInput {
  email: string;
  username: string;
  password: string;
  confirmation: string;
}

export interface RegistrationErrors {
  email?: string;
  username?: string;
  password?: string;
  confirmation?: string;
}

/**
 * Validates the whole form at once.
 *
 * All fields are reported together rather than stopping at the first failure:
 * finding out about one error, fixing it, and being told about the next is a
 * worse loop than seeing everything on submit.
 */
export const validateRegistration = (
  input: RegistrationInput,
  validateUsername: (value: string) => { ok: true; value: string } | { ok: false; error: string },
): { ok: true; email: string; username: string; password: string } | { ok: false; errors: RegistrationErrors } => {
  const errors: RegistrationErrors = {};

  const email = validateEmail(input.email);
  if (!email.ok) errors.email = email.error;

  const username = validateUsername(input.username);
  if (!username.ok) errors.username = username.error;

  const password = validatePassword(input.password);
  if (!password.ok) errors.password = password.error;

  const confirmation = validateConfirmation(input.password, input.confirmation);
  if (!confirmation.ok) errors.confirmation = confirmation.error;

  if (Object.keys(errors).length > 0 || !email.ok || !username.ok || !password.ok) {
    return { ok: false, errors };
  }

  return { ok: true, email: email.value, username: username.value, password: password.value };
};