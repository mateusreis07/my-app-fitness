import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
  createWeightEntry,
  parseNotes,
  parseWeight,
  validWeight,
} from './model.ts';

const ID = '11111111-1111-4111-8111-111111111111';

test('valid weight is anything inside the CHECK range', () => {
  assert.equal(validWeight(WEIGHT_KG_MIN), true);
  assert.equal(validWeight(WEIGHT_KG_MAX), true);
  assert.equal(validWeight(WEIGHT_KG_MIN - 0.1), false);
  assert.equal(validWeight(WEIGHT_KG_MAX + 0.1), false);
  for (const value of [NaN, Infinity, -Infinity]) assert.equal(validWeight(value), false);
});

test('parses comma decimal and rounds to one decimal place', () => {
  assert.equal(parseWeight('72,5'), 72.5);
  assert.equal(parseWeight('72.55'), 72.6); // arredonda, não trunca
  assert.equal(parseWeight(' 90 '), 90);
});

test('rejects out-of-range, malformed and non-finite weight text', () => {
  for (const text of ['', '0', '-5', '24,9', '400,1', 'abc', '90 kg', 'NaN', 'Infinity']) {
    assert.equal(parseWeight(text), null, text);
  }
});

test('notes trim, empty becomes null, and the length limit is enforced', () => {
  assert.equal(parseNotes('  jejum  '), 'jejum');
  assert.equal(parseNotes('   '), null);
  assert.equal(parseNotes(''), null);
  assert.equal(parseNotes('x'.repeat(500)), 'x'.repeat(500));
  assert.equal(parseNotes('x'.repeat(501)), null);
});

test('a valid entry captures the local day, the instant and the timezone', () => {
  const entry = createWeightEntry({
    userId: 'owner',
    weightKg: 72.5,
    timeZone: 'America/Sao_Paulo',
    now: new Date('2026-09-24T01:00:00Z'), // 22h em São Paulo: ainda dia 23
    id: ID,
  });
  assert.ok(entry);
  assert.equal(entry.recorded_date, '2026-09-23');
  assert.equal(entry.recorded_timezone, 'America/Sao_Paulo');
  assert.equal(entry.notes, null);
});

test('an entry made after local midnight lands on the next day', () => {
  const entry = createWeightEntry({
    userId: 'owner',
    weightKg: 72.5,
    timeZone: 'America/Sao_Paulo',
    now: new Date('2026-09-24T03:00:00Z'), // 0h em São Paulo: já é dia 24
    id: ID,
  });
  assert.equal(entry?.recorded_date, '2026-09-24');
});

test('invalid weight, id, instant or notes never build an entry', () => {
  const base = { userId: 'owner', weightKg: 72.5, timeZone: 'UTC', now: new Date(), id: ID };
  assert.equal(createWeightEntry({ ...base, userId: '' }), null);
  assert.equal(createWeightEntry({ ...base, weightKg: 0 }), null);
  assert.equal(createWeightEntry({ ...base, weightKg: NaN }), null);
  assert.equal(createWeightEntry({ ...base, id: 'not-a-uuid' }), null);
  assert.equal(createWeightEntry({ ...base, now: new Date('invalid') }), null);
  assert.equal(createWeightEntry({ ...base, notes: '' }), null);
  assert.equal(createWeightEntry({ ...base, notes: 'x'.repeat(501) }), null);
});

test('a legitimate note is preserved on the entry', () => {
  const entry = createWeightEntry({
    userId: 'owner',
    weightKg: 72.5,
    timeZone: 'UTC',
    now: new Date(),
    id: ID,
    notes: 'em jejum',
  });
  assert.equal(entry?.notes, 'em jejum');
});
