/**
 * Leitura e escrita das preferências de notificação.
 *
 * Mesmo contrato das fases anteriores: `Result<T>` tagueado, `try/catch`,
 * `abortSignal`, filtro por dono. Upsert por `user_id` — uma linha por
 * usuário, mesmo padrão de `training_preferences`/`nutrition_preferences`.
 */
import type { KoraClient } from '@/services/supabase/client';
import type { NotificationPreferences } from '@/services/supabase/database.types';

export type Result<T> = { ok: true; data: T } | { ok: false };

const FAILED = { ok: false } as const;

const DEFAULTS: Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  water_enabled: false,
  workout_enabled: false,
  weight_enabled: false,
  summary_enabled: false,
  reminder_time: '15:00',
  summary_time: '21:00',
};

/** Ausência de linha ainda não é erro: o usuário simplesmente não configurou nada. */
export async function loadPreferences(
  client: KoraClient,
  userId: string,
  signal?: AbortSignal,
): Promise<Result<NotificationPreferences | null>> {
  try {
    const query = client.from('notification_preferences').select('*').eq('user_id', userId);
    if (signal) query.abortSignal(signal);
    const { data, error } = await query.maybeSingle();
    return error ? FAILED : { ok: true, data: data ?? null };
  } catch {
    return FAILED;
  }
}

export async function savePreferences(
  client: KoraClient,
  userId: string,
  patch: Partial<Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>,
  current: NotificationPreferences | null,
): Promise<Result<NotificationPreferences>> {
  try {
    const { data, error } = await client
      .from('notification_preferences')
      .upsert(
        {
          user_id: userId,
          water_enabled: current?.water_enabled ?? DEFAULTS.water_enabled,
          workout_enabled: current?.workout_enabled ?? DEFAULTS.workout_enabled,
          weight_enabled: current?.weight_enabled ?? DEFAULTS.weight_enabled,
          summary_enabled: current?.summary_enabled ?? DEFAULTS.summary_enabled,
          reminder_time: current?.reminder_time ?? DEFAULTS.reminder_time,
          summary_time: current?.summary_time ?? DEFAULTS.summary_time,
          ...patch,
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .maybeSingle();
    if (error || !data) return FAILED;
    return { ok: true, data };
  } catch {
    return FAILED;
  }
}
