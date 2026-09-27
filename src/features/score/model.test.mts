import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  consistencyScore,
  currentStreak,
  dayComponents,
  longestStreak,
  nutritionScore,
  ratioScore,
  scoreStatusKey,
  totalScore,
  workoutScore,
  type ScoreDay,
} from './model.ts';

test('calories within the tolerance band score 100, either side', () => {
  assert.equal(nutritionScore(2000, 2000), 100);
  assert.equal(nutritionScore(2090, 2000), 100); // +4.5%, inside 10%
  assert.equal(nutritionScore(1910, 2000), 100); // -4.5%, inside 10%
});

test('calories decay linearly past the tolerance, symmetric for over and under', () => {
  // 30% over and 30% under should score the same, both below 100 and above 0.
  const over = nutritionScore(2600, 2000);
  const under = nutritionScore(1400, 2000);
  assert.equal(over, under);
  assert.ok(over > 0 && over < 100);
});

test('calories at or beyond the zero-at deviation floor at zero', () => {
  assert.equal(nutritionScore(3000, 2000), 0); // +50%
  assert.equal(nutritionScore(1000, 2000), 0); // -50%
  assert.equal(nutritionScore(4000, 2000), 0); // beyond the floor, still 0, never negative
});

test('nutritionScore guards against a non-positive or invalid target', () => {
  assert.equal(nutritionScore(100, 0), 0);
  assert.equal(nutritionScore(100, -10), 0);
  assert.equal(nutritionScore(NaN, 2000), 0);
});

test('ratioScore caps at 100 once the target is met or exceeded', () => {
  assert.equal(ratioScore(50, 100), 50);
  assert.equal(ratioScore(100, 100), 100);
  assert.equal(ratioScore(150, 100), 100);
  assert.equal(ratioScore(0, 100), 0);
  assert.equal(ratioScore(-10, 100), 0);
  assert.equal(ratioScore(50, 0), 0);
});

test('workout component is 100 on a rest/no-plan day and only drops when scheduled and not completed', () => {
  assert.equal(workoutScore(false, false), 100);
  assert.equal(workoutScore(true, true), 100);
  assert.equal(workoutScore(true, false), 0);
});

test('consistency counts the three loggable areas, independent of hitting the target', () => {
  assert.equal(
    consistencyScore({ loggedMeal: false, loggedWater: false, loggedWorkout: false }),
    0,
  );
  assert.equal(
    consistencyScore({ loggedMeal: true, loggedWater: false, loggedWorkout: false }),
    33,
  );
  assert.equal(consistencyScore({ loggedMeal: true, loggedWater: true, loggedWorkout: true }), 100);
});

test('totalScore is null without a nutrition target, never a fabricated number', () => {
  const noTargets = dayComponents({
    consumedKcal: 0,
    targetKcal: null,
    consumedProteinG: 0,
    targetProteinG: null,
    consumedWaterMl: 0,
    targetWaterMl: null,
    workoutScheduled: false,
    workoutCompleted: false,
    loggedMeal: false,
    loggedWater: false,
    loggedWorkout: false,
  });
  assert.equal(totalScore(noTargets), null);
});

test('totalScore is the weighted sum of the five components when a target exists', () => {
  const components = dayComponents({
    consumedKcal: 2000,
    targetKcal: 2000,
    consumedProteinG: 150,
    targetProteinG: 150,
    consumedWaterMl: 2000,
    targetWaterMl: 2000,
    workoutScheduled: false,
    workoutCompleted: false,
    loggedMeal: true,
    loggedWater: true,
    loggedWorkout: true,
  });
  // Todos os componentes batem a meta, sem treino programado (100) e as três
  // áreas registradas (consistency 100): soma ponderada dá 100 cheio.
  assert.equal(totalScore(components), 100);
});

test('scoreStatusKey maps ranges and null to the unavailable key', () => {
  assert.equal(scoreStatusKey(null), 'score.status.unavailable');
  assert.equal(scoreStatusKey(85), 'score.status.excellent');
  assert.equal(scoreStatusKey(65), 'score.status.good');
  assert.equal(scoreStatusKey(45), 'score.status.fair');
  assert.equal(scoreStatusKey(10), 'score.status.low');
});

function days(scores: (number | null)[]): ScoreDay[] {
  return scores.map((totalScore, index) => ({ dayKey: `day-${index}`, totalScore }));
}

test('currentStreak counts consecutive good days from the front, and stops at the first failure', () => {
  assert.equal(currentStreak(days([80, 70, 60])), 3);
  assert.equal(currentStreak(days([80, 40, 90])), 1);
  assert.equal(currentStreak(days([49])), 0); // just below the threshold
  assert.equal(currentStreak(days([50])), 1); // exactly at the threshold
});

test('a gap (null day) breaks the current streak just like a low score', () => {
  assert.equal(currentStreak(days([80, null, 90])), 1);
});

test('longestStreak finds the best run anywhere in the list, even if the current streak is shorter', () => {
  assert.equal(longestStreak(days([40, 80, 80, 80, 40, 60])), 3);
  assert.equal(longestStreak(days([40, 40])), 0);
  assert.equal(longestStreak([]), 0);
});
