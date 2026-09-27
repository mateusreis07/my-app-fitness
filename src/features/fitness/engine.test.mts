import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACTIVITY_FACTORS, CALCULATION_SOURCE, KCAL_PER_KG, CALORIE_FLOOR } from './constants.ts';
import {
  buildFitnessPlan,
  calculateBmi,
  classifyBmi,
  calculateBmr,
  calculateTdee,
  calculateCalorieTarget,
  calculateMacros,
  calculateWaterMl,
  getWeeklyChangeLimit,
  type FitnessInput,
} from './engine.ts';

const BASE: FitnessInput = {
  weightKg: 80,
  heightCm: 180,
  ageYears: 30,
  biologicalSex: 'male',
  activityLevel: 'moderately_active',
  goalType: 'lose_weight',
  targetWeightKg: 75,
  todayIso: '2026-09-22',
};
function ready(overrides: Partial<FitnessInput> = {}) {
  const plan = buildFitnessPlan({ ...BASE, ...overrides });
  assert.equal(plan.status, 'ready');
  return plan;
}
function unavailable(overrides: Partial<FitnessInput>, reason: string) {
  assert.deepEqual(buildFitnessPlan({ ...BASE, ...overrides }), {
    status: 'unavailable',
    reason,
    calculationSource: CALCULATION_SOURCE,
  });
}

