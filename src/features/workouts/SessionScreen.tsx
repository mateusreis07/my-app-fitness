import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet } from 'react-native';
import { ActionButton, Field, FormNotice } from '@/components/form';
import { Card, Copy, Page } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { getSupabaseClient } from '@/services/supabase/client';
import { theme } from '@/theme/tokens';
import { progressionSignal } from './progression';
import { loadExerciseHistory } from './repository';
import { ADD_SECONDS, useRestTimer } from './useRestTimer';
import { useWorkoutPlans } from './useWorkoutPlans';
import { useWorkoutSession } from './useWorkoutSession';

export function SessionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ dayId?: string; sessionId?: string }>();
  const { plan } = useWorkoutPlans();
  const session = useWorkoutSession();
  const timer = useRestTimer();

  const [activeIndex, setActiveIndex] = useState(0);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [signal, setSignal] = useState<'increase_load' | null>(null);

  const day = plan?.days.find((candidate) => candidate.id === params.dayId) ?? null;

  const currentExercise = session.session?.exercises[activeIndex] ?? null;
  const currentDayExercise = day?.exercises.find(
    (exercise) =>
      exercise.exercise_id === currentExercise?.exercise_id &&
      exercise.user_exercise_id === currentExercise?.user_exercise_id,
  );
  const currentSets = currentExercise ? (session.sets[currentExercise.id] ?? []) : [];
  const previousSet = currentSets.at(-1) ?? null;

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !user || !currentExercise) return;
    let active = true;
    void loadExerciseHistory(client, user.id, {
      exerciseId: currentExercise.exercise_id,
      userExerciseId: currentExercise.user_exercise_id,
    }).then((result) => {
      if (!active) return;
      const maxReps = currentDayExercise?.max_reps ?? null;
      setSignal(result.ok && maxReps ? progressionSignal(result.data, maxReps) : null);
    });
    return () => {
      active = false;
    };
  }, [currentExercise, currentDayExercise, user]);

  async function onLogSet() {
    if (!currentExercise) return;
    const parsedWeight = weight.trim() ? Number(weight.replace(',', '.')) : null;
    const parsedReps = Number(reps);
    const ok = await session.logSet({
      sessionExerciseId: currentExercise.id,
      setNumber: currentSets.length + 1,
      weightKg: parsedWeight,
      reps: parsedReps,
    });
    if (ok) {
      setReps('');
      const restSeconds = currentDayExercise?.rest_seconds ?? 90;
      timer.start(restSeconds);
    }
  }

  async function onFinish() {
    if (!session.session) return;
    const ok = await session.finish(session.session.session.started_at);
    if (ok) router.replace('/workouts');
  }

  if (session.loading)
    return (
      <Page title={t('workouts.session.title')} subtitle={t('workouts.session.subtitle')}>
        <Copy>{t('common.loading')}</Copy>
      </Page>
    );

  if (!session.session)
    return (
      <Page title={t('workouts.session.title')} subtitle={t('workouts.session.subtitle')}>
        <Card>
          {day ? (
            <>
              <Copy style={s.heading}>{day.name}</Copy>
              <Copy style={s.caption}>
                {t('workouts.exerciseCount', { count: day.exercises.length })}
              </Copy>
              <ActionButton
                label={t('workouts.session.begin')}
                onPress={() => void session.start(day)}
                loading={session.busy}
              />
            </>
          ) : (
            <Copy>{t('workouts.session.noExercises')}</Copy>
          )}
        </Card>
      </Page>
    );

  return (
    <Page
      quiet
      eyebrow={t('workouts.title')}
      title={t('workouts.session.title')}
      subtitle={t('workouts.session.subtitle')}
    >
      <Card>
        <View style={s.chips}>
          {session.session.exercises.map((exercise, index) => (
            <ActionButton
              key={exercise.id}
              label={exercise.name_snapshot}
              tone={index === activeIndex ? 'primary' : 'quiet'}
              onPress={() => setActiveIndex(index)}
            />
          ))}
        </View>
      </Card>

      {currentExercise ? (
        <Card>
          <Copy style={s.heading}>{currentExercise.name_snapshot}</Copy>
          {currentDayExercise ? (
            <Copy style={s.caption}>
              {t('workouts.session.target', {
                sets: currentDayExercise.target_sets,
                min: currentDayExercise.min_reps,
                max: currentDayExercise.max_reps,
              })}
            </Copy>
          ) : null}
          {previousSet ? (
            <Copy style={s.caption}>
              {t('workouts.session.previousSet', {
                number: previousSet.set_number,
                weight: previousSet.weight_kg ?? '—',
                reps: previousSet.reps,
              })}
            </Copy>
          ) : null}
          {signal === 'increase_load' ? (
            <FormNotice tone="info">{t('workouts.session.increaseLoad')}</FormNotice>
          ) : null}

          {currentSets.map((set) => (
            <Copy key={set.id} style={s.caption}>
              {t('workouts.session.setEntry', {
                number: set.set_number,
                weight: set.weight_kg ?? '—',
                reps: set.reps,
              })}
            </Copy>
          ))}

          <Field
            label={t('workouts.session.weight')}
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
          />
          <Field
            label={t('workouts.session.reps')}
            value={reps}
            onChangeText={setReps}
            keyboardType="number-pad"
          />
          <ActionButton
            label={t('workouts.session.logSet')}
            onPress={() => void onLogSet()}
            loading={session.busy}
            disabled={reps.trim().length === 0}
          />
          {session.feedback === 'saveFailed' ? (
            <FormNotice tone="error">{t('workouts.session.saveFailed')}</FormNotice>
          ) : null}
          {session.pending ? (
            <View style={s.row}>
              <ActionButton
                label={t('workouts.session.retrySave')}
                onPress={() => void onLogSet()}
                loading={session.busy}
              />
              <ActionButton
                label={t('workouts.session.dismiss')}
                tone="quiet"
                onPress={session.clearPending}
              />
            </View>
          ) : null}

          {timer.running ? (
            <Card>
              <Copy style={s.heading}>
                {t('workouts.session.rest', { seconds: timer.remaining })}
              </Copy>
              <View style={s.row}>
                <ActionButton
                  label={t('workouts.session.addRest', { seconds: ADD_SECONDS })}
                  tone="quiet"
                  onPress={() => timer.addSeconds(ADD_SECONDS)}
                />
                <ActionButton
                  label={t('workouts.session.skipRest')}
                  tone="quiet"
                  onPress={timer.skip}
                />
              </View>
            </Card>
          ) : null}
        </Card>
      ) : null}

      <View style={s.row}>
        <ActionButton
          label={t('workouts.session.finish')}
          onPress={() => void onFinish()}
          loading={session.busy}
        />
        <ActionButton
          label={t('workouts.session.abandon')}
          tone="quiet"
          onPress={() => {
            void session.abandon();
            router.replace('/workouts');
          }}
        />
      </View>
    </Page>
  );
}

const s = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: '700' },
  caption: { fontSize: 12, color: theme.colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
});
