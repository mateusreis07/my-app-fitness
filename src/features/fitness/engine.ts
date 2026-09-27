/**
 * Motor Fitness — módulo determinístico de cálculo (seção 13).
 *
 * Não usa IA, não faz rede, não depende de React. Cada fórmula é uma função
 * exportada e testada isoladamente (seção 106, regra 3).
 *
 * Nada aqui promete precisão clínica. IMC, TMB, TDEE e meta de água são
 * estimativas, e o próprio documento mestre diz isso nas seções 14, 16 e 22.
 */
// Caminho relativo com extensão: o runner de testes do Node resolve os módulos
// diretamente, sem o alias `@/` do bundler.
import { daysBetweenIso } from '../../lib/date.ts';
import {
  roundBmi,
  roundCalories,
  roundCaloriesTowardMaintenance,
  roundMacroGrams,
  roundWaterMl,
} from '../../lib/rounding.ts';
import type { ActivityLevel, BiologicalSex, GoalType } from '@/services/supabase/database.types';
import {
  ACTIVITY_FACTORS,
  BMR_SEX_CONSTANT,
  CALCULATION_SOURCE,
  CALORIE_ADJUSTMENT,
  CALORIE_FLOOR,
  FAT_CALORIE_SHARE,
  FAT_G_PER_KG_FLOOR,
  KCAL_PER_GRAM,
  KCAL_PER_KG,
  WEEKLY_CHANGE_LIMIT,
  MIN_AUTOMATIC_AGE,
  UNDERWEIGHT_BMI,
  FITNESS_INPUT_LIMITS,
  TARGET_STORAGE_LIMITS,
  PROTEIN_G_PER_KG,
  WATER_ML_PER_KG,
} from './constants.ts';

export type BmiCategory =
  'underweight' | 'normal' | 'overweight' | 'obese_1' | 'obese_2' | 'obese_3';

/**
 * Seção 14. Referência geral, nunca julgamento individual definitivo: o IMC
 * não distingue massa magra de gordura.
 */
export function calculateBmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return roundBmi(weightKg / (heightM * heightM));
}

/** Faixas da OMS. Usadas só para dar contexto ao número, não para diagnosticar. */
export function classifyBmi(bmi: number): BmiCategory {
  if (bmi < UNDERWEIGHT_BMI) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  if (bmi < 35) return 'obese_1';
  if (bmi < 40) return 'obese_2';
  return 'obese_3';
}

/** Seção 15, Mifflin-St Jeor. Resultado em kcal/dia. */
export function calculateBmr(input: {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  biologicalSex: BiologicalSex;
}): number | null {
  if (input.biologicalSex === 'unspecified') return null;
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears;
  return base + BMR_SEX_CONSTANT[input.biologicalSex];
}

/** Seção 16. TDEE = TMB × fator de atividade. */
export function calculateTdee(bmr: number, activityLevel: ActivityLevel): number {
  return bmr * ACTIVITY_FACTORS[activityLevel];
}

/** Compartilhado pelo onboarding e pelo motor. Não é previsão de resultado. */
export function getWeeklyChangeLimit(goalType: GoalType, weightKg: number): number {
  const limit = WEEKLY_CHANGE_LIMIT[goalType];
  return Math.min(weightKg * limit.weightShare, limit.kg);
}

export type CalorieTarget = {
  calories: number;
  clampedByAutomationFloor: boolean;
  limitedByAutomation: boolean;
};

export type GoalDeadline = {
  currentWeightKg: number;
  targetWeightKg: number;
  targetDateIso: string;
  todayIso: string;
};

