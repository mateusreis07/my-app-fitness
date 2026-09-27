/**
 * KORA Score — KORA_MASTER_CONTEXT.md seções 45 a 48.
 *
 * "Não é nota de saúde, avaliação médica, diagnóstico nem indicador
 * clínico" (seção 45) — é um índice interno de aderência. Funções puras: sem
 * rede, sem React, sem relógio implícito. O dia de referência sempre entra
 * por parâmetro.
 *
 * Pesos e fórmulas ficam centralizados aqui, versionados em
 * `SCORE_ALGORITHM_VERSION` — mudar um peso ou uma fórmula no futuro não
 * reescreve o histórico já fechado em `daily_scores` (mesmo espírito de
 * `FITNESS_ENGINE_VERSION`).
 */
import { roundScore } from '../../lib/rounding.ts';
import type { TranslationKey } from '@/lib/i18n/keys';

export const SCORE_ALGORITHM_VERSION = 'kora_score@1.0';

/** Pesos iniciais da seção 46. Somam 1. */
export const WEIGHTS = {
  nutrition: 0.25,
  protein: 0.2,
  hydration: 0.15,
  workout: 0.25,
  consistency: 0.15,
} as const;

/** Desvio do alvo calórico sem penalidade nenhuma. */
export const CALORIE_TOLERANCE = 0.1;
/** Desvio a partir do qual o componente de calorias chega a zero. */
export const CALORIE_ZERO_AT = 0.5;

/** "Dia bom" para efeito de streak — decisão do responsável, documentada em docs/PHASE_9.md. */
export const STREAK_GOOD_DAY_THRESHOLD = 50;

/** Janela de fechamento tardio de dias sem linha em `daily_scores`. */
export const HISTORY_LOOKBACK_DAYS = 30;

/**
 * Calorias: proximidade da faixa, não "quanto mais melhor" (seção 47).
 * Dentro da tolerância, 100. Além dela, decai linearmente até zero no desvio
 * de `CALORIE_ZERO_AT`, para qualquer lado — faltar ou passar da meta
 * penaliza igual.
 */
export function nutritionScore(consumedKcal: number, targetKcal: number): number {
  if (!Number.isFinite(consumedKcal) || !Number.isFinite(targetKcal) || targetKcal <= 0) return 0;
  const deviation = Math.abs(consumedKcal - targetKcal) / targetKcal;
  if (deviation <= CALORIE_TOLERANCE) return 100;
  const range = CALORIE_ZERO_AT - CALORIE_TOLERANCE;
  const excess = deviation - CALORIE_TOLERANCE;
  return roundScore(100 - (excess / range) * 100);
}

/**
 * `min(consumido/meta, 1) × 100` — fórmula explícita da seção 47 para
 * proteína. A mesma lógica de capar em 100% se aplica à hidratação: o
 * documento não faz ressalva contra ultrapassar a meta de água.
 */
export function ratioScore(consumed: number, target: number): number {
  if (!Number.isFinite(consumed) || !Number.isFinite(target) || target <= 0) return 0;
  return roundScore(Math.min(Math.max(consumed, 0) / target, 1) * 100);
}

/**
 * Dia sem plano ou sem dia programado vale 100 — decisão do responsável.
 * Descanso não gera culpa. Só fica abaixo disso quando havia treino
 * programado e ele não foi concluído.
 */
export function workoutScore(scheduled: boolean, completed: boolean): number {
  return scheduled && !completed ? 0 : 100;
}

/**
 * Fração das três áreas registráveis (refeição, água, treino) com pelo menos
 * um registro no dia, independente de ter batido a meta — os outros
 * componentes já penalizam sozinhos quem registrou e ficou longe do alvo;
 * consistency mede especificamente o hábito de registrar.
 */
export function consistencyScore(input: {
  loggedMeal: boolean;
  loggedWater: boolean;
  loggedWorkout: boolean;
}): number {
  const count = [input.loggedMeal, input.loggedWater, input.loggedWorkout].filter(Boolean).length;
  return roundScore((count / 3) * 100);
}

