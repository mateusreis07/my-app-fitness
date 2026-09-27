/**
 * Modelo de treino — KORA_MASTER_CONTEXT.md seções 38 a 42 e 70 a 76.
 *
 * Funções puras, sem React e sem rede. A validação de faixa espelha os CHECKs
 * de `supabase/migrations/0009_workouts.sql`; nenhuma delas lança, todas
 * devolvem `null` para uma entrada inválida, no molde de
 * `src/features/weight/model.ts`.
 */
import type {
  Exercise,
  UserExercise,
  WorkoutDayExercise,
  WorkoutPlan,
  WorkoutPlanDay,
} from '@/services/supabase/database.types';

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export const PLAN_NAME_MAX = 160;
export const PLAN_GOAL_MAX = 200;
export const DAY_NAME_MAX = 160;
export const NOTES_MAX = 500;
export const TARGET_SETS_MIN = 1;
export const TARGET_SETS_MAX = 20;
export const REPS_MIN = 1;
export const REPS_MAX = 200;
export const REST_SECONDS_MIN = 0;
export const REST_SECONDS_MAX = 3600;
export const SET_REPS_MIN = 0;
export const SET_REPS_MAX = 200;
export const SET_WEIGHT_KG_MIN = 0;
export const SET_WEIGHT_KG_MAX = 500;

/** Exercício escolhido, venha do catálogo global ou da lista do usuário. */
export type SelectableExercise = {
  origin: 'exercise' | 'user_exercise';
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  equipment: string | null;
};

export function fromExercise(row: Exercise): SelectableExercise {
  return {
    origin: 'exercise',
    id: row.id,
    name: row.name,
    primaryMuscle: row.primary_muscle,
    secondaryMuscles: row.secondary_muscles,
    equipment: row.equipment,
  };
}

export function fromUserExercise(row: UserExercise): SelectableExercise {
  return {
    origin: 'user_exercise',
    id: row.id,
    name: row.name,
    primaryMuscle: row.primary_muscle,
    secondaryMuscles: row.secondary_muscles,
    equipment: row.equipment,
  };
}

function cleanText(value: string, max: number): string | null {
  const clean = value.trim();
  return clean.length > 0 && clean.length <= max ? clean : null;
}

function cleanOptionalText(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  const clean = value.trim();
  if (clean.length === 0) return null;
  return clean.length <= max ? clean : null;
}

export type PlanEntry = Pick<WorkoutPlan, 'name' | 'goal' | 'days_per_week'>;

export function createWorkoutPlan(input: {
  name: string;
  goal?: string | null;
  daysPerWeek?: number | null;
}): PlanEntry | null {
  const name = cleanText(input.name, PLAN_NAME_MAX);
  if (!name) return null;
  const goal = input.goal === undefined ? null : cleanOptionalText(input.goal, PLAN_GOAL_MAX);
  if (input.goal != null && input.goal.trim().length > 0 && goal === null) return null;
  const daysPerWeek = input.daysPerWeek ?? null;
  if (
    daysPerWeek !== null &&
    (!Number.isInteger(daysPerWeek) || daysPerWeek < 1 || daysPerWeek > 7)
  )
    return null;
  return { name, goal, days_per_week: daysPerWeek };
}

export type PlanDayEntry = Pick<WorkoutPlanDay, 'name' | 'day_index' | 'order_index'>;

export function createPlanDay(input: {
  name: string;
  dayIndex: number;
  orderIndex: number;
}): PlanDayEntry | null {
  const name = cleanText(input.name, DAY_NAME_MAX);
  if (!name) return null;
  if (!Number.isInteger(input.dayIndex) || input.dayIndex <= 0) return null;
  if (!Number.isInteger(input.orderIndex) || input.orderIndex < 0) return null;
  return { name, day_index: input.dayIndex, order_index: input.orderIndex };
}

