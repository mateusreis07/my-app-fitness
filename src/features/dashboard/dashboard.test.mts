import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { NutritionTargets } from '../../services/supabase/database.types';
import { dashboardClock, resolveTimeZone, formatDashboardDate } from './calendar.ts';
import {
  avatarInitials,
  metricProgress,
  DASHBOARD_CAPABILITIES,
  EMPTY_DAILY_SIGNALS,
} from './model.ts';
import { buildPriorities } from './priorities.ts';

const DAY = '2026-09-22';
const targets: NutritionTargets = {
  id: 'target',
  user_id: 'u',
  calories: 2000,
  protein_g: 100,
  carbs_g: 250,
  fat_g: 60,
  water_ml: 2000,
  effective_from: DAY,
  effective_until: null,
  calculation_source: 'fitness_engine@1.1',
  created_at: DAY,
};
const context = {
  dayKey: DAY,
  minuteOfDay: 17 * 60,
  targets,
  signals: {
    nutrition: { dayKey: DAY, calories: 800, proteinG: 50, carbsG: 100, fatG: 30, mealCount: 2 },
    water: { dayKey: DAY, consumedMl: 500 },
    workout: { dayKey: DAY, scheduled: true, completed: false },
  },
  capabilities: { nutrition: true, water: true, weight: true, workout: true },
  weight: { known: true, lastDay: '2026-09-01' },
};

