import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { FormNotice } from '@/components/form';
import { Card, Copy } from '@/components/ui';
import { theme } from '@/theme/tokens';
import type { FitnessPlan } from './engine';

/** A interface exibe o resultado do motor, inclusive a ausência de meta automática. */
export function PlanSummary({ plan }: { plan: FitnessPlan }) {
  const { t } = useTranslation();
  if (plan.status === 'unavailable')
    return (
      <Card style={s.bmi}>
        <Copy style={s.bmiValue}>{t('fitness.noTargetsTitle')}</Copy>
        <Copy>{t(`fitness.unavailable.${plan.reason}`)}</Copy>
        <Copy style={s.caption}>{t('fitness.continueWithoutTargets')}</Copy>
      </Card>
    );

  const macros = [
    { label: t('fitness.proteinLabel'), value: plan.proteinG, unit: t('fitness.gramsUnit') },
    { label: t('fitness.carbsLabel'), value: plan.carbsG, unit: t('fitness.gramsUnit') },
    { label: t('fitness.fatLabel'), value: plan.fatG, unit: t('fitness.gramsUnit') },
    { label: t('fitness.waterLabel'), value: plan.waterMl, unit: t('fitness.waterUnit') },
  ];

  return (
    <View style={s.wrapper}>
      <Card style={s.headline}>
        <Copy style={s.headlineLabel}>{t('fitness.caloriesLabel')}</Copy>
        <View style={s.headlineValueRow}>
          <Text accessibilityRole="header" style={s.headlineValue}>
            {plan.calories}
          </Text>
          <Copy style={s.headlineUnit}>{t('fitness.caloriesUnit')}</Copy>
        </View>
        <Copy style={s.basis}>{t('fitness.basis', { bmr: plan.bmr, tdee: plan.tdee })}</Copy>
      </Card>

      <View style={s.grid}>
        {macros.map((macro) => (
          <Card key={macro.label} style={s.tile}>
            <Copy style={s.tileLabel}>{macro.label}</Copy>
            <View style={s.tileValueRow}>
              <Copy style={s.tileValue}>{macro.value}</Copy>
              <Copy style={s.tileUnit}>{macro.unit}</Copy>
            </View>
          </Card>
        ))}
      </View>

      <Card style={s.bmi}>
        <View style={s.bmiRow}>
          <Copy style={s.tileLabel}>{t('fitness.bmiLabel')}</Copy>
          <Copy style={s.bmiValue}>
            {plan.bmi} · {t(`fitness.bmiCategory.${plan.bmiCategory}`)}
          </Copy>
        </View>
        <Copy style={s.caption}>{t('fitness.bmiReference')}</Copy>
      </Card>

      {plan.limitedByAutomation && plan.requestedDate ? (
        <FormNotice>{t('fitness.deadlineLimited')}</FormNotice>
      ) : null}
      {plan.clampedByAutomationFloor ? <FormNotice>{t('fitness.floorNotice')}</FormNotice> : null}
      {plan.goalType === 'gain_muscle' ? (
        <Copy style={s.caption}>{t('fitness.gainNotice')}</Copy>
      ) : null}
      {plan.requestedDate ? <Copy style={s.caption}>{t('fitness.deadlineEstimate')}</Copy> : null}

      <Copy style={s.caption}>{t('fitness.estimateNotice')}</Copy>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { gap: 12 },
  headline: { gap: 6, backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  headlineLabel: {
    color: theme.colors.onPrimaryMuted,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  headlineValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  headlineValue: {
    color: theme.colors.lime,
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '800',
    letterSpacing: -1.5,
  },
  headlineUnit: { color: theme.colors.onPrimaryMuted, fontSize: 14, fontWeight: '600' },
  basis: { color: theme.colors.onPrimaryMuted, fontSize: 12, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexGrow: 1, flexBasis: 150, gap: 6, padding: 18 },
  tileLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: '700' },
  tileValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  tileValue: { fontSize: 24, fontWeight: '700', color: theme.colors.ink },
  tileUnit: { color: theme.colors.muted, fontSize: 13 },
  bmi: { gap: 8, padding: 18 },
  bmiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  bmiValue: { fontSize: 15, fontWeight: '700', color: theme.colors.primary },
  caption: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
});
