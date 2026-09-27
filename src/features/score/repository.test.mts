import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDaysIso } from '../../lib/date.ts';
import type { KoraClient } from '../../services/supabase/client';
import { HISTORY_LOOKBACK_DAYS } from './model.ts';
import {
  closeDayScore,
  ensureRecentScoresClosed,
  loadScoreHistory,
  loadTargetsForDay,
} from './repository.ts';

type Response = { data: unknown; error: unknown };

/** Cliente simulado no padrão de `src/features/weight/repository.test.mts`. */
function mock(responses: (Response | Error)[]) {
  const calls: { method: string; args: unknown[] }[] = [];
  const client = {
    from(table: string) {
      calls.push({ method: 'from', args: [table] });
      const chain = {
        select(...args: unknown[]) {
          calls.push({ method: 'select', args });
          return chain;
        },
        eq(...args: unknown[]) {
          calls.push({ method: 'eq', args });
          return chain;
        },
        lte(...args: unknown[]) {
          calls.push({ method: 'lte', args });
          return chain;
        },
        gte(...args: unknown[]) {
          calls.push({ method: 'gte', args });
          return chain;
        },
        lt(...args: unknown[]) {
          calls.push({ method: 'lt', args });
          return chain;
        },
        gt(...args: unknown[]) {
          calls.push({ method: 'gt', args });
          return chain;
        },
        or(...args: unknown[]) {
          calls.push({ method: 'or', args });
          return chain;
        },
        order(...args: unknown[]) {
          calls.push({ method: 'order', args });
          return chain;
        },
        limit(...args: unknown[]) {
          calls.push({ method: 'limit', args });
          return chain;
        },
        abortSignal(...args: unknown[]) {
          calls.push({ method: 'abortSignal', args });
          return chain;
        },
        upsert(...args: unknown[]) {
          calls.push({ method: 'upsert', args });
          return chain;
        },
        maybeSingle() {
          calls.push({ method: 'maybeSingle', args: [] });
          return chain;
        },
        then(resolve: (r: Response) => unknown, reject: (e: Error) => unknown) {
          const result = responses.shift();
          if (result instanceof Error) return reject(result);
          if (!result) return reject(new Error('unexpected query'));
          return resolve(result);
        },
      };
      return chain;
    },
  } as unknown as KoraClient;
  return { client, calls };
}

test('loadTargetsForDay filters by owner and the validity window of that day', async () => {
  const { client, calls } = mock([{ data: null, error: null }]);
  const result = await loadTargetsForDay(client, 'owner', '2026-06-15');
  assert.deepEqual(result, { ok: true, data: null });
  assert.ok(
    calls.some((c) => c.method === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'owner'),
  );
  assert.ok(
    calls.some(
      (c) => c.method === 'lte' && c.args[0] === 'effective_from' && c.args[1] === '2026-06-15',
    ),
  );
  assert.ok(
    calls.some(
      (c) =>
        c.method === 'or' && c.args[0] === 'effective_until.is.null,effective_until.gt.2026-06-15',
    ),
  );
});

test('loadTargetsForDay read failure is a result, not an exception', async () => {
  assert.deepEqual(
    await loadTargetsForDay(mock([new Error('offline')]).client, 'owner', '2026-06-15'),
    {
      ok: false,
    },
  );
});

test('closeDayScore reads targets/nutrition/water/workout before writing, and upserts by natural key', async () => {
  const targets = {
    id: 't1',
    user_id: 'owner',
    calories: 2000,
    protein_g: 150,
    carbs_g: 200,
    fat_g: 60,
    water_ml: 2000,
    effective_from: '2026-06-01',
    effective_until: null,
    calculation_source: 'fitness_engine@1.2',
    created_at: 'x',
  };
  const row = {
    id: 'ds1',
    user_id: 'owner',
    score_date: '2026-06-15',
    nutrition_score: 100,
    protein_score: 100,
    hydration_score: 100,
    workout_score: 100,
    consistency_score: 67,
    total_score: 95,
    algorithm_version: 'kora_score@1.0',
    created_at: 'x',
  };
  const { client, calls } = mock([
    { data: targets, error: null }, // loadTargetsForDay
    { data: [], error: null }, // loadDay (meals)
    { data: [], error: null }, // loadWaterDay
    { data: null, error: null }, // loadTodaySignal -> plan (maybeSingle: null = no active plan)
    { data: [], error: null }, // loadTodaySignal -> sessions
    { data: row, error: null }, // upsert + select
  ]);
  const result = await closeDayScore(client, 'owner', '2026-06-15');
  assert.equal(result.ok, true);
  const write = calls.find((c) => c.method === 'upsert');
  assert.ok(write);
  assert.deepEqual(write!.args[1], { onConflict: 'user_id,score_date' });
  const payload = write!.args[0] as { user_id: string; score_date: string };
  assert.equal(payload.user_id, 'owner');
  assert.equal(payload.score_date, '2026-06-15');
  // As leituras (from) vêm antes do upsert na sequência de chamadas.
  const fromTables = calls.filter((c) => c.method === 'from').map((c) => c.args[0]);
  assert.equal(fromTables.at(-1), 'daily_scores');
});

test('closeDayScore without a nutrition target still closes the day, with a null total', async () => {
  const { client } = mock([
    { data: null, error: null }, // sem meta vigente
    { data: [], error: null }, // loadDay (meals)
    { data: [], error: null }, // loadWaterDay
    { data: null, error: null }, // loadTodaySignal -> plan
    { data: [], error: null }, // loadTodaySignal -> sessions
    {
      data: {
        id: 'ds1',
        user_id: 'owner',
        score_date: '2026-06-15',
        nutrition_score: null,
        protein_score: null,
        hydration_score: null,
        workout_score: 100,
        consistency_score: 0,
        total_score: null,
        algorithm_version: 'kora_score@1.0',
        created_at: 'x',
      },
      error: null,
    },
  ]);
  const result = await closeDayScore(client, 'owner', '2026-06-15');
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.total_score, null);
});

test('ensureRecentScoresClosed skips days that already have a row', async () => {
  const today = '2026-06-15';
  const fromDay = addDaysIso(today, -HISTORY_LOOKBACK_DAYS);
  const alreadyClosed = [];
  for (let day = fromDay; day < today; day = addDaysIso(day, 1))
    alreadyClosed.push({ score_date: day });

  const { client, calls } = mock([{ data: alreadyClosed, error: null }]);
  // Toda a janela já está fechada: nenhuma chamada a closeDayScore deveria
  // ocorrer, então nenhuma outra tabela é tocada além de `daily_scores`.
  const result = await ensureRecentScoresClosed(client, 'owner', today);
  assert.deepEqual(result, { ok: true, data: null });
  const fromTables = calls.filter((c) => c.method === 'from').map((c) => c.args[0]);
  assert.deepEqual(fromTables, ['daily_scores']);
});

test('loadScoreHistory filters by owner and window, most recent first', async () => {
  const { client, calls } = mock([{ data: [], error: null }]);
  const result = await loadScoreHistory(client, 'owner', '2026-06-01');
  assert.deepEqual(result, { ok: true, data: [] });
  assert.ok(
    calls.some((c) => c.method === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'owner'),
  );
  assert.ok(
    calls.some(
      (c) => c.method === 'gte' && c.args[0] === 'score_date' && c.args[1] === '2026-06-01',
    ),
  );
});

test('loadScoreHistory read failure is a result, not an exception', async () => {
  assert.deepEqual(
    await loadScoreHistory(mock([new Error('offline')]).client, 'owner', '2026-06-01'),
    {
      ok: false,
    },
  );
});