/** Ajuste inicial aproximado. Nunca calcula uma data de chegada. */
export function calculateCalorieTarget(input: {
  tdee: number;
  currentWeightKg: number;
  goalType: GoalType;
  deadline?: GoalDeadline | null;
}): CalorieTarget | null {
  const rule = CALORIE_ADJUSTMENT[input.goalType];
  if (!Number.isFinite(input.tdee) || input.tdee <= 0) return null;
  // Não transformar manutenção abaixo do piso em ganho involuntário.
  if (rule.direction === 0) {
    if (input.tdee < CALORIE_FLOOR) return null;
    return {
      calories: roundCalories(input.tdee),
      clampedByAutomationFloor: false,
      limitedByAutomation: false,
    };
  }
  let requestedDelta = input.tdee * rule.defaultShare;
  if (input.deadline) {
    const days = daysBetweenIso(input.deadline.todayIso, input.deadline.targetDateIso);
    const deltaKg =
      (input.deadline.targetWeightKg - input.deadline.currentWeightKg) * rule.direction;
    if (!Number.isFinite(days) || days <= 0 || deltaKg <= 0) return null;
    requestedDelta = (deltaKg * KCAL_PER_KG) / days;
  }
  const allowedDelta = Math.min(
    requestedDelta,
    input.tdee * rule.maxShare,
    (getWeeklyChangeLimit(input.goalType, input.currentWeightKg) * KCAL_PER_KG) / 7,
  );
  const adjusted = input.tdee + rule.direction * allowedDelta;
  // Para ganho, subir artificialmente até o piso poderia exceder o superávit permitido.
  if (rule.direction > 0 && adjusted < CALORIE_FLOOR) return null;
  const calories = roundCaloriesTowardMaintenance(Math.max(adjusted, CALORIE_FLOOR), input.tdee);
  // Não entregar manutenção/superávit como plano de perda, nem manutenção como ganho.
  if ((calories - input.tdee) * rule.direction <= 0) return null;
  return {
    calories,
    clampedByAutomationFloor: adjusted < CALORIE_FLOOR,
    limitedByAutomation: requestedDelta > allowedDelta || adjusted < CALORIE_FLOOR,
  };
}

export type Macros = { proteinG: number; carbsG: number; fatG: number };

/**
 * Seções 19 a 21. Proteína por peso corporal, gordura por fração calórica e
 * carboidrato com o que sobra.
 *
 * Se proteína e gordura já consomem todas as calorias — possível em meta muito
 * baixa com peso alto — não gerar um plano incompatível com o piso de gordura.
 */
export function calculateMacros(input: {
  calories: number;
  weightKg: number;
  goalType: GoalType;
}): Macros | null {
  const proteinG = input.weightKg * PROTEIN_G_PER_KG[input.goalType];
  const proteinCalories = proteinG * KCAL_PER_GRAM.protein;

  const fatFloorG = input.weightKg * FAT_G_PER_KG_FLOOR;
  const preferredFatG = (input.calories * FAT_CALORIE_SHARE) / KCAL_PER_GRAM.fat;

  const remainingAfterProtein = input.calories - proteinCalories;
  if (remainingAfterProtein < fatFloorG * KCAL_PER_GRAM.fat) return null;
  const affordableFatG = remainingAfterProtein / KCAL_PER_GRAM.fat;
  const fatG = Math.max(Math.min(preferredFatG, affordableFatG), fatFloorG);

  const remaining = input.calories - proteinCalories - fatG * KCAL_PER_GRAM.fat;
  const carbsG = Math.max(remaining, 0) / KCAL_PER_GRAM.carbs;

  return {
    proteinG: roundMacroGrams(proteinG),
    carbsG: roundMacroGrams(carbsG),
    fatG: roundMacroGrams(fatG),
  };
}

/** Seção 22. Estimativa inicial, ajustável no futuro por clima e treino. */
export function calculateWaterMl(weightKg: number): number {
  return roundWaterMl(weightKg * WATER_ML_PER_KG);
}

export type UnavailableReason =
  | 'invalid_input'
  | 'unspecified_sex'
  | 'underweight'
  | 'target_underweight'
  | 'calorie_floor'
  | 'incompatible_macros'
  | 'outside_supported_range';

export type FitnessPlan =
  | {
      status: 'unavailable';
      reason: UnavailableReason;
      calculationSource: string;
    }
  | {
      status: 'ready';
      bmi: number;
      bmiCategory: BmiCategory;
      bmr: number;
      tdee: number;
      calories: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
      waterMl: number;
      clampedByAutomationFloor: boolean;
      limitedByAutomation: boolean;
      goalType: GoalType;
      requestedDate: string | null;
      calculationSource: string;
    };

export type FitnessInput = {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  biologicalSex: BiologicalSex;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  /** Peso desejado, quando o objetivo trabalha com um. */
  targetWeightKg?: number | null;
  /** Prazo desejado, opcional. Orienta o ajuste inicial dentro dos limites da automação. */
  targetDateIso?: string | null;
  /** Dia de referência para o prazo desejado. */
  todayIso: string;
};

