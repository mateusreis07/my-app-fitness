import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { getSupabaseClient } from '@/services/supabase/client';
import { loadRecentSessionsSummary, type RecentSessionsSummary } from './repository';

const WINDOW_DAYS = 7;

/** Aderência simples para a aba Progresso — só números, sem gráfico (Fase 8). */
export function useWorkoutAdherence() {
  const { user } = useAuth();
  const userId = user?.id;
  const [summary, setSummary] = useState<RecentSessionsSummary | null>(null);
  const [error, setError] = useState(false);
  const active = useRef(false);

  const reload = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client || !userId) return;
    const sinceIso = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const result = await loadRecentSessionsSummary(client, userId, sinceIso);
    if (!active.current) return;
    setSummary(result.ok ? result.data : null);
    setError(!result.ok);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      active.current = true;
      void reload();
      return () => {
        active.current = false;
      };
    }, [reload]),
  );

  return { summary, loading: summary === null && !error, error, reload };
}
