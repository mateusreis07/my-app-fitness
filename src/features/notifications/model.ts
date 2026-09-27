/**
 * Notificações locais — KORA_MASTER_CONTEXT.md seções 44, 54, 121 e 122.
 *
 * "Notificações devem ser configuráveis." "Nunca utilizar spam agressivo."
 * Funções puras: sem rede, sem Expo, sem relógio implícito — o instante e o
 * fuso sempre entram por parâmetro.
 *
 * Sem gatilho recorrente do próprio agendador: o app recalcula o que falta
 * para hoje a cada abertura/retomada e reagenda por um identificador estável
 * por tipo, para nunca duplicar nem manter um lembrete que já perdeu sentido
 * (meta batida, treino concluído).
 */
import type { TranslationKey } from '@/lib/i18n/keys';
import { daysBetweenIso } from '../../lib/date.ts';
import { dashboardClock } from '../dashboard/calendar.ts';
import { PRIORITY_POLICY } from '../dashboard/priorities.ts';

/** Mesmo limite já usado pela prioridade de peso — não um número novo. */
export const WEIGHT_REMINDER_AFTER_DAYS = PRIORITY_POLICY.weightAfterDays;

export type NotificationType = 'water' | 'workout' | 'weight' | 'summary';

/** Identificador estável por tipo — cancelar-e-reagendar pelo mesmo id nunca duplica. */
export const NOTIFICATION_ID: Record<NotificationType, string> = {
  water: 'kora-water',
  workout: 'kora-workout',
  weight: 'kora-weight',
  summary: 'kora-summary',
};
export const REST_NOTIFICATION_ID = 'kora-rest';

/**
 * Segundos até o próximo `HH:MM` de hoje, no fuso informado. `null` quando
 * esse horário já passou hoje — não agenda notificação no passado.
 */
export function secondsUntil(time: string, now: Date, timeZone: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(time);
  if (!match) return null;
  const targetMinute = Number(match[1]) * 60 + Number(match[2]);
  const clock = dashboardClock(now, timeZone);
  const diffMinutes = targetMinute - clock.minuteOfDay;
  if (diffMinutes <= 0) return null;
  return diffMinutes * 60;
}

/** Sem meta vigente, sem cobrança: `null` significa "não avaliar", não "faltou". */
export function shouldRemindWater(consumedMl: number | null, targetMl: number | null): boolean {
  if (targetMl === null || targetMl <= 0 || consumedMl === null) return false;
  return consumedMl < targetMl;
}

/** Mesma condição exata da prioridade `workout` (Fase 8/4) — dia de descanso nunca lembra. */
export function shouldRemindWorkout(scheduled: boolean, completed: boolean): boolean {
  return scheduled && !completed;
}

/** `lastWeighInDay === null` conta como "nunca pesou" — sempre elegível a lembrete. */
export function shouldRemindWeight(lastWeighInDay: string | null, todayDayKey: string): boolean {
  if (lastWeighInDay === null) return true;
  return daysBetweenIso(lastWeighInDay, todayDayKey) >= WEIGHT_REMINDER_AFTER_DAYS;
}

export type SummaryInput = {
  mealCount: number;
  consumedKcal: number | null;
  targetKcal: number | null;
  consumedWaterMl: number | null;
  workoutCompleted: boolean;
  score: number | null;
};

export type SummaryContent = {
  bodyKey: TranslationKey;
  params: Record<string, string | number>;
};

/**
 * `null` quando não há nada de real para resumir (nenhuma refeição, água ou
 * treino, e nenhum score calculável) — um resumo vazio seria só ruído.
 */
export function summaryContent(input: SummaryInput): SummaryContent | null {
  const hasActivity =
    input.mealCount > 0 ||
    (input.consumedWaterMl ?? 0) > 0 ||
    input.workoutCompleted ||
    input.score !== null;
  if (!hasActivity) return null;
  return {
    bodyKey: 'notifications.summary.body',
    params: {
      calories: input.consumedKcal ?? 0,
      target: input.targetKcal ?? 0,
      water: input.consumedWaterMl ?? 0,
      score: input.score ?? '—',
    },
  };
}

export type NotificationPreferencesInput = {
  waterEnabled: boolean;
  workoutEnabled: boolean;
  weightEnabled: boolean;
  summaryEnabled: boolean;
  reminderTime: string;
  summaryTime: string;
};

export type DayStateInput = {
  now: Date;
  timeZone: string;
  todayDayKey: string;
  consumedKcal: number | null;
  targetKcal: number | null;
  consumedWaterMl: number | null;
  targetWaterMl: number | null;
  mealCount: number;
  workoutScheduled: boolean;
  workoutCompleted: boolean;
  lastWeighInDay: string | null;
  score: number | null;
};

export type ScheduleEntry = {
  id: string;
  secondsFromNow: number;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  bodyParams?: Record<string, string | number>;
};

export type NotificationPlan = {
  toSchedule: ScheduleEntry[];
  toCancel: string[];
};

/**
 * Núcleo puro: decide o que agendar/cancelar hoje. Tipo desativado, condição
 * que não se aplica mais, ou horário já passado — tudo vira cancelamento, não
 * agendamento silencioso de algo desatualizado.
 */
export function planTodayNotifications(
  prefs: NotificationPreferencesInput,
  day: DayStateInput,
): NotificationPlan {
  const toSchedule: ScheduleEntry[] = [];
  const toCancel: string[] = [];

  function decide(
    type: NotificationType,
    enabled: boolean,
    due: boolean,
    time: string,
    titleKey: TranslationKey,
    bodyKey: TranslationKey,
    bodyParams?: Record<string, string | number>,
  ) {
    const id = NOTIFICATION_ID[type];
    const seconds = enabled && due ? secondsUntil(time, day.now, day.timeZone) : null;
    if (seconds === null) {
      toCancel.push(id);
      return;
    }
    toSchedule.push({ id, secondsFromNow: seconds, titleKey, bodyKey, bodyParams });
  }

  decide(
    'water',
    prefs.waterEnabled,
    shouldRemindWater(day.consumedWaterMl, day.targetWaterMl),
    prefs.reminderTime,
    'notifications.water.title',
    'notifications.water.body',
  );

  decide(
    'workout',
    prefs.workoutEnabled,
    shouldRemindWorkout(day.workoutScheduled, day.workoutCompleted),
    prefs.reminderTime,
    'notifications.workout.title',
    'notifications.workout.body',
  );

  decide(
    'weight',
    prefs.weightEnabled,
    shouldRemindWeight(day.lastWeighInDay, day.todayDayKey),
    prefs.reminderTime,
    'notifications.weight.title',
    'notifications.weight.body',
  );

  const summary = summaryContent({
    mealCount: day.mealCount,
    consumedKcal: day.consumedKcal,
    targetKcal: day.targetKcal,
    consumedWaterMl: day.consumedWaterMl,
    workoutCompleted: day.workoutCompleted,
    score: day.score,
  });
  decide(
    'summary',
    prefs.summaryEnabled,
    summary !== null,
    prefs.summaryTime,
    'notifications.summary.title',
    summary?.bodyKey ?? 'notifications.summary.body',
    summary?.params,
  );

  return { toSchedule, toCancel };
}
