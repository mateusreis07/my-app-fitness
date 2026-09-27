import type { KoraClient } from '@/services/supabase/client';
import type { DashboardSnapshot, Resource } from './model.ts';

async function read<T>(
  query: PromiseLike<{ data: T | null; error: unknown }>,
): Promise<Resource<T>> {
  try {
    const result = await query;
    return result.error ? { status: 'error' } : { status: 'ready', data: result.data };
  } catch {
    return { status: 'error' };
  }
}
/** Só leituras. Cada painel falha isoladamente e toda consulta é limitada ao usuário. */
export async function loadDashboard(
  client: KoraClient,
  userId: string,
  dayKey: string,
  nowIso: string,
  signal?: AbortSignal,
): Promise<DashboardSnapshot> {
  const targets = client
    .from('nutrition_targets')
    .select('*')
    .eq('user_id', userId)
    .is('effective_until', null)
    .lte('effective_from', dayKey);
  const weight = client
    .from('weight_logs')
    .select('*')
    .eq('user_id', userId)
    .lte('recorded_at', nowIso)
    .order('recorded_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);
  const training = client.from('training_preferences').select('*').eq('user_id', userId);
  const goal = client.from('goals').select('*').eq('user_id', userId).eq('status', 'active');
  if (signal) for (const query of [targets, weight, training, goal]) query.abortSignal(signal);
  const [targetResult, weightResult, trainingResult, goalResult] = await Promise.all([
    read(targets.maybeSingle()),
    read(weight.maybeSingle()),
    read(training.maybeSingle()),
    read(goal.maybeSingle()),
  ]);
  return {
    userId,
    dayKey,
    loadedAt: nowIso,
    targets: targetResult,
    weight: weightResult,
    training: trainingResult,
    goal: goalResult,
  };
}
