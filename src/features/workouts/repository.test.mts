import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { KoraClient } from '../../services/supabase/client';
import { createSetEntry } from './model.ts';
import {
  createDayExercise,
  createPlan,
  createPlanDay,
  loadExerciseCatalog,
  saveSet,
  startSession,
} from './repository.ts';

type Response = { data: unknown; error: unknown };

/** Mesmo cliente simulado de `src/features/weight/repository.test.mts`. */
function mock(responses: (Response | Error)[]) {
  const calls: { method: string; args: unknown[] }[] = [];
  const client = {
    from(table: string) {
      calls.push({ method: 'from', args: [table] });
      const chain = {
        select(...args: unknown[]) {
          calls.push({ method: 'select', args });
          return chain;
        },
        eq(...args: unknown[]) {
          calls.push({ method: 'eq', args });
          return chain;
        },
        in(...args: unknown[]) {
          calls.push({ method: 'in', args });
          return chain;
        },
        order(...args: unknown[]) {
          calls.push({ method: 'order', args });
          return chain;
        },
        limit(...args: unknown[]) {
          calls.push({ method: 'limit', args });
          return chain;
        },
        abortSignal(...args: unknown[]) {
          calls.push({ method: 'abortSignal', args });
          return chain;
        },
        insert(...args: unknown[]) {
          calls.push({ method: 'insert', args });
          return chain;
        },
        upsert(...args: unknown[]) {
          calls.push({ method: 'upsert', args });
          return chain;
        },
        delete() {
          calls.push({ method: 'delete', args: [] });
          return chain;
        },
        maybeSingle() {
          calls.push({ method: 'maybeSingle', args: [] });
          return chain;
        },
        then(resolve: (r: Response) => unknown, reject: (e: Error) => unknown) {
          const result = responses.shift();
          if (result instanceof Error) return reject(result);
          if (!result) return reject(new Error('unexpected query'));
          return resolve(result);
        },
      };
      return chain;
    },
  } as unknown as KoraClient;
  return { client, calls };
}

test('exercise catalog merges the user list before the global list', async () => {
  const { client, calls } = mock([
    {
      data: [
        {
          id: 'ux-1',
          user_id: 'owner',
          name: 'Zebra unilateral',
          primary_muscle: 'Costas',
          secondary_muscles: [],
          equipment: null,
          instructions: null,
          created_at: '2026-01-01',
        },
      ],
      error: null,
    },
    {
      data: [
        {
          id: 'ex-1',
          name: 'Agachamento',
          primary_muscle: 'Quadríceps',
          secondary_muscles: [],
          equipment: 'Barra',
          instructions: null,
          media_url: null,
          source: 'seed',
          verified: false,
          active: true,
          created_at: '2026-01-01',
        },
      ],
      error: null,
    },
  ]);
  const result = await loadExerciseCatalog(client, 'owner');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.data.map((exercise) => exercise.origin),
    ['user_exercise', 'exercise'],
  );
  assert.deepEqual(
    calls.filter((c) => c.method === 'from').map((c) => c.args[0]),
    ['user_exercises', 'exercises'],
  );
  assert.ok(
    calls.some((c) => c.method === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'owner'),
  );
  assert.ok(calls.some((c) => c.method === 'eq' && c.args[0] === 'active' && c.args[1] === true));
});

test('catalog read failure never surfaces an empty list as success', async () => {
  assert.deepEqual(await loadExerciseCatalog(mock([new Error('offline')]).client, 'owner'), {
    ok: false,
  });
});

