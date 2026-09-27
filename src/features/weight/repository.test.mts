import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { KoraClient } from '../../services/supabase/client';
import type { WeightLog } from '../../services/supabase/database.types';
import { createWeightEntry } from './model.ts';
import {
  WEIGHT_PAGE_SIZE,
  loadActiveGoal,
  loadWeightHistory,
  removeWeightEntry,
  saveWeightEntry,
} from './repository.ts';

const ID = '11111111-1111-4111-8111-111111111111';
const entry = createWeightEntry({
  userId: 'owner',
  weightKg: 72.5,
  timeZone: 'America/Sao_Paulo',
  now: new Date('2026-09-23T15:00:00Z'),
  id: ID,
})!;
const row: WeightLog = { ...entry, created_at: entry.recorded_at };

type Response = { data: unknown; error: unknown };

/** Mesmo cliente simulado de `src/features/hydration/hydration.test.mts`. */
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
        gte(...args: unknown[]) {
          calls.push({ method: 'gte', args });
          return chain;
        },
        gt(...args: unknown[]) {
          calls.push({ method: 'gt', args });
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
        delete() {
          calls.push({ method: 'delete', args: [] });
          return chain;
        },
        maybeSingle() {
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

test('weight history read filters owner and the start day, and propagates cancellation', async () => {
  const { client, calls } = mock([{ data: [], error: null }]);
  const signal = new AbortController().signal;
  assert.deepEqual(await loadWeightHistory(client, 'owner', '2026-06-26', signal), {
    ok: true,
    data: [],
  });
  for (const [method, args] of [
    ['eq', ['user_id', 'owner']],
    ['gte', ['recorded_date', '2026-06-26']],
    ['abortSignal', [signal]],
  ] as const)
    assert.ok(
      calls.some((c) => c.method === method && JSON.stringify(c.args) === JSON.stringify(args)),
    );
  assert.deepEqual(
    calls.filter((c) => c.method === 'from').map((c) => c.args[0]),
    ['weight_logs'],
  );
});

test('weight history paginates instead of silently truncating the series', async () => {
  const page = Array.from({ length: WEIGHT_PAGE_SIZE }, (_, i) => ({
    ...row,
    id: String(i).padStart(4, '0'),
  }));
  const { client, calls } = mock([
    { data: page, error: null },
    { data: [{ ...row, id: 'last' }], error: null },
  ]);
  const result = await loadWeightHistory(client, 'owner', '2026-06-26');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.length, WEIGHT_PAGE_SIZE + 1);
  assert.ok(calls.some((c) => c.method === 'gt' && c.args[1] === page.at(-1)!.id));
});

test('network and database read failure are not an empty history', async () => {
  for (const response of [new Error('offline'), { data: null, error: { message: 'failed' } }])
    assert.deepEqual(await loadWeightHistory(mock([response]).client, 'owner', '2026-06-26'), {
      ok: false,
    });
});

test('active goal read is owner-scoped and absence is not an error', async () => {
  const { client, calls } = mock([{ data: null, error: null }]);
  assert.deepEqual(await loadActiveGoal(client, 'owner'), { ok: true, data: null });
  assert.ok(
    calls.some((c) => c.method === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'owner'),
  );
  assert.ok(
    calls.some((c) => c.method === 'eq' && c.args[0] === 'status' && c.args[1] === 'active'),
  );
  assert.deepEqual(await loadActiveGoal(mock([new Error('offline')]).client, 'owner'), {
    ok: false,
  });
});

test('saving and retrying preserve the UUID and use ignoreDuplicates, never update', async () => {
  const { client, calls } = mock([
    { data: null, error: null },
    { data: row, error: null },
    { data: null, error: null },
    { data: row, error: null },
  ]);
  assert.deepEqual(await saveWeightEntry(client, entry), { ok: true, data: row });
  assert.deepEqual(await saveWeightEntry(client, entry), { ok: true, data: row });
  const writes = calls.filter((c) => c.method === 'upsert');
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[0].args, writes[1].args);
  assert.deepEqual(writes[0].args[1], { onConflict: 'id', ignoreDuplicates: true });
  assert.ok(
    calls.some((c) => c.method === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'owner'),
  );
});

test('save never reports success for a hidden, missing or mismatched replay', async () => {
  for (const data of [null, { ...row, weight_kg: 80 }, { ...row, recorded_date: '2026-06-27' }])
    assert.deepEqual(
      await saveWeightEntry(
        mock([
          { data: null, error: null },
          { data, error: null },
        ]).client,
        entry,
      ),
      { ok: false },
    );
});

test('save failure stops the follow-up read; invalid weight never reaches the server', async () => {
  const { client, calls } = mock([{ data: null, error: { message: 'failed' } }]);
  assert.deepEqual(await saveWeightEntry(client, entry), { ok: false });
  assert.equal(calls.filter((c) => c.method === 'from').length, 1);
  const invalid = mock([]);
  assert.deepEqual(await saveWeightEntry(invalid.client, { ...entry, weight_kg: 0 }), {
    ok: false,
  });
  assert.equal(invalid.calls.length, 0);
});

test('remove is owner-scoped and surfaces failure', async () => {
  const { client, calls } = mock([{ data: null, error: null }]);
  assert.deepEqual(await removeWeightEntry(client, 'owner', ID), { ok: true, data: null });
  assert.ok(
    calls.some((c) => c.method === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'owner'),
  );
  assert.ok(calls.some((c) => c.method === 'eq' && c.args[0] === 'id' && c.args[1] === ID));
  assert.deepEqual(await removeWeightEntry(mock([new Error('offline')]).client, 'owner', ID), {
    ok: false,
  });
});
