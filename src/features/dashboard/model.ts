import type {
  Goal,
  NutritionTargets,
  TrainingPreferences,
  WeightLog,
} from '@/services/supabase/database.types';

export type Resource<T> = { status: 'ready'; data: T | null } | { status: 'error' };
export type DashboardSnapshot = {
  userId: string;
  dayKey: string;
  loadedAt: string;
  targets: Resource<NutritionTargets>;
  weight: Resource<WeightLog>;
  training: Resource<TrainingPreferences>;
  goal: Resource<Goal>;
};

/** Os adaptadores das fases 5–8 fornecerão registros do dia, nunca zeros sintéticos. */
export type DailySignals = {
  nutrition: {
    dayKey: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    mealCount: number;
  } | null;
  water: { dayKey: string; consumedMl: number } | null;
  workout: { dayKey: string; scheduled: boolean; completed: boolean } | null;
};
export const EMPTY_DAILY_SIGNALS: DailySignals = { nutrition: null, water: null, workout: null };
export type DashboardCapabilities = {
  nutrition: boolean;
  water: boolean;
  weight: boolean;
  workout: boolean;
};
/** Ativar somente junto do adaptador real e de uma ação funcional na fase correspondente. */
export const DASHBOARD_CAPABILITIES: DashboardCapabilities = {
  nutrition: false,
  water: false,
  weight: false,
  workout: false,
};

export type MetricProgress = {
  consumed: number;
  target: number;
  remaining: number;
  over: number;
  fraction: number;
};
export function metricProgress(
  consumed: number | null,
  target: number | null,
): MetricProgress | null {
  if (
    consumed === null ||
    target === null ||
    !Number.isFinite(consumed) ||
    !Number.isFinite(target) ||
    consumed < 0 ||
    target <= 0
  )
    return null;
  return {
    consumed,
    target,
    remaining: Math.max(0, target - consumed),
    over: Math.max(0, consumed - target),
    fraction: Math.min(1, consumed / target),
  };
}

export function avatarInitials(name: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return words.length
    ? [...words[0]][0].toLocaleUpperCase('pt-BR') +
        (words.length > 1 ? [...words.at(-1)!][0].toLocaleUpperCase('pt-BR') : '')
    : '';
}

/** Nunca reutilizar totais de ontem ou números inválidos como registros de hoje. */
export function selectDailySignals(signals: DailySignals, dayKey: string): DailySignals {
  const food = signals.nutrition;
  const water = signals.water;
  return {
    nutrition:
      food?.dayKey === dayKey &&
      [food.calories, food.proteinG, food.carbsG, food.fatG, food.mealCount].every(
        (value) => Number.isFinite(value) && value >= 0,
      )
        ? food
        : null,
    water:
      water?.dayKey === dayKey && Number.isFinite(water.consumedMl) && water.consumedMl >= 0
        ? water
        : null,
    workout: signals.workout?.dayKey === dayKey ? signals.workout : null,
  };
}
