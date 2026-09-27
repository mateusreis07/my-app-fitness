/**
 * Totais do dia, no formato que o dashboard consome.
 *
 * O nome dos campos é carregado: `DashboardView` monta `${kind}G` por template
 * literal para casar com `protein_g`, `carbs_g` e `fat_g` da meta. Renomear
 * aqui quebra a tela sem erro de tipo.
 *
 * `selectDailySignals` descarta o bloco se qualquer número não for finito e
 * não-negativo, ou se o dia não bater exatamente. Por isso a soma ignora linhas
 * inválidas em vez de propagar `NaN`.
 */
import { roundCalories, roundMacroGrams } from '../../lib/rounding.ts';
import type { MealItem } from '@/services/supabase/database.types';

export type DayTotals = {
  dayKey: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealCount: number;
};

function usable(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/**
 * `mealCount` conta refeições que têm ao menos um item, não refeições criadas.
 * Uma refeição vazia não é registro, e o motor de prioridades usa esse número
 * para distinguir "não registrou" de "comeu pouca proteína".
 */
export function buildDayTotals(
  dayKey: string,
  meals: { id: string; items: MealItem[] }[],
): DayTotals {
  let calories = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;
  let mealCount = 0;

  for (const meal of meals) {
    if (meal.items.length === 0) continue;
    mealCount += 1;
    for (const item of meal.items) {
      calories += usable(item.calories_snapshot);
      proteinG += usable(item.protein_snapshot);
      carbsG += usable(item.carbs_snapshot);
      fatG += usable(item.fat_snapshot);
    }
  }

  return {
    dayKey,
    calories: roundCalories(calories),
    proteinG: roundMacroGrams(proteinG),
    carbsG: roundMacroGrams(carbsG),
    fatG: roundMacroGrams(fatG),
    mealCount,
  };
}

/** Soma de uma refeição só, para a linha de cada refeição na tela. */
export function buildMealTotals(items: MealItem[]): Omit<DayTotals, 'dayKey' | 'mealCount'> {
  const totals = buildDayTotals('', items.length ? [{ id: 'meal', items }] : []);
  return {
    calories: totals.calories,
    proteinG: totals.proteinG,
    carbsG: totals.carbsG,
    fatG: totals.fatG,
  };
}
