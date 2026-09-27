import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mapAuthError } from './errors.ts';

test('maps known Supabase codes to catalog messages', () => {
  assert.equal(mapAuthError({ code: 'invalid_credentials' }), 'auth.error.invalidCredentials');
  assert.equal(mapAuthError({ code: 'email_not_confirmed' }), 'auth.error.emailNotConfirmed');
  assert.equal(mapAuthError({ code: 'user_already_exists' }), 'auth.error.userExists');
  assert.equal(mapAuthError({ code: 'email_exists' }), 'auth.error.userExists');
  assert.equal(mapAuthError({ code: 'otp_expired' }), 'auth.error.linkExpired');
  assert.equal(mapAuthError({ code: 'over_email_send_rate_limit' }), 'auth.error.rateLimited');
});

test('treats HTTP 429 without code as rate limiting', () => {
  assert.equal(mapAuthError({ status: 429 }), 'auth.error.rateLimited');
});

test('recognizes connection failures, which arrive without a code', () => {
  assert.equal(mapAuthError({ name: 'AuthRetryableFetchError' }), 'auth.error.network');
  assert.equal(mapAuthError({ message: 'Network request failed' }), 'auth.error.network');
  assert.equal(mapAuthError({ message: 'Failed to fetch' }), 'auth.error.network');
});

test('falls back to a generic message and never leaks the server text', () => {
  assert.equal(mapAuthError(null), 'auth.error.unexpected');
  assert.equal(mapAuthError({ code: 'brand_new_code' }), 'auth.error.unexpected');
  assert.equal(
    mapAuthError({ message: 'pgbouncer: relation "users" does not exist' }),
    'auth.error.unexpected',
  );
});
