import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// createClient() throws synchronously if the URL/key are missing or invalid.
// That throw would happen during this module's top-level evaluation — before
// React ever mounts — crashing the whole app to a blank page with nothing to
// catch it. App.tsx checks isSupabaseConfigured and renders a clear
// "missing configuration" screen instead of mounting the app, so this code
// path should be unreachable when misconfigured. The proxy below exists as a
// loud backup (throws a clear error on first use) rather than leaving
// `supabase` silently undefined if that guard is ever bypassed.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : (new Proxy({}, {
      get() {
        throw new Error(
          'Supabase client used before configuration was verified — VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing.'
        );
      },
    }) as ReturnType<typeof createClient>);
