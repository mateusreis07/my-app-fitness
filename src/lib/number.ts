/**
 * Conversão de número digitado, compartilhada entre onboarding e nutrição.
 *
 * Fica fora das features porque a regra de vírgula decimal é a mesma em toda
 * entrada numérica do app. Duplicar isso já seria duplicar regra.
 */

/** Aceita vírgula decimal, como se digita em pt-BR. Rejeita negativo e lixo. */
export function parseDecimal(value: string): number | null {
  const clean = value.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Uma casa decimal, com vírgula, para exibição em pt-BR. */
export function formatDecimalBr(value: number, places = 1): string {
  return value.toFixed(places).replace('.', ',');
}
