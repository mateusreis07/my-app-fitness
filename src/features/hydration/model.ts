import type { WaterLog } from '@/services/supabase/database.types';
import { dashboardClock } from '../dashboard/calendar.ts';
import { parseDecimal } from '../../lib/number.ts';

/** Limites técnicos por registro, não orientação de ingestão. Mesmo CHECK da migration 0007. */
export const WATER_AMOUNT_MAX = 5000;
export const WATER_SHORTCUTS = [250, 500] as const;
export type WaterEntry = Omit<WaterLog, 'created_at'>;
export function validAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount >= 1 && amount <= WATER_AMOUNT_MAX;
}
export function parseWaterAmount(text: string): number | null {
  const amount = parseDecimal(text);
  return amount !== null && validAmount(amount) ? amount : null;
}
export function createWaterEntry(
  userId: string,
  amount: number,
  timeZone: string,
  now: Date,
  id: string,
): WaterEntry | null {
  if (
    !validAmount(amount) ||
    !userId ||
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id) ||
    !Number.isFinite(now.getTime())
  )
    return null;
  return {
    id,
    user_id: userId,
    amount_ml: amount,
    recorded_at: now.toISOString(),
    recorded_date: dashboardClock(now, timeZone).dayKey,
    recorded_timezone: timeZone,
  };
}
export function waterTotals(
  dayKey: string,
  rows: WaterLog[],
): { dayKey: string; consumedMl: number } | null {
  let consumedMl = 0;
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.recorded_date !== dayKey || seen.has(row.id)) continue;
    if (!validAmount(row.amount_ml)) return null;
    seen.add(row.id);
    consumedMl += row.amount_ml;
  }
  return { dayKey, consumedMl };
}
