import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Service-role client — full DB access, bypasses RLS. Server-side only, never exposed to the browser. */
export function getAdminClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/** Resolves the calling user from their Supabase JWT (forwarded by supabase.functions.invoke). */
export async function getRequestUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data } = await client.auth.getUser();
  return data.user ?? null;
}
