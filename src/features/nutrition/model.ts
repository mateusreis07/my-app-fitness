/**
 * Modelo da nutrição — KORA_MASTER_CONTEXT.md seções 27 a 31 e 66 a 69.
 *
 * Valores internos em inglês, como manda o documento. Os rótulos ficam no
 * catálogo pt-BR (regra 7), referenciados pela chave de tradução.
 */
import type { TranslationKey } from '@/lib/i18n/keys';
import type { Food, MealItem, MealType, UserFood } from '@/services/supabase/database.types';

/** Ordem de exibição: a do dia, não a alfabética (seção 28). */
export const MEAL_TYPES = [
  'breakfast',
  'morning_snack',
  'lunch',
  'afternoon_snack',
  'dinner',
  'supper',
  'other',
] as const;

export type MealTypeOption = { value: MealType; labelKey: TranslationKey };

export const MEAL_TYPE_OPTIONS: MealTypeOption[] = [
  { value: 'breakfast', labelKey: 'nutrition.mealType.breakfast' },
  { value: 'morning_snack', labelKey: 'nutrition.mealType.morning_snack' },
  { value: 'lunch', labelKey: 'nutrition.mealType.lunch' },
  { value: 'afternoon_snack', labelKey: 'nutrition.mealType.afternoon_snack' },
  { value: 'dinner', labelKey: 'nutrition.mealType.dinner' },
  { value: 'supper', labelKey: 'nutrition.mealType.supper' },
  { value: 'other', labelKey: 'nutrition.mealType.other' },
];

export function mealTypeLabelKey(value: MealType): TranslationKey {
  return (
    MEAL_TYPE_OPTIONS.find((option) => option.value === value)?.labelKey ??
    'nutrition.mealType.other'
  );
}

/**
 * Alimento escolhido, venha da base global ou da lista do usuário.
 *
 * A tela não precisa saber de qual tabela veio; só o registro precisa, para
 * gravar a chave certa.
 */
export type SelectableFood = {
  origin: 'food' | 'user_food';
  id: string;
  name: string;
  brand: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export function fromFood(row: Food): SelectableFood {
  return {
    origin: 'food',
    id: row.id,
    name: row.name,
    brand: row.brand,
    servingSize: Number(row.serving_size),
    servingUnit: row.serving_unit,
    calories: Number(row.calories),
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
  };
}

export function fromUserFood(row: UserFood): SelectableFood {
  return {
    origin: 'user_food',
    id: row.id,
    name: row.name,
    brand: null,
    servingSize: Number(row.serving_size),
    servingUnit: row.serving_unit,
    calories: Number(row.calories),
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
  };
}

/** Uma refeição do dia com os itens já registrados. */
export type MealWithItems = {
  id: string;
  mealType: MealType;
  items: MealItem[];
};
