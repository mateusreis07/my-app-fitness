/**
 * Modelo do registro de peso — KORA_MASTER_CONTEXT.md seção 35.
 *
 * Funções puras, sem React e sem rede. Espelha `src/features/hydration/model.ts`:
 * a criação da entrada devolve `null` em vez de lançar, e valida o próprio UUID.
 */
import { dashboardClock } from '../dashboard/calendar.ts';
import { roundWeightKg } from '../../lib/rounding.ts';
import { parseDecimal } from '../../lib/number.ts';
import type { WeightLog } from '@/services/supabase/database.types';

/** Espelha o CHECK `weight_logs_range` da migration 0003. */
export const WEIGHT_KG_MIN = 25;
export const WEIGHT_KG_MAX = 400;
export const NOTES_MAX_LENGTH = 500;

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** O que o cliente envia. `created_at` fica com o banco. */
export type WeightEntry = Omit<WeightLog, 'created_at'>;

export function validWeight(value: number): boolean {
  return Number.isFinite(value) && value >= WEIGHT_KG_MIN && value <= WEIGHT_KG_MAX;
}

/**
 * Aceita vírgula decimal e arredonda para uma casa.
 *
 * A balança do usuário marca 0,1 kg; guardar mais casas dá falsa precisão.
 * A coluna é `numeric(5,2)` e o onboarding grava duas casas por um `round2`
 * próprio — diferença conhecida, registrada em `docs/PHASE_7.md`.
 */
export function parseWeight(value: string): number | null {
  const parsed = parseDecimal(value);
  if (parsed === null) return null;
  const rounded = roundWeightKg(parsed);
  return validWeight(rounded) ? rounded : null;
}

export function parseNotes(value: string): string | null {
  const clean = value.trim();
  if (clean.length === 0) return null;
  return clean.length <= NOTES_MAX_LENGTH ? clean : null;
}

/**
 * Monta a entrada a ser gravada. `recorded_date` sai do mesmo relógio do
 * dashboard, no fuso do perfil — é o invariante 16, e é o que o CHECK
 * `weight_logs_local_date` confere no banco.
 */
export function createWeightEntry(input: {
  userId: string;
  weightKg: number;
  timeZone: string;
  now: Date;
  id: string;
  notes?: string | null;
}): WeightEntry | null {
  const { userId, weightKg, timeZone, now, id } = input;
  if (!userId || !UUID.test(id)) return null;
  if (!validWeight(weightKg)) return null;
  if (!Number.isFinite(now.getTime())) return null;
  const notes = input.notes ?? null;
  if (notes !== null && (notes.length === 0 || notes.length > NOTES_MAX_LENGTH)) return null;

  let dayKey: string;
  try {
    dayKey = dashboardClock(now, timeZone).dayKey;
  } catch {
    return null;
  }

  return {
    id,
    user_id: userId,
    weight_kg: weightKg,
    recorded_at: now.toISOString(),
    recorded_date: dayKey,
    recorded_timezone: timeZone,
    notes,
  };
}
