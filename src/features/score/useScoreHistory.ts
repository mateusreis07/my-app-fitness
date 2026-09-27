import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { dashboardClock, resolveTimeZone } from '@/features/dashboard/calendar';
import { addDaysIso } from '@/lib/date';
import { getSupabaseClient } from '@/services/supabase/client';
import type { DailyScore } from '@/services/supabase/database.types';
import { currentStreak, longestStreak, HISTORY_LOOKBACK_DAYS, type ScoreDay } from './model';
import { ensureRecentScoresClosed, loadScoreHistory } from './repository';

/** Quantos dias entram na média de comparação do card do dashboard (seção 24). */
const COMPARISON_WINDOW_DAYS = 7;

/**
 * Histórico do KORA Score — fecha os últimos dias pendentes e lê o que já
 * está fechado. O score de **hoje** não vem daqui: é calculado ao vivo em
 * `DashboardScreen.tsx` a partir dos hooks que já existem, porque o dia ainda
 * não terminou e não deve ser persistido.
 *
 * Mesma estrutura das fases anteriores: chave de cache por dia/fuso, contador
 * de requisição para descartar resposta antiga, `useFocusEffect` com poll de
 * 30 s e `AppState`.
 */
export function useScoreHistory() {
  const { user, profile } = useAuth();
  const userId = user?.id;
  const timeZone = resolveTimeZone(profile?.timezone);
  const [now, setNow] = useState(() => new Date());
  const dayKey = dashboardClock(now, timeZone).dayKey;
  const key = `${userId}:${dayKey}:${timeZone}`;

  const [loaded, setLoaded] = useState<{ key: string; scores: DailyScore[] | null } | null>(null);
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
      await ensureRecentScoresClosed(client, userId, day, abort.signal);
      const result = await loadScoreHistory(
        client,
        userId,
        addDaysIso(day, -HISTORY_LOOKBACK_DAYS),
        abort.signal,
      );
      if (id === request.current && !abort.signal.aborted)
        setLoaded({ key: `${userId}:${day}:${timeZone}`, scores: result.ok ? result.data : null });
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

  // Isolado em useMemo — o React Compiler pode não preservar a memoização
  // manual do useFocusEffect se essas contas ficarem soltas no corpo do hook
  // (invariante 20). Depende de `current` (referência estável do estado), não
  // de um `scores` derivado com `?? []`, que criaria um array novo a cada
  // render e invalidaria a memoização sempre.
  const derived = useMemo(() => {
    const scores = current?.scores ?? [];
    const byDay = new Map(scores.map((row) => [row.score_date, row.total_score]));
    // Contígua e do dia mais recente **fechado** para trás — hoje ainda não
    // fechou (é calculado ao vivo em DashboardScreen), então o streak aqui
    // reflete os dias já concluídos. Buraco vira `null`, nunca zero.
    const yesterday = addDaysIso(dayKey, -1);
    const days: ScoreDay[] = [];
    for (let day = yesterday, i = 0; i < HISTORY_LOOKBACK_DAYS; day = addDaysIso(day, -1), i++)
      days.push({ dayKey: day, totalScore: byDay.get(day) ?? null });

    const recent = days.slice(0, COMPARISON_WINDOW_DAYS);
    const withData = recent.filter((day) => day.totalScore !== null);
    const average7d =
      withData.length > 0
        ? Math.round(withData.reduce((sum, day) => sum + day.totalScore!, 0) / withData.length)
        : null;
    return {
      days,
      average7d,
      current: currentStreak(days),
      longest: longestStreak(days),
    };
  }, [current, dayKey]);

  return {
    dayKey,
    days: derived.days,
    average7d: derived.average7d,
    currentStreak: derived.current,
    longestStreak: derived.longest,
    loading: current === null,
    error: current !== null && current.scores === null,
    refreshing,
    reload,
  };
}
