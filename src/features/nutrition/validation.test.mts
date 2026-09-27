import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  EMPTY_CUSTOM_FOOD,
  isCustomFoodValid,
  validateCustomFood,
  validateQuantity,
  type CustomFoodDraft,
} from './validation.ts';

const VALIDO: CustomFoodDraft = {
  name: 'Arroz integral cozido',
  servingSize: '100',
  servingUnit: 'g',
  calories: '124',
  proteinG: '2,6',
  carbsG: '25,8',
  fatG: '1',
};

test('quantidade aceita vírgula e recusa zero, negativo e lixo', () => {
  assert.equal(validateQuantity('150'), null);
  assert.equal(validateQuantity('1,5'), null);
  assert.equal(validateQuantity(''), 'nutrition.error.quantityRequired');
  assert.equal(validateQuantity('0'), 'nutrition.error.quantityRequired');
  assert.equal(validateQuantity('-2'), 'nutrition.error.quantityRequired');
  assert.equal(validateQuantity('muito'), 'nutrition.error.quantityRequired');
  assert.equal(validateQuantity('10001'), 'nutrition.error.quantityRange');
});

test('alimento completo é aceito', () => {
  assert.deepEqual(validateCustomFood(VALIDO), {});
  assert.equal(isCustomFoodValid(VALIDO), true);
});

test('rascunho vazio aponta todos os campos obrigatórios', () => {
  const issues = validateCustomFood(EMPTY_CUSTOM_FOOD);
  assert.equal(issues.name, 'nutrition.error.nameRequired');
  assert.equal(issues.servingUnit, 'nutrition.error.unitRequired');
  assert.equal(issues.servingSize, 'nutrition.error.servingRange');
  assert.equal(issues.calories, 'nutrition.error.caloriesRange');
  assert.equal(issues.proteinG, 'nutrition.error.macroRange');
});

test('zero é valor legítimo para caloria e macro, mas não para porção', () => {
  const semGordura = { ...VALIDO, fatG: '0', calories: '0' };
  assert.equal(validateCustomFood(semGordura).fatG, undefined);
  assert.equal(validateCustomFood(semGordura).calories, undefined);
  assert.equal(
    validateCustomFood({ ...VALIDO, servingSize: '0' }).servingSize,
    'nutrition.error.servingRange',
  );
});

test('limites de tamanho e faixa são respeitados', () => {
  assert.equal(validateCustomFood({ ...VALIDO, name: 'x' }).name, 'nutrition.error.nameRequired');
  assert.equal(
    validateCustomFood({ ...VALIDO, name: 'x'.repeat(161) }).name,
    'nutrition.error.nameRequired',
  );
  assert.equal(
    validateCustomFood({ ...VALIDO, servingUnit: 'u'.repeat(21) }).servingUnit,
    'nutrition.error.unitRequired',
  );
  assert.equal(
    validateCustomFood({ ...VALIDO, calories: '9001' }).calories,
    'nutrition.error.caloriesRange',
  );
  assert.equal(
    validateCustomFood({ ...VALIDO, carbsG: '1001' }).carbsG,
    'nutrition.error.macroRange',
  );
});

test('espaço em branco não vale como nome nem como unidade', () => {
  assert.equal(validateCustomFood({ ...VALIDO, name: '   ' }).name, 'nutrition.error.nameRequired');
  assert.equal(
    validateCustomFood({ ...VALIDO, servingUnit: '  ' }).servingUnit,
    'nutrition.error.unitRequired',
  );
});
