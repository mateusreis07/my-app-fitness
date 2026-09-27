/**
 * Modelo do onboarding — KORA_MASTER_CONTEXT.md seção 12.
 *
 * Os valores são os internos em inglês, como manda o documento. Os rótulos
 * ficam no catálogo pt-BR (regra 7), referenciados pela chave de tradução.
 */
import type {
  ActivityLevel,
  BiologicalSex,
  FitnessExperience,
  GoalType,
  TrainingLocation,
} from '@/services/supabase/database.types';
import type { TranslationKey } from '@/lib/i18n/keys';

export const ONBOARDING_STEPS = [
  'goal',
  'basics',
  'target',
  'activity',
  'training',
  'nutrition',
  'summary',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/**
 * Rascunho do onboarding. Os campos numéricos ficam como texto porque é o que
 * o usuário digita; a conversão acontece na validação, em um lugar só.
 */
export type OnboardingDraft = {
  goalType: GoalType | null;
  biologicalSex: BiologicalSex | null;
  birthDate: string;
  heightCm: string;
  currentWeightKg: string;
  targetWeightKg: string;
  targetDate: string;
  activityLevel: ActivityLevel | null;
  fitnessExperience: FitnessExperience | null;
  trainingDaysPerWeek: number | null;
  trainingSessionMinutes: number | null;
  trainingLocation: TrainingLocation | null;
  equipment: string[];
  mealsPerDay: number | null;
  vegetarian: boolean;
  vegan: boolean;
  restrictions: string[];
  nutritionNotes: string;
};

export const EMPTY_DRAFT: OnboardingDraft = {
  goalType: null,
  biologicalSex: null,
  birthDate: '',
  heightCm: '',
  currentWeightKg: '',
  targetWeightKg: '',
  targetDate: '',
  activityLevel: null,
  fitnessExperience: null,
  trainingDaysPerWeek: null,
  trainingSessionMinutes: null,
  trainingLocation: null,
  equipment: [],
  mealsPerDay: null,
  vegetarian: false,
  vegan: false,
  restrictions: [],
  nutritionNotes: '',
};

export type Option<T extends string> = { value: T; labelKey: TranslationKey };

export const GOAL_OPTIONS: Option<GoalType>[] = [
  { value: 'lose_weight', labelKey: 'onboarding.goal.lose_weight' },
  { value: 'gain_muscle', labelKey: 'onboarding.goal.gain_muscle' },
  { value: 'maintain_weight', labelKey: 'onboarding.goal.maintain_weight' },
  { value: 'improve_health', labelKey: 'onboarding.goal.improve_health' },
  { value: 'improve_fitness', labelKey: 'onboarding.goal.improve_fitness' },
];

export const SEX_OPTIONS: Option<BiologicalSex>[] = [
  { value: 'female', labelKey: 'onboarding.sexOption.female' },
  { value: 'male', labelKey: 'onboarding.sexOption.male' },
  { value: 'unspecified', labelKey: 'onboarding.sexOption.unspecified' },
];

export const ACTIVITY_OPTIONS: (Option<ActivityLevel> & { hintKey: TranslationKey })[] = [
  {
    value: 'sedentary',
    labelKey: 'onboarding.activityOption.sedentary',
    hintKey: 'onboarding.activityHint.sedentary',
  },
  {
    value: 'lightly_active',
    labelKey: 'onboarding.activityOption.lightly_active',
    hintKey: 'onboarding.activityHint.lightly_active',
  },
  {
    value: 'moderately_active',
    labelKey: 'onboarding.activityOption.moderately_active',
    hintKey: 'onboarding.activityHint.moderately_active',
  },
  {
    value: 'very_active',
    labelKey: 'onboarding.activityOption.very_active',
    hintKey: 'onboarding.activityHint.very_active',
  },
  {
    value: 'extremely_active',
    labelKey: 'onboarding.activityOption.extremely_active',
    hintKey: 'onboarding.activityHint.extremely_active',
  },
];

/** Rótulo traduzível de um valor interno, ou `null` se o valor não existir. */
export function findLabelKey<T extends string>(
  options: Option<T>[],
  value: T | null,
): TranslationKey | null {
  if (value === null) return null;
  return options.find((option) => option.value === value)?.labelKey ?? null;
}

export const EXPERIENCE_OPTIONS: Option<FitnessExperience>[] = [
  { value: 'beginner', labelKey: 'onboarding.experienceOption.beginner' },
  { value: 'intermediate', labelKey: 'onboarding.experienceOption.intermediate' },
  { value: 'advanced', labelKey: 'onboarding.experienceOption.advanced' },
];

export const LOCATION_OPTIONS: Option<TrainingLocation>[] = [
  { value: 'home', labelKey: 'onboarding.locationOption.home' },
  { value: 'gym', labelKey: 'onboarding.locationOption.gym' },
  { value: 'outdoor', labelKey: 'onboarding.locationOption.outdoor' },
  { value: 'mixed', labelKey: 'onboarding.locationOption.mixed' },
];

export const EQUIPMENT_OPTIONS: Option<string>[] = [
  { value: 'bodyweight', labelKey: 'onboarding.equipmentOption.bodyweight' },
  { value: 'dumbbells', labelKey: 'onboarding.equipmentOption.dumbbells' },
  { value: 'barbell', labelKey: 'onboarding.equipmentOption.barbell' },
  { value: 'machines', labelKey: 'onboarding.equipmentOption.machines' },
  { value: 'bands', labelKey: 'onboarding.equipmentOption.bands' },
  { value: 'cardio', labelKey: 'onboarding.equipmentOption.cardio' },
];

export const RESTRICTION_OPTIONS: Option<string>[] = [
  { value: 'lactose', labelKey: 'onboarding.restrictionOption.lactose' },
  { value: 'gluten', labelKey: 'onboarding.restrictionOption.gluten' },
  { value: 'nuts', labelKey: 'onboarding.restrictionOption.nuts' },
  { value: 'seafood', labelKey: 'onboarding.restrictionOption.seafood' },
  { value: 'eggs', labelKey: 'onboarding.restrictionOption.eggs' },
];

export const TRAINING_DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;
export const SESSION_MINUTES_OPTIONS = [20, 30, 45, 60, 90] as const;
export const MEALS_PER_DAY_OPTIONS = [2, 3, 4, 5, 6] as const;

/** Objetivos que trabalham com um peso-alvo explícito na etapa 3. */
export function requiresTargetWeight(goalType: GoalType | null): boolean {
  return goalType === 'lose_weight' || goalType === 'gain_muscle';
}

/** Pula apenas a meta de peso; dados básicos são obrigatórios para todos os objetivos. */
export function nextOnboardingStepIndex(
  index: number,
  goal: GoalType | null,
  direction: 1 | -1,
): number {
  let next = index + direction;
  if (ONBOARDING_STEPS[next] === 'target' && !requiresTargetWeight(goal)) next += direction;
  return Math.max(0, Math.min(ONBOARDING_STEPS.length - 1, next));
}
