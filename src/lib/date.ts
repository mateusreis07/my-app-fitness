/**
 * Datas no formato `AAAA-MM-DD`, sempre em dia de calendário.
 *
 * Fica fora de qualquer feature porque o onboarding e o Motor Fitness precisam
 * das mesmas contas. Duplicar aritmética de data é como duplicar cálculo.
 */

const DAY_MS = 86_400_000;

/**
 * Data local de hoje.
 *
 * `toISOString()` converte para UTC e, à noite no Brasil, devolveria o dia
 * seguinte. O dia do usuário é o dia do relógio dele (seção 93).
 */
export function todayIso(now: Date = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function toUtcTime(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00.000Z`).getTime();
}

export function addDaysIso(isoDate: string, days: number): string {
  return new Date(toUtcTime(isoDate) + Math.round(days) * DAY_MS).toISOString().slice(0, 10);
}

export function addWeeksIso(isoDate: string, weeks: number): string {
  return addDaysIso(isoDate, Math.ceil(weeks) * 7);
}

/** Dias inteiros de `fromIso` até `toIso`. Negativo se `toIso` for anterior. */
export function daysBetweenIso(fromIso: string, toIso: string): number {
  return Math.round((toUtcTime(toIso) - toUtcTime(fromIso)) / DAY_MS);
}
