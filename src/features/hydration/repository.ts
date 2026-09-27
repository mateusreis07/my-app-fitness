import type { KoraClient } from '@/services/supabase/client';
import type { WaterLog } from '@/services/supabase/database.types';
import { validAmount, type WaterEntry } from './model.ts';
export type WaterResult<T> = { ok: true; data: T } | { ok: false };
const FAILED = { ok: false } as const;
export const WATER_PAGE_SIZE = 200;
export async function loadWaterDay(
  client: KoraClient,
  userId: string,
  dayKey: string,
  signal?: AbortSignal,
): Promise<WaterResult<WaterLog[]>> {
  try {
    const rows: WaterLog[] = [];
    let after: string | null = null;
    for (;;) {
      const query = client
        .from('water_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('recorded_date', dayKey)
        .order('id', { ascending: true })
        .limit(WATER_PAGE_SIZE);
      if (after) query.gt('id', after);
      if (signal) query.abortSignal(signal);
      const { data, error } = await query;
      if (error || !data) return FAILED;
      rows.push(...data);
      if (data.length < WATER_PAGE_SIZE) break;
      const next = data.at(-1)!.id;
      if (next === after) return FAILED;
      after = next;
    }
    rows.sort((a, b) => b.recorded_at.localeCompare(a.recorded_at) || b.id.localeCompare(a.id));
    return { ok: true, data: rows };
  } catch {
    return FAILED;
  }
}
/** INSERT … ON CONFLICT DO NOTHING + releitura: retry não altera nem duplica a operação. */
export async function saveWaterEntry(
  client: KoraClient,
  entry: WaterEntry,
): Promise<WaterResult<WaterLog>> {
  if (!validAmount(entry.amount_ml)) return FAILED;
  try {
    const saved = await client
      .from('water_logs')
      .upsert(entry, { onConflict: 'id', ignoreDuplicates: true });
    if (saved.error) return FAILED;
    const { data, error } = await client
      .from('water_logs')
      .select('*')
      .eq('user_id', entry.user_id)
      .eq('id', entry.id)
      .maybeSingle();
    if (
      error ||
      !data ||
      data.amount_ml !== entry.amount_ml ||
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
export async function removeWaterEntry(
  client: KoraClient,
  userId: string,
  id: string,
): Promise<WaterResult<null>> {
  try {
    const { error } = await client.from('water_logs').delete().eq('user_id', userId).eq('id', id);
    return error ? FAILED : { ok: true, data: null };
  } catch {
    return FAILED;
  }
}
