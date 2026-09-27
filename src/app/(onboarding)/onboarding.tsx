import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { ChipGroup, ChoiceGroup, PillGroup, SwitchRow } from '@/components/choice';
import { ActionButton, Field, FormNotice } from '@/components/form';
import { Card, Copy, Page } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { buildFitnessPlan } from '@/features/fitness/engine';
import { PlanSummary } from '@/features/fitness/PlanSummary';
import { buildOnboardingPayload } from '@/features/onboarding/payload';
import {
  ACTIVITY_OPTIONS,
  EMPTY_DRAFT,
  EQUIPMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  LOCATION_OPTIONS,
  MEALS_PER_DAY_OPTIONS,
  ONBOARDING_STEPS,
  RESTRICTION_OPTIONS,
  SESSION_MINUTES_OPTIONS,
  SEX_OPTIONS,
  TRAINING_DAYS_OPTIONS,
  findLabelKey,
  requiresTargetWeight,
  nextOnboardingStepIndex,
  type OnboardingDraft,
  type OnboardingStep,
} from '@/features/onboarding/model';
import { submitOnboarding } from '@/features/onboarding/submit';
import { evaluatePace, validateStep, type FieldIssues } from '@/features/onboarding/validation';
import { todayIso } from '@/lib/date';
import type { TranslationKey } from '@/lib/i18n/keys';
import { getSupabaseClient } from '@/services/supabase/client';
import { theme } from '@/theme/tokens';

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, refreshProfile } = useAuth();

  const today = useMemo(() => todayIso(), []);
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT);
  const [stepIndex, setStepIndex] = useState(0);
  const [issues, setIssues] = useState<FieldIssues>({});
  const [saveError, setSaveError] = useState<TranslationKey | null>(null);
  const [saving, setSaving] = useState(false);

  const step = ONBOARDING_STEPS[stepIndex];
  const isLast = stepIndex === ONBOARDING_STEPS.length - 1;

  const set = useCallback(<K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setIssues((current) => ({ ...current, [key]: undefined }));
  }, []);

  const toggleIn = useCallback((key: 'equipment' | 'restrictions', value: string) => {
    setDraft((current) => {
      const list = current[key];
      return {
        ...current,
        [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value],
      };
    });
  }, []);

  const pace = useMemo(() => evaluatePace(draft, today), [draft, today]);

  // O plano só existe quando o rascunho está completo. Vem do mesmo payload que
  // será gravado, para a tela nunca mostrar número diferente do que foi salvo.
  const plan = useMemo(() => {
    if (step !== 'summary' || !user) return null;
    const payload = buildOnboardingPayload(user.id, draft, today);
    if (!payload) return null;
    return {
      plan: buildFitnessPlan(payload.fitnessInput),
      targetWeightKg: payload.goal.target_weight_kg,
    };
  }, [step, user, draft, today]);

  async function onAdvance() {
    const nextIssues = validateStep(step, draft, today);
    setIssues(nextIssues);
    if (Object.keys(nextIssues).length > 0) return;

    if (!isLast) {
      // A etapa de meta não se aplica a quem não escolheu um peso-alvo.
      setStepIndex(nextOnboardingStepIndex(stepIndex, draft.goalType, 1));
      return;
    }

    const client = getSupabaseClient();
    if (!client || !user) {
      setSaveError('onboarding.error.saveFailed');
      return;
    }
    setSaving(true);
    setSaveError(null);
    const result = await submitOnboarding(client, user.id, draft, today);
    if (!result.ok) {
      setSaving(false);
      setSaveError(result.error);
      return;
    }
    // O perfil precisa ser relido antes de navegar: é ele que libera as abas.
    await refreshProfile();
    setSaving(false);
    router.replace('/');
  }

  function onBack() {
    setStepIndex(nextOnboardingStepIndex(stepIndex, draft.goalType, -1));
    setIssues({});
  }

  const titles: Record<OnboardingStep, { title: string; subtitle: string }> = {
    goal: { title: t('onboarding.goalTitle'), subtitle: t('onboarding.goalSubtitle') },
    basics: { title: t('onboarding.basicsTitle'), subtitle: t('onboarding.basicsSubtitle') },
    target: { title: t('onboarding.targetTitle'), subtitle: t('onboarding.targetSubtitle') },
    activity: { title: t('onboarding.activityTitle'), subtitle: t('onboarding.activitySubtitle') },
    training: { title: t('onboarding.trainingTitle'), subtitle: t('onboarding.trainingSubtitle') },
    nutrition: {
      title: t('onboarding.nutritionTitle'),
      subtitle: t('onboarding.nutritionSubtitle'),
    },
    summary: { title: t('onboarding.summaryTitle'), subtitle: t('onboarding.summarySubtitle') },
  };

  return (
    <Page
      quiet
      eyebrow={t('onboarding.eyebrow')}
      title={titles[step].title}
      subtitle={titles[step].subtitle}
    >
      <ProgressBar current={stepIndex + 1} total={ONBOARDING_STEPS.length} />

      <Card>
        {step === 'goal' ? (
          <ChoiceGroup
            label={t('onboarding.goalTitle')}
            error={issues.goalType ? t(issues.goalType) : null}
            options={GOAL_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
            }))}
            value={draft.goalType}
            onChange={(value) => set('goalType', value)}
          />
        ) : null}

        {step === 'basics' ? (
          <>
            <ChoiceGroup
              label={t('onboarding.sex')}
              hint={t('onboarding.sexHint')}
              error={issues.biologicalSex ? t(issues.biologicalSex) : null}
              options={SEX_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              }))}
              value={draft.biologicalSex}
              onChange={(value) => set('biologicalSex', value)}
            />
            <Field
              label={t('onboarding.birthDate')}
              placeholder={t('onboarding.birthDatePlaceholder')}
              value={draft.birthDate}
              onChangeText={(value) => set('birthDate', value)}
              error={issues.birthDate ? t(issues.birthDate) : null}
              inputMode="numeric"
              maxLength={10}
            />
            <Field
              label={t('onboarding.height')}
              value={draft.heightCm}
              onChangeText={(value) => set('heightCm', value)}
              error={issues.heightCm ? t(issues.heightCm) : null}
              inputMode="decimal"
              keyboardType="numeric"
              maxLength={5}
            />
            <Field
              label={t('onboarding.currentWeight')}
              value={draft.currentWeightKg}
              onChangeText={(value) => set('currentWeightKg', value)}
              error={issues.currentWeightKg ? t(issues.currentWeightKg) : null}
              inputMode="decimal"
              keyboardType="numeric"
              maxLength={6}
            />
          </>
        ) : null}

        {step === 'target' ? (
          <>
            <Field
              label={t('onboarding.targetWeight')}
              value={draft.targetWeightKg}
              onChangeText={(value) => set('targetWeightKg', value)}
              error={issues.targetWeightKg ? t(issues.targetWeightKg) : null}
              inputMode="decimal"
              keyboardType="numeric"
              maxLength={6}
            />
            <Field
              label={t('onboarding.targetDate')}
              hint={t('onboarding.optional')}
              placeholder={t('onboarding.birthDatePlaceholder')}
              value={draft.targetDate}
              onChangeText={(value) => set('targetDate', value)}
              error={issues.targetDate ? t(issues.targetDate) : null}
              inputMode="numeric"
              maxLength={10}
            />
            {pace.level === 'limited' ? (
              <FormNotice tone="info">{t('onboarding.paceWarningBody')}</FormNotice>
            ) : null}
          </>
        ) : null}

        {step === 'activity' ? (
          <ChoiceGroup
            label={t('onboarding.activityTitle')}
            error={issues.activityLevel ? t(issues.activityLevel) : null}
            options={ACTIVITY_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
              description: t(option.hintKey),
            }))}
            value={draft.activityLevel}
            onChange={(value) => set('activityLevel', value)}
          />
        ) : null}

        {step === 'training' ? (
          <>
            <PillGroup
              label={t('onboarding.daysPerWeek')}
              error={issues.trainingDaysPerWeek ? t(issues.trainingDaysPerWeek) : null}
              options={TRAINING_DAYS_OPTIONS.map((days) => ({ value: days, label: String(days) }))}
              value={draft.trainingDaysPerWeek}
              onChange={(value) => set('trainingDaysPerWeek', value)}
            />
            <PillGroup
              label={t('onboarding.sessionMinutes')}
              error={issues.trainingSessionMinutes ? t(issues.trainingSessionMinutes) : null}
              options={SESSION_MINUTES_OPTIONS.map((minutes) => ({
                value: minutes,
                label: String(minutes),
              }))}
              value={draft.trainingSessionMinutes}
              onChange={(value) => set('trainingSessionMinutes', value)}
            />
            <ChoiceGroup
              label={t('onboarding.location')}
              error={issues.trainingLocation ? t(issues.trainingLocation) : null}
              options={LOCATION_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              }))}
              value={draft.trainingLocation}
              onChange={(value) => set('trainingLocation', value)}
            />
            <ChipGroup
              label={t('onboarding.equipment')}
              hint={t('onboarding.optional')}
              options={EQUIPMENT_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              }))}
              values={draft.equipment}
              onToggle={(value) => toggleIn('equipment', value)}
            />
            <ChoiceGroup
              label={t('onboarding.experience')}
              error={issues.fitnessExperience ? t(issues.fitnessExperience) : null}
              options={EXPERIENCE_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              }))}
              value={draft.fitnessExperience}
              onChange={(value) => set('fitnessExperience', value)}
            />
          </>
        ) : null}

        {step === 'nutrition' ? (
          <>
            <PillGroup
              label={t('onboarding.mealsPerDay')}
              hint={t('onboarding.optional')}
              options={MEALS_PER_DAY_OPTIONS.map((meals) => ({
                value: meals,
                label: String(meals),
              }))}
              value={draft.mealsPerDay}
              onChange={(value) => set('mealsPerDay', value)}
            />
            <View style={s.switches}>
              <Copy style={s.sectionLabel}>{t('onboarding.dietTitle')}</Copy>
              <SwitchRow
                label={t('onboarding.vegetarian')}
                value={draft.vegetarian}
                onChange={(value) => set('vegetarian', value)}
              />
              <SwitchRow
                label={t('onboarding.vegan')}
                value={draft.vegan}
                onChange={(value) => {
                  // Vegano implica vegetariano, como o CHECK do banco exige.
                  setDraft((current) => ({
                    ...current,
                    vegan: value,
                    vegetarian: value ? true : current.vegetarian,
                  }));
                }}
              />
            </View>
            <ChipGroup
              label={t('onboarding.restrictions')}
              hint={t('onboarding.optional')}
              options={RESTRICTION_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              }))}
              values={draft.restrictions}
              onToggle={(value) => toggleIn('restrictions', value)}
            />
            <Field
              label={t('onboarding.notes')}
              hint={t('onboarding.optional')}
              placeholder={t('onboarding.notesPlaceholder')}
              value={draft.nutritionNotes}
              onChangeText={(value) => set('nutritionNotes', value)}
              error={issues.nutritionNotes ? t(issues.nutritionNotes) : null}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
          </>
        ) : null}

        {step === 'summary' ? <Summary draft={draft} /> : null}

        {saveError ? <FormNotice tone="error">{t(saveError)}</FormNotice> : null}
      </Card>

      {step === 'summary' && plan ? (
        <>
          <View style={s.planHeading}>
            <Text accessibilityRole="header" style={s.planTitle}>
              {t('onboarding.planTitle')}
            </Text>
            <Copy style={s.wellness}>{t('onboarding.planSubtitle')}</Copy>
          </View>
          <PlanSummary plan={plan.plan} />
          <Copy style={s.wellness}>{t('onboarding.wellness')}</Copy>
        </>
      ) : null}

      <View style={s.actions}>
        {stepIndex > 0 ? (
          <ActionButton
            label={t('onboarding.back')}
            tone="quiet"
            onPress={onBack}
            disabled={saving}
          />
        ) : null}
        <ActionButton
          label={
            isLast
              ? t(
                  plan?.plan.status === 'ready'
                    ? 'onboarding.acceptPlan'
                    : 'onboarding.continueWithoutPlan',
                )
              : t('onboarding.next')
          }
          onPress={() => void onAdvance()}
          loading={saving}
        />
      </View>
    </Page>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const { t } = useTranslation();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: current }}
      style={s.progress}
    >
      <Copy style={s.progressLabel}>{t('onboarding.stepOf', { current, total })}</Copy>
      <View style={s.track}>
        <View style={[s.fill, { width: `${(current / total) * 100}%` }]} />
      </View>
    </View>
  );
}

