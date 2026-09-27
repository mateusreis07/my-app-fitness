import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { getSupabaseClient } from '@/services/supabase/client';
import {
  createDayExercise as buildDayExercise,
  createPlanDay as buildPlanDay,
  createWorkoutPlan,
  type SelectableExercise,
} from './model';
import {
  createDayExercise,
  createPlan as createPlanRow,
  createPlanDay,
  deactivatePlan,
  loadActivePlan,
  removeDayExercise,
  removePlan as removePlanRow,
  removePlanDay,
  type PlanWithDays,
} from './repository';

/**
 * Plano ativo do usuário, com as operações de construção manual (sem geração
 * automática, por decisão do responsável — ver `docs/PHASE_8.md`).
 */
export function useWorkoutPlans() {
  const { user } = useAuth();
  const userId = user?.id;
  const [plan, setPlan] = useState<PlanWithDays | null | undefined>(undefined);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const reload = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client || !userId) return;
    const id = ++request.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const result = await loadActivePlan(client, userId, abort.signal);
    if (id !== request.current || abort.signal.aborted || !active.current) return;
    setPlan(result.ok ? result.data : null);
    setError(!result.ok);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      active.current = true;
      void reload();
      return () => {
        active.current = false;
        ++request.current;
        controller.current?.abort();
      };
    }, [reload]),
  );

  async function createPlan(input: {
    name: string;
    goal?: string | null;
    daysPerWeek?: number | null;
  }) {
    const client = getSupabaseClient();
    const entry = createWorkoutPlan(input);
    if (busy || !client || !userId || !entry) return false;
    setBusy(true);
    try {
      // Só um plano ativo por vez: o anterior é desativado antes do novo
      // nascer, para não colidir com o índice parcial.
      if (plan) await deactivatePlan(client, userId, plan.plan.id);
      const result = await createPlanRow(client, userId, entry);
      await reload();
      return result.ok;
    } finally {
      setBusy(false);
    }
  }

  async function removePlan() {
    const client = getSupabaseClient();
    if (busy || !client || !userId || !plan) return;
    setBusy(true);
    try {
      await removePlanRow(client, userId, plan.plan.id);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function addDay(name: string) {
    const client = getSupabaseClient();
    if (busy || !client || !plan) return false;
    const nextIndex = plan.days.length + 1;
    const entry = buildPlanDay({ name, dayIndex: nextIndex, orderIndex: plan.days.length });
    if (!entry) return false;
    setBusy(true);
    try {
      const result = await createPlanDay(client, plan.plan.id, entry);
      await reload();
      return result.ok;
    } finally {
      setBusy(false);
    }
  }

  async function removeDay(dayId: string) {
    const client = getSupabaseClient();
    if (busy || !client) return;
    setBusy(true);
    try {
      await removePlanDay(client, dayId);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function addExercise(
    dayId: string,
    input: {
      exercise: SelectableExercise;
      targetSets: number;
      minReps: number;
      maxReps: number;
      restSeconds: number;
      notes?: string | null;
    },
  ) {
    const client = getSupabaseClient();
    const day = plan?.days.find((candidate) => candidate.id === dayId);
    if (busy || !client || !day) return false;
    const entry = buildDayExercise({ ...input, orderIndex: day.exercises.length });
    if (!entry) return false;
    setBusy(true);
    try {
      const result = await createDayExercise(client, dayId, entry);
      await reload();
      return result.ok;
    } finally {
      setBusy(false);
    }
  }

  async function removeExercise(dayExerciseId: string) {
    const client = getSupabaseClient();
    if (busy || !client) return;
    setBusy(true);
    try {
      await removeDayExercise(client, dayExerciseId);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return {
    plan: plan ?? null,
    loading: plan === undefined,
    error,
    busy,
    reload,
    createPlan,
    removePlan,
    addDay,
    removeDay,
    addExercise,
    removeExercise,
  };
}
