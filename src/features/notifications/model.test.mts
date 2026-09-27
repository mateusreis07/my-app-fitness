import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  NOTIFICATION_ID,
  planTodayNotifications,
  secondsUntil,
  shouldRemindWater,
  shouldRemindWeight,
  shouldRemindWorkout,
  summaryContent,
  WEIGHT_REMINDER_AFTER_DAYS,
  type DayStateInput,
  type NotificationPreferencesInput,
} from './model.ts';

const TZ = 'America/Sao_Paulo';

test('secondsUntil is null once the target time already passed today', () => {
  // 15h em Sao Paulo (18h UTC), horario-alvo 12:00 ja passou.
  const now = new Date('2026-06-15T18:00:00Z');
  assert.equal(secondsUntil('12:00', now, TZ), null);
});

test('secondsUntil counts forward to a future time today', () => {
  // 12h em Sao Paulo (15h UTC), horario-alvo 15:00 ainda nao chegou.
  const now = new Date('2026-06-15T15:00:00Z');
  assert.equal(secondsUntil('15:00', now, TZ), 3 * 60 * 60);
});

test('secondsUntil rejects a malformed time string', () => {
  assert.equal(secondsUntil('not-a-time', new Date(), TZ), null);
});

test('shouldRemindWater never fires without a valid target or without a reading', () => {
  assert.equal(shouldRemindWater(500, null), false);
  assert.equal(shouldRemindWater(500, 0), false);
  assert.equal(shouldRemindWater(null, 2000), false);
});

test('shouldRemindWater fires only while under the target', () => {
  assert.equal(shouldRemindWater(500, 2000), true);
  assert.equal(shouldRemindWater(2000, 2000), false);
  assert.equal(shouldRemindWater(2500, 2000), false);
});

test('shouldRemindWorkout mirrors the exact dashboard priority condition', () => {
  assert.equal(shouldRemindWorkout(true, false), true);
  assert.equal(shouldRemindWorkout(true, true), false);
  assert.equal(shouldRemindWorkout(false, false), false);
});

test('shouldRemindWeight treats "never weighed" as always eligible', () => {
  assert.equal(shouldRemindWeight(null, '2026-06-15'), true);
});

test(`shouldRemindWeight uses the same ${WEIGHT_REMINDER_AFTER_DAYS}-day threshold as the priority engine`, () => {
  assert.equal(shouldRemindWeight('2026-06-09', '2026-06-15'), false); // 6 dias
  assert.equal(shouldRemindWeight('2026-06-08', '2026-06-15'), true); // 7 dias
});

test('summaryContent is null when there is truly nothing to summarize', () => {
  const result = summaryContent({
    mealCount: 0,
    consumedKcal: null,
    targetKcal: null,
    consumedWaterMl: 0,
    workoutCompleted: false,
    score: null,
  });
  assert.equal(result, null);
});

test('summaryContent appears when any single dimension has real activity', () => {
  assert.notEqual(
    summaryContent({
      mealCount: 1,
      consumedKcal: 500,
      targetKcal: null,
      consumedWaterMl: 0,
      workoutCompleted: false,
      score: null,
    }),
    null,
  );
  assert.notEqual(
    summaryContent({
      mealCount: 0,
      consumedKcal: null,
      targetKcal: null,
      consumedWaterMl: 0,
      workoutCompleted: true,
      score: null,
    }),
    null,
  );
});

const basePrefs: NotificationPreferencesInput = {
  waterEnabled: true,
  workoutEnabled: true,
  weightEnabled: true,
  summaryEnabled: true,
  reminderTime: '15:00',
  summaryTime: '21:00',
};

const baseDay: DayStateInput = {
  now: new Date('2026-06-15T15:00:00Z'), // 12h em Sao Paulo
  timeZone: TZ,
  todayDayKey: '2026-06-15',
  consumedKcal: 500,
  targetKcal: 2000,
  consumedWaterMl: 500,
  targetWaterMl: 2000,
  mealCount: 1,
  workoutScheduled: true,
  workoutCompleted: false,
  lastWeighInDay: null,
  score: 40,
};

test('a disabled type is always cancelled, never scheduled, regardless of the condition', () => {
  const plan = planTodayNotifications(
    {
      ...basePrefs,
      waterEnabled: false,
      workoutEnabled: false,
      weightEnabled: false,
      summaryEnabled: false,
    },
    baseDay,
  );
  assert.deepEqual(plan.toSchedule, []);
  assert.deepEqual(
    new Set(plan.toCancel),
    new Set([
      NOTIFICATION_ID.water,
      NOTIFICATION_ID.workout,
      NOTIFICATION_ID.weight,
      NOTIFICATION_ID.summary,
    ]),
  );
});

test('water never schedules without a nutrition target, even if enabled', () => {
  const plan = planTodayNotifications(basePrefs, { ...baseDay, targetWaterMl: null });
  assert.ok(!plan.toSchedule.some((entry) => entry.id === NOTIFICATION_ID.water));
  assert.ok(plan.toCancel.includes(NOTIFICATION_ID.water));
});

test('a completed workout cancels the workout reminder instead of scheduling it', () => {
  const plan = planTodayNotifications(basePrefs, { ...baseDay, workoutCompleted: true });
  assert.ok(!plan.toSchedule.some((entry) => entry.id === NOTIFICATION_ID.workout));
  assert.ok(plan.toCancel.includes(NOTIFICATION_ID.workout));
});

test('a weigh-in from fewer than the threshold days ago cancels the weight reminder', () => {
  const plan = planTodayNotifications(basePrefs, { ...baseDay, lastWeighInDay: '2026-06-14' });
  assert.ok(!plan.toSchedule.some((entry) => entry.id === NOTIFICATION_ID.weight));
  assert.ok(plan.toCancel.includes(NOTIFICATION_ID.weight));
});

test('a reminder due today but past the configured time is cancelled, not scheduled in the past', () => {
  const plan = planTodayNotifications(basePrefs, {
    ...baseDay,
    now: new Date('2026-06-15T20:00:00Z'), // 17h em Sao Paulo, depois das 15h
  });
  assert.ok(!plan.toSchedule.some((entry) => entry.id === NOTIFICATION_ID.water));
  assert.ok(plan.toCancel.includes(NOTIFICATION_ID.water));
});

test('an eligible, enabled type schedules with the correct id and a positive delay', () => {
  const plan = planTodayNotifications(basePrefs, baseDay);
  const water = plan.toSchedule.find((entry) => entry.id === NOTIFICATION_ID.water);
  assert.ok(water);
  assert.ok(water!.secondsFromNow > 0);
  const workout = plan.toSchedule.find((entry) => entry.id === NOTIFICATION_ID.workout);
  assert.ok(workout);
  const weight = plan.toSchedule.find((entry) => entry.id === NOTIFICATION_ID.weight);
  assert.ok(weight); // nunca pesou
  const summary = plan.toSchedule.find((entry) => entry.id === NOTIFICATION_ID.summary);
  assert.ok(summary);
});
