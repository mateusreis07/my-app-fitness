import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { getSupabaseClient } from '@/services/supabase/client';
import { dashboardClock, resolveTimeZone } from './calendar';
import type { DashboardSnapshot } from './model';
import { loadDashboard } from './repository';

/** De quanto em quanto tempo o relógio é reavaliado, para virar o dia e a saudação. */
const TICK_MS = 30_000;

/** Foco, retorno ao app e virada do dia invalidam a leitura. Respostas antigas são descartadas. */
export function useDashboard() {
  const { user, profile } = useAuth();
  const userId = user?.id;
  const timeZone = resolveTimeZone(profile?.timezone);
  const onboardingAt = profile?.onboarding_completed_at ?? null;
  const [now, setNow] = useState(() => new Date());
  const [loaded, setLoaded] = useState<{ key: string; snapshot: DashboardSnapshot } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const clock = dashboardClock(now, timeZone);
  const key = `${userId}:${clock.dayKey}:${timeZone}:${onboardingAt}`;

  // Os setters entram nas dependências porque o React Compiler os infere. São
  // identidades estáveis do useState, então não mudam o comportamento.
  const refresh = useCallback(async () => {
    const client = getSupabaseClient();
    if (!userId || !client) return;
    const id = ++request.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setRefreshing(true);
    const current = new Date();
    setNow(current);
    const day = dashboardClock(current, timeZone).dayKey;
    try {
      const result = await loadDashboard(client, userId, day, current.toISOString(), abort.signal);
      if (id !== request.current || abort.signal.aborted) return;
      setLoaded({ key: `${userId}:${day}:${timeZone}:${onboardingAt}`, snapshot: result });
    } finally {
      // Só a requisição mais recente devolve o controle: uma resposta antiga não
      // pode apagar o "atualizando" de uma busca ainda em voo. Sem isto, uma
      // leitura substituída deixaria o indicador girando para sempre.
      if (id === request.current) setRefreshing(false);
    }
  }, [userId, timeZone, onboardingAt, setRefreshing, setNow, setLoaded]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      let lastDay = dashboardClock(new Date(), timeZone).dayKey;
      const tick = () => {
        const current = new Date();
        setNow(current);
        const day = dashboardClock(current, timeZone).dayKey;
        if (day !== lastDay) {
          lastDay = day;
          void refresh();
        }
      };
      const timer = setInterval(tick, TICK_MS);
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') void refresh();
      });
      return () => {
        clearInterval(timer);
        subscription.remove();
        // Invalida qualquer resposta em voo antes de sair da tela.
        ++request.current;
        controller.current?.abort();
      };
    }, [refresh, timeZone, setNow]),
  );

  return {
    // Um retrato de outro dia, outro usuário ou outro fuso nunca é exibido.
    snapshot: loaded?.key === key ? loaded.snapshot : null,
    refreshing,
    refresh,
    clock,
    now,
    timeZone,
    profile,
  };
}
