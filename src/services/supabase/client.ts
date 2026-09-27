import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { getSupabaseConfig } from '@/lib/env';
import type { Database } from './database.types';

export type KoraClient = SupabaseClient<Database>;

let client: KoraClient | undefined;
let refreshBound = false;

/**
 * Mantém o refresh automático de token ligado apenas com o app em primeiro
 * plano, como recomenda o guia oficial do Supabase para React Native. Em
 * segundo plano o timer seria suspenso pelo sistema e geraria erros de rede.
 */
function bindForegroundRefresh(instance: KoraClient) {
  if (refreshBound || Platform.OS === 'web') return;
  refreshBound = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void instance.auth.startAutoRefresh();
    else void instance.auth.stopAutoRefresh();
  });
  if (AppState.currentState === 'active') void instance.auth.startAutoRefresh();
}

/** Lazy by design: a navegação funciona sem credenciais e sem tentar rede. */
export function getSupabaseClient(): KoraClient | null {
  if (client) return client;
  const result = getSupabaseConfig();
  if (result.status !== 'ready') return null;
  client = createClient<Database>(result.config.url, result.config.publishableKey, {
    auth: {
      ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: Platform.OS === 'web',
      flowType: 'pkce',
      lock: processLock,
    },
  });
  bindForegroundRefresh(client);
  return client;
}

/** `true` quando existe configuração pública válida para falar com o backend. */
export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig().status === 'ready';
}