export type DayExerciseEntry = Pick<
  WorkoutDayExercise,
  | 'exercise_id'
  | 'user_exercise_id'
  | 'name_snapshot'
  | 'order_index'
  | 'target_sets'
  | 'min_reps'
  | 'max_reps'
  | 'rest_seconds'
  | 'notes'
>;

/** A origem é o exercício escolhido no seletor; o nome vira snapshot na hora. */
export function createDayExercise(input: {
  exercise: SelectableExercise;
  orderIndex: number;
  targetSets: number;
  minReps: number;
  maxReps: number;
  restSeconds: number;
  notes?: string | null;
}): DayExerciseEntry | null {
  const nameSnapshot = cleanText(input.exercise.name, DAY_NAME_MAX);
  if (!nameSnapshot) return null;
  if (!Number.isInteger(input.orderIndex) || input.orderIndex < 0) return null;
  if (
    !Number.isInteger(input.targetSets) ||
    input.targetSets < TARGET_SETS_MIN ||
    input.targetSets > TARGET_SETS_MAX
  )
    return null;
  if (
    !Number.isInteger(input.minReps) ||
    !Number.isInteger(input.maxReps) ||
    input.minReps < REPS_MIN ||
    input.maxReps > REPS_MAX ||
    input.minReps > input.maxReps
  )
    return null;
  if (
    !Number.isInteger(input.restSeconds) ||
    input.restSeconds < REST_SECONDS_MIN ||
    input.restSeconds > REST_SECONDS_MAX
  )
    return null;
  const notes = cleanOptionalText(input.notes, NOTES_MAX);
  if (input.notes != null && input.notes.trim().length > 0 && notes === null) return null;
  return {
    exercise_id: input.exercise.origin === 'exercise' ? input.exercise.id : null,
    user_exercise_id: input.exercise.origin === 'user_exercise' ? input.exercise.id : null,
    name_snapshot: nameSnapshot,
    order_index: input.orderIndex,
    target_sets: input.targetSets,
    min_reps: input.minReps,
    max_reps: input.maxReps,
    rest_seconds: input.restSeconds,
    notes,
  };
}

/** O que o cliente envia para gravar uma série. `created_at` fica com o banco. */
export type SetEntry = {
  id: string;
  session_exercise_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number;
  completed: boolean;
  rest_seconds: number | null;
};

/**
 * Monta a entrada de uma série registrada durante a sessão. Carrega o próprio
 * UUID (gerado no cliente) porque é o único ponto de escrita da fase que
 * precisa do protocolo de idempotência da Fase 6/7 — toques repetidos durante
 * o treino não podem virar séries duplicadas.
 */
export function createSetEntry(input: {
  id: string;
  sessionExerciseId: string;
  setNumber: number;
  weightKg?: number | null;
  reps: number;
  completed?: boolean;
  restSeconds?: number | null;
}): SetEntry | null {
  if (!UUID.test(input.id) || !input.sessionExerciseId) return null;
  if (!Number.isInteger(input.setNumber) || input.setNumber <= 0) return null;
  const weightKg = input.weightKg ?? null;
  if (
    weightKg !== null &&
    (!Number.isFinite(weightKg) || weightKg < SET_WEIGHT_KG_MIN || weightKg > SET_WEIGHT_KG_MAX)
  )
    return null;
  if (!Number.isInteger(input.reps) || input.reps < SET_REPS_MIN || input.reps > SET_REPS_MAX)
    return null;
  const restSeconds = input.restSeconds ?? null;
  if (
    restSeconds !== null &&
    (!Number.isInteger(restSeconds) || restSeconds < 0 || restSeconds > REST_SECONDS_MAX)
  )
    return null;
  return {
    id: input.id,
    session_exercise_id: input.sessionExerciseId,
    set_number: input.setNumber,
    weight_kg: weightKg,
    reps: input.reps,
    completed: input.completed ?? true,
    rest_seconds: restSeconds,
  };
}