test('BMI formula and unrounded category boundaries', () => {
  assert.equal(calculateBmi(80, 180), 24.7);
  for (const [bmi, expected] of [
    [18.49, 'underweight'],
    [18.5, 'normal'],
    [25, 'overweight'],
    [30, 'obese_1'],
    [35, 'obese_2'],
    [40, 'obese_3'],
  ] as const)
    assert.equal(classifyBmi(bmi), expected);
});
test('Mifflin constants for female and male; unspecified has no invented BMR', () => {
  assert.equal(calculateBmr(BASE), 1780);
  assert.equal(calculateBmr({ ...BASE, biologicalSex: 'female' }), 1614);
  assert.equal(calculateBmr({ ...BASE, biologicalSex: 'unspecified' }), null);
});
test('TDEE uses every activity factor', () => {
  for (const [level, factor] of Object.entries(ACTIVITY_FACTORS))
    assert.equal(calculateTdee(1780, level as FitnessInput['activityLevel']), 1780 * factor);
});
test('weekly limits scale with weight and obey absolute caps', () => {
  assert.equal(getWeeklyChangeLimit('lose_weight', 50), 0.5);
  assert.equal(getWeeklyChangeLimit('lose_weight', 150), 1);
  assert.ok(Math.abs(getWeeklyChangeLimit('gain_muscle', 70) - 0.35) < 1e-12);
  assert.equal(getWeeklyChangeLimit('gain_muscle', 150), 0.5);
  assert.equal(getWeeklyChangeLimit('maintain_weight', 80), 0);
});
test('default deficit is 15%, rounded toward maintenance', () => {
  assert.equal(ready().calories, Math.ceil(1780 * 1.55 * 0.85));
});
test('default surplus is 5%', () => {
  assert.equal(
    ready({ goalType: 'gain_muscle', targetWeightKg: 85 }).calories,
    Math.floor(1780 * 1.55 * 1.05),
  );
});
test('maintenance, health and fitness use TDEE without a weight deadline', () => {
  for (const goalType of ['maintain_weight', 'improve_health', 'improve_fitness'] as const) {
    const plan = ready({ goalType, targetWeightKg: null, targetDateIso: '2026-09-23' });
    assert.equal(plan.calories, 2759);
    assert.equal(plan.requestedDate, null);
  }
});
test('slow deadline no longer forces a 10% deficit (70 to 69 kg over 365 days)', () => {
  const result = calculateCalorieTarget({
    tdee: 2250,
    currentWeightKg: 70,
    goalType: 'lose_weight',
    deadline: {
      currentWeightKg: 70,
      targetWeightKg: 69,
      todayIso: '2026-09-22',
      targetDateIso: '2027-09-22',
    },
  });
  assert.ok(result);
  assert.equal(result.calories, 2229);
  assert.equal(result.limitedByAutomation, false);
});
test('loss deadline caps both percentage of TDEE and weekly weight change', () => {
  for (const tdee of [2000, 6000]) {
    const result = calculateCalorieTarget({
      tdee,
      currentWeightKg: 60,
      goalType: 'lose_weight',
      deadline: {
        currentWeightKg: 60,
        targetWeightKg: 55,
        todayIso: '2026-09-22',
        targetDateIso: '2026-09-23',
      },
    });
    assert.ok(result);
    assert.ok(tdee - result.calories <= tdee * 0.2);
    assert.ok(((tdee - result.calories) * 7) / KCAL_PER_KG <= 0.6);
    assert.equal(result.limitedByAutomation, true);
  }
});
test('gain deadline caps both percentage of TDEE and weekly weight change', () => {
  for (const tdee of [2000, 6000]) {
    const result = calculateCalorieTarget({
      tdee,
      currentWeightKg: 60,
      goalType: 'gain_muscle',
      deadline: {
        currentWeightKg: 60,
        targetWeightKg: 65,
        todayIso: '2026-09-22',
        targetDateIso: '2026-09-23',
      },
    });
    assert.ok(result);
    assert.ok(result.calories - tdee <= tdee * 0.15);
    assert.ok(((result.calories - tdee) * 7) / KCAL_PER_KG <= 0.3);
    assert.equal(result.limitedByAutomation, true);
  }
});
test('floor reduces deficit without converting weight loss to maintenance', () => {
  const result = calculateCalorieTarget({
    tdee: 1600,
    currentWeightKg: 70,
    goalType: 'lose_weight',
  });
  assert.ok(result);
  assert.equal(result.calories, 1500);
  assert.equal(result.clampedByAutomationFloor, true);
  for (const tdee of [1400, 1500])
    assert.equal(
      calculateCalorieTarget({ tdee, currentWeightKg: 70, goalType: 'lose_weight' }),
      null,
    );
});
test('BMR is not treated as an intake floor', () => {
  const plan = ready({ activityLevel: 'sedentary', targetDateIso: '2026-09-23' });
  assert.ok(plan.calories < plan.bmr);
  assert.ok(plan.calories >= 1500);
});
test('floor is identical for eligible male and female plans', () => {
  for (const biologicalSex of ['female', 'male'] as const) {
    const plan = ready({
      biologicalSex,
      weightKg: 60,
      heightCm: 155,
      ageYears: 45,
      activityLevel: 'lightly_active',
      targetWeightKg: 55,
      targetDateIso: '2026-09-23',
    });
    assert.equal(plan.calories, 1500);
  }
});
test('floor never creates unintended surplus in maintenance or enlarges gain', () => {
  assert.equal(
    calculateCalorieTarget({ tdee: 1400, currentWeightKg: 70, goalType: 'maintain_weight' }),
    null,
  );
  assert.equal(
    calculateCalorieTarget({ tdee: 1400, currentWeightKg: 70, goalType: 'gain_muscle' }),
    null,
  );
});
test('unspecified sex completes calculation without calorie or macro targets', () =>
  unavailable({ biologicalSex: 'unspecified' }, 'unspecified_sex'));
test('rejects automatic loss for underweight user (50 kg, 170 cm)', () =>
  unavailable({ weightKg: 50, heightCm: 170, targetWeightKg: 45 }, 'underweight'));
test('rejects automatic loss toward underweight target', () =>
  unavailable({ targetWeightKg: 59 }, 'target_underweight'));
