/**
 * Leituras e escritas de treino.
 *
 * Mesmo contrato das fases anteriores: `Result<T>` tagueado, `try/catch` que
 * nunca deixa exceção escapar, `abortSignal` em toda consulta, filtro
 * explícito por dono onde a tabela tem `user_id` (mesmo com RLS já
 * cobrindo). Onde a posse vem de uma tabela-pai sem `user_id` próprio
 * (`workout_day_exercises`, `workout_session_exercises`, `workout_sets`), a
 * RLS é a única barreira — mesmo padrão de `meal_items` em
 * `src/features/nutrition/repository.ts`.
 *
 * Sem transação entre chamadas REST: pai é sempre gravado antes do filho. Se o
 * filho falhar, sobra um pai vazio, que a tela trata como "nada registrado".
 */
import type { KoraClient } from '@/services/supabase/client';
import type {
  Exercise,
  UserExercise,
  WorkoutDayExercise,
  WorkoutPlan,
  WorkoutPlanDay,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
} from '@/services/supabase/database.types';
import {
  fromExercise,
  fromUserExercise,
  type DayExerciseEntry,
  type PlanDayEntry,
  type PlanEntry,
  type SelectableExercise,
  type SetEntry,
} from './model.ts';

export type Result<T> = { ok: true; data: T } | { ok: false };

const FAILED = { ok: false } as const;

export const CATALOG_LIMIT = 500;
export const SESSION_HISTORY_LIMIT = 20;
export const SET_PAGE_SIZE = 200;

/** Base global (ativa) mais o catálogo do próprio usuário. */
export async function loadExerciseCatalog(
  client: KoraClient,
  userId: string,
  signal?: AbortSignal,
): Promise<Result<SelectableExercise[]>> {
  try {
    const ownQuery = client
      .from('user_exercises')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true })
      .limit(CATALOG_LIMIT);
    const globalQuery = client
      .from('exercises')
      .select('*')
      .eq('active', true)
      .order('name', { ascending: true })
      .limit(CATALOG_LIMIT);
    if (signal) {
      ownQuery.abortSignal(signal);
      globalQuery.abortSignal(signal);
    }
    const [own, global] = await Promise.all([ownQuery, globalQuery]);
    if (own.error || global.error) return FAILED;
    return {
      ok: true,
      data: [
        ...((own.data ?? []) as UserExercise[]).map(fromUserExercise),
        ...((global.data ?? []) as Exercise[]).map(fromExercise),
      ],
    };
  } catch {
    return FAILED;
  }
}

export type PlanWithDays = {
  plan: WorkoutPlan;
  days: (WorkoutPlanDay & { exercises: WorkoutDayExercise[] })[];
};