export type ScoreComponents = {
  nutrition: number | null;
  protein: number | null;
  hydration: number | null;
  workout: number;
  consistency: number;
};

/**
 * Soma ponderada pelos `WEIGHTS`. Devolve `null` quando não havia meta
 * nutricional vigente no dia (`nutrition`/`protein`/`hydration` vêm da mesma
 * linha de `nutrition_targets` e ficam nulos juntos) — sem meta não é score
 * zero, é ausência de score, como qualquer outra ausência no projeto.
 */
export function totalScore(components: ScoreComponents): number | null {
  if (components.nutrition === null || components.protein === null || components.hydration === null)
    return null;
  return roundScore(
    components.nutrition * WEIGHTS.nutrition +
      components.protein * WEIGHTS.protein +
      components.hydration * WEIGHTS.hydration +
      components.workout * WEIGHTS.workout +
      components.consistency * WEIGHTS.consistency,
  );
}

/** Monta os cinco componentes de um dia a partir dos totais já lidos — usado tanto para "hoje" quanto para fechar um dia passado. */
export function dayComponents(input: {
  consumedKcal: number | null;
  targetKcal: number | null;
  consumedProteinG: number | null;
  targetProteinG: number | null;
  consumedWaterMl: number | null;
  targetWaterMl: number | null;
  workoutScheduled: boolean;
  workoutCompleted: boolean;
  loggedMeal: boolean;
  loggedWater: boolean;
  loggedWorkout: boolean;
}): ScoreComponents {
  const hasTargets =
    input.targetKcal !== null && input.targetProteinG !== null && input.targetWaterMl !== null;
  return {
    nutrition:
      hasTargets && input.consumedKcal !== null
        ? nutritionScore(input.consumedKcal, input.targetKcal!)
        : null,
    protein:
      hasTargets && input.consumedProteinG !== null
        ? ratioScore(input.consumedProteinG, input.targetProteinG!)
        : null,
    hydration:
      hasTargets && input.consumedWaterMl !== null
        ? ratioScore(input.consumedWaterMl, input.targetWaterMl!)
        : null,
    workout: workoutScore(input.workoutScheduled, input.workoutCompleted),
    consistency: consistencyScore({
      loggedMeal: input.loggedMeal,
      loggedWater: input.loggedWater,
      loggedWorkout: input.loggedWorkout,
    }),
  };
}

const STATUS_RANGES: { min: number; key: TranslationKey }[] = [
  { min: 80, key: 'score.status.excellent' },
  { min: 60, key: 'score.status.good' },
  { min: 40, key: 'score.status.fair' },
  { min: 0, key: 'score.status.low' },
];

/** Texto de status da seção 24. Faixas simples, sem linguagem clínica. */
export function scoreStatusKey(total: number | null): TranslationKey {
  if (total === null) return 'score.status.unavailable';
  return STATUS_RANGES.find((range) => total >= range.min)!.key;
}

export type ScoreDay = { dayKey: string; totalScore: number | null };

/**
 * `days` precisa ser contígua e vir do dia mais recente para trás — o
 * chamador preenche qualquer buraco do histórico com `totalScore: null`.
 * Conta enquanto o dia é "bom" (`>= STREAK_GOOD_DAY_THRESHOLD`); um buraco ou
 * um dia abaixo do limite interrompe a contagem, mas nunca apaga o recorde.
 */
export function currentStreak(days: ScoreDay[]): number {
  let streak = 0;
  for (const day of days) {
    if (day.totalScore === null || day.totalScore < STREAK_GOOD_DAY_THRESHOLD) break;
    streak++;
  }
  return streak;
}

/** Maior sequência de dias bons já vista na lista, em qualquer posição. */
export function longestStreak(days: ScoreDay[]): number {
  let longest = 0;
  let running = 0;
  for (const day of days) {
    if (day.totalScore !== null && day.totalScore >= STREAK_GOOD_DAY_THRESHOLD) {
      running++;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
  }
  return longest;
}
