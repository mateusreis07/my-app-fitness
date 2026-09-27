import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { getSupabaseClient } from '@/services/supabase/client';
import { type SelectableExercise } from './model';
import { loadExerciseCatalog } from './repository';

/** Lista mesclada (catálogo global + exercícios do usuário) para os seletores de plano/sessão. */
export function useWorkoutCatalog() {
  const { user } = useAuth();
  const userId = user?.id;
  const [exercises, setExercises] = useState<SelectableExercise[] | null>(null);
  const [error, setError] = useState(false);
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
    const result = await loadExerciseCatalog(client, userId, abort.signal);
    if (id !== request.current || abort.signal.aborted || !active.current) return;
    setExercises(result.ok ? result.data : null);
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

  return { exercises: exercises ?? [], loading: exercises === null && !error, error, reload };
}
