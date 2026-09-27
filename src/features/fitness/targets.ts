/**
 * Persistência das metas calculadas pelo Motor Fitness.
 *
 * Recalcular não sobrescreve: fecha a janela de vigência da meta atual e abre
 * outra (seções 97 e 108). Assim dá para saber com qual versão do motor uma
 * meta antiga foi produzida.
 */
import type { KoraClient } from '@/services/supabase/client';
import type { NutritionTargets } from '@/services/supabase/database.types';
import type { FitnessPlan } from './engine.ts';

export type TargetsResult = { ok: true } | { ok: false; error: 'fitness.error.saveFailed' };

const FAILED: TargetsResult = { ok: false, error: 'fitness.error.saveFailed' };

export async function saveNutritionTargets(
  client: KoraClient,
  userId: string,
  plan: FitnessPlan,
  todayIso: string,
): Promise<TargetsResult> {
  // Fecha a meta vigente. O índice parcial só admite uma com effective_until nulo.
  const closed = await client
    .from('nutrition_targets')
    .update({ effective_until: todayIso })
    .eq('user_id', userId)
    .is('effective_until', null);
  if (closed.error) return FAILED;

  // Ausência de plano é um resultado válido. Fecha o anterior sem inventar metas zero.
  if (plan.status === 'unavailable') return { ok: true };

  const inserted = await client.from('nutrition_targets').insert({
    user_id: userId,
    calories: plan.calories,
    protein_g: plan.proteinG,
    carbs_g: plan.carbsG,
    fat_g: plan.fatG,
    water_ml: plan.waterMl,
    effective_from: todayIso,
    effective_until: null,
    calculation_source: plan.calculationSource,
  });
  if (inserted.error) return FAILED;

  return { ok: true };
}

/** Distingue ausência de meta de falha de leitura; não tratar rede como inelegibilidade. */
export type CurrentTargetsResult = { ok: true; targets: NutritionTargets | null } | { ok: false };
export async function fetchCurrentTargets(
  client: KoraClient,
  userId: string,
): Promise<CurrentTargetsResult> {
  try {
    const { data, error } = await client
      .from('nutrition_targets')
      .select('*')
      .eq('user_id', userId)
      .is('effective_until', null)
      .maybeSingle();
    return error ? { ok: false } : { ok: true, targets: data };
  } catch {
    return { ok: false };
  }
}
