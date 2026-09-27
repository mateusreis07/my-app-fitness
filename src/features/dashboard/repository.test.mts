import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { KoraClient } from '../../services/supabase/client';
import { loadDashboard } from './repository.ts';

test('dashboard is read-only, owner-scoped and only queries existing phase 1–3 tables', async () => {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const client = {
    from(table: string) {
      const query = {
        select(...args: unknown[]) {
          calls.push({ table, method: 'select', args });
          return query;
        },
        eq(...args: unknown[]) {
          calls.push({ table, method: 'eq', args });
          return query;
        },
        is(...args: unknown[]) {
          calls.push({ table, method: 'is', args });
          return query;
        },
        lte(...args: unknown[]) {
          calls.push({ table, method: 'lte', args });
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
        maybeSingle() {
          return query;
        },
        abortSignal(...args: unknown[]) {
          calls.push({ table, method: 'abortSignal', args });
          return query;
        },
        then(
          resolve: (value: { data: null; error: null | { code: string } }) => unknown,
          reject: (error: Error) => unknown,
        ) {
          if (table === 'goals') return reject(new Error('offline'));
          return resolve({
            data: null,
            error: table === 'weight_logs' ? { code: 'failure' } : null,
          });
        },
      };
      return query;
    },
  } as unknown as KoraClient;
  const signal = new AbortController().signal;
  const snapshot = await loadDashboard(
    client,
    'owner',
    '2026-09-22',
    '2026-09-22T19:00:00Z',
    signal,
  );
  assert.equal(snapshot.userId, 'owner');
  assert.equal(snapshot.dayKey, '2026-09-22');
  assert.deepEqual(snapshot.targets, { status: 'ready', data: null });
  assert.deepEqual(snapshot.training, { status: 'ready', data: null });
  assert.deepEqual(snapshot.weight, { status: 'error' });
  assert.deepEqual(snapshot.goal, { status: 'error' });
  const tables = [...new Set(calls.map((c) => c.table))];
  assert.deepEqual(tables, ['nutrition_targets', 'weight_logs', 'training_preferences', 'goals']);
  for (const table of tables) {
    assert.ok(
      calls.some(
        (c) =>
          c.table === table &&
          c.method === 'eq' &&
          c.args[0] === 'user_id' &&
          c.args[1] === 'owner',
      ),
    );
    assert.ok(
      calls.some((c) => c.table === table && c.method === 'abortSignal' && c.args[0] === signal),
    );
  }
  assert.ok(
    calls.some(
      (c) =>
        c.table === 'nutrition_targets' && c.method === 'lte' && c.args[0] === 'effective_from',
    ),
  );
  assert.ok(
    calls.some(
      (c) =>
        c.table === 'nutrition_targets' && c.method === 'is' && c.args[0] === 'effective_until',
    ),
  );
  assert.ok(
    calls.some(
      (c) => c.table === 'weight_logs' && c.method === 'lte' && c.args[0] === 'recorded_at',
    ),
  );
  assert.ok(
    calls.some((c) => c.table === 'weight_logs' && c.method === 'limit' && c.args[0] === 1),
  );
});
