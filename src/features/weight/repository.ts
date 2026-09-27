/**
 * Leituras e escritas do peso.
 *
 * Mesmo contrato da Fase 6: resultado tagueado, `try/catch` que nunca deixa
 * exceção escapar, `abortSignal` em toda consulta e filtro por dono. Ausência
 * de registro é lista vazia, nunca erro — e nunca zero.
 */
import type { KoraClient } from '@/services/supabase/client';
import type { Goal, WeightLog } from '@/services/supabase/database.types';
import { validWeight, type WeightEntry } from './model.ts';

export type WeightResult<T> = { ok: true; data: T } | { ok: false };

const FAILED = { ok: false } as const;

/** Página da leitura por cursor. O teto de linhas do Supabase não pode truncar a série em silêncio. */
export const WEIGHT_PAGE_SIZE = 200;

/**
 * Histórico a partir de um dia, para a série do gráfico.
 *
 * Pagina por `id` crescente porque o cursor precisa ser estável: dois registros
 * no mesmo dia empatariam em `recorded_date`.
 */
export async function loadWeightHistory(
  client: KoraClient,
  userId: string,
  fromDay: string,
  signal?: AbortSignal,
): Promise<WeightResult<WeightLog[]>> {
  try {
    const rows: WeightLog[] = [];
    let after: string | null = null;
    for (;;) {
      const query = client
        .from('weight_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('recorded_date', fromDay)
        .order('id', { ascending: true })
        .limit(WEIGHT_PAGE_SIZE);
      if (after) query.gt('id', after);
      if (signal) query.abortSignal(signal);
      const { data, error } = await query;
      if (error || !data) return FAILED;
      rows.push(...data);
      if (data.length < WEIGHT_PAGE_SIZE) break;
      const next = data.at(-1)!.id;
      // Cursor que não avança viraria laço infinito.
      if (next === after) return FAILED;
      after = next;
    }
    // Mais recente primeiro, para a lista do histórico.
    rows.sort((a, b) => b.recorded_at.localeCompare(a.recorded_at) || b.id.localeCompare(a.id));
    return { ok: true, data: rows };
  } catch {
    return FAILED;
  }
}

/** Objetivo ativo, de onde saem o peso de partida e o peso desejado. */
export async function loadActiveGoal(
  client: KoraClient,
  userId: string,
  signal?: AbortSignal,
): Promise<WeightResult<Goal | null>> {
  try {
    const query = client.from('goals').select('*').eq('user_id', userId).eq('status', 'active');
    if (signal) query.abortSignal(signal);
    const { data, error } = await query.maybeSingle();
    return error ? FAILED : { ok: true, data: data ?? null };
  } catch {
    return FAILED;
  }
}

/** INSERT … ON CONFLICT DO NOTHING + releitura: retry não altera nem duplica a operação. */
export async function saveWeightEntry(
  client: KoraClient,
  entry: WeightEntry,
): Promise<WeightResult<WeightLog>> {
  if (!validWeight(entry.weight_kg)) return FAILED;
  try {
    const saved = await client
      .from('weight_logs')
      .upsert(entry, { onConflict: 'id', ignoreDuplicates: true });
    if (saved.error) return FAILED;
    const { data, error } = await client
      .from('weight_logs')
      .select('*')
      .eq('user_id', entry.user_id)
      .eq('id', entry.id)
      .maybeSingle();
    if (
      error ||
      !data ||
      Number(data.weight_kg) !== entry.weight_kg ||
      data.recorded_date !== entry.recorded_date ||
      data.recorded_timezone !== entry.recorded_timezone ||
      new Date(data.recorded_at).getTime() !== new Date(entry.recorded_at).getTime()
    )
      return FAILED;
    return { ok: true, data };
  } catch {
    return FAILED;
  }
}

export async function removeWeightEntry(
  client: KoraClient,
  userId: string,
  id: string,
): Promise<WeightResult<null>> {
  try {
    const { error } = await client.from('weight_logs').delete().eq('user_id', userId).eq('id', id);
    return error ? FAILED : { ok: true, data: null };
  } catch {
    return FAILED;
  }
}
