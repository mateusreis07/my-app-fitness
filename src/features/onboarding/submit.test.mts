import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { KoraClient } from '../../services/supabase/client';
import { EMPTY_DRAFT, nextOnboardingStepIndex, type OnboardingDraft } from './model.ts';
import { buildOnboardingPayload } from './payload.ts';
import { submitOnboarding } from './submit.ts';
import { buildFitnessPlan } from '../fitness/engine.ts';
import { fetchCurrentTargets } from '../fitness/targets.ts';

const TODAY = '2026-09-22';
const DRAFT: OnboardingDraft = {
  ...EMPTY_DRAFT,
  goalType: 'lose_weight',
  biologicalSex: 'female',
  birthDate: '10/05/1990',
  heightCm: '168',
  currentWeightKg: '72',
  targetWeightKg: '68',
  targetDate: '01/06/2027',
  activityLevel: 'lightly_active',
  fitnessExperience: 'beginner',
  trainingDaysPerWeek: 3,
  trainingSessionMinutes: 45,
  trainingLocation: 'home',
};
type Event = {
  table: string;
  verb: string;
  values: Record<string, unknown>;
  filters: [string, unknown][];
};
function mock(fail?: (event: Event) => boolean, throwNetwork = false) {
  const events: Event[] = [];
  const client = {
    from(table: string) {
      const event: Event = { table, verb: '', values: {}, filters: [] };
      const chain = {
        upsert(values: Record<string, unknown>) {
          event.verb = 'upsert';
          event.values = values;
          return chain;
        },
        insert(values: Record<string, unknown>) {
          event.verb = 'insert';
          event.values = values;
          return chain;
        },
        update(values: Record<string, unknown>) {
          event.verb = 'update';
          event.values = values;
          return chain;
        },
        select() {
          event.verb = 'select';
          return chain;
        },
        eq(key: string, value: unknown) {
          event.filters.push([key, value]);
          return chain;
        },
        is(key: string, value: unknown) {
          event.filters.push([key, value]);
          return chain;
        },
        async maybeSingle() {
          if (throwNetwork) throw new Error('network');
          return { data: null, error: fail?.(event) ? { message: 'failure' } : null };
        },
        then(
          resolve: (result: { error: { message: string } | null }) => unknown,
          reject: (error: Error) => unknown,
        ) {
          events.push(event);
          if (throwNetwork) return reject(new Error('network'));
          return Promise.resolve({ error: fail?.(event) ? { message: 'failure' } : null }).then(
            resolve,
          );
        },
      };
      return chain;
    },
  } as unknown as KoraClient;
  return { client, events };
}

test('eligible onboarding saves exactly previewed targets and version before completion', async () => {
  const { client, events } = mock();
  assert.deepEqual(await submitOnboarding(client, 'owner', DRAFT, TODAY), { ok: true });
  const payload = buildOnboardingPayload('owner', DRAFT, TODAY);
  assert.ok(payload);
  const plan = buildFitnessPlan(payload.fitnessInput);
  assert.equal(plan.status, 'ready');
  const insert = events.find((e) => e.table === 'nutrition_targets' && e.verb === 'insert');
  assert.ok(insert);
  assert.deepEqual(insert.values, {
    user_id: 'owner',
    calories: plan.calories,
    protein_g: plan.proteinG,
    carbs_g: plan.carbsG,
    fat_g: plan.fatG,
    water_ml: plan.waterMl,
    effective_from: TODAY,
    effective_until: null,
    calculation_source: 'fitness_engine@1.2',
  });
  const close = events.find((e) => e.table === 'nutrition_targets' && e.verb === 'update');
  assert.ok(close);
  assert.deepEqual(close.values, { effective_until: TODAY });
  assert.deepEqual(close.filters, [
    ['user_id', 'owner'],
    ['effective_until', null],
  ]);
  assert.ok(events.at(-1)?.values.onboarding_completed_at);
});
test('unspecified sex and underweight goals complete without fake targets or deleting history', async () => {
  for (const overrides of [
    { biologicalSex: 'unspecified' as const },
    { currentWeightKg: '50', targetWeightKg: '45' },
    { targetWeightKg: '45' },
  ]) {
    const { client, events } = mock();
    assert.deepEqual(await submitOnboarding(client, 'owner', { ...DRAFT, ...overrides }, TODAY), {
      ok: true,
    });
    assert.equal(
      events.filter((e) => e.table === 'nutrition_targets' && e.verb === 'insert').length,
      0,
    );
    assert.equal(
      events.filter((e) => e.table === 'nutrition_targets' && e.verb === 'update').length,
      1,
    );
    assert.ok(events.at(-1)?.values.onboarding_completed_at);
    assert.equal(
      events.find((e) => e.table === 'goals' && e.verb === 'insert')?.values.target_date,
      '2027-06-01',
    );
  }
});
test('target close or insert failure never marks onboarding complete', async () => {
  for (const verb of ['update', 'insert']) {
    const { client, events } = mock((e) => e.table === 'nutrition_targets' && e.verb === verb);
    assert.deepEqual(await submitOnboarding(client, 'owner', DRAFT, TODAY), {
      ok: false,
      error: 'onboarding.error.saveFailed',
    });
    assert.equal(
      events.some((e) => e.values.onboarding_completed_at),
      false,
    );
  }
});
test('network rejection becomes a retryable translated result', async () => {
  const { client } = mock(undefined, true);
  assert.deepEqual(await submitOnboarding(client, 'owner', DRAFT, TODAY), {
    ok: false,
    error: 'onboarding.error.saveFailed',
  });
});
test('validation cannot be bypassed by submitting a minor directly', async () => {
  const { client, events } = mock();
  assert.equal(
    (await submitOnboarding(client, 'owner', { ...DRAFT, birthDate: '23/09/2008' }, TODAY)).ok,
    false,
  );
  assert.equal(events.length, 0);
});
test('failed target reads differ from completed onboarding without targets', async () => {
  assert.deepEqual(await fetchCurrentTargets(mock().client, 'owner'), { ok: true, targets: null });
  assert.deepEqual(await fetchCurrentTargets(mock(() => true).client, 'owner'), { ok: false });
  assert.deepEqual(await fetchCurrentTargets(mock(undefined, true).client, 'owner'), { ok: false });
});
test('all goals visit basics; only weight goals visit target; backward navigation is symmetric', () => {
  for (const goal of ['maintain_weight', 'improve_health', 'improve_fitness'] as const) {
    assert.equal(nextOnboardingStepIndex(0, goal, 1), 1);
    assert.equal(nextOnboardingStepIndex(1, goal, 1), 3);
    assert.equal(nextOnboardingStepIndex(3, goal, -1), 1);
  }
  for (const goal of ['lose_weight', 'gain_muscle'] as const) {
    assert.equal(nextOnboardingStepIndex(1, goal, 1), 2);
    assert.equal(nextOnboardingStepIndex(3, goal, -1), 2);
  }
});
test('weightless goal payload discards stale requested weight and date', () => {
  const payload = buildOnboardingPayload('owner', { ...DRAFT, goalType: 'improve_health' }, TODAY);
  assert.ok(payload);
  assert.equal(payload.goal.target_weight_kg, null);
  assert.equal(payload.goal.target_date, null);
});
