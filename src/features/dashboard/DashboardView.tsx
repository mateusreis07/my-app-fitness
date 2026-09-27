import Feather from '@expo/vector-icons/Feather';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Copy, IconTile, NavButton, type IconName } from '@/components/ui';
import { WATER_SHORTCUTS } from '@/features/hydration/model';
import { ActionButton, FormNotice } from '@/components/form';
import { theme } from '@/theme/tokens';
import { formatDashboardDate, dashboardClock } from './calendar';
import {
  avatarInitials,
  metricProgress,
  DASHBOARD_CAPABILITIES,
  EMPTY_DAILY_SIGNALS,
  type DashboardSnapshot,
  type DailySignals,
  type DashboardCapabilities,
  selectDailySignals,
} from './model';
import { buildPriorities, type Priority } from './priorities';
import { scoreStatusKey } from '@/features/score/model';

const number = (value: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);

type Props = {
  name: string | null;
  now: Date;
  timeZone: string;
  snapshot: DashboardSnapshot | null;
  refreshing: boolean;
  onRefresh: () => void;
  onWaterAdd?: (amount: number) => void;
  waterBusy?: boolean;
  waterError?: boolean;
  waterFeedback?: 'saved' | 'removed' | 'saveFailed' | 'removeFailed' | null;
  onWaterRetry?: () => void;
  /** Média móvel de 7 dias; `null` quando ainda não há dado suficiente. */
  weightTrend?: number | null;
  /** Score de hoje, calculado ao vivo. `null` sem meta vigente; `undefined` enquanto carrega. */
  todayScore?: number | null;
  /** Média dos últimos 7 dias fechados; `null` sem dado suficiente. */
  scoreAverage7d?: number | null;
  signals?: DailySignals;
  capabilities?: DashboardCapabilities;
  onPriority?: (destination: Priority['destination']) => void;
};

