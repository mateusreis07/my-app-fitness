/**
 * Conversão de quantidade em macros registrados.
 *
 * É o único lugar onde essa conta existe. A tela apenas exibe o resultado
 * (seção 106, regra 5). Os valores produzidos aqui viram os snapshots de
 * `meal_items`, que preservam o histórico mesmo se o alimento mudar depois.
 */
// Caminho relativo com extensão: o runner de testes do Node resolve os módulos
// diretamente, sem o alias `@/` do bundler.
import { roundCalories, roundMacroGrams } from '../../lib/rounding.ts';
import type { SelectableFood } from './model.ts';

export type Snapshot = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/** Quantidade máxima aceita, alinhada ao CHECK da migration 0005. */
export const MAX_QUANTITY = 10_000;

/**
 * `quantity` está na mesma unidade da porção do alimento. Uma porção de 100 g
 * com quantidade 150 rende 1,5 vez os macros.
 *
 * Devolve `null` quando a entrada não permite uma conta honesta — porção zero
 * ou negativa, quantidade fora de faixa, número não finito. Nunca devolve zero
 * para disfarçar entrada inválida.
 */
export function buildSnapshot(food: SelectableFood, quantity: number): Snapshot | null {
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > MAX_QUANTITY) return null;
  if (!Number.isFinite(food.servingSize) || food.servingSize <= 0) return null;
  for (const value of [food.calories, food.proteinG, food.carbsG, food.fatG]) {
    if (!Number.isFinite(value) || value < 0) return null;
  }

  const factor = quantity / food.servingSize;
  return {
    calories: roundCalories(food.calories * factor),
    proteinG: roundMacroGrams(food.proteinG * factor),
    carbsG: roundMacroGrams(food.carbsG * factor),
    fatG: roundMacroGrams(food.fatG * factor),
  };
}
