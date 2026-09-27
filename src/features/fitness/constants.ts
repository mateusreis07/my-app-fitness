/** Motor versionado: alterar parâmetros exige nova versão; preservar metas históricas. */
import type { ActivityLevel, BiologicalSex, GoalType } from '@/services/supabase/database.types';

export const FITNESS_ENGINE_VERSION = '1.2';
export const CALCULATION_SOURCE = `fitness_engine@${FITNESS_ENGINE_VERSION}` as const;

/** Seção 16. Estimativas, como o próprio documento adverte. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
};

/** Mifflin-St Jeor: não há constante validada para sexo não informado. */
export const BMR_SEX_CONSTANT: Record<Exclude<BiologicalSex, 'unspecified'>, number> = {
  male: 5,
  female: -161,
};

/**
 * Energia aproximada de um quilo de massa corporal. É a estimativa clássica
 * usada para converter déficit calórico em ritmo de mudança de peso.
 *
 * É uma aproximação, não uma constante física exata: a composição do que se
 * perde ou ganha varia. Usada apenas para o ajuste inicial; não gera previsão de data de chegada.
 */
export const KCAL_PER_KG = 7700;

/** Política aprovada em 22/09/2026. Sem ajuste mínimo quando existe prazo. */
export const CALORIE_ADJUSTMENT: Record<
  GoalType,
  { direction: -1 | 0 | 1; maxShare: number; defaultShare: number }
> = {
  lose_weight: { direction: -1, maxShare: 0.2, defaultShare: 0.15 },
  gain_muscle: { direction: 1, maxShare: 0.15, defaultShare: 0.05 },
  maintain_weight: { direction: 0, maxShare: 0, defaultShare: 0 },
  improve_health: { direction: 0, maxShare: 0, defaultShare: 0 },
  improve_fitness: { direction: 0, maxShare: 0, defaultShare: 0 },
};

/** Limites da automação, não metas nem garantias de segurança individual. */
export const WEEKLY_CHANGE_LIMIT: Record<GoalType, { weightShare: number; kg: number }> = {
  lose_weight: { weightShare: 0.01, kg: 1 },
  gain_muscle: { weightShare: 0.005, kg: 0.5 },
  maintain_weight: { weightShare: 0, kg: 0 },
  improve_health: { weightShare: 0, kg: 0 },
  improve_fitness: { weightShare: 0, kg: 0 },
};

/** Piso operacional da automação, não mínimo biológico universal. TMB não é piso. */
export const CALORIE_FLOOR = 1500;
export const MIN_AUTOMATIC_AGE = 18;
export const UNDERWEIGHT_BMI = 18.5;
/** Limites de entrada compartilhados com o formulário; não são faixas clínicas. */
export const FITNESS_INPUT_LIMITS = {
  maxAge: 100,
  minHeightCm: 80,
  maxHeightCm: 260,
  minWeightKg: 25,
  maxWeightKg: 400,
} as const;
/** Contrato da migration 0004, preservado para metas históricas. */
export const TARGET_STORAGE_LIMITS = {
  maxCalories: 8000,
  maxProteinG: 500,
  maxCarbsG: 1200,
  maxFatG: 400,
  maxWaterMl: 10000,
} as const;

/**
 * Seção 19, gramas de proteína por quilo de peso corporal.
 * Faixas do documento: manutenção 1,2–1,6; perda de gordura 1,6–2,2;
 * ganho de massa 1,6–2,2.
 */
export const PROTEIN_G_PER_KG: Record<GoalType, number> = {
  lose_weight: 1.8,
  gain_muscle: 1.8,
  maintain_weight: 1.4,
  improve_health: 1.4,
  improve_fitness: 1.6,
};

/** Seção 20. Fração das calorias vinda de gordura. Faixa do documento: 25%–30%. */
export const FAT_CALORIE_SHARE = 0.275;

/** Piso de gordura em g/kg, para o ajuste de carboidrato nunca zerar a gordura. */
export const FAT_G_PER_KG_FLOOR = 0.6;

/** Seção 22. Estimativa, sem promessa de precisão clínica. */
export const WATER_ML_PER_KG = 35;

/** Calorias por grama de cada macronutriente (seção 21). */
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;
