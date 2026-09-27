import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { MealItem } from '../../services/supabase/database.types';
import { selectDailySignals } from '../dashboard/model.ts';
import { buildDayTotals, buildMealTotals } from './totals.ts';

const DAY = '2026-09-23';

function item(overrides: Partial<MealItem> = {}): MealItem {
  return {
    id: 'item',
    meal_id: 'meal',
    food_id: null,
    user_food_id: 'food',
    name_snapshot: 'Arroz',
    quantity: 100,
    serving_unit: 'g',
    calories_snapshot: 130,
    protein_snapshot: 3,
    carbs_snapshot: 28,
    fat_snapshot: 1,
    created_at: DAY,
    ...overrides,
  };
}

test('dia sem refeição devolve zeros explícitos e nenhuma refeição contada', () => {
  assert.deepEqual(buildDayTotals(DAY, []), {
    dayKey: DAY,
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    mealCount: 0,
  });
});

test('soma itens de várias refeições', () => {
  const totals = buildDayTotals(DAY, [
    { id: 'a', items: [item(), item()] },
    { id: 'b', items: [item({ calories_snapshot: 200, protein_snapshot: 10 })] },
  ]);
  assert.equal(totals.calories, 460); // 130 + 130 + 200
  assert.equal(totals.proteinG, 16); // 3 + 3 + 10
  assert.equal(totals.mealCount, 2);
});

test('refeição sem item não conta como refeição registrada', () => {
  const totals = buildDayTotals(DAY, [
    { id: 'a', items: [] },
    { id: 'b', items: [item()] },
  ]);
  assert.equal(totals.mealCount, 1);
  assert.equal(totals.calories, 130);
});

test('valor inválido não contamina o total com NaN', () => {
  const totals = buildDayTotals(DAY, [
    {
      id: 'a',
      items: [
        item(),
        item({ calories_snapshot: Number.NaN as unknown as number }),
        item({ protein_snapshot: -5 }),
      ],
    },
  ]);
  assert.ok(Number.isFinite(totals.calories));
  assert.ok(totals.proteinG >= 0);
  assert.equal(totals.calories, 260); // a linha inválida entra como zero
});

test('o formato produzido sobrevive ao filtro do dashboard', () => {
  const totals = buildDayTotals(DAY, [{ id: 'a', items: [item()] }]);
  const selected = selectDailySignals({ nutrition: totals, water: null, workout: null }, DAY);
  assert.deepEqual(selected.nutrition, totals);
});

test('total de outro dia é descartado pelo dashboard', () => {
  const totals = buildDayTotals('2026-09-22', [{ id: 'a', items: [item()] }]);
  const selected = selectDailySignals({ nutrition: totals, water: null, workout: null }, DAY);
  assert.equal(selected.nutrition, null);
});

test('total de uma refeição isolada ignora dia e contagem', () => {
  assert.deepEqual(buildMealTotals([item(), item()]), {
    calories: 260,
    proteinG: 6,
    carbsG: 56,
    fatG: 2,
  });
  assert.deepEqual(buildMealTotals([]), { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
});
