import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EMPTY_DRAFT, type OnboardingDraft } from './model.ts';
import {
  calculateAge,
  evaluatePace,
  parseDateInput,
  parseDecimal,
  validateStep,
} from './validation.ts';

const TODAY = '2026-09-22';

function draft(overrides: Partial<OnboardingDraft> = {}): OnboardingDraft {
  return { ...EMPTY_DRAFT, ...overrides };
}

test('accepts comma as decimal separator', () => {
  assert.equal(parseDecimal('72,5'), 72.5);
  assert.equal(parseDecimal(' 72.5 '), 72.5);
  assert.equal(parseDecimal('72,5 kg'), null);
  assert.equal(parseDecimal('-5'), null);
  assert.equal(parseDecimal(''), null);
});

test('parses both date formats and rejects impossible days', () => {
  assert.equal(parseDateInput('29/02/2024'), '2024-02-29');
  assert.equal(parseDateInput('1990-05-10'), '1990-05-10');
  assert.equal(parseDateInput('31/02/1990'), null);
  assert.equal(parseDateInput('29/02/2025'), null);
  assert.equal(parseDateInput('10-05-1990'), null);
});

test('calculates age without counting an unreached birthday', () => {
  assert.equal(calculateAge('2000-09-22', TODAY), 26);
  assert.equal(calculateAge('2000-09-23', TODAY), 25);
  assert.equal(calculateAge('2000-12-01', TODAY), 25);
});

test('basics step demands sex, valid age, height and weight', () => {
  const complete = draft({
    biologicalSex: 'female',
    birthDate: '10/05/1990',
    heightCm: '168',
    currentWeightKg: '72,5',
  });
  assert.deepEqual(validateStep('basics', complete, TODAY), {});

  const empty = validateStep('basics', draft(), TODAY);
  assert.equal(empty.biologicalSex, 'onboarding.error.sexRequired');
  assert.equal(empty.birthDate, 'onboarding.error.birthDateInvalid');
  assert.equal(empty.heightCm, 'onboarding.error.heightRange');
  assert.equal(empty.currentWeightKg, 'onboarding.error.weightRange');
});

test('blocks users under 18', () => {
  const minor = draft({
    biologicalSex: 'male',
    birthDate: '23/09/2008',
    heightCm: '170',
    currentWeightKg: '60',
  });
  assert.equal(
    validateStep('basics', minor, TODAY).birthDate,
    'onboarding.error.birthDateTooYoung',
  );
});

test('target weight must move in the direction of the goal', () => {
  const base = { currentWeightKg: '80', targetDate: '' };
  assert.equal(
    validateStep('target', draft({ ...base, goalType: 'lose_weight', targetWeightKg: '85' }), TODAY)
      .targetWeightKg,
    'onboarding.error.targetNotBelow',
  );
  assert.equal(
    validateStep('target', draft({ ...base, goalType: 'gain_muscle', targetWeightKg: '75' }), TODAY)
      .targetWeightKg,
    'onboarding.error.targetNotAbove',
  );
  assert.deepEqual(
    validateStep(
      'target',
      draft({ ...base, goalType: 'lose_weight', targetWeightKg: '75' }),
      TODAY,
    ),
    {},
  );
});

test('target step does not apply to goals without a weight target', () => {
  assert.deepEqual(validateStep('target', draft({ goalType: 'improve_health' }), TODAY), {});
});

test('a past deadline is rejected, an absent one is accepted', () => {
  const base = draft({ goalType: 'lose_weight', currentWeightKg: '80', targetWeightKg: '75' });
  assert.equal(
    validateStep('target', { ...base, targetDate: '01/01/2020' }, TODAY).targetDate,
    'onboarding.error.datePast',
  );
  assert.equal(validateStep('target', { ...base, targetDate: '' }, TODAY).targetDate, undefined);
});

test('flags a deadline beyond automation without predicting an arrival date', () => {
  // 10 kg a perder em 2 semanas: acima de 1 kg/semana.
  const rushed = draft({
    goalType: 'lose_weight',
    currentWeightKg: '80',
    targetWeightKg: '70',
    targetDate: '06/10/2026',
  });
  const verdict = evaluatePace(rushed, TODAY);
  assert.equal(verdict.level, 'limited');
  assert.deepEqual(verdict, { level: 'limited' });
});

test('accepts a deadline that fits the automation pace limit', () => {
  const calm = draft({
    goalType: 'lose_weight',
    currentWeightKg: '80',
    targetWeightKg: '75',
    targetDate: '22/03/2027',
  });
  assert.equal(evaluatePace(calm, TODAY).level, 'ok');
});

test('muscle gain uses a slower automation pace limit than weight loss', () => {
  // 5 kg em 8 semanas: dentro do limite de perda (0,7 kg/sem), acima do ganho (0,35).
  const shared = { currentWeightKg: '70', targetDate: '17/11/2026' };
  assert.equal(
    evaluatePace(draft({ ...shared, goalType: 'lose_weight', targetWeightKg: '65' }), TODAY).level,
    'ok',
  );
  assert.equal(
    evaluatePace(draft({ ...shared, goalType: 'gain_muscle', targetWeightKg: '75' }), TODAY).level,
    'limited',
  );
});

test('pace is not evaluated without a deadline or without a target', () => {
  assert.equal(
    evaluatePace(
      draft({ goalType: 'lose_weight', currentWeightKg: '80', targetWeightKg: '70' }),
      TODAY,
    ).level,
    'none',
  );
  assert.equal(evaluatePace(draft({ goalType: 'maintain_weight' }), TODAY).level, 'none');
});

test('training step requires all four answers', () => {
  const issues = validateStep('training', draft(), TODAY);
  assert.equal(issues.trainingDaysPerWeek, 'onboarding.error.daysRequired');
  assert.equal(issues.trainingSessionMinutes, 'onboarding.error.minutesRequired');
  assert.equal(issues.trainingLocation, 'onboarding.error.locationRequired');
  assert.equal(issues.fitnessExperience, 'onboarding.error.experienceRequired');
});

test('nutrition step is fully optional except for the notes limit', () => {
  assert.deepEqual(validateStep('nutrition', draft(), TODAY), {});
  assert.equal(
    validateStep('nutrition', draft({ nutritionNotes: 'x'.repeat(501) }), TODAY).nutritionNotes,
    'onboarding.error.notesTooLong',
  );
});
