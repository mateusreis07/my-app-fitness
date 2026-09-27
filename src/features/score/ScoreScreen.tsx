import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { ActionButton, FormNotice } from '@/components/form';
import { Card, Copy, NavButton, Page } from '@/components/ui';
import { useHydrationDay } from '@/features/hydration/useHydrationDay';
import { useNutritionDay } from '@/features/nutrition/useNutritionDay';
import { useTodayWorkout } from '@/features/workouts/useTodayWorkout';
import { theme } from '@/theme/tokens';
import { ScoreChart } from './ScoreChart';
import { dayComponents, scoreStatusKey, totalScore, type ScoreComponents } from './model';
import { useScoreHistory } from './useScoreHistory';

const HISTORY_DAYS_SHOWN = 14;

const COMPONENT_ORDER: (keyof ScoreComponents)[] = [
  'nutrition',
  'protein',
  'hydration',
  'workout',
  'consistency',
];

/**
 * Tela do KORA Score — seções 45 a 48. Detalhamento de hoje, streak e
 * histórico. "Regras" do roadmap (streak, consistency, banda de calorias)
 * estão documentadas em `docs/PHASE_9.md`, não repetidas aqui em prosa.
 */
export function ScoreScreen() {
  const { t } = useTranslation();
  const nutrition = useNutritionDay();
  const water = useHydrationDay();
  const workout = useTodayWorkout();
  const history = useScoreHistory();
  const [chartWidth, setChartWidth] = useState(0);

  function onChartLayout(event: LayoutChangeEvent) {
    setChartWidth(event.nativeEvent.layout.width);
  }

  const loadingToday = nutrition.loading || water.loading || workout.loading;
  const errorToday = nutrition.error || water.error || workout.error;

  const todayComponents = useMemo(() => {
    if (loadingToday || errorToday) return null;
    return dayComponents({
      consumedKcal: nutrition.totals.calories,
      targetKcal: nutrition.targets ? Number(nutrition.targets.calories) : null,
      consumedProteinG: nutrition.totals.proteinG,
      targetProteinG: nutrition.targets ? Number(nutrition.targets.protein_g) : null,
      consumedWaterMl: water.totals?.consumedMl ?? null,
      targetWaterMl: nutrition.targets ? Number(nutrition.targets.water_ml) : null,
      workoutScheduled: workout.scheduled,
      workoutCompleted: workout.completed,
      loggedMeal: nutrition.totals.mealCount > 0,
      loggedWater: water.logs.length > 0,
      loggedWorkout: workout.completed,
    });
  }, [loadingToday, errorToday, nutrition, water, workout]);

  const todayTotal = todayComponents ? totalScore(todayComponents) : undefined;
  const recentDays = history.days.slice(0, HISTORY_DAYS_SHOWN);

  return (
    <Page title={t('score.title')} subtitle={t('score.subtitle')}>
      <NavButton href="/" label={t('common.backHome')} />
      <ActionButton
        label={t('dashboard.refresh')}
        onPress={() => void history.reload()}
        loading={history.refreshing}
        tone="quiet"
      />

      <Card>
        <Copy style={s.heading}>{t('score.today')}</Copy>
        {loadingToday ? (
          <Copy>{t('common.loading')}</Copy>
        ) : errorToday || todayTotal === undefined ? (
          <Copy style={s.caption}>{t('score.loadFailed')}</Copy>
        ) : todayTotal === null ? (
          <Copy style={s.caption}>{t('score.unavailable')}</Copy>
        ) : (
          <>
            <Copy style={s.value}>{todayTotal}</Copy>
            <Copy style={s.caption}>{t(scoreStatusKey(todayTotal))}</Copy>
            <View style={s.components}>
              {COMPONENT_ORDER.map((key) => (
                <View key={key} style={s.componentRow}>
                  <Copy style={s.componentLabel}>{t(`score.component.${key}`)}</Copy>
                  <Copy style={s.componentValue}>
                    {todayComponents![key] === null ? '—' : todayComponents![key]}
                  </Copy>
                </View>
              ))}
            </View>
          </>
        )}
      </Card>

      <Card>
        <Copy style={s.heading}>{t('score.streakCurrent', { days: history.currentStreak })}</Copy>
        <Copy style={s.caption}>{t('score.streakBest', { days: history.longestStreak })}</Copy>
        <Copy style={s.caption}>{t('score.streakExplainer')}</Copy>
      </Card>

      <Card onLayout={onChartLayout}>
        <Copy style={s.heading}>{t('score.historyTitle')}</Copy>
        {history.loading ? (
          <Copy>{t('common.loading')}</Copy>
        ) : history.error ? (
          <FormNotice tone="error">{t('score.loadFailed')}</FormNotice>
        ) : recentDays.every((day) => day.totalScore === null) ? (
          <Copy style={s.caption}>{t('score.empty')}</Copy>
        ) : chartWidth > 0 ? (
          <ScoreChart days={recentDays} width={chartWidth} />
        ) : null}
      </Card>
    </Page>
  );
}

const s = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: '700' },
  caption: { fontSize: 12, color: theme.colors.muted, lineHeight: 18 },
  value: { fontSize: 40, lineHeight: 48, fontWeight: '700', color: theme.colors.primary },
  components: { gap: 8, marginTop: 4 },
  componentRow: { flexDirection: 'row', justifyContent: 'space-between' },
  componentLabel: { fontSize: 14 },
  componentValue: { fontSize: 14, fontWeight: '600', color: theme.colors.muted },
});
