import { randomUUID } from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { dashboardClock, resolveTimeZone } from '@/features/dashboard/calendar';
import { addDaysIso } from '@/lib/date';
import { getSupabaseClient } from '@/services/supabase/client';
import type { Goal, WeightLog } from '@/services/supabase/database.types';
import { createWeightEntry, type WeightEntry } from './model';
import {
  loadActiveGoal,
  loadWeightHistory,
  removeWeightEntry,
  saveWeightEntry,
} from './repository';
import {
  changeSinceStart,
  dailySeries,
  movingAverage,
  progressToTarget,
  weeklyComparison,
} from './trend';

/** Janela do histórico e do gráfico. Noventa dias cobrem a tendência sem virar consulta pesada. */
export const HISTORY_DAYS = 90;

/** `numeric` do Postgres chega como string; `null`/`undefined` viram `null`. */
function numberOrNull(value: string | number | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/**
 * Histórico de peso, tendência e objetivo ativo.
 *
 * Mesma estrutura de `useHydrationDay`: chave de cache que impede mostrar dado
 * de outro dia ou de outro usuário, contador de requisição para descartar
 * resposta antiga, e o protocolo de pendência que repete o **mesmo UUID**
 * quando a resposta foi incerta — assim uma retentativa não vira registro
 * duplicado.
 */
export function useWeightHistory() {
  const { user, profile } = useAuth();
  const userId = user?.id;
  const timeZone = resolveTimeZone(profile?.timezone);
  const [now, setNow] = useState(() => new Date());
  const dayKey = dashboardClock(now, timeZone).dayKey;
  const key = `${userId}:${dayKey}:${timeZone}`;

  const [loaded, setLoaded] = useState<{
    key: string;
    logs: WeightLog[] | null;
    goal: Goal | null;
    goalFailed: boolean;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    owner: string;
    kind: 'saved' | 'removed' | 'saveFailed' | 'removeFailed';
  } | null>(null);
  const [pending, setPending] = useState<WeightEntry | null>(null);
  const lock = useRef(false);
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
      const [logs, goal] = await Promise.all([
        loadWeightHistory(client, userId, addDaysIso(day, -(HISTORY_DAYS - 1)), abort.signal),
        loadActiveGoal(client, userId, abort.signal),
      ]);
      if (id === request.current && !abort.signal.aborted)
        setLoaded({
          key: `${userId}:${day}:${timeZone}`,
          logs: logs.ok ? logs.data : null,
          goal: goal.ok ? goal.data : null,
          goalFailed: !goal.ok,
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

  async function save(weightKg?: number, notes?: string | null): Promise<boolean> {
    const client = getSupabaseClient();
    if (lock.current || !userId || !client) return false;
    // Enquanto há resposta incerta, repetir somente a entrada original.
    let entry: WeightEntry | null;
    if (pending?.user_id === userId) {
      entry = pending;
    } else if (weightKg === undefined) {
      entry = null;
    } else {
      entry = createWeightEntry({
        userId,
        weightKg,
        timeZone,
        now: new Date(),
        id: randomUUID(),
        notes: notes ?? null,
      });
    }
    if (!entry) return false;
    lock.current = true;
    setBusy(true);
    setFeedback(null);
    setPending(entry);
    try {
      const result = await saveWeightEntry(client, entry);
      if (result.ok) setPending(null);
      if (active.current) {
        setFeedback({ owner: userId, kind: result.ok ? 'saved' : 'saveFailed' });
        await reload();
      }
      return result.ok;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const client = getSupabaseClient();
    if (lock.current || !client || !userId) return;
    lock.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await removeWeightEntry(client, userId, id);
      if (active.current) {
        setFeedback({ owner: userId, kind: result.ok ? 'removed' : 'removeFailed' });
        await reload();
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const current = loaded?.key === key ? loaded : null;
  const logs = current?.logs ?? [];
  const goal = current?.goal ?? null;
  const loading = current === null;
  const error = current !== null && current.logs === null;
  const goalError = current?.goalFailed ?? false;

  // Isolado em useMemo: o compilador do React não conseguia preservar a
  // memoização manual do useFocusEffect quando essas contas ficavam soltas no
  // corpo do hook, por causa do parâmetro com valor padrão em `movingAverage`.
  // Um limite de memoização explícito resolve.
  const trendData = useMemo(() => {
    const series = current?.logs ? dailySeries(current.logs) : [];
    const latest = series.at(-1) ?? null;
    const startingKg = numberOrNull(goal?.starting_weight_kg);
    const targetKg = numberOrNull(goal?.target_weight_kg);
    return {
      series,
      latest,
      trend: movingAverage(series, dayKey),
      weekly: weeklyComparison(series, dayKey),
      change: changeSinceStart(series),
      target: progressToTarget(startingKg, latest?.weightKg ?? null, targetKg),
    };
  }, [current, goal, dayKey]);

  return {
    dayKey,
    timeZone,
    logs,
    series: trendData.series,
    latest: trendData.latest,
    goal,
    trend: trendData.trend,
    weekly: trendData.weekly,
    change: trendData.change,
    target: trendData.target,
    loading,
    error,
    goalError,
    refreshing,
    busy,
    pending: pending?.user_id === userId ? pending : null,
    feedback: feedback && feedback.owner === userId ? feedback.kind : null,
    reload,
    save,
    remove,
    clearPending: () => {
      setPending(null);
      setFeedback(null);
      void reload();
    },
  };
}