/** O plano ativo do usuário, com dias e exercícios já aninhados. */
export async function loadActivePlan(
  client: KoraClient,
  userId: string,
  signal?: AbortSignal,
): Promise<Result<PlanWithDays | null>> {
  try {
    const planQuery = client
      .from('workout_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true);
    if (signal) planQuery.abortSignal(signal);
    const plan = await planQuery.maybeSingle();
    if (plan.error) return FAILED;
    if (!plan.data) return { ok: true, data: null };

    const daysQuery = client
      .from('workout_plan_days')
      .select('*')
      .eq('plan_id', plan.data.id)
      .order('day_index', { ascending: true });
    if (signal) daysQuery.abortSignal(signal);
    const days = await daysQuery;
    if (days.error) return FAILED;
    const dayRows = (days.data ?? []) as WorkoutPlanDay[];
    if (dayRows.length === 0) return { ok: true, data: { plan: plan.data, days: [] } };

    const exercisesQuery = client
      .from('workout_day_exercises')
      .select('*')
      .in(
        'workout_day_id',
        dayRows.map((day) => day.id),
      )
      .order('order_index', { ascending: true });
    if (signal) exercisesQuery.abortSignal(signal);
    const exercises = await exercisesQuery;
    if (exercises.error) return FAILED;
    const exerciseRows = (exercises.data ?? []) as WorkoutDayExercise[];

    return {
      ok: true,
      data: {
        plan: plan.data,
        days: dayRows.map((day) => ({
          ...day,
          exercises: exerciseRows.filter((exercise) => exercise.workout_day_id === day.id),
        })),
      },
    };
  } catch {
    return FAILED;
  }
}

export async function createPlan(
  client: KoraClient,
  userId: string,
  entry: PlanEntry,
): Promise<Result<WorkoutPlan>> {
  try {
    const { data, error } = await client
      .from('workout_plans')
      .insert({ ...entry, user_id: userId, active: true })
      .select('*')
      .maybeSingle();
    if (error || !data) return FAILED;
    return { ok: true, data };
  } catch {
    return FAILED;
  }
}

/** Só um plano ativo por vez (índice `workout_plans_one_active_per_user`). */
export async function deactivatePlan(
  client: KoraClient,
  userId: string,
  planId: string,
): Promise<Result<null>> {
  try {
    const { error } = await client
      .from('workout_plans')
      .update({ active: false })
      .eq('user_id', userId)
      .eq('id', planId);
    return error ? FAILED : { ok: true, data: null };
  } catch {
    return FAILED;
  }
}

export async function removePlan(
  client: KoraClient,
  userId: string,
  planId: string,
): Promise<Result<null>> {
  try {
    // Dias e exercícios-do-dia caem em cascata (on delete cascade).
    const { error } = await client
      .from('workout_plans')
      .delete()
      .eq('user_id', userId)
      .eq('id', planId);
    return error ? FAILED : { ok: true, data: null };
  } catch {
    return FAILED;
  }
}

export async function createPlanDay(
  client: KoraClient,
  planId: string,
  entry: PlanDayEntry,
): Promise<Result<WorkoutPlanDay>> {
  try {
    const { data, error } = await client
      .from('workout_plan_days')
      .insert({ ...entry, plan_id: planId })
      .select('*')
      .maybeSingle();
    if (error || !data) return FAILED;
    return { ok: true, data };
  } catch {
    return FAILED;
  }
}

export async function removePlanDay(client: KoraClient, dayId: string): Promise<Result<null>> {
  try {
    // RLS já impede apagar dia de plano alheio.
    const { error } = await client.from('workout_plan_days').delete().eq('id', dayId);
    return error ? FAILED : { ok: true, data: null };
  } catch {
    return FAILED;
  }
}

export async function createDayExercise(
  client: KoraClient,
  workoutDayId: string,
  entry: DayExerciseEntry,
): Promise<Result<WorkoutDayExercise>> {
  try {
    const { data, error } = await client
      .from('workout_day_exercises')
      .insert({ ...entry, workout_day_id: workoutDayId })
      .select('*')
      .maybeSingle();
    if (error || !data) return FAILED;
    return { ok: true, data };
  } catch {
    return FAILED;
  }
}

export async function removeDayExercise(
  client: KoraClient,
  dayExerciseId: string,
): Promise<Result<null>> {
  try {
    const { error } = await client.from('workout_day_exercises').delete().eq('id', dayExerciseId);
    return error ? FAILED : { ok: true, data: null };
  } catch {
    return FAILED;
  }
}

export type SessionWithExercises = {
  session: WorkoutSession;
  exercises: WorkoutSessionExercise[];
};

/**
 * Sessão em andamento, se houver — para retomar depois do app fechar no meio
 * de um treino, em vez de começar uma segunda sessão por engano.
 */
export async function loadInProgressSession(
  client: KoraClient,
  userId: string,
  signal?: AbortSignal,
): Promise<Result<SessionWithExercises | null>> {
  try {
    const sessionQuery = client
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })
      .limit(1);
    if (signal) sessionQuery.abortSignal(signal);
    const session = await sessionQuery.maybeSingle();
    if (session.error) return FAILED;
    if (!session.data) return { ok: true, data: null };

    const exercisesQuery = client
      .from('workout_session_exercises')
      .select('*')
      .eq('session_id', session.data.id)
      .order('order_index', { ascending: true });
    if (signal) exercisesQuery.abortSignal(signal);
    const exercises = await exercisesQuery;
    if (exercises.error) return FAILED;

    return { ok: true, data: { session: session.data, exercises: exercises.data ?? [] } };
  } catch {
    return FAILED;
  }
}

/**
 * Inicia uma sessão a partir de um dia de plano (ou avulsa, se `workoutDayId`
 * for `null`), copiando o nome de cada exercício para `name_snapshot` — a
 * sessão não pode perder o nome se o plano for editado depois.
 */