function Summary({ draft }: { draft: OnboardingDraft }) {
  const { t } = useTranslation();
  const none = t('onboarding.summaryNone');

  const goalKey = findLabelKey(GOAL_OPTIONS, draft.goalType);
  const activityKey = findLabelKey(ACTIVITY_OPTIONS, draft.activityLevel);

  const rows: { label: string; value: string }[] = [
    {
      label: t('onboarding.summaryGoal'),
      value: goalKey ? t(goalKey) : none,
    },
    {
      label: t('onboarding.summaryBody'),
      value: `${draft.heightCm} cm · ${draft.currentWeightKg} kg`,
    },
    {
      label: t('onboarding.summaryTarget'),
      value: requiresTargetWeight(draft.goalType)
        ? `${draft.targetWeightKg} kg · ${draft.targetDate.trim() || t('onboarding.summaryTargetOpen')}`
        : none,
    },
    {
      label: t('onboarding.summaryActivity'),
      value: activityKey ? t(activityKey) : none,
    },
    {
      label: t('onboarding.summaryTraining'),
      value: t('onboarding.summaryDaysValue', {
        days: draft.trainingDaysPerWeek ?? 0,
        minutes: draft.trainingSessionMinutes ?? 0,
      }),
    },
    {
      label: t('onboarding.summaryNutrition'),
      value:
        [
          draft.mealsPerDay ? `${draft.mealsPerDay}x` : null,
          draft.vegan
            ? t('onboarding.vegan')
            : draft.vegetarian
              ? t('onboarding.vegetarian')
              : null,
          ...draft.restrictions.map((item) => {
            const key = findLabelKey(RESTRICTION_OPTIONS, item);
            return key ? t(key) : item;
          }),
        ]
          .filter(Boolean)
          .join(' · ') || none,
    },
  ];

  return (
    <View style={s.summary}>
      {rows.map((row) => (
        <View key={row.label} style={s.summaryRow}>
          <Copy style={s.summaryLabel}>{row.label}</Copy>
          <Copy style={s.summaryValue}>{row.value}</Copy>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  progress: { gap: 8 },
  progressLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: '600' },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.line,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: 3, backgroundColor: theme.colors.primary },
  actions: { flexDirection: 'row-reverse', gap: 12, flexWrap: 'wrap' },
  switches: { gap: 4 },
  sectionLabel: { fontSize: 13, fontWeight: '700' },
  planHeading: { gap: 6, paddingTop: 4 },
  planTitle: { fontSize: 22, fontWeight: '700', color: theme.colors.ink, letterSpacing: -0.6 },
  summary: { gap: 14 },
  summaryRow: { gap: 2 },
  summaryLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: '700' },
  summaryValue: { fontSize: 15 },
  wellness: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
});
