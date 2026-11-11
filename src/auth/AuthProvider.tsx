import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';

import { supabase } from '../lib/supabase';
import { avatarOption } from './avatars';
import { normaliseEmail } from './credentials';
import { validateDisplayName } from './displayName';
import { isUserRole } from './roles';
import { validateUsername } from './username';
import type { AuthContextValue, Profile, ProfileRow } from './types';

const PROFILE_COLUMNS =
  'id, username, display_name, avatar_url, role, is_available';

// Before migration 0008 the role column does not exist, and before 0012 the
// availability column does not. Selecting a missing column fails the whole
// row, which the guard would read as "no profile", so each older shape has a
// fallback that keeps existing accounts working until the migration is applied.
const ROLE_PROFILE_COLUMNS = 'id, username, display_name, avatar_url, role';
const LEGACY_PROFILE_COLUMNS = 'id, username, display_name, avatar_url';

export const mapProfile = (row: ProfileRow | null): Profile | null =>
  row
    ? {
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        role: isUserRole(row.role) ? row.role : 'customer',
        isAvailable: row.is_available !== false,
      }
    : null;

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  // The user id whose profile query has finished. Kept separate from the
  // profile object because a missing row is a settled answer too.
  const [profileResolvedFor, setProfileResolvedFor] = useState<string | null>(null);
  const navigate = useNavigate();

  // One subscription for the whole app.
  useEffect(() => {
    let active = true;

    supabase.auth.getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setIsLoading(false);
      })
      .catch(() => {
        // A rejected getSession used to leave isLoading true forever, which the
        // guard renders as its full-screen loading shell. Treat it as a normal
        // signed-out start instead.
        if (!active) return;
        setSession(null);
        setIsLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      setIsLoading(false);

      // Clear immediately on sign-out rather than waiting for the effect below.
      // Re-login in the same tab then starts from a clean profile state.
      if (!next) {
        setProfile(null);
        setProfileResolvedFor(null);
        setIsProfileLoading(false);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Outside onAuthStateChange: calling Supabase inside it deadlocks.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setProfileResolvedFor(null);
      setIsProfileLoading(false);
      return;
    }

    let active = true;
    // Set before the query, not after: a returning customer reaches the
    // callback page before this resolves, and a stale false here would read
    // as "no username" and send them through the form again.
    setIsProfileLoading(true);
    // A new session has not been resolved yet, even if a profile object from
    // the previous session is still in state for this render.
    setProfileResolvedFor(null);

    // try/finally, because this flag gates a full-screen shell. A rejected
    // request used to skip the only line that cleared it, leaving the guard on
    // its loading branch forever — which is exactly the "page went black
    // after signup" report.
    const loadProfile = async () => {
      try {
        let { data, error } = await supabase
          .from('profiles')
          .select(PROFILE_COLUMNS)
          .eq('id', userId)
          .maybeSingle();

        if (error?.code === '42703') {
          ({ data, error } = await supabase
            .from('profiles')
            .select(ROLE_PROFILE_COLUMNS)
            .eq('id', userId)
            .maybeSingle());
        }

        if (error?.code === '42703') {
          ({ data, error } = await supabase
            .from('profiles')
            .select(LEGACY_PROFILE_COLUMNS)
            .eq('id', userId)
            .maybeSingle());
        }

        if (!active) return;
        setProfile(error ? null : mapProfile(data as ProfileRow | null));
      } catch {
        if (active) setProfile(null);
      } finally {
        if (active) {
          setIsProfileLoading(false);
          setProfileResolvedFor(userId);
        }
      }
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, [userId]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      // Depends on Supabase Authentication > URL Configuration. This exact URL
      // must be in the Redirect URLs allow-list, or Supabase silently discards
      // it and falls back to the project's Site URL — which is
      // http://localhost:3000 until someone changes it. That failure looks like
      // a successful login that lands on the wrong host.
      //
      // Required entries:
      //   https://trim-one.vercel.app/auth/callback
      //   http://localhost:5173/auth/callback
      //   http://localhost:8100/auth/callback
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    navigate('/home', { replace: true });
  }, [navigate]);

  const saveUsername = useCallback(
    async (input: string) => {
      const result = validateUsername(input);
      if (!result.ok) return { ok: false, error: result.error };
      if (!userId) return { ok: false, error: 'You are not signed in.' };

      const mapError = (code: string | undefined) => {
        // 23505 is the unique violation on the username index.
        if (code === '23505') return 'That name is taken.';
        // 23514 is the check constraint on the shape of the name. The client
        // validates the same pattern, so reaching this means the two rules
        // drifted apart; say what the database actually accepts.
        if (code === '23514') {
          return 'Use lowercase letters, numbers and underscores only.';
        }
        return 'Could not save your username. Try again.';
      };

      // Update first, insert only if the trigger did not create the row.
      //
      // Upsert looks simpler, but PostgREST puts every payload column in the
      // ON CONFLICT DO UPDATE list, including id. Migration 0008 grants update
      // on the editable columns only, so the whole upsert failed with 42501 and
      // no username could ever be saved. Two statements keep the grant strict.
      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update({ username: result.value })
        .eq('id', userId)
        .select('id');

      if (updateError) return { ok: false, error: mapError(updateError.code) };

      if (!updated || updated.length === 0) {
        // The signup trigger normally creates the row before the session
        // exists, so this is the fallback for a provisioned account whose row
        // is missing.
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({ id: userId, username: result.value });

        if (insertError) return { ok: false, error: mapError(insertError.code) };
      }

      // Built from scratch when there is no profile yet. The old version only
      // spread an existing object, so a customer whose initial profile read
      // came back empty saved a name, kept a null profile, and was bounced
      // straight back here by the guard — the form appeared to do nothing.
      //
      // Role is carried over rather than reset: this path is also reachable by
      // a provisioned staff account whose profile read was slow.
      setProfile((current) => ({
        id: userId,
        username: result.value,
        displayName: current?.displayName ?? null,
        avatarUrl: current?.avatarUrl ?? null,
        role: current?.role ?? 'customer',
        isAvailable: current?.isAvailable ?? true,
      }));
      return { ok: true };
    },
    [userId],
  );

  /**
   * Fills in a display name when the account did not arrive with one. Google
   * usually supplies a name; email signup does not, which is the case this
   * form exists for.
   */
  const saveDisplayName = useCallback(
    async (input: string) => {
      const result = validateDisplayName(input);
      if (!result.ok) return { ok: false, error: result.error };
      if (!userId) return { ok: false, error: 'You are not signed in.' };

      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update({ display_name: result.value })
        .eq('id', userId)
        .select('id');

      if (updateError) {
        return { ok: false, error: 'Could not save your name. Try again.' };
      }

      if (!updated || updated.length === 0) {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({ id: userId, display_name: result.value });

        if (insertError) {
          return { ok: false, error: 'Could not save your name. Try again.' };
        }
      }

      setProfile((current) =>
        current
          ? { ...current, displayName: result.value }
          : {
              id: userId,
              username: null,
              displayName: result.value,
              avatarUrl: null,
              role: 'customer',
              isAvailable: true,
            },
      );

      return { ok: true };
    },
    [userId],
  );

  /**
   * Writes one of Trim's own avatars to the caller's row.
   *
   * avatar_url already holds the Google photo for OAuth accounts, so this
   * overwrites it rather than adding a second column. Migration 0008 grants
   * update on this column for every signed-in role, which is what lets the same
   * picker work on the customer, barber and admin dashboards.
   */
  const saveAvatar = useCallback(
    async (avatarUrl: string) => {
      if (!userId) return { ok: false, error: 'You are not signed in.' };

      const option = avatarOption(avatarUrl);
      if (!option) return { ok: false, error: 'Pick one of the Trim avatars.' };

      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: option.src })
        .eq('id', userId)
        .select('id');

      if (updateError) {
        return { ok: false, error: 'Could not save your avatar. Try again.' };
      }

      if (!updated || updated.length === 0) {
        // The row is normally created by the signup trigger. This covers the
        // same fallback as saveUsername, in case that trigger has not run.
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({ id: userId, avatar_url: option.src });

        if (insertError) {
          return { ok: false, error: 'Could not save your avatar. Try again.' };
        }
      }

      setProfile((current) =>
        current ? { ...current, avatarUrl: option.src } : current,
      );

      return { ok: true };
    },
    [userId],
  );

  /**
   * Sets the barber's chair availability through the role-checked RPC. The
   * function refuses non-barber accounts, so a customer cannot make themselves
   * bookable by writing to their own profile.
   */
  const saveAvailability = useCallback(
    async (available: boolean) => {
      if (!userId) return { ok: false, error: 'You are not signed in.' };

      try {
        const { error } = await supabase.rpc('set_barber_availability', {
          p_available: available,
        });

        if (error) {
          if (error.code === '42883' || error.code === 'PGRST202') {
            return {
              ok: false,
              error: 'Availability is not available yet. Try again later.',
            };
          }
          if (error.code === '42501') {
            return {
              ok: false,
              error: 'Only barber accounts can change availability.',
            };
          }
          return {
            ok: false,
            error: 'Could not update availability. Try again.',
          };
        }

        setProfile((current) =>
          current ? { ...current, isAvailable: available } : current,
        );
        return { ok: true };
      } catch (cause) {
        console.error('Could not update availability', cause);
        return {
          ok: false,
          error: 'Could not reach the account service. Check your connection and try again.',
        };
      }
    },
    [userId],
  );

  /**
   * Asks the database whether a name is free.
   *
   * A plain select cannot answer this: the profiles RLS policy only exposes the
   * caller's own row, so every other name looked available and the rejection
   * only arrived from the unique constraint on save. username_available is a
   * security-definer function that answers with a boolean and reveals nothing
   * else. Returns null when the function is missing, which callers treat as
   * "unknown" rather than "free".
   */
  const isUsernameAvailable = useCallback(
    async (username: string): Promise<boolean | null> => {
      const { data, error } = await supabase.rpc('username_available', {
        candidate: username,
      });

      if (error) return null;
      return data === true;
    },
    [],
  );

  /**
   * Supabase error text is not worth showing raw, but a few cases are specific
   * enough that a generic message would be useless: a username already claimed,
   * an unconfirmed account, and a throttled client.
   */
  const readAuthError = useCallback((message: string): string => {
    const lower = message.toLowerCase();

    if (lower.includes('rate limit') || lower.includes('too many') || lower.includes('429')) {
      return 'Too many attempts. Wait a few minutes and try again.';
    }
    if (lower.includes('already registered') || lower.includes('already been registered')) {
      return 'That email already has an account. Sign in instead.';
    }
    if (lower.includes('username') || lower.includes('duplicate key')) {
      return 'That username is taken. Try another.';
    }
    if (lower.includes('invalid login')) {
      return 'That email and password do not match an account.';
    }
    // Reachable when the project still has "Confirm email" on: the account
    // exists, but Supabase refuses to let it sign in until it is confirmed,
    // and this flow has no way to confirm it.
    if (lower.includes('not confirmed')) {
      return 'That account is not confirmed yet, so it cannot sign in.';
    }
    if (lower.includes('signups not allowed') || lower.includes('sign up not allowed')) {
      return 'New accounts are closed right now.';
    }
    return 'Something went wrong. Try again in a moment.';
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string }) => {
      const email = normaliseEmail(input.email);

      const { data, error } = await supabase.auth.signUp({
        email,
        password: input.password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });

      if (error) return { ok: false as const, error: readAuthError(error.message) };

      // With email confirmations enabled, Supabase creates the user but may not
      // return a session until the email OTP/code is verified.
      if (!data.session) {
        return { ok: true as const, needsVerification: true as const, email };
      }

      return { ok: true as const, needsVerification: false as const };
    },
    [readAuthError],
  );

  const resendSignupVerification = useCallback(
    async (email: string) => {
      const cleanEmail = normaliseEmail(email);
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) return { ok: false as const, error: readAuthError(error.message) };
      return { ok: true as const };
    },
    [readAuthError],
  );

  const sendPasswordResetLink = useCallback(
    async (email: string) => {
      const cleanEmail = normaliseEmail(email);
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      if (error) return { ok: false as const, error: readAuthError(error.message) };
      return { ok: true as const };
    },
    [readAuthError],
  );

  const setPassword = useCallback(
    async (password: string) => {
      if (password.length < 8) {
        return { ok: false as const, error: 'Password must be at least 8 characters.' };
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { ok: false as const, error: readAuthError(error.message) };

      // updateUser adds email/password credentials for OAuth-only accounts, but
      // the current session/user state may not include the new identity yet.
      // Refresh so hasPassword/UI updates immediately.
      try {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed.session) {
          setSession(refreshed.session);
        }
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          setSession((current) => (current ? { ...current, user: userData.user } : current));
        }
        if (!refreshed.session) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) setSession(sessionData.session);
        }
      } catch {
        // Non-fatal: password was saved; state may refresh on next auth event.
      }

      return { ok: true as const };
    },
    [readAuthError],
  );

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) return { ok: false as const, error: readAuthError(error.message) };
      return { ok: true as const };
    },
    [readAuthError],
  );

  const isProfileReady = Boolean(userId && profileResolvedFor === userId);
  const hasPassword = Boolean(
    session?.user.identities?.some((identity) => identity.provider === 'email') ||
      session?.user.app_metadata?.providers?.includes?.('email'),
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      isLoading,
      isProfileLoading,
      isProfileReady,
      signInWithGoogle,
      signOut,
      saveUsername,
      saveDisplayName,
      saveAvatar,
      saveAvailability,
      register,
      signInWithPassword,
      resendSignupVerification,
      sendPasswordResetLink,
      setPassword,
      hasPassword,
      isUsernameAvailable,
    }),
    [
      session,
      profile,
      isLoading,
      isProfileLoading,
      isProfileReady,
      signInWithGoogle,
      signOut,
      saveUsername,
      saveDisplayName,
      saveAvatar,
      saveAvailability,
      register,
      signInWithPassword,
      resendSignupVerification,
      sendPasswordResetLink,
      setPassword,
      hasPassword,
      isUsernameAvailable,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
