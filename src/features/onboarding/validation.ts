import type { TranslationKey } from '@/lib/i18n/keys';
import { parseDecimal } from '../../lib/number.ts';
import { daysBetweenIso } from '../../lib/date.ts';
import { MIN_AUTOMATIC_AGE, FITNESS_INPUT_LIMITS } from '../fitness/constants.ts';
import { getWeeklyChangeLimit } from '../fitness/engine.ts';
import type { OnboardingDraft, OnboardingStep } from './model.ts';
import { requiresTargetWeight } from './model.ts';

// A regra de vírgula decimal é compartilhada com a nutrição; mora em lib/number.
export { parseDecimal } from '../../lib/number.ts';

export const MIN_AGE = MIN_AUTOMATIC_AGE;
export const MAX_AGE = FITNESS_INPUT_LIMITS.maxAge;
export const HEIGHT_CM_MIN = FITNESS_INPUT_LIMITS.minHeightCm;
export const HEIGHT_CM_MAX = FITNESS_INPUT_LIMITS.maxHeightCm;
export const WEIGHT_KG_MIN = FITNESS_INPUT_LIMITS.minWeightKg;
export const WEIGHT_KG_MAX = FITNESS_INPUT_LIMITS.maxWeightKg;

/** Aceita `DD/MM/AAAA` e `AAAA-MM-DD`. Devolve sempre `AAAA-MM-DD`. */
export function parseDateInput(value: string): string | null {
  const clean = value.trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(clean);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);
  let year: number, month: number, day: number;
  if (br) [, day, month, year] = br.map(Number) as [number, number, number, number];
  else if (iso) [, year, month, day] = iso.map(Number) as [number, number, number, number];
  else return null;

  // Date.UTC normaliza datas impossíveis (31/02). Comparar de volta rejeita.
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

export function formatDateBr(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

export function calculateAge(birthIso: string, todayIso: string): number {
  const [by, bm, bd] = birthIso.split('-').map(Number);
  const [ty, tm, td] = todayIso.split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

export type FieldIssues = Partial<Record<keyof OnboardingDraft, TranslationKey>>;

export function validateStep(
  step: OnboardingStep,
  draft: OnboardingDraft,
  todayIso: string,
): FieldIssues {
  const issues: FieldIssues = {};

  if (step === 'goal' && !draft.goalType) {
    issues.goalType = 'onboarding.error.goalRequired';
  }

  if (step === 'basics') {
    if (!draft.biologicalSex) issues.biologicalSex = 'onboarding.error.sexRequired';

    const birth = parseDateInput(draft.birthDate);
    if (!birth) {
      issues.birthDate = 'onboarding.error.birthDateInvalid';
    } else {
      const age = calculateAge(birth, todayIso);
      if (age < MIN_AGE) issues.birthDate = 'onboarding.error.birthDateTooYoung';
      else if (age > MAX_AGE) issues.birthDate = 'onboarding.error.birthDateInvalid';
    }

    const height = parseDecimal(draft.heightCm);
    if (height === null || height < HEIGHT_CM_MIN || height > HEIGHT_CM_MAX) {
      issues.heightCm = 'onboarding.error.heightRange';
    }

    const weight = parseDecimal(draft.currentWeightKg);
    if (weight === null || weight < WEIGHT_KG_MIN || weight > WEIGHT_KG_MAX) {
      issues.currentWeightKg = 'onboarding.error.weightRange';
    }
  }

  if (step === 'target' && requiresTargetWeight(draft.goalType)) {
    const target = parseDecimal(draft.targetWeightKg);
    if (target === null || target < WEIGHT_KG_MIN || target > WEIGHT_KG_MAX) {
      issues.targetWeightKg = 'onboarding.error.weightRange';
    } else {
      const current = parseDecimal(draft.currentWeightKg);
      if (current !== null) {
        if (draft.goalType === 'lose_weight' && target >= current) {
          issues.targetWeightKg = 'onboarding.error.targetNotBelow';
        }
        if (draft.goalType === 'gain_muscle' && target <= current) {
          issues.targetWeightKg = 'onboarding.error.targetNotAbove';
        }
      }
    }
    // A data é opcional; só é validada quando preenchida.
    if (draft.targetDate.trim()) {
      const target = parseDateInput(draft.targetDate);
      if (!target) issues.targetDate = 'onboarding.error.dateInvalid';
      else if (target <= todayIso) issues.targetDate = 'onboarding.error.datePast';
    }
  }

  if (step === 'activity' && !draft.activityLevel) {
    issues.activityLevel = 'onboarding.error.activityRequired';
  }

  if (step === 'training') {
    if (!draft.trainingDaysPerWeek) issues.trainingDaysPerWeek = 'onboarding.error.daysRequired';
    if (!draft.trainingSessionMinutes) {
      issues.trainingSessionMinutes = 'onboarding.error.minutesRequired';
    }
    if (!draft.trainingLocation) issues.trainingLocation = 'onboarding.error.locationRequired';
    if (!draft.fitnessExperience) issues.fitnessExperience = 'onboarding.error.experienceRequired';
  }

  if (step === 'nutrition' && draft.nutritionNotes.trim().length > 500) {
    issues.nutritionNotes = 'onboarding.error.notesTooLong';
  }

  return issues;
}

export function isStepValid(
  step: OnboardingStep,
  draft: OnboardingDraft,
  todayIso: string,
): boolean {
  return Object.keys(validateStep(step, draft, todayIso)).length === 0;
}

export type PaceVerdict = { level: 'none' } | { level: 'ok' } | { level: 'limited' };

/** Aviso preliminar: ausência de aviso não significa aprovação clínica ou de prazo. */
export function evaluatePace(draft: OnboardingDraft, todayIso: string): PaceVerdict {
  if (!draft.goalType || !requiresTargetWeight(draft.goalType)) return { level: 'none' };
  const current = parseDecimal(draft.currentWeightKg);
  const target = parseDecimal(draft.targetWeightKg);
  const deadline = parseDateInput(draft.targetDate);
  if (current === null || current <= 0 || target === null || !deadline) return { level: 'none' };
  const days = daysBetweenIso(todayIso, deadline);
  if (days <= 0) return { level: 'none' };
  const requiredWeekly = (Math.abs(target - current) * 7) / days;
  return {
    level: requiredWeekly > getWeeklyChangeLimit(draft.goalType, current) ? 'limited' : 'ok',
  };
}
