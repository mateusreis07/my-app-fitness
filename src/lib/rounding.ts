/**
 * Arredondamentos centralizados — KORA_MASTER_CONTEXT.md seção 119.
 *
 * Existir em um lugar só evita que a mesma grandeza apareça com precisões
 * diferentes em telas diferentes.
 */

/** Peso corporal: uma casa decimal. */
export function roundWeightKg(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Calorias: inteiro. */
export function roundCalories(value: number): number {
  return Math.round(value);
}

/** Macronutrientes: inteiro, em gramas. */
export function roundMacroGrams(value: number): number {
  return Math.round(value);
}

/** Água: inteiro, em mililitros. */
export function roundWaterMl(value: number): number {
  return Math.round(value);
}

/** IMC: uma casa decimal. É referência geral, não medida de precisão. */
export function roundBmi(value: number): number {
  return Math.round(value * 10) / 10;
}

/** KORA Score e seus componentes: inteiro, sempre entre 0 e 100. */
export function roundScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Aproxima a manutenção para nunca ampliar o ajuste por arredondamento. */
export function roundCaloriesTowardMaintenance(value: number, tdee: number): number {
  return value < tdee ? Math.ceil(value) : value > tdee ? Math.floor(value) : Math.round(value);
}
