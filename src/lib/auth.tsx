import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, Membership } from '@/types';
import { logError } from '@/lib/errors';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  membership: Membership | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

/**
 * Creates a profile row for an authenticated user if one doesn't exist yet.
 * ignoreDuplicates means this only ever inserts (never overwrites), so it's
 * safe to call on every session load — covers brand-new signups right after
 * email confirmation AND older auth users left without a profile row.
 */
async function ensureProfile(userId: string) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, username: `user_${userId.slice(0, 8)}` }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) logError('ensureProfile', error);
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    let { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!profileData) {
      await ensureProfile(userId);
      const retry = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      profileData = retry.data;
    }
    setProfile(profileData as Profile | null);

    const { data: membershipData } = await supabase
      .from('memberships')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    setMembership(membershipData as Membership | null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setMembership(null);
        setLoading(false);
      } else if (session?.user) {
        (async () => {
          await loadProfile(session.user.id);
          setLoading(false);
        })();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message, needsEmailConfirmation: false };

    // With email confirmation enabled, signUp() creates the auth user but
    // returns no session — there's no authenticated context yet to create a
    // profile under RLS, so profile creation happens later in loadProfile()
    // once the user actually has a session (after confirming + signing in).
    if (data.session) {
      await loadProfile(data.session.user.id);
      return { error: null, needsEmailConfirmation: false };
    }
    return { error: null, needsEmailConfirmation: true };
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      await loadProfile(data.user.id);
    }
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setMembership(null);
  }

  async function refreshProfile() {
    if (user) await loadProfile(user.id);
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, membership, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
