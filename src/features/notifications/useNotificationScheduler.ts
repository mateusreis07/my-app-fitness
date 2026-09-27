import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { dashboardClock, resolveTimeZone } from '@/features/dashboard/calendar';
import { useHydrationDay } from '@/features/hydration/useHydrationDay';
import { useNutritionDay } from '@/features/nutrition/useNutritionDay';
import { dayComponents, totalScore } from '@/features/score/model';
import { useTodayWorkout } from '@/features/workouts/useTodayWorkout';
import { useWeightHistory } from '@/features/weight/useWeightHistory';
import { planTodayNotifications } from './model';
import { useNotificationPreferences } from './useNotificationPreferences';
import { applyPlan, configureNotificationHandler } from './scheduler';

const POLL_MS = 30_000;

/**
 * Hook "invisível", montado uma vez na raiz autenticada do app. Recalcula o
 * que falta agendar para hoje a partir dos mesmos hooks de dia já usados no
 * dashboard — nenhuma leitura nova além das preferências. Nunca renderiza
 * nada; só sincroniza o agendador do dispositivo com o estado atual.
 */
export function useNotificationScheduler() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const userId = user?.id;
  const timeZone = resolveTimeZone(profile?.timezone);
  const nutrition = useNutritionDay();
  const water = useHydrationDay();
  const workout = useTodayWorkout();
  const weight = useWeightHistory();
  const { preferences } = useNotificationPreferences();
  const active = useRef(false);

  const apply = useCallback(() => {
    if (!userId || !preferences) return;
    const anyEnabled =
      preferences.water_enabled ||
      preferences.workout_enabled ||
      preferences.weight_enabled ||
      preferences.summary_enabled;
    if (!anyEnabled) return;
    if (
      nutrition.loading ||
      nutrition.error ||
      water.loading ||
      water.error ||
      workout.loading ||
      workout.error ||
      weight.loading
    )
      return;

    const now = new Date();
    const todayDayKey = dashboardClock(now, timeZone).dayKey;
    const targets = nutrition.targets;
    const components = dayComponents({
      consumedKcal: nutrition.totals.calories,
      targetKcal: targets ? Number(targets.calories) : null,
      consumedProteinG: nutrition.totals.proteinG,
      targetProteinG: targets ? Number(targets.protein_g) : null,
      consumedWaterMl: water.totals?.consumedMl ?? null,
      targetWaterMl: targets ? Number(targets.water_ml) : null,
      workoutScheduled: workout.scheduled,
      workoutCompleted: workout.completed,
      loggedMeal: nutrition.totals.mealCount > 0,
      loggedWater: water.logs.length > 0,
      loggedWorkout: workout.completed,
    });
    const score = totalScore(components);

    const plan = planTodayNotifications(
      {
        waterEnabled: preferences.water_enabled,
        workoutEnabled: preferences.workout_enabled,
        weightEnabled: preferences.weight_enabled,
        summaryEnabled: preferences.summary_enabled,
        reminderTime: preferences.reminder_time,
        summaryTime: preferences.summary_time,
      },
      {
        now,
        timeZone,
        todayDayKey,
        consumedKcal: nutrition.totals.calories,
        targetKcal: targets ? Number(targets.calories) : null,
        consumedWaterMl: water.totals?.consumedMl ?? null,
        targetWaterMl: targets ? Number(targets.water_ml) : null,
        mealCount: nutrition.totals.mealCount,
        workoutScheduled: workout.scheduled,
        workoutCompleted: workout.completed,
        lastWeighInDay: weight.latest?.dayKey ?? null,
        score,
      },
    );

    void applyPlan(
      plan.toSchedule.map((entry) => ({
        id: entry.id,
        secondsFromNow: entry.secondsFromNow,
        title: String(t(entry.titleKey)),
        // A chave varia por tipo de notificação, cada uma com sua própria
        // forma de interpolação — o `t()` tipado não reconcilia um
        // dicionário genérico contra a união de todas elas.
        body: String(
          entry.bodyParams ? t(entry.bodyKey, entry.bodyParams as never) : t(entry.bodyKey),
        ),
      })),
      plan.toCancel,
    );
  }, [userId, preferences, nutrition, water, workout, weight, timeZone, t]);

  // `useEffect`, não `useFocusEffect`: este hook vive no layout das abas
  // (montado uma vez para toda a sessão autenticada), não numa tela roteada
  // — não deve depender de eventos de foco de navegação.
  useEffect(() => {
    active.current = true;
    void configureNotificationHandler();
    apply();
    const timer = setInterval(apply, POLL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') apply();
    });
    return () => {
      active.current = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, [apply]);
}