export async function startSession(
  client: KoraClient,
  userId: string,
  input: {
    workoutDayId: string | null;
    dayNameSnapshot: string | null;
    exercises: { exerciseId: string | null; userExerciseId: string | null; nameSnapshot: string }[];
  },
): Promise<Result<SessionWithExercises>> {
  try {
    const session = await client
      .from('workout_sessions')
      .insert({
        user_id: userId,
        workout_day_id: input.workoutDayId,
        day_name_snapshot: input.dayNameSnapshot,
        status: 'in_progress',
      })
      .select('*')
      .maybeSingle();
    if (session.error || !session.data) return FAILED;
    const sessionRow = session.data;

    if (input.exercises.length === 0)
      return { ok: true, data: { session: sessionRow, exercises: [] } };

    const exercises = await client
      .from('workout_session_exercises')
      .insert(
        input.exercises.map((exercise, index) => ({
          session_id: sessionRow.id,
          exercise_id: exercise.exerciseId,
          user_exercise_id: exercise.userExerciseId,
          name_snapshot: exercise.nameSnapshot,
          order_index: index,
        })),
      )
      .select('*');
    if (exercises.error || !exercises.data) return FAILED;

    return { ok: true, data: { session: sessionRow, exercises: exercises.data } };
  } catch {
    return FAILED;
  }
}

export async function finishSession(
  client: KoraClient,
  userId: string,
  sessionId: string,
  completedAt: Date,
  durationSeconds: number,
): Promise<Result<WorkoutSession>> {
  try {
    const { data, error } = await client
      .from('workout_sessions')
      .update({
        status: 'completed',
        completed_at: completedAt.toISOString(),
        duration_seconds: durationSeconds,
      })
      .eq('user_id', userId)
      .eq('id', sessionId)
      .select('*')
      .maybeSingle();
    if (error || !data) return FAILED;
    return { ok: true, data };
  } catch {
    return FAILED;
  }
}

export async function abandonSession(
  client: KoraClient,
  userId: string,
  sessionId: string,
): Promise<Result<null>> {
  try {
    const { error } = await client
      .from('workout_sessions')
      .update({ status: 'abandoned' })
      .eq('user_id', userId)
      .eq('id', sessionId);
    return error ? FAILED : { ok: true, data: null };
  } catch {
    return FAILED;
  }
}

/** INSERT … ON CONFLICT DO NOTHING + releitura: retry não altera nem duplica a série. */
export async function saveSet(client: KoraClient, entry: SetEntry): Promise<Result<WorkoutSet>> {
  try {
    const saved = await client
      .from('workout_sets')
      .upsert(entry, { onConflict: 'id', ignoreDuplicates: true });
    if (saved.error) return FAILED;
    const { data, error } = await client
      .from('workout_sets')
      .select('*')
      .eq('id', entry.id)
      .maybeSingle();
    if (
      error ||
      !data ||
      data.reps !== entry.reps ||
      Number(data.weight_kg ?? null) !== (entry.weight_kg ?? null) ||
      data.set_number !== entry.set_number
    )
      return FAILED;
    return { ok: true, data };
  } catch {
    return FAILED;
  }
}

export async function removeSet(client: KoraClient, setId: string): Promise<Result<null>> {
  try {
    // RLS já impede apagar série de sessão alheia.
    const { error } = await client.from('workout_sets').delete().eq('id', setId);
    return error ? FAILED : { ok: true, data: null };
  } catch {
    return FAILED;
  }
}

export async function loadSessionSets(
  client: KoraClient,
  sessionExerciseId: string,
  signal?: AbortSignal,
): Promise<Result<WorkoutSet[]>> {
  try {
    const query = client
      .from('workout_sets')
      .select('*')
      .eq('session_exercise_id', sessionExerciseId)
      .order('set_number', { ascending: true })
      .limit(SET_PAGE_SIZE);
    if (signal) query.abortSignal(signal);
    const { data, error } = await query;
    if (error || !data) return FAILED;
    return { ok: true, data };
  } catch {
    return FAILED;
  }
}

/**
 * Sinal do dia para o dashboard e para a prioridade `workout`: existe plano
 * ativo com pelo menos um dia (`scheduled`) e existe sessão concluída hoje
 * (`completed`). Ver decisão registrada na migration 0009 sobre o que
 * "programado" significa aqui.
 */
