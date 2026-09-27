import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { SelectableFood } from './model.ts';
import { buildSnapshot, MAX_QUANTITY } from './quantity.ts';

// Porção de referência: 100 g com 130 kcal.
const ARROZ: SelectableFood = {
  origin: 'user_food',
  id: 'arroz',
  name: 'Arroz cozido',
  brand: null,
  servingSize: 100,
  servingUnit: 'g',
  calories: 130,
  proteinG: 2.7,
  carbsG: 28,
  fatG: 0.3,
};

test('quantidade igual à porção devolve os valores da própria porção', () => {
  assert.deepEqual(buildSnapshot(ARROZ, 100), {
    calories: 130,
    proteinG: 3,
    carbsG: 28,
    fatG: 0,
  });
});

test('quantidade proporcional multiplica todos os macros', () => {
  const snapshot = buildSnapshot(ARROZ, 150);
  assert.ok(snapshot);
  assert.equal(snapshot.calories, 195); // 130 × 1,5
  assert.equal(snapshot.carbsG, 42); // 28 × 1,5
});

test('porção diferente de 100 também funciona', () => {
  // Uma unidade de 50 g com 80 kcal: duas unidades dão 160 kcal.
  const ovo: SelectableFood = { ...ARROZ, servingSize: 1, servingUnit: 'unidade', calories: 80 };
  assert.equal(buildSnapshot(ovo, 2)?.calories, 160);
});

test('arredondamento passa pelas funções centrais, sem casas decimais em macros', () => {
  const snapshot = buildSnapshot(ARROZ, 33);
  assert.ok(snapshot);
  for (const value of [snapshot.calories, snapshot.proteinG, snapshot.carbsG, snapshot.fatG]) {
    assert.equal(value, Math.round(value), 'macros e calorias são inteiros');
  }
});

test('entrada inválida devolve null em vez de zero disfarçado', () => {
  for (const quantity of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, MAX_QUANTITY + 1]) {
    assert.equal(buildSnapshot(ARROZ, quantity), null, `quantidade ${quantity}`);
  }
});

test('porção inválida no alimento impede a conta', () => {
  assert.equal(buildSnapshot({ ...ARROZ, servingSize: 0 }, 100), null);
  assert.equal(buildSnapshot({ ...ARROZ, servingSize: -5 }, 100), null);
  assert.equal(buildSnapshot({ ...ARROZ, calories: Number.NaN }, 100), null);
  assert.equal(buildSnapshot({ ...ARROZ, proteinG: -1 }, 100), null);
});

test('o limite de quantidade é aceito, o valor seguinte não', () => {
  const pequeno: SelectableFood = { ...ARROZ, servingSize: 10000, calories: 1 };
  assert.ok(buildSnapshot(pequeno, MAX_QUANTITY));
  assert.equal(buildSnapshot(pequeno, MAX_QUANTITY + 0.01), null);
});
