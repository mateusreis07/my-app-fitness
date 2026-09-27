import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { dashboardClock, resolveTimeZone } from '@/features/dashboard/calendar';
import { fetchCurrentTargets } from '@/features/fitness/targets';
import { getSupabaseClient } from '@/services/supabase/client';
import type { NutritionTargets } from '@/services/supabase/database.types';
import type { MealWithItems } from './model';
import { loadDay } from './repository';
import { buildDayTotals, type DayTotals } from './totals';

export type NutritionDayState = {
  loading: boolean;
  error: boolean;
  dayKey: string;
  meals: MealWithItems[];
  totals: DayTotals;
  /** `undefined` enquanto carrega; `null` quando não há meta vigente. */
  targets: NutritionTargets | null | undefined;
  reload: () => void;
};

/**
 * Registros do dia corrente.
 *
 * O dia vem do mesmo relógio do dashboard, no fuso do perfil. Gravar ou ler com
 * data UTC faria os registros da noite sumirem, porque `selectDailySignals`
 * compara a chave do dia por igualdade exata.
 */
export function useNutritionDay(): NutritionDayState {
  const { user, profile } = useAuth();
  const userId = user?.id;
  const timeZone = resolveTimeZone(profile?.timezone);
  const dayKey = dashboardClock(new Date(), timeZone).dayKey;

  const [loaded, setLoaded] = useState<{
    key: string;
    meals: MealWithItems[] | null;
    targets: NutritionTargets | null | undefined;
  } | null>(null);
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const key = `${userId}:${dayKey}`;

  const reload = useCallback(() => {
    const client = getSupabaseClient();
    if (!userId || !client) return;
    const id = ++request.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;

    void Promise.all([
      loadDay(client, userId, dayKey, abort.signal),
      fetchCurrentTargets(client, userId),
    ]).then(([day, targets]) => {
      if (id !== request.current || abort.signal.aborted) return;
      setLoaded({
        key: `${userId}:${dayKey}`,
        meals: day.ok ? day.data : null,
        // Erro de leitura da meta não vira "sem meta": fica indefinido e a tela
        // apenas deixa de comparar com porcentagem.
        targets: targets.ok ? targets.targets : undefined,
      });
    });
  }, [userId, dayKey, setLoaded]);

  useFocusEffect(
    useCallback(() => {
      reload();
      return () => {
        ++request.current;
        controller.current?.abort();
      };
    }, [reload]),
  );

  const current = loaded?.key === key ? loaded : null;
  const meals = current?.meals ?? [];

  return {
    loading: current === null,
    error: current !== null && current.meals === null,
    dayKey,
    meals,
    totals: buildDayTotals(dayKey, meals),
    targets: current?.targets,
    reload,
  };
}
