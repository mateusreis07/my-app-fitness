import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSupabaseConfig } from './env.ts';

const key = 'sb_publishable_example-public-key';

test('allows running without a backend', () => {
  assert.deepEqual(parseSupabaseConfig(), { status: 'missing' });
});
test('normalizes a complete public configuration', () => {
  assert.deepEqual(parseSupabaseConfig(' https://example.supabase.co/ ', key), {
    status: 'ready',
    config: { url: 'https://example.supabase.co', publishableKey: key },
  });
});
test('rejects partial configuration and private or legacy keys', () => {
  for (const value of [undefined, '', 'sb_secret_private', 'eyJ.legacy.jwt']) {
    assert.equal(parseSupabaseConfig('https://example.supabase.co', value).status, 'invalid');
  }
  assert.equal(parseSupabaseConfig(undefined, key).status, 'invalid');
});
test('rejects insecure remote endpoints and embedded credentials', () => {
  for (const url of [
    'http://example.com',
    'ftp://example.com',
    'https://user:password@example.com',
    'not-a-url',
    'https://example.com/path',
    'https://example.com?token=secret',
    'https://example.com#secret',
  ]) {
    assert.equal(parseSupabaseConfig(url, key).status, 'invalid');
  }
});
test('allows local Supabase development over HTTP', () => {
  assert.equal(parseSupabaseConfig('http://127.0.0.1:54321', key).status, 'ready');
});