/** Apresentação do dashboard. Nenhuma fórmula fitness ou leitura do banco nesta camada. */
export function DashboardView({
  name,
  now,
  timeZone,
  snapshot,
  refreshing,
  onRefresh,
  signals = EMPTY_DAILY_SIGNALS,
  capabilities = DASHBOARD_CAPABILITIES,
  onPriority,
  onWaterAdd,
  waterBusy = false,
  waterError = false,
  waterFeedback,
  onWaterRetry,
  weightTrend,
  todayScore,
  scoreAverage7d,
}: Props) {
  const { t } = useTranslation();
  const wide = useWindowDimensions().width >= 760;
  const clock = dashboardClock(now, timeZone);
  const targets = snapshot?.targets.status === 'ready' ? snapshot.targets.data : null;
  const weight = snapshot?.weight.status === 'ready' ? snapshot.weight.data : null;
  const training = snapshot?.training.status === 'ready' ? snapshot.training.data : null;
  const goal = snapshot?.goal.status === 'ready' ? snapshot.goal.data : null;
  const initials = avatarInitials(name);
  const targetsError = snapshot?.targets.status === 'error';
  const daily = selectDailySignals(signals, clock.dayKey);
  const energyProgress = metricProgress(
    daily.nutrition?.calories ?? null,
    targets?.calories ?? null,
  );
  const priorities = buildPriorities({
    dayKey: clock.dayKey,
    minuteOfDay: clock.minuteOfDay,
    targets,
    signals: daily,
    capabilities: onPriority ? capabilities : DASHBOARD_CAPABILITIES,
    weight: {
      known: snapshot?.weight.status === 'ready',
      lastDay: weight ? dashboardClock(new Date(weight.recorded_at), timeZone).dayKey : null,
    },
  });
  const hasError =
    snapshot &&
    [snapshot.targets, snapshot.weight, snapshot.training, snapshot.goal].some(
      (resource) => resource.status === 'error',
    );
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        <View style={s.content}>
          <View style={s.top}>
            <Text style={s.brand}>
              {t('common.brand')}
              <Text style={s.dot}>.</Text>
            </Text>
            <Link href="/profile" asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t('dashboard.openProfile')}
                style={s.avatar}
              >
                {initials ? (
                  <Copy style={s.initials}>{initials}</Copy>
                ) : (
                  <Feather name="user" size={22} color={theme.colors.primary} accessible={false} />
                )}
              </Pressable>
            </Link>
          </View>
          <View style={s.heading}>
            <Copy style={s.date}>{formatDashboardDate(now, timeZone, true)}</Copy>
            <Text accessibilityRole="header" style={s.title}>
              {t(`dashboard.greeting.${clock.greeting}`)}
              {name?.trim() ? t('dashboard.nameSuffix', { name: name.trim() }) : ''}
            </Text>
            <Copy style={s.muted}>{t('dashboard.subtitle')}</Copy>
          </View>
          <View style={s.toolbar}>
            <Copy style={s.sectionTitle}>{t('dashboard.overview')}</Copy>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.refresh')}
              accessibilityState={{ disabled: refreshing }}
              disabled={refreshing}
              onPress={onRefresh}
              style={s.refresh}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Feather
                  name="refresh-cw"
                  size={17}
                  color={theme.colors.primary}
                  accessible={false}
                />
              )}
              <Copy style={s.link}>{t('dashboard.refresh')}</Copy>
            </Pressable>
          </View>
          {!snapshot ? (
            <Card accessibilityLiveRegion="polite" style={s.loading}>
              <ActivityIndicator color={theme.colors.primary} />
              <Copy>{t('dashboard.loading')}</Copy>
            </Card>
          ) : (
            <>
              {hasError ? (
                <View accessibilityRole="alert" style={s.error}>
                  <Copy>{t('dashboard.partialError')}</Copy>
                  <ActionButton
                    label={t('dashboard.retry')}
                    onPress={onRefresh}
                    disabled={refreshing}
                    tone="quiet"
                  />
                </View>
              ) : null}
              {goal ? (
                <Copy style={s.goal}>
                  {t('dashboard.goal', { goal: t(`onboarding.goal.${goal.goal_type}`) })}
                </Copy>
              ) : null}
              {!targets && !targetsError ? (
                <Card style={s.noTargets}>
                  <IconTile name="compass" />
                  <View style={s.flex}>
                    <Copy style={s.cardTitle}>{t('fitness.noTargetsTitle')}</Copy>
                    <Copy style={s.muted}>{t('fitness.noTargetsBody')}</Copy>
                  </View>
                </Card>
              ) : null}
              {/* Seção 88: o KORA Score é o primeiro elemento visual da tela Hoje, acima até das prioridades. */}
              <Card style={s.score}>
                <View style={s.cardTop}>
                  <Copy style={s.scoreTitle}>{t('dashboard.score')}</Copy>
                  <NavButton href="/score" label={t('dashboard.openScore')} light />
                </View>
                {todayScore === undefined ? (
                  <Copy style={s.light}>{t('common.loading')}</Copy>
                ) : todayScore === null ? (
                  <Copy style={s.light}>{t('dashboard.scoreUnavailable')}</Copy>
                ) : (
                  <>
                    <Copy style={s.scoreValue}>{todayScore}</Copy>
                    <Copy style={s.light}>{t(scoreStatusKey(todayScore))}</Copy>
                    {scoreAverage7d != null ? (
                      <Copy style={s.lightSmall}>
                        {t('dashboard.scoreComparison', { average: scoreAverage7d })}
                      </Copy>
                    ) : null}
                  </>
                )}
              </Card>
              <View style={[s.row, wide && s.horizontal]}>
                <View style={s.flex}>
                  <Card style={s.energy}>
                    <View style={s.cardTop}>
                      <Copy style={s.energyLabel}>{t('dashboard.energy')}</Copy>
                      <Feather name="zap" size={23} color={theme.colors.lime} accessible={false} />
                    </View>
                    {targetsError ? (
                      <Copy style={s.light}>{t('dashboard.targetsError')}</Copy>
                    ) : (
                      <>
                        <View style={s.energyNumbers}>
                          <Text style={s.energyValue}>
                            {daily.nutrition
                              ? number(daily.nutrition.calories)
                              : t('dashboard.unknown')}
                          </Text>
                          <Copy style={s.light}>
                            {t('dashboard.energyTarget', {
                              target: targets ? number(targets.calories) : t('dashboard.unknown'),
                            })}
                          </Copy>
                        </View>
                        <Copy style={s.light}>{t('dashboard.consumedTarget')}</Copy>
                        <View style={s.energyDivider} />
                        <Copy style={s.light}>
                          {energyProgress
                            ? t(
                                energyProgress.over > 0
                                  ? 'dashboard.energyOver'
                                  : 'dashboard.energyRemaining',
                                {
                                  amount: number(
                                    energyProgress.over > 0
                                      ? energyProgress.over
                                      : energyProgress.remaining,
                                  ),
                                },
                              )
                            : t('dashboard.remainingUnknown')}
                        </Copy>
                        {!daily.nutrition ? (
                          <Copy style={s.lightSmall}>
                            {t(
                              targets
                                ? 'dashboard.nutritionPending'
                                : 'dashboard.nutritionNoTarget',
                            )}
                          </Copy>
                        ) : null}
                      </>
                    )}
                    <NavButton href="/nutrition" label={t('dashboard.openNutrition')} light />
                  </Card>
                </View>
                <Card style={s.flex}>
                  <SectionTitle icon="pie-chart" title={t('dashboard.macros')} />
                  {targetsError ? (
                    <Copy style={s.muted}>{t('dashboard.targetsError')}</Copy>
                  ) : (
                    <>
                      {(['protein', 'carbs', 'fat'] as const).map((kind) => (
                        <Metric
                          key={kind}
                          label={t(`fitness.${kind}Label`)}
                          target={targets ? targets[`${kind}_g`] : null}
                          consumed={daily.nutrition?.[`${kind}G`] ?? null}
                          unit={t('fitness.gramsUnit')}
                        />
                      ))}
                      {!daily.nutrition ? (
                        <Copy style={s.caption}>{t('dashboard.macrosPending')}</Copy>
                      ) : null}
                    </>
                  )}
                </Card>
              </View>
              <View style={[s.row, wide && s.horizontal]}>
                <Card style={s.flex}>
                  <SectionTitle icon="droplet" title={t('dashboard.water')} tone="water" />
                  {targetsError ? (
                    <Copy style={s.muted}>{t('dashboard.targetsError')}</Copy>
                  ) : (
                    <Metric
                      label={t('dashboard.waterToday')}
                      target={targets?.water_ml ?? null}
                      consumed={daily.water?.consumedMl ?? null}
                      unit={t('fitness.waterUnit')}
                    />
                  )}
                  <View style={s.quickWater}>
                    {WATER_SHORTCUTS.map((amount) => (
                      <Pressable
                        key={amount}
                        disabled={!onWaterAdd || waterBusy}
                        onPress={() => onWaterAdd?.(amount)}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !onWaterAdd || waterBusy }}
                        accessibilityHint={!onWaterAdd ? t('dashboard.waterPending') : undefined}
                        style={s.disabled}
                      >
                        <Copy style={s.disabledText}>
                          {t('dashboard.waterShortcut', { amount })}
                        </Copy>
                      </Pressable>
                    ))}
                  </View>
                  {waterError ? (
                    <FormNotice tone="error">{t('hydration.loadFailed')}</FormNotice>
                  ) : null}
                  {waterFeedback ? (
                    <FormNotice tone={waterFeedback.endsWith('Failed') ? 'error' : 'success'}>
                      {t(`hydration.${waterFeedback}`)}
                    </FormNotice>
                  ) : null}
                  {onWaterRetry ? (
                    <ActionButton
                      label={t('hydration.retrySave')}
                      onPress={onWaterRetry}
                      tone="quiet"
                    />
                  ) : null}
                  {onWaterAdd ? (
                    <NavButton href="/hydration" label={t('hydration.open')} />
                  ) : (
                    <Copy style={s.caption}>{t('dashboard.waterPending')}</Copy>
                  )}
                </Card>
                <Card style={s.flex}>
                  <SectionTitle icon="trending-up" title={t('dashboard.weight')} />
                  {snapshot.weight.status === 'error' ? (
                    <Copy style={s.muted}>{t('dashboard.weightError')}</Copy>
                  ) : weight ? (
                    <>
                      <Copy style={s.bigValue}>
                        {t('dashboard.weightValue', { weight: number(weight.weight_kg) })}
                      </Copy>
                      <Copy style={s.muted}>
                        {t('dashboard.weightDate', {
                          date: formatDashboardDate(weight.recorded_at, timeZone),
                        })}
                      </Copy>
                    </>
                  ) : (
                    <Copy style={s.muted}>{t('dashboard.noWeight')}</Copy>
                  )}
                  {weightTrend != null ? (
                    <Copy style={s.caption}>
                      {t('dashboard.weightTrend7d', { value: number(weightTrend) })}
                    </Copy>
                  ) : (
                    <Copy style={s.caption}>{t('dashboard.weightTrendUnavailable')}</Copy>
                  )}
                  {goal?.target_weight_kg != null ? (
                    <Copy style={s.caption}>
                      {t('progress.targetWeight')}: {number(Number(goal.target_weight_kg))} kg
                    </Copy>
                  ) : null}
                  <NavButton href="/progress" label={t('dashboard.openProgress')} />
                </Card>
              </View>
              <Card>
                <SectionTitle icon="activity" title={t('dashboard.workout')} />
                {daily.workout ? (
                  <Copy style={s.cardTitle}>
                    {t(
                      daily.workout.completed
                        ? 'dashboard.workoutCompleted'
                        : daily.workout.scheduled
                          ? 'dashboard.workoutScheduled'
                          : 'dashboard.noWorkout',
                    )}
                  </Copy>
                ) : (
                  <Copy style={s.cardTitle}>{t('dashboard.noWorkout')}</Copy>
                )}
                {snapshot.training.status === 'error' ? (
                  <Copy style={s.muted}>{t('dashboard.trainingError')}</Copy>
                ) : training ? (
                  <Copy style={s.muted}>
                    {t('dashboard.trainingPreference', {
                      days: training.days_per_week,
                      minutes: training.session_minutes,
                    })}
                  </Copy>
                ) : (
                  <Copy style={s.muted}>{t('dashboard.noTrainingPreference')}</Copy>
                )}
                {!daily.workout ? (
                  <Copy style={s.caption}>{t('dashboard.workoutPending')}</Copy>
                ) : null}
                <NavButton href="/workouts" label={t('dashboard.openWorkouts')} />
              </Card>
              <View style={s.sectionHeading}>
                <Copy style={s.sectionTitle}>{t('dashboard.priorities')}</Copy>
                <Copy style={s.muted}>{t('dashboard.prioritiesSubtitle')}</Copy>
              </View>
              <Card style={priorities.length ? undefined : s.priorities}>
                {priorities.length === 0 ? (
                  <>
                    <IconTile name="check-circle" />
                    <View style={s.flex}>
                      <Copy style={s.cardTitle}>{t('dashboard.noPriorities')}</Copy>
                      <Copy style={s.muted}>
                        {t(hasError ? 'dashboard.prioritiesError' : 'dashboard.prioritiesPending')}
                      </Copy>
                    </View>
                  </>
                ) : (
                  priorities.map((priority) => (
                    <View key={priority.id}>
                      <Copy style={s.cardTitle}>{t(`dashboard.priority.${priority.id}`)}</Copy>
                      <ActionButton
                        label={t(`dashboard.priorityAction.${priority.id}`)}
                        onPress={() => onPriority?.(priority.destination)}
                        tone="quiet"
                      />
                    </View>
                  ))
                )}
              </Card>
              {targets ? <Copy style={s.caption}>{t('fitness.estimateNotice')}</Copy> : null}
            </>
          )}
          <Copy style={s.footer}>{t('dashboard.footer')}</Copy>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({
  icon,
  title,
  tone = 'green',
}: {
  icon: IconName;
  title: string;
  tone?: 'green' | 'water';
}) {
  return (
    <View style={s.sectionRow}>
      <IconTile name={icon} tone={tone} />
      <Copy accessibilityRole="header" style={s.cardTitle}>
        {title}
      </Copy>
    </View>
  );
}

