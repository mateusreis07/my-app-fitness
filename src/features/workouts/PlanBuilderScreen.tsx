import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet } from 'react-native';
import { ActionButton, Field, FormNotice } from '@/components/form';
import { Card, Copy, NavButton, Page } from '@/components/ui';
import { useDashboard } from '@/features/dashboard/useDashboard';
import { theme } from '@/theme/tokens';
import type { SelectableExercise } from './model';
import { useWorkoutCatalog } from './useWorkoutCatalog';
import { useWorkoutPlans } from './useWorkoutPlans';

const DEFAULT_TARGET_SETS = 3;
const DEFAULT_MIN_REPS = 8;
const DEFAULT_MAX_REPS = 12;
const DEFAULT_REST_SECONDS = 90;

export function PlanBuilderScreen() {
  const { t } = useTranslation();
  const {
    plan,
    loading,
    busy,
    createPlan,
    removePlan,
    addDay,
    removeDay,
    addExercise,
    removeExercise,
  } = useWorkoutPlans();
  const { exercises } = useWorkoutCatalog();
  const { snapshot } = useDashboard();
  const suggestedDays =
    snapshot?.training.status === 'ready' ? (snapshot.training.data?.days_per_week ?? null) : null;

  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [formError, setFormError] = useState(false);

  const [dayName, setDayName] = useState('');
  const [openDayId, setOpenDayId] = useState<string | null>(null);
  const [term, setTerm] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<SelectableExercise | null>(null);
  const [targetSets, setTargetSets] = useState(String(DEFAULT_TARGET_SETS));
  const [minReps, setMinReps] = useState(String(DEFAULT_MIN_REPS));
  const [maxReps, setMaxReps] = useState(String(DEFAULT_MAX_REPS));
  const [restSeconds, setRestSeconds] = useState(String(DEFAULT_REST_SECONDS));
  const [exerciseError, setExerciseError] = useState(false);

  const filteredExercises = term.trim()
    ? exercises.filter((exercise) =>
        exercise.name.toLowerCase().includes(term.trim().toLowerCase()),
      )
    : exercises.slice(0, 20);

  async function onCreatePlan() {
    const ok = await createPlan({
      name,
      goal: goal.trim() || null,
      daysPerWeek: suggestedDays,
    });
    setFormError(!ok);
    if (ok) {
      setName('');
      setGoal('');
    }
  }

  async function onAddDay() {
    const ok = await addDay(dayName);
    if (ok) setDayName('');
  }

  async function onAddExercise(dayId: string) {
    const parsedSets = Number(targetSets);
    const parsedMin = Number(minReps);
    const parsedMax = Number(maxReps);
    const parsedRest = Number(restSeconds);
    if (!selectedExercise) {
      setExerciseError(true);
      return;
    }
    const ok = await addExercise(dayId, {
      exercise: selectedExercise,
      targetSets: parsedSets,
      minReps: parsedMin,
      maxReps: parsedMax,
      restSeconds: parsedRest,
    });
    setExerciseError(!ok);
    if (ok) {
      setSelectedExercise(null);
      setTerm('');
      setTargetSets(String(DEFAULT_TARGET_SETS));
      setMinReps(String(DEFAULT_MIN_REPS));
      setMaxReps(String(DEFAULT_MAX_REPS));
      setRestSeconds(String(DEFAULT_REST_SECONDS));
    }
  }

  return (
    <Page
      quiet
      eyebrow={t('workouts.title')}
      title={t('workouts.plan.title')}
      subtitle={t('workouts.plan.subtitle')}
    >
      {loading ? (
        <Copy>{t('common.loading')}</Copy>
      ) : !plan ? (
        <Card>
          <Field label={t('workouts.plan.name')} value={name} onChangeText={setName} />
          <Field
            label={t('workouts.plan.goal')}
            value={goal}
            onChangeText={setGoal}
            placeholder={t('workouts.plan.goalPlaceholder')}
          />
          {suggestedDays ? (
            <Copy style={s.caption}>
              {t('workouts.plan.suggestedDays', { count: suggestedDays })}
            </Copy>
          ) : null}
          {formError ? <FormNotice tone="error">{t('workouts.plan.saveFailed')}</FormNotice> : null}
          <ActionButton
            label={t('workouts.plan.create')}
            onPress={() => void onCreatePlan()}
            loading={busy}
            disabled={name.trim().length === 0}
          />
        </Card>
      ) : (
        <>
          <Card>
            <Copy style={s.heading}>{plan.plan.name}</Copy>
            <Field label={t('workouts.plan.addDay')} value={dayName} onChangeText={setDayName} />
            <ActionButton
              label={t('workouts.plan.addDayConfirm')}
              onPress={() => void onAddDay()}
              loading={busy}
              disabled={dayName.trim().length === 0}
            />
          </Card>

          {plan.days.map((day) => (
            <Card key={day.id}>
              <View style={s.row}>
                <Copy style={s.heading}>{day.name}</Copy>
                <ActionButton
                  label={t('workouts.plan.removeDay')}
                  tone="quiet"
                  onPress={() => void removeDay(day.id)}
                />
              </View>
              {day.exercises.map((exercise) => (
                <View key={exercise.id} style={s.exerciseRow}>
                  <Copy>{exercise.name_snapshot}</Copy>
                  <Copy style={s.caption}>
                    {t('workouts.plan.exerciseDetail', {
                      sets: exercise.target_sets,
                      min: exercise.min_reps,
                      max: exercise.max_reps,
                      rest: exercise.rest_seconds,
                    })}
                  </Copy>
                  <ActionButton
                    label={t('workouts.plan.removeExercise')}
                    tone="quiet"
                    onPress={() => void removeExercise(exercise.id)}
                  />
                </View>
              ))}

              {openDayId === day.id ? (
                <View style={s.form}>
                  <Field
                    label={t('workouts.plan.searchExercise')}
                    value={term}
                    onChangeText={(value) => {
                      setTerm(value);
                      setSelectedExercise(null);
                    }}
                  />
                  {selectedExercise ? (
                    <Copy style={s.caption}>
                      {t('workouts.plan.selected', { name: selectedExercise.name })}
                    </Copy>
                  ) : (
                    <View style={s.chips}>
                      {filteredExercises.map((exercise) => (
                        <ActionButton
                          key={`${exercise.origin}:${exercise.id}`}
                          label={exercise.name}
                          tone="quiet"
                          onPress={() => setSelectedExercise(exercise)}
                        />
                      ))}
                    </View>
                  )}
                  <Field
                    label={t('workouts.plan.targetSets')}
                    value={targetSets}
                    onChangeText={setTargetSets}
                    keyboardType="number-pad"
                  />
                  <Field
                    label={t('workouts.plan.minReps')}
                    value={minReps}
                    onChangeText={setMinReps}
                    keyboardType="number-pad"
                  />
                  <Field
                    label={t('workouts.plan.maxReps')}
                    value={maxReps}
                    onChangeText={setMaxReps}
                    keyboardType="number-pad"
                  />
                  <Field
                    label={t('workouts.plan.restSeconds')}
                    value={restSeconds}
                    onChangeText={setRestSeconds}
                    keyboardType="number-pad"
                  />
                  {exerciseError ? (
                    <FormNotice tone="error">{t('workouts.plan.exerciseSaveFailed')}</FormNotice>
                  ) : null}
                  <View style={s.row}>
                    <ActionButton
                      label={t('workouts.plan.addExerciseConfirm')}
                      onPress={() => void onAddExercise(day.id)}
                      loading={busy}
                    />
                    <ActionButton
                      label={t('workouts.plan.cancel')}
                      tone="quiet"
                      onPress={() => setOpenDayId(null)}
                    />
                  </View>
                </View>
              ) : (
                <ActionButton
                  label={t('workouts.plan.addExercise')}
                  tone="quiet"
                  onPress={() => setOpenDayId(day.id)}
                />
              )}
            </Card>
          ))}

          <Card>
            <ActionButton
              label={t('workouts.plan.removePlan')}
              tone="quiet"
              onPress={() => void removePlan()}
              loading={busy}
            />
          </Card>
        </>
      )}
      <NavButton href="/workouts" label={t('common.backHome')} />
    </Page>
  );
}

const s = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: '700' },
  caption: { fontSize: 12, color: theme.colors.muted },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'center' },
  exerciseRow: { gap: 4, borderTopWidth: 1, borderTopColor: theme.colors.line, paddingTop: 10 },
  form: { gap: 10, borderTopWidth: 1, borderTopColor: theme.colors.line, paddingTop: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
