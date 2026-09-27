import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { dashboardClock, resolveTimeZone } from '@/features/dashboard/calendar';
import { getSupabaseClient } from '@/services/supabase/client';
import { loadTodaySignal } from './repository';

/**
 * Sinal de treino do dia, consumido pelo Dashboard (`DailySignals.workout`) e
 * pela prioridade `workout`. Mesma estrutura de leitura periódica das outras
 * fases, sem o protocolo de pendência/retentativa — é só leitura, não há
 * escrita aqui.
 */
export function useTodayWorkout() {
  const { user, profile } = useAuth();
  const userId = user?.id;
  const timeZone = resolveTimeZone(profile?.timezone);
  const [now, setNow] = useState(() => new Date());
  const dayKey = dashboardClock(now, timeZone).dayKey;
  const key = `${userId}:${dayKey}:${timeZone}`;

  const [loaded, setLoaded] = useState<{
    key: string;
    signal: { scheduled: boolean; completed: boolean } | null;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const active = useRef(false);
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const reload = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client || !userId) return;
    const current = new Date();
    setNow(current);
    const day = dashboardClock(current, timeZone).dayKey;
    const id = ++request.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setRefreshing(true);
    try {
      const result = await loadTodaySignal(client, userId, day, abort.signal);
      if (id === request.current && !abort.signal.aborted)
        setLoaded({
          key: `${userId}:${day}:${timeZone}`,
          signal: result.ok ? result.data : null,
        });
    } finally {
      if (id === request.current && active.current) setRefreshing(false);
    }
  }, [userId, timeZone, setNow, setRefreshing, setLoaded]);

  useFocusEffect(
    useCallback(() => {
      active.current = true;
      void reload();
      let lastDay = dashboardClock(new Date(), timeZone).dayKey;
      const timer = setInterval(() => {
        const next = new Date();
        setNow(next);
        const day = dashboardClock(next, timeZone).dayKey;
        if (day !== lastDay) {
          lastDay = day;
          void reload();
        }
      }, 30_000);
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') void reload();
      });
      return () => {
        active.current = false;
        ++request.current;
        controller.current?.abort();
        clearInterval(timer);
        subscription.remove();
      };
    }, [reload, timeZone, setNow]),
  );

  const current = loaded?.key === key ? loaded : null;

  return {
    dayKey,
    scheduled: current?.signal?.scheduled ?? false,
    completed: current?.signal?.completed ?? false,
    loading: current === null,
    error: current !== null && current.signal === null,
    refreshing,
    reload,
  };
}