test('unknown consumption and no targets never become zero progress', () => {
  assert.equal(metricProgress(null, 2000), null);
  assert.equal(metricProgress(500, null), null);
  for (const target of [0, -1, NaN, Infinity]) assert.equal(metricProgress(10, target), null);
  for (const consumed of [-1, NaN, Infinity]) assert.equal(metricProgress(consumed, 100), null);
});
test('known zero, remaining and excess are explicit; visual progress caps at 100%', () => {
  assert.deepEqual(metricProgress(0, 100), {
    consumed: 0,
    target: 100,
    remaining: 100,
    over: 0,
    fraction: 0,
  });
  assert.deepEqual(metricProgress(120, 100), {
    consumed: 120,
    target: 100,
    remaining: 0,
    over: 20,
    fraction: 1,
  });
});
test('timezone calendar handles UTC midnight and profile timezone', () => {
  assert.equal(dashboardClock(new Date('2026-09-23T02:59:59Z'), 'America/Sao_Paulo').dayKey, DAY);
  assert.equal(
    dashboardClock(new Date('2026-09-23T03:00:00Z'), 'America/Sao_Paulo').dayKey,
    '2026-09-23',
  );
  assert.equal(
    dashboardClock(new Date('2026-09-23T03:00:00Z'), 'America/Sao_Paulo').minuteOfDay,
    0,
  );
  assert.equal(dashboardClock(new Date('2026-09-22T00:00:00Z'), 'Asia/Tokyo').minuteOfDay, 540);
});
test('greetings follow local time and invalid timezone has valid fallback', () => {
  assert.equal(dashboardClock(new Date('2026-09-22T11:59:00Z'), 'UTC').greeting, 'morning');
  assert.equal(dashboardClock(new Date('2026-09-22T12:00:00Z'), 'UTC').greeting, 'afternoon');
  assert.equal(dashboardClock(new Date('2026-09-22T18:00:00Z'), 'UTC').greeting, 'evening');
  assert.doesNotThrow(() => dashboardClock(new Date(), resolveTimeZone('Invalid/Timezone')));
  assert.match(formatDashboardDate('2026-09-23T01:00:00Z', 'America/Sao_Paulo'), /22/);
});
test('initials support empty, single and multiple names without disclosing email', () => {
  assert.equal(avatarInitials(null), '');
  assert.equal(avatarInitials(' '), '');
  assert.equal(avatarInitials(' Ágata da Silva '), 'ÁS');
  assert.equal(avatarInitials('Mateus'), 'M');
});
test('priority relevance is deterministic and limited to three', () => {
  const before = structuredClone(context);
  assert.deepEqual(
    buildPriorities(context).map((p) => p.id),
    ['workout', 'water', 'protein'],
  );
  assert.deepEqual(context, before);
  assert.deepEqual(buildPriorities(context), buildPriorities(context));
});
test('water threshold is after 15h and below 60%, protein after 16h and below 70%', () => {
  const capabilities = { nutrition: true, water: true, weight: false, workout: false };
  assert.deepEqual(buildPriorities({ ...context, capabilities, minuteOfDay: 900 }), []);
  assert.deepEqual(
    buildPriorities({ ...context, capabilities, minuteOfDay: 901 }).map((p) => p.id),
    ['water'],
  );
  assert.deepEqual(
    buildPriorities({ ...context, capabilities, minuteOfDay: 960 }).map((p) => p.id),
    ['water'],
  );
  assert.deepEqual(
    buildPriorities({ ...context, capabilities, minuteOfDay: 961 }).map((p) => p.id),
    ['water', 'protein'],
  );
  assert.deepEqual(
    buildPriorities({
      ...context,
      capabilities,
      signals: {
        ...context.signals,
        nutrition: { ...context.signals.nutrition, proteinG: 70 },
        water: { dayKey: DAY, consumedMl: 1200 },
      },
    }),
    [],
  );
});
test('no automatic target prevents nutrition and hydration nudges without suppressing an actual workout', () => {
  assert.deepEqual(
    buildPriorities({ ...context, targets: null, weight: { known: false, lastDay: null } }).map(
      (p) => p.id,
    ),
    ['workout'],
  );
});
test('missing data, yesterday data and unavailable modules cannot create nudges', () => {
  assert.deepEqual(buildPriorities({ ...context, capabilities: DASHBOARD_CAPABILITIES }), []);
  assert.deepEqual(
    buildPriorities({
      ...context,
      signals: EMPTY_DAILY_SIGNALS,
      weight: { known: false, lastDay: null },
    }),
    [],
  );
  const signals = {
    nutrition: { ...context.signals.nutrition, dayKey: '2026-09-21' },
    water: { ...context.signals.water, dayKey: '2026-09-21' },
    workout: { ...context.signals.workout, dayKey: '2026-09-21' },
  };
  assert.deepEqual(
    buildPriorities({ ...context, signals, weight: { known: false, lastDay: null } }),
    [],
  );
});
test('future or ended targets cannot produce nutrition priorities', () => {
  for (const patch of [{ effective_from: '2026-09-23' }, { effective_until: DAY }])
    assert.deepEqual(
      buildPriorities({
        ...context,
        targets: { ...targets, ...patch },
        signals: { ...context.signals, workout: null },
        weight: { known: false, lastDay: null },
      }),
      [],
    );
});
test('completed and unscheduled workouts do not become pending; preferences are not a schedule', () => {
  for (const patch of [{ scheduled: false }, { completed: true }])
    assert.equal(
      buildPriorities({
        ...context,
        signals: { ...context.signals, workout: { ...context.signals.workout, ...patch } },
      }).some((p) => p.id === 'workout'),
      false,
    );
});
test('unknown weight is not stale; a known missing or seven-day-old record may prompt only when recording exists', () => {
  const input = { ...context, signals: EMPTY_DAILY_SIGNALS };
  assert.deepEqual(buildPriorities({ ...input, weight: { known: false, lastDay: null } }), []);
  assert.deepEqual(
    buildPriorities({ ...input, weight: { known: true, lastDay: '2026-09-16' } }),
    [],
  );
  assert.deepEqual(
    buildPriorities({ ...input, weight: { known: true, lastDay: '2026-09-15' } }).map((p) => p.id),
    ['weight'],
  );
  assert.deepEqual(
    buildPriorities({ ...input, weight: { known: true, lastDay: null } }).map((p) => p.id),
    ['weight'],
  );
  assert.deepEqual(
    buildPriorities({ ...input, weight: { known: true, lastDay: '2026-09-24' } }),
    [],
  );
});
test('missing meal records do not imply protein deficiency', () => {
  assert.equal(
    buildPriorities({
      ...context,
      signals: { ...context.signals, nutrition: { ...context.signals.nutrition, mealCount: 0 } },
    }).some((p) => p.id === 'protein'),
    false,
  );
});
