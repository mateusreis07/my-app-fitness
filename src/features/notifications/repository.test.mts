import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { KoraClient } from '../../services/supabase/client';
import { loadPreferences, savePreferences } from './repository.ts';

type Response = { data: unknown; error: unknown };

/** Mesmo cliente simulado das fases anteriores. */
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

test('loadPreferences filters by owner and absence is not an error', async () => {
  const { client, calls } = mock([{ data: null, error: null }]);
  assert.deepEqual(await loadPreferences(client, 'owner'), { ok: true, data: null });
  assert.ok(
    calls.some((c) => c.method === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'owner'),
  );
  assert.deepEqual(
    calls.filter((c) => c.method === 'from').map((c) => c.args[0]),
    ['notification_preferences'],
  );
});

test('loadPreferences read failure is a result, not an exception', async () => {
  assert.deepEqual(await loadPreferences(mock([new Error('offline')]).client, 'owner'), {
    ok: false,
  });
});

test('savePreferences upserts by user_id, merging the patch onto current values', async () => {
  const row = {
    id: 'np1',
    user_id: 'owner',
    water_enabled: true,
    workout_enabled: false,
    weight_enabled: false,
    summary_enabled: false,
    reminder_time: '15:00',
    summary_time: '21:00',
    created_at: 'x',
    updated_at: 'x',
  };
  const { client, calls } = mock([{ data: row, error: null }]);
  const current = { ...row, water_enabled: false };
  const result = await savePreferences(client, 'owner', { water_enabled: true }, current);
  assert.deepEqual(result, { ok: true, data: row });
  const write = calls.find((c) => c.method === 'upsert');
  assert.ok(write);
  assert.deepEqual(write!.args[1], { onConflict: 'user_id' });
  const payload = write!.args[0] as {
    user_id: string;
    water_enabled: boolean;
    reminder_time: string;
  };
  assert.equal(payload.user_id, 'owner');
  assert.equal(payload.water_enabled, true);
  assert.equal(payload.reminder_time, '15:00');
});

test('savePreferences without a current row falls back to defaults for untouched fields', async () => {
  const { client, calls } = mock([
    {
      data: {
        id: 'np1',
        user_id: 'owner',
        water_enabled: true,
        workout_enabled: false,
        weight_enabled: false,
        summary_enabled: false,
        reminder_time: '15:00',
        summary_time: '21:00',
        created_at: 'x',
        updated_at: 'x',
      },
      error: null,
    },
  ]);
  await savePreferences(client, 'owner', { water_enabled: true }, null);
  const write = calls.find((c) => c.method === 'upsert');
  const payload = write!.args[0] as { reminder_time: string; summary_time: string };
  assert.equal(payload.reminder_time, '15:00');
  assert.equal(payload.summary_time, '21:00');
});

test('savePreferences write failure is a result, not an exception', async () => {
  assert.deepEqual(
    await savePreferences(
      mock([new Error('offline')]).client,
      'owner',
      { water_enabled: true },
      null,
    ),
    { ok: false },
  );
});
