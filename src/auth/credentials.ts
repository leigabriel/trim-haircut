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
 * Deliberately permissive. The only reliable email check is actually delivering
 * to it, which this app no longer does on signup. Over-strict patterns reject
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

export interface RegistrationInput {
  email: string;
  password: string;
  confirmation: string;
}

export interface RegistrationErrors {
  email?: string;
  password?: string;
  confirmation?: string;
}

/**
 * Validates the whole form at once.
 *
 * All fields are reported together rather than stopping at the first failure:
 * finding out about one error, fixing it, and being told about the next is a
 * worse loop than seeing everything on submit.
 *
 * No username here: it is asked for on the Welcome page, once the account
 * exists. Collecting it twice meant the Welcome prompt never appeared for email
 * signups, because the profile already had a name by then.
 */
export const validateRegistration = (
  input: RegistrationInput,
): { ok: true; email: string; password: string } | { ok: false; errors: RegistrationErrors } => {
  const errors: RegistrationErrors = {};

  const email = validateEmail(input.email);
  if (!email.ok) errors.email = email.error;

  const password = validatePassword(input.password);
  if (!password.ok) errors.password = password.error;

  const confirmation = validateConfirmation(input.password, input.confirmation);
  if (!confirmation.ok) errors.confirmation = confirmation.error;

  if (Object.keys(errors).length > 0 || !email.ok || !password.ok) {
    return { ok: false, errors };
  }

  return { ok: true, email: email.value, password: password.value };
};