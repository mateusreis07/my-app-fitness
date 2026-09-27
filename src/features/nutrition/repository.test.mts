import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { KoraClient } from '../../services/supabase/client';
import type { SelectableFood } from './model.ts';
import { loadDay, logMealItem, removeMealItem, searchFoods } from './repository.ts';

type Call = { table: string; method: string; args: unknown[] };

/**
 * Cliente simulado no mesmo padrão de `src/features/dashboard/repository.test.mts`:
 * cada método registra a chamada e devolve a própria cadeia.
 */
function mock(
  options: { rows?: Record<string, unknown[]>; failOn?: string; throwOn?: string } = {},
) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const query = {
        select(...args: unknown[]) {
          calls.push({ table, method: 'select', args });
          return query;
        },
        insert(...args: unknown[]) {
          calls.push({ table, method: 'insert', args });
          return query;
        },
        upsert(...args: unknown[]) {
          calls.push({ table, method: 'upsert', args });
          return query;
        },
        delete(...args: unknown[]) {
          calls.push({ table, method: 'delete', args });
          return query;
        },
        eq(...args: unknown[]) {
          calls.push({ table, method: 'eq', args });
          return query;
        },
        in(...args: unknown[]) {
          calls.push({ table, method: 'in', args });
          return query;
        },
        ilike(...args: unknown[]) {
          calls.push({ table, method: 'ilike', args });
          return query;
        },
        order(...args: unknown[]) {
          calls.push({ table, method: 'order', args });
          return query;
        },
        limit(...args: unknown[]) {
          calls.push({ table, method: 'limit', args });
          return query;
        },
        abortSignal(...args: unknown[]) {
          calls.push({ table, method: 'abortSignal', args });
          return query;
        },
        maybeSingle() {
          return query;
        },
        then(
          resolve: (value: { data: unknown; error: unknown }) => unknown,
          reject: (error: Error) => unknown,
        ) {
          if (options.throwOn === table) return reject(new Error('offline'));
          return resolve({
            data: options.rows?.[table] ?? null,
            error: options.failOn === table ? { code: 'failure' } : null,
          });
        },
      };
      return query;
    },
  } as unknown as KoraClient;
  return { client, calls };
}

const FOOD: SelectableFood = {
  origin: 'user_food',
  id: 'food-1',
  name: 'Arroz',
  brand: null,
  servingSize: 100,
  servingUnit: 'g',
  calories: 130,
  proteinG: 3,
  carbsG: 28,
  fatG: 1,
};

test('a leitura do dia só toca tabelas da fase, filtra pelo dono e propaga o cancelamento', async () => {
  const { client, calls } = mock({ rows: { meals: [{ id: 'm1', meal_type: 'lunch' }] } });
  const signal = new AbortController().signal;
  const result = await loadDay(client, 'owner', '2026-09-23', signal);

  assert.equal(result.ok, true);
  const tables = [...new Set(calls.map((c) => c.table))];
  assert.deepEqual(tables, ['meals', 'meal_items']);
  assert.ok(
    calls.some(
      (c) =>
        c.table === 'meals' &&
        c.method === 'eq' &&
        c.args[0] === 'user_id' &&
        c.args[1] === 'owner',
    ),
  );
  assert.ok(
    calls.some(
      (c) =>
        c.table === 'meals' &&
        c.method === 'eq' &&
        c.args[0] === 'meal_date' &&
        c.args[1] === '2026-09-23',
    ),
  );
  for (const table of tables) {
    assert.ok(
      calls.some((c) => c.table === table && c.method === 'abortSignal' && c.args[0] === signal),
      `${table} recebeu abortSignal`,
    );
  }
});

test('dia sem refeição não consulta itens e devolve lista vazia, não erro', async () => {
  const { client, calls } = mock({ rows: { meals: [] } });
  const result = await loadDay(client, 'owner', '2026-09-23');
  assert.deepEqual(result, { ok: true, data: [] });
  assert.equal(
    calls.some((c) => c.table === 'meal_items'),
    false,
  );
});

test('falha de leitura e queda de rede viram resultado de erro, não exceção', async () => {
  assert.deepEqual(await loadDay(mock({ failOn: 'meals' }).client, 'owner', '2026-09-23'), {
    ok: false,
  });
  assert.deepEqual(await loadDay(mock({ throwOn: 'meals' }).client, 'owner', '2026-09-23'), {
    ok: false,
  });
});