test('plan, day and day-exercise are written in that order, parent before child', async () => {
  const plan = {
    id: 'plan-1',
    user_id: 'owner',
    name: 'Plano',
    goal: null,
    days_per_week: null,
    active: true,
    created_at: 'x',
    updated_at: 'x',
  };
  const day = {
    id: 'day-1',
    plan_id: 'plan-1',
    day_index: 1,
    name: 'Dia A',
    order_index: 0,
    created_at: 'x',
  };
  const dayExercise = {
    id: 'de-1',
    workout_day_id: 'day-1',
    exercise_id: 'ex-1',
    user_exercise_id: null,
    name_snapshot: 'Supino',
    order_index: 0,
    target_sets: 3,
    min_reps: 8,
    max_reps: 12,
    rest_seconds: 90,
    notes: null,
    created_at: 'x',
  };
  const { client, calls } = mock([
    { data: plan, error: null },
    { data: day, error: null },
    { data: dayExercise, error: null },
  ]);

  const planResult = await createPlan(client, 'owner', {
    name: 'Plano',
    goal: null,
    days_per_week: null,
  });
  assert.equal(planResult.ok, true);
  const dayResult = await createPlanDay(client, 'plan-1', {
    name: 'Dia A',
    day_index: 1,
    order_index: 0,
  });
  assert.equal(dayResult.ok, true);
  const exerciseResult = await createDayExercise(client, 'day-1', {
    exercise_id: 'ex-1',
    user_exercise_id: null,
    name_snapshot: 'Supino',
    order_index: 0,
    target_sets: 3,
    min_reps: 8,
    max_reps: 12,
    rest_seconds: 90,
    notes: null,
  });
  assert.equal(exerciseResult.ok, true);

  assert.deepEqual(
    calls.filter((c) => c.method === 'from').map((c) => c.args[0]),
    ['workout_plans', 'workout_plan_days', 'workout_day_exercises'],
  );
  assert.ok(
    calls.some((c) => c.method === 'insert' && (c.args[0] as { active: boolean }).active === true),
  );
});

test('starting a session writes the session before the session exercises', async () => {
  const session = {
    id: 'session-1',
    user_id: 'owner',
    workout_day_id: 'day-1',
    day_name_snapshot: 'Dia A',
    started_at: 'x',
    completed_at: null,
    duration_seconds: null,
    status: 'in_progress',
    created_at: 'x',
  };
  const sessionExercises = [
    {
      id: 'se-1',
      session_id: 'session-1',
      exercise_id: 'ex-1',
      user_exercise_id: null,
      name_snapshot: 'Supino',
      order_index: 0,
      created_at: 'x',
    },
  ];
  const { client, calls } = mock([
    { data: session, error: null },
    { data: sessionExercises, error: null },
  ]);
  const result = await startSession(client, 'owner', {
    workoutDayId: 'day-1',
    dayNameSnapshot: 'Dia A',
    exercises: [{ exerciseId: 'ex-1', userExerciseId: null, nameSnapshot: 'Supino' }],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.session.id, 'session-1');
  assert.equal(result.data.exercises.length, 1);
  assert.deepEqual(
    calls.filter((c) => c.method === 'from').map((c) => c.args[0]),
    ['workout_sessions', 'workout_session_exercises'],
  );
});

test('a session with no exercises does not attempt to insert session exercises', async () => {
  const session = {
    id: 'session-1',
    user_id: 'owner',
    workout_day_id: null,
    day_name_snapshot: null,
    started_at: 'x',
    completed_at: null,
    duration_seconds: null,
    status: 'in_progress',
    created_at: 'x',
  };
  const { client, calls } = mock([{ data: session, error: null }]);
  const result = await startSession(client, 'owner', {
    workoutDayId: null,
    dayNameSnapshot: null,
    exercises: [],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(
    calls.filter((c) => c.method === 'from').map((c) => c.args[0]),
    ['workout_sessions'],
  );
});

test('saving a set uses upsert-ignore, and a retry sends the identical options', async () => {
  const entry = createSetEntry({
    id: '11111111-1111-4111-8111-111111111111',
    sessionExerciseId: 'se-1',
    setNumber: 1,
    weightKg: 80,
    reps: 10,
  })!;
  const row = { ...entry, created_at: 'x' };
  const { client, calls } = mock([
    { data: null, error: null },
    { data: row, error: null },
    { data: null, error: null },
    { data: row, error: null },
  ]);
  assert.deepEqual(await saveSet(client, entry), { ok: true, data: row });
  assert.deepEqual(await saveSet(client, entry), { ok: true, data: row });
  const writes = calls.filter((c) => c.method === 'upsert');
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[0].args, writes[1].args);
  assert.deepEqual(writes[0].args[1], { onConflict: 'id', ignoreDuplicates: true });
});

test('save never reports success for a hidden or mismatched replay', async () => {
  const entry = createSetEntry({
    id: '11111111-1111-4111-8111-111111111111',
    sessionExerciseId: 'se-1',
    setNumber: 1,
    weightKg: 80,
    reps: 10,
  })!;
  const row = { ...entry, created_at: 'x' };
  for (const data of [null, { ...row, reps: 12 }, { ...row, weight_kg: 60 }])
    assert.deepEqual(
      await saveSet(
        mock([
          { data: null, error: null },
          { data, error: null },
        ]).client,
        entry,
      ),
      { ok: false },
    );
});