export async function loadTodaySignal(
  client: KoraClient,
  userId: string,
  dayKey: string,
  signal?: AbortSignal,
): Promise<Result<{ scheduled: boolean; completed: boolean }>> {
  try {
    const planQuery = client
      .from('workout_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true);
    if (signal) planQuery.abortSignal(signal);
    const plan = await planQuery.maybeSingle();
    if (plan.error) return FAILED;

    let scheduled = false;
    if (plan.data) {
      const daysQuery = client
        .from('workout_plan_days')
        .select('id')
        .eq('plan_id', plan.data.id)
        .limit(1);
      if (signal) daysQuery.abortSignal(signal);
      const days = await daysQuery;
      if (days.error) return FAILED;
      scheduled = (days.data ?? []).length > 0;
    }

    const dayStart = `${dayKey}T00:00:00.000Z`;
    const dayEnd = `${dayKey}T23:59:59.999Z`;
    const sessionsQuery = client
      .from('workout_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('completed_at', dayStart)
      .lte('completed_at', dayEnd)
      .limit(1);
    if (signal) sessionsQuery.abortSignal(signal);
    const sessions = await sessionsQuery;
    if (sessions.error) return FAILED;

    return { ok: true, data: { scheduled, completed: (sessions.data ?? []).length > 0 } };
  } catch {
    return FAILED;
  }
}

export type RecentSessionsSummary = { completedLast7Days: number; lastSessionAt: string | null };

/** Aderência simples para a aba Progresso: sem gráfico nesta fase. */
export async function loadRecentSessionsSummary(
  client: KoraClient,
  userId: string,
  sinceIso: string,
  signal?: AbortSignal,
): Promise<Result<RecentSessionsSummary>> {
  try {
    const recentQuery = client
      .from('workout_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('completed_at', sinceIso);
    if (signal) recentQuery.abortSignal(signal);
    const recent = await recentQuery;
    if (recent.error) return FAILED;

    const lastQuery = client
      .from('workout_sessions')
      .select('completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1);
    if (signal) lastQuery.abortSignal(signal);
    const last = await lastQuery.maybeSingle();
    if (last.error) return FAILED;

    return {
      ok: true,
      data: {
        completedLast7Days: (recent.data ?? []).length,
        lastSessionAt: last.data?.completed_at ?? null,
      },
    };
  } catch {
    return FAILED;
  }
}

export type ExerciseHistorySession = {
  sessionId: string;
  sets: { reps: number; completed: boolean }[];
};

/**
 * Histórico de séries de um exercício, agrupado por sessão concluída, da mais
 * recente para a mais antiga — a forma que `progression.ts` espera.
 */
export async function loadExerciseHistory(
  client: KoraClient,
  userId: string,
  exercise: { exerciseId: string | null; userExerciseId: string | null },
  signal?: AbortSignal,
): Promise<Result<ExerciseHistorySession[]>> {
  try {
    const sessionsQuery = client
      .from('workout_sessions')
      .select('id, completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(SESSION_HISTORY_LIMIT);
    if (signal) sessionsQuery.abortSignal(signal);
    const sessions = await sessionsQuery;
    if (sessions.error || !sessions.data) return FAILED;
    const sessionIds = sessions.data.map((row) => row.id as string);
    if (sessionIds.length === 0) return { ok: true, data: [] };

    if (!exercise.exerciseId && !exercise.userExerciseId) return { ok: true, data: [] };
    const exercisesQuery = exercise.exerciseId
      ? client
          .from('workout_session_exercises')
          .select('id, session_id')
          .in('session_id', sessionIds)
          .eq('exercise_id', exercise.exerciseId)
      : client
          .from('workout_session_exercises')
          .select('id, session_id')
          .in('session_id', sessionIds)
          .eq('user_exercise_id', exercise.userExerciseId as string);
    if (signal) exercisesQuery.abortSignal(signal);
    const sessionExercises = await exercisesQuery;
    if (sessionExercises.error || !sessionExercises.data) return FAILED;
    if (sessionExercises.data.length === 0) return { ok: true, data: [] };

    const setsQuery = client
      .from('workout_sets')
      .select('session_exercise_id, reps, completed')
      .in(
        'session_exercise_id',
        sessionExercises.data.map((row) => row.id as string),
      );
    if (signal) setsQuery.abortSignal(signal);
    const sets = await setsQuery;
    if (sets.error || !sets.data) return FAILED;

    const bySessionExercise = new Map<string, string>(
      sessionExercises.data.map((row) => [row.id as string, row.session_id as string]),
    );
    // Preserva a ordem de `sessions.data`, que já veio da mais recente.
    const order = new Map(sessionIds.map((id, index) => [id, index]));
    const grouped = new Map<string, { reps: number; completed: boolean }[]>();
    for (const set of sets.data as {
      session_exercise_id: string;
      reps: number;
      completed: boolean;
    }[]) {
      const sessionId = bySessionExercise.get(set.session_exercise_id);
      if (!sessionId) continue;
      const list = grouped.get(sessionId) ?? [];
      list.push({ reps: set.reps, completed: set.completed });
      grouped.set(sessionId, list);
    }
    return {
      ok: true,
      data: [...grouped.entries()]
        .sort((a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0))
        .map(([sessionId, sets]) => ({ sessionId, sets })),
    };
  } catch {
    return FAILED;
  }
}
