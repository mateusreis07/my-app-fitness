import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { getSupabaseClient } from '@/services/supabase/client';
import type { Profile } from '@/services/supabase/database.types';
import { mapAuthError, type AuthErrorKey } from './errors';
import { normalizeEmail } from './validation';

export type AuthStatus = 'loading' | 'unconfigured' | 'signedOut' | 'signedIn';

export type AuthResult<T = undefined> = { ok: true; data: T } | { ok: false; error: AuthErrorKey };

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** `true` enquanto o perfil ainda não chegou para uma sessão já ativa. */
  profileLoading: boolean;
  /** `true` entre a abertura do link de recuperação e a troca da senha. */
  recovering: boolean;
  signUp: (input: {
    email: string;
    password: string;
    displayName: string;
  }) => Promise<AuthResult<{ needsConfirmation: boolean }>>;
  signIn: (input: { email: string; password: string }) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const NOT_CONFIGURED: AuthResult<never> = { ok: false, error: 'auth.error.unexpected' };

export function AuthProvider({ children }: PropsWithChildren) {
  const client = useMemo(() => getSupabaseClient(), []);
  const [status, setStatus] = useState<AuthStatus>(client ? 'loading' : 'unconfigured');
  const [session, setSession] = useState<Session | null>(null);
  // Guarda de quem é o perfil carregado. `profileLoading` é derivado daqui, em
  // vez de um sinalizador próprio: evita setState síncrono dentro do efeito.
  const [loaded, setLoaded] = useState<{ userId: string; profile: Profile | null } | null>(null);
  const [recovering, setRecovering] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadProfile = useCallback(
    async (id: string) => {
      if (!client) return;
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('user_id', id)
        .maybeSingle();
      if (!mounted.current) return;
      // O perfil é criado por trigger no cadastro. Se ainda não existe, o app
      // segue: o onboarding faz upsert antes de gravar qualquer dado.
      setLoaded({ userId: id, profile: error ? null : data });
    },
    [client],
  );

  useEffect(() => {
    if (!client) return;

    void client.auth.getSession().then(({ data }) => {
      if (!mounted.current) return;
      setSession(data.session);
      setStatus(data.session ? 'signedIn' : 'signedOut');
    });

    const { data: subscription } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted.current) return;
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'USER_UPDATED' || event === 'SIGNED_OUT') setRecovering(false);
      setSession(nextSession);
      setStatus(nextSession ? 'signedIn' : 'signedOut');
    });

    return () => subscription.subscription.unsubscribe();
  }, [client]);

  const userId = session?.user.id ?? null;
  const profile = loaded && loaded.userId === userId ? loaded.profile : null;
  const profileLoading = userId !== null && loaded?.userId !== userId;
  useEffect(() => {
    if (!userId) return;
    void loadProfile(userId);
  }, [userId, loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (userId) await loadProfile(userId);
  }, [userId, loadProfile]);

  const signUp = useCallback<AuthContextValue['signUp']>(
    async ({ email, password, displayName }) => {
      if (!client) return NOT_CONFIGURED;
      const { data, error } = await client.auth.signUp({
        email: normalizeEmail(email),
        password,
        options: {
          data: { display_name: displayName.trim() },
          emailRedirectTo: Linking.createURL('/sign-in'),
        },
      });
      if (error) return { ok: false, error: mapAuthError(error) };
      // Sem sessão na resposta significa que o projeto exige confirmação por
      // e-mail antes do primeiro login.
      return { ok: true, data: { needsConfirmation: data.session === null } };
    },
    [client],
  );

  const signIn = useCallback<AuthContextValue['signIn']>(
    async ({ email, password }) => {
      if (!client) return NOT_CONFIGURED;
      const { error } = await client.auth.signInWithPassword({
        email: normalizeEmail(email),
        password,
      });
      return error ? { ok: false, error: mapAuthError(error) } : { ok: true, data: undefined };
    },
    [client],
  );

  const signOut = useCallback<AuthContextValue['signOut']>(async () => {
    if (!client) return NOT_CONFIGURED;
    const { error } = await client.auth.signOut();
    if (error) return { ok: false, error: mapAuthError(error) };
    if (mounted.current) setLoaded(null);
    return { ok: true, data: undefined };
  }, [client]);

  const sendPasswordReset = useCallback<AuthContextValue['sendPasswordReset']>(
    async (email) => {
      if (!client) return NOT_CONFIGURED;
      const { error } = await client.auth.resetPasswordForEmail(normalizeEmail(email), {
        redirectTo: Linking.createURL('/reset-password'),
      });
      return error ? { ok: false, error: mapAuthError(error) } : { ok: true, data: undefined };
    },
    [client],
  );

  const updatePassword = useCallback<AuthContextValue['updatePassword']>(
    async (password) => {
      if (!client) return NOT_CONFIGURED;
      const { error } = await client.auth.updateUser({ password });
      if (error) return { ok: false, error: mapAuthError(error) };
      if (mounted.current) setRecovering(false);
      return { ok: true, data: undefined };
    },
    [client],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      profile,
      profileLoading,
      recovering,
      signUp,
      signIn,
      signOut,
      sendPasswordReset,
      updatePassword,
      refreshProfile,
    }),
    [
      status,
      session,
      profile,
      profileLoading,
      recovering,
      signUp,
      signIn,
      signOut,
      sendPasswordReset,
      updatePassword,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return value;
}

/** Conclusão do onboarding, derivada do perfil. Fonte única para as rotas. */
export function useOnboardingComplete(): boolean {
  const { profile } = useAuth();
  return profile?.onboarding_completed_at != null;
}