/** Ponto de entrada único do motor. Não duplicar estes cálculos (regra 5). */
export function buildFitnessPlan(input: FitnessInput): FitnessPlan {
  const unavailable = (reason: UnavailableReason): FitnessPlan => ({
    status: 'unavailable',
    reason,
    calculationSource: CALCULATION_SOURCE,
  });
  if (
    ![input.weightKg, input.heightCm, input.ageYears].every(Number.isFinite) ||
    input.ageYears < MIN_AUTOMATIC_AGE ||
    input.ageYears > FITNESS_INPUT_LIMITS.maxAge ||
    input.weightKg < FITNESS_INPUT_LIMITS.minWeightKg ||
    input.weightKg > FITNESS_INPUT_LIMITS.maxWeightKg ||
    input.heightCm < FITNESS_INPUT_LIMITS.minHeightCm ||
    input.heightCm > FITNESS_INPUT_LIMITS.maxHeightCm ||
    !(input.goalType in CALORIE_ADJUSTMENT) ||
    !(input.activityLevel in ACTIVITY_FACTORS) ||
    !['female', 'male', 'unspecified'].includes(input.biologicalSex)
  )
    return unavailable('invalid_input');
  const direction = CALORIE_ADJUSTMENT[input.goalType].direction;
  if (
    input.targetWeightKg != null &&
    (!Number.isFinite(input.targetWeightKg) ||
      input.targetWeightKg < FITNESS_INPUT_LIMITS.minWeightKg ||
      input.targetWeightKg > FITNESS_INPUT_LIMITS.maxWeightKg ||
      (direction !== 0 && (input.targetWeightKg - input.weightKg) * direction <= 0))
  )
    return unavailable('invalid_input');
  // Usar IMC bruto: 18,46 não deve se tornar elegível ao arredondar para 18,5.
  const rawBmi = input.weightKg / (input.heightCm / 100) ** 2;
  if (input.goalType === 'lose_weight') {
    if (rawBmi < UNDERWEIGHT_BMI) return unavailable('underweight');
    if (
      input.targetWeightKg != null &&
      input.targetWeightKg / (input.heightCm / 100) ** 2 < UNDERWEIGHT_BMI
    )
      return unavailable('target_underweight');
  }
  const bmr = calculateBmr(input);
  if (bmr === null) return unavailable('unspecified_sex');
  const tdee = calculateTdee(bmr, input.activityLevel);
  const deadline =
    direction !== 0 && input.targetWeightKg != null && input.targetDateIso
      ? {
          currentWeightKg: input.weightKg,
          targetWeightKg: input.targetWeightKg,
          targetDateIso: input.targetDateIso,
          todayIso: input.todayIso,
        }
      : null;
  const target = calculateCalorieTarget({
    tdee,
    currentWeightKg: input.weightKg,
    goalType: input.goalType,
    deadline,
  });
  if (!target) return unavailable('calorie_floor');
  const macros = calculateMacros({
    calories: target.calories,
    weightKg: input.weightKg,
    goalType: input.goalType,
  });
  if (!macros) return unavailable('incompatible_macros');
  const waterMl = calculateWaterMl(input.weightKg);
  // Limites do esquema 0004; não truncar números para fabricar um plano gravável.
  if (
    target.calories > TARGET_STORAGE_LIMITS.maxCalories ||
    macros.proteinG > TARGET_STORAGE_LIMITS.maxProteinG ||
    macros.carbsG > TARGET_STORAGE_LIMITS.maxCarbsG ||
    macros.fatG > TARGET_STORAGE_LIMITS.maxFatG ||
    waterMl > TARGET_STORAGE_LIMITS.maxWaterMl
  )
    return unavailable('outside_supported_range');
  return {
    status: 'ready',
    bmi: roundBmi(rawBmi),
    bmiCategory: classifyBmi(rawBmi),
    bmr: roundCalories(bmr),
    tdee: roundCalories(tdee),
    ...target,
    ...macros,
    waterMl,
    goalType: input.goalType,
    requestedDate: direction === 0 ? null : (input.targetDateIso ?? null),
    calculationSource: CALCULATION_SOURCE,
  };
}
