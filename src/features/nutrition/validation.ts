/**
 * Validação do registro alimentar. Funções puras, sem React e sem rede.
 *
 * Os limites espelham os CHECKs da migration 0005: o banco é a última defesa,
 * mas o usuário precisa ver a mensagem antes de tentar gravar.
 */
import type { TranslationKey } from '@/lib/i18n/keys';
import { parseDecimal } from '../../lib/number.ts';
import { MAX_QUANTITY } from './quantity.ts';

export const NAME_MAX_LENGTH = 160;
export const UNIT_MAX_LENGTH = 20;
export const MAX_SERVING = 10_000;
export const MAX_CALORIES = 9000;
export const MAX_MACRO_G = 1000;

export type CustomFoodDraft = {
  name: string;
  servingSize: string;
  servingUnit: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
};

export const EMPTY_CUSTOM_FOOD: CustomFoodDraft = {
  name: '',
  servingSize: '',
  servingUnit: '',
  calories: '',
  proteinG: '',
  carbsG: '',
  fatG: '',
};

export type CustomFoodIssues = Partial<Record<keyof CustomFoodDraft, TranslationKey>>;

export function validateQuantity(value: string): TranslationKey | null {
  const parsed = parseDecimal(value);
  if (parsed === null || parsed <= 0) return 'nutrition.error.quantityRequired';
  if (parsed > MAX_QUANTITY) return 'nutrition.error.quantityRange';
  return null;
}

export function validateCustomFood(draft: CustomFoodDraft): CustomFoodIssues {
  const issues: CustomFoodIssues = {};

  const name = draft.name.trim();
  if (name.length < 2 || name.length > NAME_MAX_LENGTH) {
    issues.name = 'nutrition.error.nameRequired';
  }

  const unit = draft.servingUnit.trim();
  if (unit.length < 1 || unit.length > UNIT_MAX_LENGTH) {
    issues.servingUnit = 'nutrition.error.unitRequired';
  }

  const serving = parseDecimal(draft.servingSize);
  if (serving === null || serving <= 0 || serving > MAX_SERVING) {
    issues.servingSize = 'nutrition.error.servingRange';
  }

  const calories = parseDecimal(draft.calories);
  if (calories === null || calories > MAX_CALORIES) {
    issues.calories = 'nutrition.error.caloriesRange';
  }

  const macros = [
    ['proteinG', draft.proteinG],
    ['carbsG', draft.carbsG],
    ['fatG', draft.fatG],
  ] as const;
  for (const [field, raw] of macros) {
    const parsed = parseDecimal(raw);
    if (parsed === null || parsed > MAX_MACRO_G) {
      issues[field] = 'nutrition.error.macroRange';
    }
  }

  return issues;
}

export function isCustomFoodValid(draft: CustomFoodDraft): boolean {
  return Object.keys(validateCustomFood(draft)).length === 0;
}
