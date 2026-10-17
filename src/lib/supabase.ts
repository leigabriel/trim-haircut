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
  },
});