test('busca consulta a lista do usuário e a base global, ambas limitadas', async () => {
  const { client, calls } = mock();
  await searchFoods(client, 'owner', 'arroz');
  const tables = [...new Set(calls.map((c) => c.table))];
  assert.deepEqual(tables.sort(), ['foods', 'user_foods']);
  assert.ok(
    calls.some(
      (c) =>
        c.table === 'user_foods' &&
        c.method === 'eq' &&
        c.args[0] === 'user_id' &&
        c.args[1] === 'owner',
    ),
  );
  // A base global não filtra por dono: é compartilhada e só de leitura.
  assert.equal(
    calls.some((c) => c.table === 'foods' && c.method === 'eq' && c.args[0] === 'user_id'),
    false,
  );
  for (const table of tables) {
    assert.ok(calls.some((c) => c.table === table && c.method === 'limit'));
  }
});

test('busca vazia não vai ao banco e curingas do usuário são neutralizados', async () => {
  const vazio = mock();
  assert.deepEqual(await searchFoods(vazio.client, 'owner', '   '), { ok: true, data: [] });
  assert.equal(vazio.calls.length, 0);

  const comCuringa = mock();
  await searchFoods(comCuringa.client, 'owner', '100%_arroz');
  const ilike = comCuringa.calls.find((c) => c.method === 'ilike');
  assert.equal(ilike?.args[1], '%100arroz%');
});

test('registrar item cria a refeição do dia e grava o snapshot na ordem certa', async () => {
  const { client, calls } = mock({ rows: { meals: { id: 'm1' } as unknown as unknown[] } });
  const result = await logMealItem(client, 'owner', {
    dayKey: '2026-09-23',
    mealType: 'lunch',
    food: FOOD,
    quantity: 150,
    snapshot: { calories: 195, proteinG: 5, carbsG: 42, fatG: 2 },
  });

  assert.equal(result.ok, true);
  const verbos = calls.filter((c) => ['upsert', 'insert'].includes(c.method));
  assert.deepEqual(
    verbos.map((c) => `${c.table}.${c.method}`),
    ['meals.upsert', 'meal_items.insert'],
  );

  const meal = verbos[0].args[0] as Record<string, unknown>;
  assert.equal(meal.user_id, 'owner');
  assert.equal(meal.meal_date, '2026-09-23');
  assert.equal(meal.meal_type, 'lunch');
  assert.equal(
    (verbos[0].args[1] as Record<string, unknown>).onConflict,
    'user_id,meal_date,meal_type',
  );

  const item = verbos[1].args[0] as Record<string, unknown>;
  assert.equal(item.meal_id, 'm1');
  assert.equal(item.user_food_id, 'food-1');
  assert.equal(item.food_id, null, 'alimento do usuário não preenche a chave da base global');
  assert.equal(item.name_snapshot, 'Arroz');
  assert.equal(item.calories_snapshot, 195);
});

test('alimento da base global grava a chave oposta', async () => {
  const { calls, client } = mock({ rows: { meals: { id: 'm1' } as unknown as unknown[] } });
  await logMealItem(client, 'owner', {
    dayKey: '2026-09-23',
    mealType: 'dinner',
    food: { ...FOOD, origin: 'food', id: 'global-1' },
    quantity: 100,
    snapshot: { calories: 130, proteinG: 3, carbsG: 28, fatG: 1 },
  });
  const item = calls.find((c) => c.table === 'meal_items' && c.method === 'insert')
    ?.args[0] as Record<string, unknown>;
  assert.equal(item.food_id, 'global-1');
  assert.equal(item.user_food_id, null);
});

test('falha ao criar a refeição impede a gravação do item', async () => {
  const { client, calls } = mock({ failOn: 'meals' });
  const result = await logMealItem(client, 'owner', {
    dayKey: '2026-09-23',
    mealType: 'lunch',
    food: FOOD,
    quantity: 100,
    snapshot: { calories: 130, proteinG: 3, carbsG: 28, fatG: 1 },
  });
  assert.deepEqual(result, { ok: false });
  assert.equal(
    calls.some((c) => c.table === 'meal_items'),
    false,
  );
});

test('remover item usa a chave do próprio item; a posse fica com a RLS', async () => {
  const { client, calls } = mock();
  const result = await removeMealItem(client, 'item-1');
  assert.deepEqual(result, { ok: true, data: null });
  assert.ok(calls.some((c) => c.table === 'meal_items' && c.method === 'delete'));
  assert.ok(
    calls.some(
      (c) =>
        c.table === 'meal_items' &&
        c.method === 'eq' &&
        c.args[0] === 'id' &&
        c.args[1] === 'item-1',
    ),
  );
});
