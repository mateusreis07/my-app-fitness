import { randomUUID } from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { getSupabaseClient } from '@/services/supabase/client';
import type { WorkoutSet } from '@/services/supabase/database.types';
import { createSetEntry, type SetEntry } from './model';
import {
  abandonSession,
  finishSession,
  loadInProgressSession,
  loadSessionSets,
  removeSet as removeSetRow,
  saveSet,
  startSession,
  type PlanWithDays,
  type SessionWithExercises,
} from './repository';

/**
 * Sessão de treino ao vivo — seção 41. Molde do hook de dia da Fase 6/7:
 * `lock`/`active`/`request`/`controller`, e o protocolo de pendência que
 * repete o **mesmo UUID** quando a resposta de `logSet` foi incerta, porque
 * um toque duplo durante o treino não pode virar série duplicada.
 */
export function useWorkoutSession() {
  const { user } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState<{
    session: SessionWithExercises | null;
    sets: Record<string, WorkoutSet[]>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<SetEntry | null>(null);
  const [feedback, setFeedback] = useState<
    'saved' | 'saveFailed' | 'removed' | 'removeFailed' | null
  >(null);
  const lock = useRef(false);
  const active = useRef(false);

  const loadSets = useCallback(async (sessionData: SessionWithExercises) => {
    const client = getSupabaseClient();
    if (!client) return {};
    const entries = await Promise.all(
      sessionData.exercises.map(async (exercise) => {
        const result = await loadSessionSets(client, exercise.id);
        return [exercise.id, result.ok ? result.data : []] as const;
      }),
    );
    return Object.fromEntries(entries);
  }, []);

  const reload = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client || !userId) return;
    setLoading(true);
    try {
      const result = await loadInProgressSession(client, userId);
      if (!active.current) return;
      if (!result.ok || !result.data) {
        setState({ session: null, sets: {} });
        return;
      }
      const sets = await loadSets(result.data);
      if (active.current) setState({ session: result.data, sets });
    } finally {
      if (active.current) setLoading(false);
    }
  }, [userId, loadSets]);

  useFocusEffect(
    useCallback(() => {
      active.current = true;
      void reload();
      return () => {
        active.current = false;
      };
    }, [reload]),
  );

  async function start(day: PlanWithDays['days'][number] | null): Promise<boolean> {
    const client = getSupabaseClient();
    if (lock.current || !client || !userId) return false;
    lock.current = true;
    setBusy(true);
    try {
      const result = await startSession(client, userId, {
        workoutDayId: day?.id ?? null,
        dayNameSnapshot: day?.name ?? null,
        exercises: (day?.exercises ?? []).map((exercise) => ({
          exerciseId: exercise.exercise_id,
          userExerciseId: exercise.user_exercise_id,
          nameSnapshot: exercise.name_snapshot,
        })),
      });
      if (result.ok && active.current) setState({ session: result.data, sets: {} });
      return result.ok;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function logSet(input: {
    sessionExerciseId: string;
    setNumber: number;
    weightKg?: number | null;
    reps: number;
    completed?: boolean;
    restSeconds?: number | null;
  }): Promise<boolean> {
    const client = getSupabaseClient();
    if (lock.current || !client) return false;
    // Enquanto há resposta incerta, repetir somente a série original.
    const entry = pending ?? createSetEntry({ ...input, id: randomUUID() });
    if (!entry) return false;
    lock.current = true;
    setBusy(true);
    setFeedback(null);
    setPending(entry);
    try {
      const result = await saveSet(client, entry);
      if (result.ok) setPending(null);
      if (active.current) {
        setFeedback(result.ok ? 'saved' : 'saveFailed');
        if (result.ok && state)
          setState({
            ...state,
            sets: {
              ...state.sets,
              [entry.session_exercise_id]: [
                ...(state.sets[entry.session_exercise_id] ?? []).filter(
                  (set) => set.set_number !== entry.set_number,
                ),
                result.data,
              ].sort((a, b) => a.set_number - b.set_number),
            },
          });
      }
      return result.ok;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function removeSet(sessionExerciseId: string, setId: string) {
    const client = getSupabaseClient();
    if (lock.current || !client) return;
    lock.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await removeSetRow(client, setId);
      if (active.current) {
        setFeedback(result.ok ? 'removed' : 'removeFailed');
        if (result.ok && state)
          setState({
            ...state,
            sets: {
              ...state.sets,
              [sessionExerciseId]: (state.sets[sessionExerciseId] ?? []).filter(
                (set) => set.id !== setId,
              ),
            },
          });
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function finish(startedAt: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (lock.current || !client || !userId || !state?.session) return false;
    lock.current = true;
    setBusy(true);
    try {
      const now = new Date();
      const durationSeconds = Math.max(
        0,
        Math.round((now.getTime() - new Date(startedAt).getTime()) / 1000),
      );
      const result = await finishSession(
        client,
        userId,
        state.session.session.id,
        now,
        durationSeconds,
      );
      if (result.ok && active.current) setState({ session: null, sets: {} });
      return result.ok;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function abandon() {
    const client = getSupabaseClient();
    if (lock.current || !client || !userId || !state?.session) return;
    lock.current = true;
    setBusy(true);
    try {
      await abandonSession(client, userId, state.session.session.id);
      if (active.current) setState({ session: null, sets: {} });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return {
    session: state?.session ?? null,
    sets: state?.sets ?? {},
    loading,
    busy,
    pending,
    feedback,
    start,
    logSet,
    removeSet,
    finish,
    abandon,
    reload,
    clearPending: () => {
      setPending(null);
      setFeedback(null);
    },
  };
}
