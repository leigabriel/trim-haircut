import type { Session } from '@supabase/supabase-js';

import type { UserRole } from './roles';

export interface Profile {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
}

/** Row shape from the profiles table. */
export interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  /** Absent until migration 0008 has run. */
  role?: string | null;
}

export interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  /** True until the session read finishes. */
  isLoading: boolean;
  /**
   * True while the profiles row is being fetched. Separate from isLoading
   * because a null profile is ambiguous until the query has settled: it means
   * either "no row yet" or "still loading", and only one of those is a reason
   * to send a returning customer back through the username form.
   */
  isProfileLoading: boolean;

  /**
   * True only once the profile query for the current session has settled,
   * including when it settled with no row. This is what the auth guards check:
   * isProfileLoading starts false, so on the render immediately after a sign-in
   * it still looks like "no profile" and used to bounce a returning account to
   * /welcome before the query had even started.
   */
  isProfileReady: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  saveUsername: (input: string) => Promise<{ ok: boolean; error?: string }>;

  /**
   * Stores one of the avatars from /assets/avatar on the caller's own profile.
   * Only those known paths are accepted, so the column cannot be pointed at an
   * arbitrary URL through this method.
   */
  saveAvatar: (avatarUrl: string) => Promise<{ ok: boolean; error?: string }>;

  /**
   * Creates an account and signs the customer straight in.
   *
   * The account is created with no username: the Welcome page collects it
   * afterwards, so a half-filled signup form cannot block registration.
   *
   * There is no confirmation step, so the project must have "Confirm email"
   * switched off. That setting is what makes Supabase return a live session
   * from signUp instead of emailing a code.
   */
  register: (input: {
    email: string;
    password: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;

  signInWithPassword: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;

  /**
   * Whether a username is free.
   *
   * `null` means the check could not run — the RPC may not be deployed yet, or
   * the network failed. Callers treat that as "unknown, let the database decide
   * on save" rather than claiming the name is free.
   */
  isUsernameAvailable: (username: string) => Promise<boolean | null>;
}
