import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWaterEntry, parseWaterAmount, waterTotals } from './model.ts';
import { saveWaterEntry, removeWaterEntry, loadWaterDay, WATER_PAGE_SIZE } from './repository.ts';
import type { WaterLog } from '../../services/supabase/database.types';
import type { KoraClient } from '../../services/supabase/client';
import { selectDailySignals, EMPTY_DAILY_SIGNALS, metricProgress } from '../dashboard/model.ts';
import { buildPriorities } from '../dashboard/priorities.ts';
const ID = '11111111-1111-4111-8111-111111111111';
const entry = createWaterEntry(
  'owner',
  250,
  'America/Sao_Paulo',
  new Date('2026-09-24T01:00:00Z'),
  ID,
)!;
const row: WaterLog = { ...entry, created_at: entry.recorded_at };
test('water shortcuts and custom integer amount accept positive milliliters', () => {
  for (const [text, value] of [
    ['250', 250],
    ['500', 500],
    [' 350 ', 350],
    ['1', 1],
    ['5000', 5000],
    ['250,0', 250],
  ] as const)
    assert.equal(parseWaterAmount(text), value);
});
test('rejects zero, negatives, fractions, nonfinite and malformed amounts', () => {
  for (const text of ['', '0', '-1', '250,5', 'NaN', 'Infinity', '1e3', '5001', '250 ml'])
    assert.equal(parseWaterAmount(text), null);
  for (const value of [NaN, Infinity, -1, 0, 1.5, 5001])
    assert.equal(createWaterEntry('owner', value, 'UTC', new Date(), ID), null);
});
test('entry captures local day and original instant for retry after midnight', () => {
  assert.equal(entry.recorded_date, '2026-09-23');
  assert.equal(entry.recorded_at, '2026-09-24T01:00:00.000Z');
  assert.equal(entry.recorded_timezone, 'America/Sao_Paulo');
  assert.equal(
    createWaterEntry('owner', 250, 'America/Sao_Paulo', new Date('2026-09-24T03:00:00Z'), ID)
      ?.recorded_date,
    '2026-09-24',
  );
  assert.equal(createWaterEntry('owner', 250, 'UTC', new Date('invalid'), ID), null);
  assert.equal(createWaterEntry('owner', 250, 'UTC', new Date(), 'not-uuid'), null);
});
test('known empty day is zero and invalid data is not zero', () => {
  assert.deepEqual(waterTotals('2026-09-23', []), { dayKey: '2026-09-23', consumedMl: 0 });
  assert.equal(waterTotals('2026-09-23', [{ ...row, amount_ml: NaN }]), null);
});
test('totals deduplicate IDs, ignore other days, and sum custom quantities', () => {
  const total = waterTotals('2026-09-23', [
    row,
    row,
    { ...row, id: '2', amount_ml: 500 },
    { ...row, id: '3', amount_ml: 350 },
    { ...row, id: '4', recorded_date: '2026-09-22' },
  ]);
  assert.deepEqual(total, { dayKey: '2026-09-23', consumedMl: 1100 });
  assert.deepEqual(
    selectDailySignals({ ...EMPTY_DAILY_SIGNALS, water: total }, '2026-09-23').water,
    total,
  );
  assert.equal(
    selectDailySignals({ ...EMPTY_DAILY_SIGNALS, water: total }, '2026-09-24').water,
    null,
  );
});
test('no target still permits records and no progress is invented; excess stays capped', () => {
  assert.equal(metricProgress(1100, null), null);
  assert.equal(metricProgress(2500, 2000)?.fraction, 1);
  assert.equal(metricProgress(2500, 2000)?.remaining, 0);
  assert.deepEqual(
    buildPriorities({
      dayKey: '2026-09-23',
      minuteOfDay: 1000,
      targets: null,
      signals: { ...EMPTY_DAILY_SIGNALS, water: waterTotals('2026-09-23', [row]) },
      capabilities: { water: true, nutrition: false, weight: false, workout: false },
      weight: { known: false, lastDay: null },
    }),
    [],
  );
});

