/**
 * Leituras e escritas da nutrição.
 *
 * Mesmo contrato do dashboard: toda consulta é limitada ao dono, recebe o
 * `AbortSignal` e falha isolada vira um resultado explícito. Ausência de
 * registro é lista vazia, nunca um erro — e nunca um zero.
 *
 * Não existe transação entre chamadas REST. A refeição é criada antes do item;
 * se o item falhar, sobra uma refeição vazia, que a tela trata como "nada
 * registrado" e que `buildDayTotals` não conta.
 */
import type { KoraClient } from '@/services/supabase/client';
import type { Food, MealItem, MealType, UserFood } from '@/services/supabase/database.types';
import { fromFood, fromUserFood, type MealWithItems, type SelectableFood } from './model.ts';
import type { Snapshot } from './quantity.ts';

export type Result<T> = { ok: true; data: T } | { ok: false };

const FAILED = { ok: false } as const;

/** Quantos alimentos a busca devolve por origem. */
const SEARCH_LIMIT = 25;
/** Quantas refeições recentes alimentam o atalho de "usados recentemente". */
const RECENT_MEALS = 20;
const RECENT_FOODS = 8;

export type RecentFood = { name: string; foodId: string | null; userFoodId: string | null };

export async function loadDay(
  client: KoraClient,
  userId: string,
  dayKey: string,
  signal?: AbortSignal,
): Promise<Result<MealWithItems[]>> {
  try {
    const mealsQuery = client
      .from('meals')
      .select('*')
      .eq('user_id', userId)
      .eq('meal_date', dayKey);
    if (signal) mealsQuery.abortSignal(signal);
    const meals = await mealsQuery;
    if (meals.error) return FAILED;
    const rows = meals.data ?? [];
    if (rows.length === 0) return { ok: true, data: [] };

    const itemsQuery = client
      .from('meal_items')
      .select('*')
      .in(
        'meal_id',
        rows.map((meal) => meal.id),
      )
      .order('created_at', { ascending: true });
    if (signal) itemsQuery.abortSignal(signal);
    const items = await itemsQuery;
    if (items.error) return FAILED;

    const all = (items.data ?? []) as MealItem[];
    return {
      ok: true,
      data: rows.map((meal) => ({
        id: meal.id,
        mealType: meal.meal_type,
        items: all.filter((item) => item.meal_id === meal.id),
      })),
    };
  } catch {
    return FAILED;
  }
}

/**
 * Busca na lista do usuário e na base global.
 *
 * A base global está vazia até a fonte importada ser decidida; a consulta já
 * existe para que nada mude na tela quando ela for preenchida.
 */
export async function searchFoods(
  client: KoraClient,
  userId: string,
  term: string,
  signal?: AbortSignal,
): Promise<Result<SelectableFood[]>> {
  const clean = term.trim();
  if (clean.length === 0) return { ok: true, data: [] };
  // Curingas do usuário não viram curingas do LIKE.
  const pattern = '%' + clean.replace(/[%_\\]/g, '') + '%';

  try {
    const ownQuery = client
      .from('user_foods')
      .select('*')
      .eq('user_id', userId)
      .ilike('name', pattern)
      .order('name', { ascending: true })
      .limit(SEARCH_LIMIT);
    const globalQuery = client
      .from('foods')
      .select('*')
      .ilike('name', pattern)
      .order('name', { ascending: true })
      .limit(SEARCH_LIMIT);
    if (signal) {
      ownQuery.abortSignal(signal);
      globalQuery.abortSignal(signal);
    }

    const [own, global] = await Promise.all([ownQuery, globalQuery]);
    if (own.error || global.error) return FAILED;

    return {
      ok: true,
      data: [
        ...((own.data ?? []) as UserFood[]).map(fromUserFood),
        ...((global.data ?? []) as Food[]).map(fromFood),
      ],
    };
  } catch {
    return FAILED;
  }
}

/** Atalho de recentes (seção 31). Sem tabela extra: sai do próprio histórico. */
export async function listRecentFoods(
  client: KoraClient,
  userId: string,
  signal?: AbortSignal,
): Promise<Result<RecentFood[]>> {
  try {
    const mealsQuery = client
      .from('meals')
      .select('*')
      .eq('user_id', userId)
      .order('meal_date', { ascending: false })
      .limit(RECENT_MEALS);
    if (signal) mealsQuery.abortSignal(signal);
    const meals = await mealsQuery;
    if (meals.error) return FAILED;
    const ids = (meals.data ?? []).map((meal) => meal.id);
    if (ids.length === 0) return { ok: true, data: [] };

    const itemsQuery = client
      .from('meal_items')
      .select('*')
      .in('meal_id', ids)
      .order('created_at', { ascending: false });
    if (signal) itemsQuery.abortSignal(signal);
    const items = await itemsQuery;
    if (items.error) return FAILED;

    const seen = new Set<string>();
    const recent: RecentFood[] = [];
    for (const item of (items.data ?? []) as MealItem[]) {
      // Item cujo alimento foi apagado não volta como atalho: não há de onde
      // reconstruir a porção para um novo registro.
      const key = item.user_food_id ?? item.food_id;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      recent.push({
        name: item.name_snapshot,
        foodId: item.food_id,
        userFoodId: item.user_food_id,
      });
      if (recent.length >= RECENT_FOODS) break;
    }
    return { ok: true, data: recent };
  } catch {
    return FAILED;
  }
}

export async function createUserFood(
  client: KoraClient,
  userId: string,
  food: Omit<UserFood, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
): Promise<Result<UserFood>> {
  try {
    const { data, error } = await client
      .from('user_foods')
      .insert({ ...food, user_id: userId })
      .select('*')
      .maybeSingle();
    if (error || !data) return FAILED;
    return { ok: true, data };
  } catch {
    return FAILED;
  }
}

/**
 * Registra um item. A refeição do dia é criada sob demanda.
 *
 * O índice único `(user_id, meal_date, meal_type)` garante uma refeição por
 * tipo por dia, então o upsert é seguro contra dois toques seguidos.
 */
export async function logMealItem(
  client: KoraClient,
  userId: string,
  input: {
    dayKey: string;
    mealType: MealType;
    food: SelectableFood;
    quantity: number;
    snapshot: Snapshot;
  },
): Promise<Result<{ mealId: string }>> {
  try {
    const meal = await client
      .from('meals')
      .upsert(
        { user_id: userId, meal_type: input.mealType, meal_date: input.dayKey },
        { onConflict: 'user_id,meal_date,meal_type' },
      )
      .select('*')
      .maybeSingle();
    if (meal.error || !meal.data) return FAILED;

    const item = await client.from('meal_items').insert({
      meal_id: meal.data.id,
      food_id: input.food.origin === 'food' ? input.food.id : null,
      user_food_id: input.food.origin === 'user_food' ? input.food.id : null,
      name_snapshot: input.food.name,
      quantity: input.quantity,
      serving_unit: input.food.servingUnit,
      calories_snapshot: input.snapshot.calories,
      protein_snapshot: input.snapshot.proteinG,
      carbs_snapshot: input.snapshot.carbsG,
      fat_snapshot: input.snapshot.fatG,
    });
    if (item.error) return FAILED;

    return { ok: true, data: { mealId: meal.data.id } };
  } catch {
    return FAILED;
  }
}

export async function removeMealItem(client: KoraClient, itemId: string): Promise<Result<null>> {
  try {
    // A RLS já impede apagar item de refeição alheia.
    const { error } = await client.from('meal_items').delete().eq('id', itemId);
    return error ? FAILED : { ok: true, data: null };
  } catch {
    return FAILED;
  }
}
