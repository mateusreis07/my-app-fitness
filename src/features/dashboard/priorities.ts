import type { NutritionTargets } from '@/services/supabase/database.types';
import { daysBetweenIso } from '../../lib/date.ts';
import { metricProgress, type DashboardCapabilities, type DailySignals } from './model.ts';

export const PRIORITY_POLICY = {
  max: 3,
  proteinAfterMinute: 16 * 60,
  proteinBelow: 0.7,
  waterAfterMinute: 15 * 60,
  waterBelow: 0.6,
  weightAfterDays: 7,
} as const;
export type Priority = {
  id: 'water' | 'protein' | 'workout' | 'weight';
  relevance: number;
  destination: 'water' | 'nutrition' | 'workout' | 'weight';
};
/** Sem rede/IA/relógio implícito. Ausência de dados não é baixo progresso. */
export function buildPriorities(input: {
  dayKey: string;
  minuteOfDay: number;
  targets: NutritionTargets | null;
  signals: DailySignals;
  capabilities: DashboardCapabilities;
  weight: { known: boolean; lastDay: string | null };
}): Priority[] {
  const { dayKey, minuteOfDay, targets, signals, capabilities } = input;
  const candidates: Priority[] = [];
  const nutrition = signals.nutrition?.dayKey === dayKey ? signals.nutrition : null;
  const water = signals.water?.dayKey === dayKey ? signals.water : null;
  const workout = signals.workout?.dayKey === dayKey ? signals.workout : null;
  // Meta precisa pertencer ao dia consultado, mesmo quando o chamador fornece dados em cache.
  const applicable =
    targets &&
    targets.effective_from <= dayKey &&
    (!targets.effective_until || targets.effective_until > dayKey)
      ? targets
      : null;
  const proteinProgress = metricProgress(
    nutrition?.proteinG ?? null,
    applicable?.protein_g ?? null,
  );
  const waterProgress = metricProgress(water?.consumedMl ?? null, applicable?.water_ml ?? null);
  if (capabilities.workout && workout?.scheduled && !workout.completed)
    candidates.push({ id: 'workout', relevance: 100, destination: 'workout' });
  if (
    capabilities.water &&
    minuteOfDay > PRIORITY_POLICY.waterAfterMinute &&
    waterProgress &&
    waterProgress.fraction < PRIORITY_POLICY.waterBelow
  )
    candidates.push({ id: 'water', relevance: 80, destination: 'water' });
  if (
    capabilities.nutrition &&
    minuteOfDay > PRIORITY_POLICY.proteinAfterMinute &&
    nutrition &&
    nutrition.mealCount > 0 &&
    proteinProgress &&
    proteinProgress.fraction < PRIORITY_POLICY.proteinBelow
  )
    candidates.push({ id: 'protein', relevance: 70, destination: 'nutrition' });
  if (
    capabilities.weight &&
    input.weight.known &&
    (!input.weight.lastDay ||
      daysBetweenIso(input.weight.lastDay, dayKey) >= PRIORITY_POLICY.weightAfterDays)
  )
    candidates.push({ id: 'weight', relevance: 50, destination: 'weight' });
  return candidates.sort((a, b) => b.relevance - a.relevance).slice(0, PRIORITY_POLICY.max);
}
