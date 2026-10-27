import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';

import { supabase } from '../lib/supabase';
import { normaliseEmail } from './credentials';
import { isUserRole } from './roles';
import { validateUsername } from './username';
import type { AuthContextValue, Profile, ProfileRow } from './types';

const PROFILE_COLUMNS = 'id, username, display_name, avatar_url, role';

// Before migration 0008 the role column does not exist. Selecting it would fail
// the whole row and the guard would read that as "no profile", so the fallback
// keeps every existing account working until that migration is applied.
const LEGACY_PROFILE_COLUMNS = 'id, username, display_name, avatar_url';

export const mapProfile = (row: ProfileRow | null): Profile | null =>
  row
    ? {
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        role: isUserRole(row.role) ? row.role : 'customer',
      }
    : null;

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const navigate = useNavigate();

  // One subscription for the whole app.
  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      setIsLoading(false);
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
      setIsProfileLoading(false);
      return;
    }

    let active = true;
    // Set before the query, not after: a returning customer reaches the
    // callback page before this resolves, and a stale false here would read
    // as "no username" and send them through the form again.
    setIsProfileLoading(true);

    // try/finally, because this flag gates a full-screen shell. A rejected
    // request used to skip the only line that cleared it, leaving the guard on
    // its black loading branch forever — which is exactly the "page went black
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
            .select(LEGACY_PROFILE_COLUMNS)
            .eq('id', userId)
            .maybeSingle());
        }

        if (!active) return;
        setProfile(error ? null : mapProfile(data as ProfileRow | null));
      } catch {
        if (active) setProfile(null);
      } finally {
        if (active) setIsProfileLoading(false);
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
      }));
      return { ok: true };
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
      });

      if (error) return { ok: false as const, error: readAuthError(error.message) };

      // No session means one of two things, and a password sign in tells them
      // apart: the project still requires confirmation, or the address already
      // had an account and Supabase returned a placeholder user rather than
      // signing in. Without this the customer would be dropped into the app
      // with no session and bounce straight back here.
      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: input.password,
        });

        if (signInError) return { ok: false as const, error: readAuthError(signInError.message) };
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

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      isLoading,
      isProfileLoading,
      signInWithGoogle,
      signOut,
      saveUsername,
      register,
      signInWithPassword,
      isUsernameAvailable,
    }),
    [
      session,
      profile,
      isLoading,
      isProfileLoading,
      signInWithGoogle,
      signOut,
      saveUsername,
      register,
      signInWithPassword,
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
