import { randomUUID } from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { dashboardClock, resolveTimeZone } from '@/features/dashboard/calendar';
import { fetchCurrentTargets, type CurrentTargetsResult } from '@/features/fitness/targets';
import { getSupabaseClient } from '@/services/supabase/client';
import type { WaterLog } from '@/services/supabase/database.types';
import { createWaterEntry, waterTotals, type WaterEntry } from './model';
import { loadWaterDay, saveWaterEntry, removeWaterEntry } from './repository';

export function useHydrationDay() {
  const { user, profile } = useAuth();
  const userId = user?.id;
  const timeZone = resolveTimeZone(profile?.timezone);
  const [now, setNow] = useState(() => new Date());
  const dayKey = dashboardClock(now, timeZone).dayKey;
  const key = `${userId}:${dayKey}:${timeZone}`;
  const [loaded, setLoaded] = useState<{
    key: string;
    logs: WaterLog[] | null;
    target: CurrentTargetsResult;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    owner: string;
    kind: 'saved' | 'removed' | 'saveFailed' | 'removeFailed';
  } | null>(null);
  const [pending, setPending] = useState<WaterEntry | null>(null);
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
      const [logs, target] = await Promise.all([
        loadWaterDay(client, userId, day, abort.signal),
        fetchCurrentTargets(client, userId),
      ]);
      if (id === request.current && !abort.signal.aborted)
        setLoaded({
          key: `${userId}:${day}:${timeZone}`,
          logs: logs.ok ? logs.data : null,
          target,
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

  async function save(amount?: number): Promise<boolean> {
    const client = getSupabaseClient();
    if (lock.current || !userId || !client) return false;
    // Enquanto há resposta incerta, repetir somente o UUID original.
    const entry =
      pending?.user_id === userId
        ? pending
        : amount === undefined
          ? null
          : createWaterEntry(userId, amount, timeZone, new Date(), randomUUID());
    if (!entry) return false;
    lock.current = true;
    setBusy(true);
    setFeedback(null);
    setPending(entry);
    try {
      const result = await saveWaterEntry(client, entry);
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
      const result = await removeWaterEntry(client, userId, id);
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
  const totals = current?.logs ? waterTotals(dayKey, current.logs) : null;
  const target = current?.target.ok ? current.target.targets : undefined;
  return {
    dayKey,
    timeZone,
    logs,
    totals,
    loading: current === null,
    error: current !== null && (current.logs === null || totals === null),
    target: target && target.effective_from > dayKey ? null : target,
    targetError: current !== null && !current.target.ok,
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