/** Barras só têm valor acessível quando o consumo é conhecido e existe uma meta positiva. */
export function Metric({
  label,
  consumed,
  target,
  unit,
}: {
  label: string;
  consumed: number | null;
  target: number | null;
  unit: string;
}) {
  const { t } = useTranslation();
  const progress = metricProgress(consumed, target);
  return (
    <View style={s.metric}>
      <View style={s.metricTop}>
        <Copy style={s.metricLabel}>{label}</Copy>
        <Copy style={s.metricValue}>
          {t('dashboard.metricValue', {
            consumed: consumed === null ? t('dashboard.unknown') : number(consumed),
            target: target === null ? t('dashboard.unknown') : number(target),
            unit,
          })}
        </Copy>
      </View>
      {progress ? (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={label}
          accessibilityValue={{
            min: 0,
            max: progress.target,
            now: Math.min(progress.consumed, progress.target),
            text: t('dashboard.metricValue', {
              consumed: number(progress.consumed),
              target: number(progress.target),
              unit,
            }),
          }}
          style={s.track}
        >
          <View style={[s.fill, { width: `${progress.fraction * 100}%` }]} />
        </View>
      ) : (
        <Copy style={s.caption}>
          {t(target === null ? 'dashboard.noMetricTarget' : 'dashboard.targetOnly')}
        </Copy>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { paddingHorizontal: 22, paddingBottom: 32, flexGrow: 1 },
  content: { width: '100%', maxWidth: theme.contentWidth, alignSelf: 'center', gap: 20 },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 22,
  },
  brand: { fontSize: 29, fontWeight: '900', letterSpacing: -1.5, color: theme.colors.primary },
  dot: { color: '#71933E' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontWeight: '700', color: theme.colors.primary },
  heading: { gap: 6 },
  date: { color: theme.colors.muted, fontSize: 12, textTransform: 'capitalize' },
  title: {
    fontSize: 30,
    lineHeight: 37,
    letterSpacing: -0.8,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  muted: { color: theme.colors.muted, fontSize: 14, lineHeight: 22 },
  caption: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionTitle: { fontSize: 20, fontWeight: '700' },
  refresh: {
    minHeight: 44,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  link: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  loading: { alignItems: 'center', paddingVertical: 48 },
  error: { padding: 18, gap: 12, borderRadius: 16, backgroundColor: theme.colors.warmSoft },
  goal: { color: theme.colors.muted, fontSize: 12 },
  noTargets: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.primarySoft,
  },
  row: { gap: 18 },
  horizontal: { flexDirection: 'row', alignItems: 'stretch' },
  flex: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 17, fontWeight: '700', lineHeight: 24 },
  energy: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    gap: 18,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  energyLabel: { color: theme.colors.lime, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  energyNumbers: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 },
  energyValue: { fontSize: 48, lineHeight: 56, fontWeight: '700', color: theme.colors.onPrimary },
  light: { color: theme.colors.onPrimaryMuted, fontSize: 14 },
  lightSmall: { color: theme.colors.onPrimaryMuted, fontSize: 12, lineHeight: 18 },
  energyDivider: { height: 1, backgroundColor: '#3B5D4B' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metric: { gap: 6 },
  metricTop: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 5 },
  metricLabel: { fontSize: 13, fontWeight: '600' },
  metricValue: { fontSize: 13, color: theme.colors.muted },
  track: {
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.primarySoft,
    overflow: 'hidden',
  },
  fill: { height: 7, borderRadius: 4, backgroundColor: theme.colors.primary },
  quickWater: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  disabled: {
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.colors.waterSoft,
  },
  disabledText: { color: theme.colors.water, fontSize: 13, fontWeight: '600' },
  bigValue: { fontSize: 32, lineHeight: 40, fontWeight: '700', color: theme.colors.primary },
  sectionHeading: { gap: 4, marginTop: 4 },
  priorities: { flexDirection: 'row', alignItems: 'flex-start' },
  score: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary, gap: 12 },
  scoreTitle: { fontSize: 17, fontWeight: '700', lineHeight: 24, color: theme.colors.onPrimary },
  scoreValue: { fontSize: 48, lineHeight: 56, fontWeight: '700', color: theme.colors.onPrimary },
  footer: { textAlign: 'center', fontSize: 11, color: theme.colors.muted, marginTop: 2 },
});
