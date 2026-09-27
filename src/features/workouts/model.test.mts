import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createDayExercise,
  createPlanDay,
  createSetEntry,
  createWorkoutPlan,
  fromExercise,
  fromUserExercise,
  type SelectableExercise,
} from './model.ts';

const ID = '11111111-1111-4111-8111-111111111111';

const exercise: SelectableExercise = {
  origin: 'exercise',
  id: 'ex-1',
  name: 'Supino reto com barra',
  primaryMuscle: 'Peito',
  secondaryMuscles: ['Tríceps'],
  equipment: 'Barra',
};

test('a plan needs a non-empty name within the length limit', () => {
  assert.equal(createWorkoutPlan({ name: '' }), null);
  assert.equal(createWorkoutPlan({ name: '  ' }), null);
  assert.equal(createWorkoutPlan({ name: 'x'.repeat(161) }), null);
  assert.deepEqual(createWorkoutPlan({ name: 'Hipertrofia' }), {
    name: 'Hipertrofia',
    goal: null,
    days_per_week: null,
  });
});

test('days per week outside 1-7 is rejected, null is accepted', () => {
  assert.equal(createWorkoutPlan({ name: 'Plano', daysPerWeek: 0 }), null);
  assert.equal(createWorkoutPlan({ name: 'Plano', daysPerWeek: 8 }), null);
  assert.equal(createWorkoutPlan({ name: 'Plano', daysPerWeek: 3.5 }), null);
  assert.equal(createWorkoutPlan({ name: 'Plano', daysPerWeek: null })?.days_per_week, null);
  assert.equal(createWorkoutPlan({ name: 'Plano', daysPerWeek: 3 })?.days_per_week, 3);
});

test('a blank goal becomes null instead of an empty string', () => {
  assert.equal(createWorkoutPlan({ name: 'Plano', goal: '   ' })?.goal, null);
  assert.equal(createWorkoutPlan({ name: 'Plano', goal: 'Força' })?.goal, 'Força');
});

test('plan day needs a positive index and a name', () => {
  assert.equal(createPlanDay({ name: '', dayIndex: 1, orderIndex: 0 }), null);
  assert.equal(createPlanDay({ name: 'Dia A', dayIndex: 0, orderIndex: 0 }), null);
  assert.equal(createPlanDay({ name: 'Dia A', dayIndex: -1, orderIndex: 0 }), null);
  assert.deepEqual(createPlanDay({ name: 'Dia A', dayIndex: 1, orderIndex: 0 }), {
    name: 'Dia A',
    day_index: 1,
    order_index: 0,
  });
});

test('fromExercise/fromUserExercise tag the origin for the mutual-exclusion write', () => {
  const row = fromExercise({
    id: 'ex-1',
    name: 'Supino',
    primary_muscle: 'Peito',
    secondary_muscles: [],
    equipment: null,
    instructions: null,
    media_url: null,
    source: 'seed',
    verified: false,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
  });
  assert.equal(row.origin, 'exercise');
  const userRow = fromUserExercise({
    id: 'ux-1',
    user_id: 'owner',
    name: 'Remada no elástico',
    primary_muscle: 'Costas',
    secondary_muscles: [],
    equipment: null,
    instructions: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  });
  assert.equal(userRow.origin, 'user_exercise');
});

test('day exercise validates rep range order and rejects reversed min/max', () => {
  const base = {
    exercise,
    orderIndex: 0,
    targetSets: 3,
    minReps: 8,
    maxReps: 12,
    restSeconds: 90,
  };
  assert.deepEqual(createDayExercise(base), {
    exercise_id: 'ex-1',
    user_exercise_id: null,
    name_snapshot: 'Supino reto com barra',
    order_index: 0,
    target_sets: 3,
    min_reps: 8,
    max_reps: 12,
    rest_seconds: 90,
    notes: null,
  });
  assert.equal(createDayExercise({ ...base, minReps: 12, maxReps: 8 }), null);
  assert.equal(createDayExercise({ ...base, targetSets: 0 }), null);
  assert.equal(createDayExercise({ ...base, targetSets: 21 }), null);
  assert.equal(createDayExercise({ ...base, restSeconds: -1 }), null);
  assert.equal(createDayExercise({ ...base, restSeconds: 3601 }), null);
});

test('day exercise from a user exercise sets user_exercise_id, not exercise_id', () => {
  const userExercise: SelectableExercise = { ...exercise, origin: 'user_exercise', id: 'ux-1' };
  const entry = createDayExercise({
    exercise: userExercise,
    orderIndex: 0,
    targetSets: 3,
    minReps: 8,
    maxReps: 12,
    restSeconds: 90,
  });
  assert.equal(entry?.exercise_id, null);
  assert.equal(entry?.user_exercise_id, 'ux-1');
});

test('a set entry requires a valid client UUID and never lets an invalid one through', () => {
  assert.equal(
    createSetEntry({ id: 'not-a-uuid', sessionExerciseId: 'se-1', setNumber: 1, reps: 10 }),
    null,
  );
  assert.deepEqual(
    createSetEntry({ id: ID, sessionExerciseId: 'se-1', setNumber: 1, weightKg: 80, reps: 10 }),
    {
      id: ID,
      session_exercise_id: 'se-1',
      set_number: 1,
      weight_kg: 80,
      reps: 10,
      completed: true,
      rest_seconds: null,
    },
  );
});

test('set weight and reps out of the CHECK range never reach the server', () => {
  const base = { id: ID, sessionExerciseId: 'se-1', setNumber: 1, reps: 10 };
  assert.equal(createSetEntry({ ...base, weightKg: -1 }), null);
  assert.equal(createSetEntry({ ...base, weightKg: 501 }), null);
  assert.equal(createSetEntry({ ...base, reps: -1 }), null);
  assert.equal(createSetEntry({ ...base, reps: 201 }), null);
  assert.equal(createSetEntry({ ...base, setNumber: 0 }), null);
});
