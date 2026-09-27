import { useTranslation } from 'react-i18next';
import { View, StyleSheet } from 'react-native';
import { ActionButton } from '@/components/form';
import { Card, Copy, NavButton, Page } from '@/components/ui';
import { theme } from '@/theme/tokens';
import { useWorkoutPlans } from './useWorkoutPlans';
import { useWorkoutSession } from './useWorkoutSession';

export function WorkoutsScreen() {
  const { t } = useTranslation();
  const { plan, loading, error, reload } = useWorkoutPlans();
  const session = useWorkoutSession();

  return (
    <Page title={t('workouts.title')} subtitle={t('workouts.subtitle')}>
      <NavButton href="/" label={t('common.backHome')} />
      <ActionButton
        label={t('dashboard.refresh')}
        onPress={() => void reload()}
        loading={loading}
        tone="quiet"
      />

      {session.session ? (
        <Card>
          <Copy style={s.heading}>{t('workouts.resumeTitle')}</Copy>
          <Copy>{session.session.session.day_name_snapshot ?? t('workouts.freeSession')}</Copy>
          <NavButton
            href={`/workout-session?sessionId=${session.session.session.id}`}
            label={t('workouts.resume')}
          />
        </Card>
      ) : null}

      {loading ? (
        <Copy>{t('common.loading')}</Copy>
      ) : error ? (
        <Card>
          <Copy>{t('workouts.loadFailed')}</Copy>
        </Card>
      ) : !plan ? (
        <Card>
          <Copy style={s.heading}>{t('workouts.emptyTitle')}</Copy>
          <Copy style={s.caption}>{t('workouts.emptyBody')}</Copy>
          <NavButton href="/plan-builder" label={t('workouts.createPlan')} />
        </Card>
      ) : (
        <Card>
          <Copy style={s.heading}>{plan.plan.name}</Copy>
          {plan.plan.goal ? <Copy style={s.caption}>{plan.plan.goal}</Copy> : null}
          {plan.days.length === 0 ? (
            <Copy style={s.caption}>{t('workouts.noDays')}</Copy>
          ) : (
            plan.days.map((day) => (
              <View key={day.id} style={s.day}>
                <Copy style={s.dayName}>{day.name}</Copy>
                <Copy style={s.caption}>
                  {t('workouts.exerciseCount', { count: day.exercises.length })}
                </Copy>
                {!session.session && day.exercises.length > 0 ? (
                  <NavButton
                    href={`/workout-session?dayId=${day.id}`}
                    label={t('workouts.start')}
                  />
                ) : null}
              </View>
            ))
          )}
          <NavButton href="/plan-builder" label={t('workouts.editPlan')} />
        </Card>
      )}
    </Page>
  );
}

const s = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: '700' },
  caption: { fontSize: 12, color: theme.colors.muted },
  day: { gap: 8, borderTopWidth: 1, borderTopColor: theme.colors.line, paddingTop: 14 },
  dayName: { fontSize: 15, fontWeight: '600' },
});