type Response = { data: unknown; error: unknown };
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
test('water read filters owner and local date and propagates cancellation', async () => {
  const { client, calls } = mock([{ data: [], error: null }]);
  const signal = new AbortController().signal;
  assert.deepEqual(await loadWaterDay(client, 'owner', '2026-09-23', signal), {
    ok: true,
    data: [],
  });
  for (const [method, args] of [
    ['eq', ['user_id', 'owner']],
    ['eq', ['recorded_date', '2026-09-23']],
    ['abortSignal', [signal]],
  ] as const)
    assert.ok(
      calls.some((c) => c.method === method && JSON.stringify(c.args) === JSON.stringify(args)),
    );
  assert.deepEqual(
    calls.filter((c) => c.method === 'from').map((c) => c.args[0]),
    ['water_logs'],
  );
});
test('water read paginates instead of silently truncating daily total', async () => {
  const page = Array.from({ length: WATER_PAGE_SIZE }, (_, i) => ({
    ...row,
    id: String(i).padStart(4, '0'),
  }));
  const { client, calls } = mock([
    { data: page, error: null },
    { data: [{ ...row, id: 'last', amount_ml: 350 }], error: null },
  ]);
  const result = await loadWaterDay(client, 'owner', '2026-09-23');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.length, WATER_PAGE_SIZE + 1);
  assert.equal(waterTotals('2026-09-23', result.data)?.consumedMl, WATER_PAGE_SIZE * 250 + 350);
  assert.ok(calls.some((c) => c.method === 'gt' && c.args[1] === page.at(-1)!.id));
});
test('network and database read failure are not an empty day', async () => {
  for (const response of [new Error('offline'), { data: null, error: { message: 'failed' } }])
    assert.deepEqual(await loadWaterDay(mock([response]).client, 'owner', '2026-09-23'), {
      ok: false,
    });
});
test('saving and retrying preserve UUID and use ignoreDuplicates, never update', async () => {
  const { client, calls } = mock([
    { data: null, error: null },
    { data: row, error: null },
    { data: null, error: null },
    { data: row, error: null },
  ]);
  assert.deepEqual(await saveWaterEntry(client, entry), { ok: true, data: row });
  assert.deepEqual(await saveWaterEntry(client, entry), { ok: true, data: row });
  const writes = calls.filter((c) => c.method === 'upsert');
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[0].args, writes[1].args);
  assert.deepEqual(writes[0].args[1], { onConflict: 'id', ignoreDuplicates: true });
  assert.ok(
    calls.some((c) => c.method === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'owner'),
  );
});
test('save never reports success for hidden, missing or mismatched replay', async () => {
  for (const data of [null, { ...row, amount_ml: 500 }, { ...row, recorded_date: '2026-09-24' }])
    assert.deepEqual(
      await saveWaterEntry(
        mock([
          { data: null, error: null },
          { data, error: null },
        ]).client,
        entry,
      ),
      { ok: false },
    );
});
test('save failure stops the follow-up read; invalid amount never reaches server', async () => {
  const { client, calls } = mock([{ data: null, error: { message: 'failed' } }]);
  assert.deepEqual(await saveWaterEntry(client, entry), { ok: false });
  assert.equal(calls.filter((c) => c.method === 'from').length, 1);
  const invalid = mock([]);
  assert.deepEqual(await saveWaterEntry(invalid.client, { ...entry, amount_ml: 0 }), { ok: false });
  assert.equal(invalid.calls.length, 0);
});
test('remove is owner-scoped and surfaces failure', async () => {
  const { client, calls } = mock([{ data: null, error: null }]);
  assert.deepEqual(await removeWaterEntry(client, 'owner', ID), { ok: true, data: null });
  assert.ok(
    calls.some((c) => c.method === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'owner'),
  );
  assert.ok(calls.some((c) => c.method === 'eq' && c.args[0] === 'id' && c.args[1] === ID));
  assert.deepEqual(await removeWaterEntry(mock([new Error('offline')]).client, 'owner', ID), {
    ok: false,
  });
});
