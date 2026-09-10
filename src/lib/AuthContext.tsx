import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './supabase';
import { canUseCalculator, isAdmin, resolveLiteAccess, type LiteAccessProfile, type LiteAccessStatus } from './access';

export type ProfileRow = LiteAccessProfile & {
  id: string;
  email?: string | null;
  full_name?: string | null;
};

type AuthState = {
  ready: boolean;
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  access: LiteAccessStatus;
  canCalculate: boolean;
  admin: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, access_mode, access_expires_at, is_active')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('[Lite] profiles fetch failed', error.message);
    return null;
  }
  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    role: data.role,
    accessMode: data.access_mode,
    accessExpiresAt: data.access_expires_at,
    isActive: data.is_active,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!supabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const refreshProfile = useCallback(async () => {
    const uid = (await supabase?.auth.getUser())?.data.user?.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    setProfile(await fetchProfile(uid));
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;

    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(data.session);
      if (data.session?.user) {
        setProfile(await fetchProfile(data.session.user.id));
      }
      setReady(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.user) {
        void fetchProfile(next.user.id).then(setProfile);
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: 'Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    if (!supabase) return { error: 'Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY' };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return error ? { error: error.message } : {};
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setProfile(null);
  }, []);

  const access = resolveLiteAccess(profile ?? {});
  const value = useMemo<AuthState>(() => ({
    ready,
    session,
    user: session?.user ?? null,
    profile,
    access,
    canCalculate: canUseCalculator(access),
    admin: isAdmin(profile),
    configured: supabaseConfigured,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  }), [ready, session, profile, access, signIn, signUp, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
