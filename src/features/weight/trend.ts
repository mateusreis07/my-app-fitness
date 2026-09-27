/**
 * Tendência de peso — KORA_MASTER_CONTEXT.md seção 36.
 *
 * "Nunca tomar decisões com base apenas em uma medição." Uma medida isolada
 * carrega água, sódio, glicogênio, horário e retenção. Por isso tudo aqui passa
 * por média móvel e por comparação entre semanas.
 *
 * **Nada neste módulo projeta data de chegada.** O `docs/PRODUCT_DECISIONS.md`
 * cita Hall et al. contra conversão linear de peso, e adia para uma evolução
 * versionada qualquer ajuste de meta a partir do peso real. Tendência descreve
 * o passado; não promete o futuro.
 *
 * Funções puras: sem rede, sem React, sem relógio implícito. O dia de
 * referência sempre entra por parâmetro.
 */
import { addDaysIso, daysBetweenIso } from '../../lib/date.ts';
import { roundWeightKg } from '../../lib/rounding.ts';
import type { WeightLog } from '@/services/supabase/database.types';

/** Janela padrão da média móvel, conforme a seção 36. */
export const TREND_WINDOW_DAYS = 7;

export type DailyWeight = { dayKey: string; weightKg: number; samples: number };

function usable(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Uma entrada por dia, em ordem crescente.
 *
 * Dia com mais de um registro vira a **média** do dia, não o último valor:
 * escolher a última pesagem seria arbitrário, e a média já reduz o ruído que a
 * seção 36 quer combater.
 *
 * Usa `recorded_date`, gravado no fuso do perfil, e não deriva o dia aqui — é
 * o que mantém a série igual independentemente de quem está lendo.
 */
export function dailySeries(logs: WeightLog[]): DailyWeight[] {
  const byDay = new Map<string, { total: number; samples: number }>();
  for (const log of logs) {
    const weight = usable(log.weight_kg);
    if (weight === null || !log.recorded_date) continue;
    const current = byDay.get(log.recorded_date) ?? { total: 0, samples: 0 };
    byDay.set(log.recorded_date, {
      total: current.total + weight,
      samples: current.samples + 1,
    });
  }
  return [...byDay.entries()]
    .map(([dayKey, { total, samples }]) => ({
      dayKey,
      weightKg: roundWeightKg(total / samples),
      samples,
    }))
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

/**
 * Média dos registros na janela que termina em `dayKey`.
 *
 * Devolve `null` quando não há nenhum registro na janela — ausência de dado
 * não vira zero nem repete o valor anterior.
 */
export function movingAverage(
  series: DailyWeight[],
  dayKey: string,
  windowDays = TREND_WINDOW_DAYS,
): number | null {
  const first = addDaysIso(dayKey, -(windowDays - 1));
  const inside = series.filter((entry) => entry.dayKey >= first && entry.dayKey <= dayKey);
  if (inside.length === 0) return null;
  const total = inside.reduce((sum, entry) => sum + entry.weightKg, 0);
  return roundWeightKg(total / inside.length);
}

export type WeeklyComparison = {
  current: number;
  previous: number;
  /** Negativo quando o peso caiu. */
  differenceKg: number;
};

/**
 * Comparação entre médias semanais, a estratégia sugerida na seção 36.
 *
 * Exige registro nas duas janelas. Sem isso não há comparação honesta a fazer,
 * e o resultado é `null`.
 */
export function weeklyComparison(
  series: DailyWeight[],
  dayKey: string,
  windowDays = TREND_WINDOW_DAYS,
): WeeklyComparison | null {
  const current = movingAverage(series, dayKey, windowDays);
  const previous = movingAverage(series, addDaysIso(dayKey, -windowDays), windowDays);
  if (current === null || previous === null) return null;
  return { current, previous, differenceKg: roundWeightKg(current - previous) };
}

export type WeightChange = {
  /** Negativo quando o peso caiu desde o início. */
  differenceKg: number;
  days: number;
};

/** Variação desde o primeiro registro da série. */
export function changeSinceStart(series: DailyWeight[]): WeightChange | null {
  if (series.length < 2) return null;
  const first = series[0];
  const last = series[series.length - 1];
  return {
    differenceKg: roundWeightKg(last.weightKg - first.weightKg),
    days: daysBetweenIso(first.dayKey, last.dayKey),
  };
}

export type TargetProgress = {
  /** 0 a 1. Chega a 1 quando a meta foi alcançada ou ultrapassada. */
  fraction: number;
  remainingKg: number;
  reached: boolean;
};

/**
 * Quanto do caminho até a meta já foi percorrido.
 *
 * Funciona nos dois sentidos, perda e ganho. Devolve `null` quando falta dado
 * ou quando o ponto de partida já é a meta — nesse caso não existe "caminho"
 * a medir, e mostrar 0% ou 100% seria inventar significado.
 */
export function progressToTarget(
  startingKg: number | null,
  currentKg: number | null,
  targetKg: number | null,
): TargetProgress | null {
  if (startingKg === null || currentKg === null || targetKg === null) return null;
  for (const value of [startingKg, currentKg, targetKg]) {
    if (!Number.isFinite(value) || value <= 0) return null;
  }
  const total = targetKg - startingKg;
  if (total === 0) return null;

  const walked = currentKg - startingKg;
  const fraction = Math.min(1, Math.max(0, walked / total));
  const remaining = targetKg - currentKg;
  // "Faltando" não faz sentido negativo: passar da meta é meta alcançada.
  const reached = Math.sign(total) !== Math.sign(remaining);

  return {
    fraction,
    remainingKg: reached ? 0 : roundWeightKg(Math.abs(remaining)),
    reached,
  };
}
