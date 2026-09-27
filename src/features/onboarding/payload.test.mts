import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EMPTY_DRAFT, type OnboardingDraft } from './model.ts';
import { buildOnboardingPayload } from './payload.ts';

const TODAY = '2026-09-22';
const USER = '11111111-1111-4111-8111-111111111111';

const COMPLETE: OnboardingDraft = {
  ...EMPTY_DRAFT,
  goalType: 'lose_weight',
  biologicalSex: 'female',
  birthDate: '10/05/1990',
  heightCm: '168,4',
  currentWeightKg: '72,55',
  targetWeightKg: '68',
  targetDate: '01/06/2027',
  activityLevel: 'lightly_active',
  fitnessExperience: 'beginner',
  trainingDaysPerWeek: 3,
  trainingSessionMinutes: 45,
  trainingLocation: 'home',
  equipment: ['bodyweight', 'bands'],
  mealsPerDay: 4,
  vegetarian: false,
  vegan: false,
  restrictions: ['lactose'],
  nutritionNotes: '  sem frituras  ',
};

test('converts a complete draft into rows matching the schema', () => {
  const payload = buildOnboardingPayload(USER, COMPLETE, TODAY);
  assert.ok(payload);

  assert.deepEqual(payload.profile, {
    user_id: USER,
    birth_date: '1990-05-10',
    biological_sex: 'female',
    height_cm: 168,
    activity_level: 'lightly_active',
    fitness_experience: 'beginner',
  });

  assert.equal(payload.goal.goal_type, 'lose_weight');
  assert.equal(payload.goal.starting_weight_kg, 72.55);
  assert.equal(payload.goal.target_weight_kg, 68);
  assert.equal(payload.goal.target_date, '2027-06-01');
  assert.equal(payload.goal.started_at, TODAY);
  assert.equal(payload.goal.status, 'active');

  assert.equal(payload.weightLog.weight_kg, 72.55);
  assert.equal(payload.weightLog.user_id, USER);

  assert.deepEqual(payload.training.equipment, ['bodyweight', 'bands']);
  assert.equal(payload.training.days_per_week, 3);
  assert.equal(payload.training.session_minutes, 45);

  assert.equal(payload.nutrition.meals_per_day, 4);
  assert.equal(payload.nutrition.notes, 'sem frituras');
  assert.deepEqual(payload.nutrition.restrictions, ['lactose']);
});

test('goals without a weight target do not carry one', () => {
  const payload = buildOnboardingPayload(
    USER,
    { ...COMPLETE, goalType: 'improve_health', targetWeightKg: '68' },
    TODAY,
  );
  assert.ok(payload);
  assert.equal(payload.goal.target_weight_kg, null);
});

test('vegan implies vegetarian, as the database CHECK requires', () => {
  const payload = buildOnboardingPayload(
    USER,
    { ...COMPLETE, vegan: true, vegetarian: false },
    TODAY,
  );
  assert.ok(payload);
  assert.equal(payload.nutrition.vegan, true);
  assert.equal(payload.nutrition.vegetarian, true);
});

test('empty notes become null instead of an empty string', () => {
  const payload = buildOnboardingPayload(USER, { ...COMPLETE, nutritionNotes: '   ' }, TODAY);
  assert.ok(payload);
  assert.equal(payload.nutrition.notes, null);
});

test('returns null when a required answer is missing', () => {
  assert.equal(buildOnboardingPayload(USER, EMPTY_DRAFT, TODAY), null);
  assert.equal(buildOnboardingPayload(USER, { ...COMPLETE, heightCm: '' }, TODAY), null);
  assert.equal(buildOnboardingPayload(USER, { ...COMPLETE, trainingLocation: null }, TODAY), null);
});