test('BMI eligibility uses raw precision instead of rounded 18.5', () => {
  unavailable({ weightKg: 53.36, heightCm: 170, targetWeightKg: 52 }, 'underweight');
  unavailable({ weightKg: 60, heightCm: 170, targetWeightKg: 53.36 }, 'target_underweight');
});
test('exact adult boundary is accepted but minors are ineligible', () => {
  ready({ ageYears: 18 });
  unavailable({ ageYears: 17 }, 'invalid_input');
});
test('nonfinite and out-of-domain input cannot generate a plan', () => {
  for (const weightKg of [NaN, Infinity, -1, 0, 24, 401])
    unavailable({ weightKg }, 'invalid_input');
  unavailable({ heightCm: 0 }, 'invalid_input');
  unavailable({ ageYears: 101 }, 'invalid_input');
  unavailable({ targetWeightKg: NaN }, 'invalid_input');
  unavailable({ targetWeightKg: 81 }, 'invalid_input');
});
test('low TDEE produces explicit no-plan rather than opposite goal', () =>
  unavailable(
    {
      weightKg: 50,
      heightCm: 150,
      ageYears: 80,
      biologicalSex: 'female',
      activityLevel: 'sedentary',
      targetWeightKg: 45,
    },
    'calorie_floor',
  ));
test('macros retain approved protein factors and fat preference', () => {
  for (const [goalType, factor] of [
    ['lose_weight', 1.8],
    ['gain_muscle', 1.8],
    ['maintain_weight', 1.4],
    ['improve_health', 1.4],
    ['improve_fitness', 1.6],
  ] as const) {
    const macros = calculateMacros({ calories: 2500, weightKg: 80, goalType });
    assert.ok(macros);
    assert.equal(macros.proteinG, Math.round(80 * factor));
    assert.equal(macros.fatG, 76);
    assert.ok(Math.abs(macros.proteinG * 4 + macros.carbsG * 4 + macros.fatG * 9 - 2500) <= 9);
  }
});
test('incompatible macros return no result instead of negative carbs or insufficient fat', () => {
  assert.equal(calculateMacros({ calories: 1500, weightKg: 200, goalType: 'lose_weight' }), null);
});
test('water remains 35 ml per kg', () => assert.equal(calculateWaterMl(72.5), 2538));
test('new targets record version 1.2; no exact arrival date or weekly forecast', () => {
  const plan = ready({ targetDateIso: '2026-12-31' });
  assert.equal(plan.calculationSource, 'fitness_engine@1.2');
  assert.equal(plan.requestedDate, '2026-12-31');
  assert.equal('pace' in plan, false);
  assert.equal('projectedDate' in plan, false);
});
test('past or zero-day deadlines cannot generate caloric adjustments', () => {
  for (const targetDateIso of ['2026-09-22', '2026-09-21', 'invalid'])
    assert.equal(
      calculateCalorieTarget({
        tdee: 2200,
        currentWeightKg: 80,
        goalType: 'lose_weight',
        deadline: {
          currentWeightKg: 80,
          targetWeightKg: 75,
          todayIso: '2026-09-22',
          targetDateIso,
        },
      }),
      null,
    );
});
test('all generated plans fit database limits across supported extremes', () => {
  for (const biologicalSex of ['male', 'female', 'unspecified'] as const)
    for (const goalType of [
      'lose_weight',
      'gain_muscle',
      'maintain_weight',
      'improve_health',
      'improve_fitness',
    ] as const)
      for (const weightKg of [25, 50, 80, 150, 250, 400])
        for (const heightCm of [80, 160, 260])
          for (const activityLevel of ['sedentary', 'extremely_active'] as const) {
            const plan = buildFitnessPlan({
              ...BASE,
              weightKg,
              heightCm,
              biologicalSex,
              goalType,
              activityLevel,
              targetWeightKg: null,
            });
            if (plan.status !== 'ready') continue;
            assert.ok(plan.calories >= CALORIE_FLOOR && plan.calories <= 8000);
            assert.ok(plan.proteinG >= 0 && plan.proteinG <= 500);
            assert.ok(plan.carbsG >= 0 && plan.carbsG <= 1200);
            assert.ok(plan.fatG >= 0 && plan.fatG <= 400);
            assert.ok(plan.waterMl >= 500 && plan.waterMl <= 10000);
            assert.ok(
              Math.abs(plan.proteinG * 4 + plan.carbsG * 4 + plan.fatG * 9 - plan.calories) <= 9,
            );
          }
});
