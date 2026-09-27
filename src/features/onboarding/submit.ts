/**
 * Persistência do onboarding.
 *
 * Não existe transação entre chamadas REST, então a ordem importa: tudo o que
 * o usuário informou é gravado primeiro e a marca de conclusão do perfil vai
 * por último. Se algo falhar no meio, o onboarding continua "não concluído" e
 * pode ser refeito. Upserts são idempotentes; inserts podem repetir histórico em uma nova tentativa.
 */
import { buildFitnessPlan } from '../fitness/engine.ts';
import { saveNutritionTargets } from '../fitness/targets.ts';
import type { KoraClient } from '@/services/supabase/client';
import { buildOnboardingPayload } from './payload.ts';
import type { OnboardingDraft } from './model.ts';

export type SubmitResult = { ok: true } | { ok: false; error: 'onboarding.error.saveFailed' };

const FAILED: SubmitResult = { ok: false, error: 'onboarding.error.saveFailed' };

async function persistOnboarding(
  client: KoraClient,
  userId: string,
  draft: OnboardingDraft,
  todayIso: string,
): Promise<SubmitResult> {
  const payload = buildOnboardingPayload(userId, draft, todayIso);
  if (!payload) return FAILED;

  const profile = await client
    .from('profiles')
    .upsert({ ...payload.profile, user_id: userId }, { onConflict: 'user_id' });
  if (profile.error) return FAILED;

  const weight = await client.from('weight_logs').insert(payload.weightLog);
  if (weight.error) return FAILED;

  // Índice parcial garante um único objetivo ativo. Um onboarding refeito
  // encerra o objetivo anterior em vez de apagá-lo (histórico, seção 97).
  const abandon = await client
    .from('goals')
    .update({ status: 'abandoned' })
    .eq('user_id', userId)
    .eq('status', 'active');
  if (abandon.error) return FAILED;

  const goal = await client.from('goals').insert(payload.goal);
  if (goal.error) return FAILED;

  const training = await client
    .from('training_preferences')
    .upsert(payload.training, { onConflict: 'user_id' });
  if (training.error) return FAILED;

  const nutrition = await client
    .from('nutrition_preferences')
    .upsert(payload.nutrition, { onConflict: 'user_id' });
  if (nutrition.error) return FAILED;

  // Motor Fitness: as metas são calculadas aqui, a partir dos dados já
  // gravados, e nunca recalculadas na interface (regra 5).
  const plan = buildFitnessPlan(payload.fitnessInput);
  const targets = await saveNutritionTargets(client, userId, plan, todayIso);
  if (!targets.ok) return FAILED;

  const complete = await client
    .from('profiles')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (complete.error) return FAILED;

  return { ok: true };
}

/** Falhas de rede também devem devolver o erro traduzível e liberar nova tentativa. */
export async function submitOnboarding(
  client: KoraClient,
  userId: string,
  draft: OnboardingDraft,
  todayIso: string,
): Promise<SubmitResult> {
  try {
    return await persistOnboarding(client, userId, draft, todayIso);
  } catch {
    return FAILED;
  }
}
