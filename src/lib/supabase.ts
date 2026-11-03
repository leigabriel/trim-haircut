import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// createClient throws a generic "supabaseUrl is required", so name the var.
const missing = [
  ...(!url ? ['VITE_SUPABASE_URL'] : []),
  ...(!key ? ['VITE_SUPABASE_PUBLISHABLE_KEY'] : []),
];

if (missing.length > 0) {
  throw new Error(
    `Missing ${missing.join(' and ')}. Copy .env.example to .env and fill it in.`,
  );
}

// Every tab gets its own auth namespace. A shared storage key would also give
// every tab the same BroadcastChannel, so signing in elsewhere would update
// this tab. The id lives in sessionStorage: a reload keeps it, a new tab gets
// a fresh one.
const projectRef = new URL(url).hostname.split('.')[0];
const tabIdKey = 'trim:auth-tab';
const tabId =
  window.sessionStorage.getItem(tabIdKey) ??
  window.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
window.sessionStorage.setItem(tabIdKey, tabId);

// PKCE, not the default implicit flow: implicit returns tokens in the URL
// fragment, which /auth/callback does not read. PKCE returns a ?code=, and
// keeps tokens out of the address bar and history.
export const supabase = createClient(url, key, {
  auth: {
    flowType: 'pkce',
    // Off, so /auth/callback is the only thing that exchanges the code.
    // Left on, the client consumes it on init and the callback fails on a spent
    // code.
    detectSessionInUrl: false,
    // localStorage is shared by every tab on this origin, so a new tab would
    // inherit the account signed in elsewhere. sessionStorage is per tab:
    // reloading keeps this tab's session, while a new tab starts signed out.
    storage: window.sessionStorage,
    storageKey: `sb-${projectRef}-auth-token-${tabId}`,
  },
});
