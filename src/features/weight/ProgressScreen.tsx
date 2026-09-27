import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Card, Copy, NavButton, Page } from '@/components/ui';
import { ActionButton, FormNotice } from '@/components/form';
import { Metric } from '@/features/dashboard/DashboardView';
import { useHydrationDay } from '@/features/hydration/useHydrationDay';
import { useNutritionDay } from '@/features/nutrition/useNutritionDay';
import { useWorkoutAdherence } from '@/features/workouts/useWorkoutAdherence';
import { theme } from '@/theme/tokens';
import { WeightChart } from './WeightChart';
import { useWeightHistory } from './useWeightHistory';

/**
 * Tela de evolução — KORA_MASTER_CONTEXT.md seção 37.
 *
 * Mostra o que já existe de dado real: peso, meta, variação, tendência,
 * proteína, água do dia e, desde a Fase 8, aderência de treino (sessões
 * concluídas nos últimos 7 dias e data da última). Sem gráfico de aderência
 * nesta fase — só números, no mesmo espírito de "só o que existe de verdade".
 * Score/streak (seção 37) entra na Fase 9.
 *
 * Nunca projeta data de chegada: a seção "Tendência" descreve o passado.
 */
export function ProgressScreen() {
  const { t } = useTranslation();
  const weight = useWeightHistory();
  const nutrition = useNutritionDay();
  const water = useHydrationDay();
  const workout = useWorkoutAdherence();
  const [chartWidth, setChartWidth] = useState(0);

  function onChartLayout(event: LayoutChangeEvent) {
    setChartWidth(event.nativeEvent.layout.width);
  }

  const hasHistory = weight.logs.length > 0;

  return (
    <Page title={t('progress.title')} subtitle={t('progress.subtitle')}>
      <ActionButton
        label={t('dashboard.refresh')}
        onPress={() => void weight.reload()}
        loading={weight.refreshing}
        tone="quiet"
      />

      {weight.loading ? (
        <Copy>{t('common.loading')}</Copy>
      ) : weight.error ? (
        <FormNotice tone="error">{t('progress.loadFailed')}</FormNotice>
      ) : !hasHistory ? (
        <Card>
          <Copy style={s.heading}>{t('progress.emptyTitle')}</Copy>
          <Copy style={s.caption}>{t('progress.emptyBody')}</Copy>
          <NavButton href="/weight" label={t('progress.logWeight')} />
        </Card>
      ) : (
        <>
          <Card>
            <View style={s.row}>
              <View style={s.column}>
                <Copy style={s.label}>{t('progress.currentWeight')}</Copy>
                <Copy style={s.value}>{weight.latest?.weightKg.toFixed(1)} kg</Copy>
              </View>
              {weight.goal?.starting_weight_kg != null ? (
                <View style={s.column}>
                  <Copy style={s.label}>{t('progress.startingWeight')}</Copy>
                  <Copy style={s.value}>
                    {Number(weight.goal.starting_weight_kg).toFixed(1)} kg
                  </Copy>
                </View>
              ) : null}
              {weight.goal?.target_weight_kg != null ? (
                <View style={s.column}>
                  <Copy style={s.label}>{t('progress.targetWeight')}</Copy>
                  <Copy style={s.value}>{Number(weight.goal.target_weight_kg).toFixed(1)} kg</Copy>
                </View>
              ) : null}
            </View>

            {weight.target ? (
              <Copy style={s.caption}>
                {weight.target.reached
                  ? t('progress.targetReached')
                  : t('progress.targetRemaining', { amount: weight.target.remainingKg.toFixed(1) })}
                {'  ·  '}
                {t('progress.targetProgress', {
                  percent: Math.round(weight.target.fraction * 100),
                })}
              </Copy>
            ) : (
              <Copy style={s.caption}>{t('progress.targetUnavailable')}</Copy>
            )}
          </Card>

          <Card>
            <Copy style={s.heading}>{t('progress.trend7d')}</Copy>
            {weight.trend !== null ? (
              <Copy style={s.value}>{weight.trend.toFixed(1)} kg</Copy>
            ) : (
              <Copy style={s.caption}>{t('progress.trendUnavailable')}</Copy>
            )}

            {weight.weekly ? (
              <Copy style={s.caption}>
                {weight.weekly.differenceKg === 0
                  ? t('progress.weeklyComparisonSame')
                  : t(
                      weight.weekly.differenceKg > 0
                        ? 'progress.weeklyComparisonUp'
                        : 'progress.weeklyComparisonDown',
                      { amount: Math.abs(weight.weekly.differenceKg).toFixed(1) },
                    )}
              </Copy>
            ) : (
              <Copy style={s.caption}>{t('progress.weeklyComparisonUnavailable')}</Copy>
            )}

            {weight.change ? (
              <Copy style={s.caption}>
                {t('progress.changeSinceStart', {
                  amount: weight.change.differenceKg.toFixed(1),
                  days: weight.change.days,
                })}
              </Copy>
            ) : (
              <Copy style={s.caption}>{t('progress.changeUnavailable')}</Copy>
            )}
          </Card>

          <Card onLayout={onChartLayout}>
            {chartWidth > 0 && weight.series.length >= 2 ? (
              <WeightChart series={weight.series} width={chartWidth} />
            ) : (
              <Copy style={s.caption}>{t('progress.chartUnavailable')}</Copy>
            )}
          </Card>

          <NavButton href="/weight" label={t('progress.logWeight')} />
        </>
      )}

      <Card>
        <Copy style={s.heading}>{t('progress.nutritionToday')}</Copy>
        <Metric
          label={t('fitness.proteinLabel')}
          consumed={nutrition.totals?.proteinG ?? null}
          target={nutrition.targets?.protein_g ?? null}
          unit={t('fitness.gramsUnit')}
        />
        <Metric
          label={t('hydration.today')}
          consumed={water.totals?.consumedMl ?? null}
          target={water.target?.water_ml ?? null}
          unit={t('fitness.waterUnit')}
        />
      </Card>

      <Card>
        <Copy style={s.heading}>{t('progress.workoutAdherence')}</Copy>
        {workout.loading ? (
          <Copy style={s.caption}>{t('common.loading')}</Copy>
        ) : workout.error || !workout.summary ? (
          <Copy style={s.caption}>{t('progress.workoutAdherenceUnavailable')}</Copy>
        ) : (
          <>
            <Copy style={s.value}>
              {t('progress.workoutSessionsThisWeek', { count: workout.summary.completedLast7Days })}
            </Copy>
            <Copy style={s.caption}>
              {workout.summary.lastSessionAt
                ? t('progress.workoutLastSession', {
                    date: new Intl.DateTimeFormat('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                    }).format(new Date(workout.summary.lastSessionAt)),
                  })
                : t('progress.workoutNoSession')}
            </Copy>
          </>
        )}
      </Card>

      <Copy style={s.disclaimer}>{t('progress.disclaimer')}</Copy>
    </Page>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  column: { gap: 2, minWidth: 100 },
  label: { fontSize: 12, color: theme.colors.muted },
  value: { fontSize: 22, fontWeight: '700' },
  heading: { fontSize: 18, fontWeight: '700' },
  caption: { fontSize: 12, color: theme.colors.muted, lineHeight: 18 },
  disclaimer: { fontSize: 11, color: theme.colors.muted, lineHeight: 16 },
});
