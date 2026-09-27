import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { getSupabaseClient } from '@/services/supabase/client';
import type { NotificationPreferences } from '@/services/supabase/database.types';
import { loadPreferences, savePreferences } from './repository';
import { requestPermission } from './scheduler';

type Patch = Partial<Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

/**
 * Preferências de notificação, para a tela `/profile`. Ativar um tipo pela
 * primeira vez pede a permissão do sistema; negada, o toggle não é salvo como
 * ativo e a tela mostra o aviso — nunca tenta agendar sem permissão.
 */
export function useNotificationPreferences() {
  const { user } = useAuth();
  const userId = user?.id;
  const [preferences, setPreferences] = useState<NotificationPreferences | null | undefined>(
    undefined,
  );
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const active = useRef(false);

  const reload = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client || !userId) return;
    const result = await loadPreferences(client, userId);
    if (!active.current) return;
    setPreferences(result.ok ? result.data : null);
    setError(!result.ok);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      active.current = true;
      void reload();
      return () => {
        active.current = false;
      };
    }, [reload]),
  );

  async function save(patch: Patch) {
    const client = getSupabaseClient();
    if (busy || !client || !userId) return false;
    setBusy(true);
    try {
      const result = await savePreferences(client, userId, patch, preferences ?? null);
      if (active.current && result.ok) setPreferences(result.data);
      return result.ok;
    } finally {
      if (active.current) setBusy(false);
    }
  }

  async function setEnabled(
    type: 'water_enabled' | 'workout_enabled' | 'weight_enabled' | 'summary_enabled',
    value: boolean,
  ) {
    setPermissionDenied(false);
    if (value) {
      const permission = await requestPermission();
      if (permission !== 'granted') {
        setPermissionDenied(true);
        return;
      }
    }
    await save({ [type]: value });
  }

  async function setTime(kind: 'reminder_time' | 'summary_time', value: string) {
    await save({ [kind]: value });
  }

  return {
    preferences: preferences ?? null,
    loading: preferences === undefined,
    error,
    busy,
    permissionDenied,
    setEnabled,
    setTime,
    dismissPermissionWarning: () => setPermissionDenied(false),
    reload,
  };
}
