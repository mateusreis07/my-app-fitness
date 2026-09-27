/**
 * Conversão do rascunho do onboarding nas linhas que vão para o banco.
 *
 * Fica separado de `submit.ts` para ser testável sem cliente Supabase: é aqui
 * que mora a regra de como cada resposta vira dado (regra 4).
 */
import type {
  Goal,
  NutritionPreferences,
  Profile,
  TrainingPreferences,
  WeightLog,
} from '@/services/supabase/database.types';
import type { FitnessInput } from '@/features/fitness/engine';
import { dashboardClock, resolveTimeZone } from '../dashboard/calendar.ts';
import { ONBOARDING_STEPS, requiresTargetWeight, type OnboardingDraft } from './model.ts';
import { calculateAge, parseDateInput, parseDecimal, isStepValid } from './validation.ts';

export type OnboardingPayload = {
  profile: Partial<Profile> & { user_id: string };
  weightLog: Omit<WeightLog, 'id' | 'created_at'>;
  goal: Omit<Goal, 'id' | 'created_at' | 'updated_at'>;
  training: Omit<TrainingPreferences, 'id' | 'created_at' | 'updated_at'>;
  nutrition: Omit<NutritionPreferences, 'id' | 'created_at' | 'updated_at'>;
  /** Entrada do Motor Fitness, derivada dos mesmos dados já validados. */
  fitnessInput: FitnessInput;
};

/** Duas casas decimais, como as colunas numeric(5,2). */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Devolve `null` quando o rascunho não tem o mínimo exigido. Os chamadores só
 * chegam aqui depois de `validateStep`, então `null` indica erro de programação
 * e não uma mensagem para o usuário.
 */
export function buildOnboardingPayload(
  userId: string,
  draft: OnboardingDraft,
  todayIso: string,
  /** Fuso do perfil. Grava o dia local junto do registro, como manda o invariante 16. */
  timeZone = resolveTimeZone(),
): OnboardingPayload | null {
  if (!ONBOARDING_STEPS.every((step) => isStepValid(step, draft, todayIso))) return null;
  const birthDate = parseDateInput(draft.birthDate);
  const height = parseDecimal(draft.heightCm);
  const currentWeight = parseDecimal(draft.currentWeightKg);

  if (
    !draft.goalType ||
    !draft.biologicalSex ||
    !draft.activityLevel ||
    !draft.fitnessExperience ||
    !draft.trainingLocation ||
    !draft.trainingDaysPerWeek ||
    !draft.trainingSessionMinutes ||
    !birthDate ||
    height === null ||
    currentWeight === null
  ) {
    return null;
  }

  const targetWeight = requiresTargetWeight(draft.goalType)
    ? parseDecimal(draft.targetWeightKg)
    : null;
  const targetDate =
    requiresTargetWeight(draft.goalType) && draft.targetDate.trim()
      ? parseDateInput(draft.targetDate)
      : null;
  const notes = draft.nutritionNotes.trim();

  return {
    profile: {
      user_id: userId,
      birth_date: birthDate,
      biological_sex: draft.biologicalSex,
      height_cm: Math.round(height),
      activity_level: draft.activityLevel,
      fitness_experience: draft.fitnessExperience,
    },
    weightLog: (() => {
      const recordedAt = new Date();
      return {
        user_id: userId,
        weight_kg: round2(currentWeight),
        recorded_at: recordedAt.toISOString(),
        recorded_date: dashboardClock(recordedAt, timeZone).dayKey,
        recorded_timezone: timeZone,
        notes: null,
      };
    })(),
    goal: {
      user_id: userId,
      goal_type: draft.goalType,
      starting_weight_kg: round2(currentWeight),
      target_weight_kg: targetWeight === null ? null : round2(targetWeight),
      started_at: todayIso,
      target_date: targetDate,
      status: 'active',
    },
    training: {
      user_id: userId,
      days_per_week: draft.trainingDaysPerWeek,
      session_minutes: draft.trainingSessionMinutes,
      location: draft.trainingLocation,
      equipment: draft.equipment,
    },
    nutrition: {
      user_id: userId,
      meals_per_day: draft.mealsPerDay,
      // O banco tem CHECK (not vegan or vegetarian). A coerção acontece aqui
      // para o usuário nunca ver um erro de constraint.
      vegetarian: draft.vegetarian || draft.vegan,
      vegan: draft.vegan,
      restrictions: draft.restrictions,
      notes: notes.length > 0 ? notes : null,
    },
    fitnessInput: {
      weightKg: currentWeight,
      heightCm: height,
      ageYears: calculateAge(birthDate, todayIso),
      biologicalSex: draft.biologicalSex,
      activityLevel: draft.activityLevel,
      goalType: draft.goalType,
      targetWeightKg: targetWeight === null ? null : round2(targetWeight),
      targetDateIso: targetDate,
      todayIso,
    },
  };
}
