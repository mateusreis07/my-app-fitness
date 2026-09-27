import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useHydrationDay } from '@/features/hydration/useHydrationDay';
import { useNutritionDay } from '@/features/nutrition/useNutritionDay';
import { dayComponents, totalScore } from '@/features/score/model';
import { useScoreHistory } from '@/features/score/useScoreHistory';
import { useTodayWorkout } from '@/features/workouts/useTodayWorkout';
import { useWeightHistory } from '@/features/weight/useWeightHistory';
import { DashboardView } from './DashboardView';
import { DASHBOARD_CAPABILITIES, type DailySignals } from './model';
import type { Priority } from './priorities';
import { useDashboard } from './useDashboard';
import { WelcomeScreen } from './WelcomeScreen';

export function DashboardScreen() {
  const { status } = useAuth();
  return status === 'unconfigured' ? <WelcomeScreen /> : <ConnectedDashboard />;
}

function ConnectedDashboard() {
  const router = useRouter();
  const { snapshot, refreshing, refresh, now, timeZone, profile } = useDashboard();
  // Leitura separada da do dashboard: uma falha em qualquer painel não pode
  // derrubar os demais.
  const nutrition = useNutritionDay();
  const water = useHydrationDay();
  const weight = useWeightHistory();
  const workout = useTodayWorkout();
  const scoreHistory = useScoreHistory();

  // Score de hoje é calculado ao vivo, nunca lido de `daily_scores` — o dia
  // ainda não fechou. `undefined` enquanto os painéis de origem carregam ou
  // falham (estado distinto de `null`, que é "sem meta nutricional vigente").
  const todayScore = useMemo(() => {
    if (
      nutrition.loading ||
      nutrition.error ||
      water.loading ||
      water.error ||
      workout.loading ||
      workout.error
    )
      return undefined;
    const targets = nutrition.targets;
    return totalScore(
      dayComponents({
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
      }),
    );
  }, [nutrition, water, workout]);

  // Enquanto carrega ou falha, o bloco fica nulo — e `null` vira "aguardando
  // registros" na tela, nunca zero.
  const signals: DailySignals = {
    nutrition: nutrition.loading || nutrition.error ? null : nutrition.totals,
    water: water.loading || water.error ? null : water.totals,
    workout:
      workout.loading || workout.error
        ? null
        : { dayKey: workout.dayKey, scheduled: workout.scheduled, completed: workout.completed },
  };

  function onPriority(destination: Priority['destination']) {
    if (destination === 'nutrition') router.push('/nutrition');
    if (destination === 'water') router.push('/hydration');
    if (destination === 'weight') router.push('/weight');
    if (destination === 'workout') router.push('/workouts');
  }

  return (
    <DashboardView
      name={profile?.display_name ?? null}
      now={now}
      timeZone={timeZone}
      snapshot={snapshot}
      refreshing={
        refreshing ||
        water.refreshing ||
        weight.refreshing ||
        workout.refreshing ||
        scoreHistory.refreshing
      }
      onRefresh={() => {
        void refresh();
        nutrition.reload();
        void water.reload();
        void weight.reload();
        void workout.reload();
        void scoreHistory.reload();
      }}
      signals={signals}
      // As quatro props andam juntas: sem `onPriority`, a DashboardView ignora
      // as capacidades.
      capabilities={{
        ...DASHBOARD_CAPABILITIES,
        nutrition: true,
        water: true,
        weight: true,
        workout: true,
      }}
      onPriority={onPriority}
      onWaterAdd={(amount) => void water.save(amount)}
      waterBusy={water.busy || Boolean(water.pending)}
      waterError={water.error}
      waterFeedback={water.feedback}
      onWaterRetry={water.pending && !water.busy ? () => void water.save() : undefined}
      weightTrend={weight.trend}
      todayScore={todayScore}
      scoreAverage7d={scoreHistory.average7d}
    />
  );
}
