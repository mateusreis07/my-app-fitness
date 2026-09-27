import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  normalizeEmail,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validatePasswordPresence,
} from './validation.ts';

test('normalizes e-mail removing spaces and case', () => {
  assert.equal(normalizeEmail('  Maria@Exemplo.COM '), 'maria@exemplo.com');
});

test('accepts a well formed e-mail and rejects the rest', () => {
  assert.equal(validateEmail('maria@exemplo.com'), null);
  assert.equal(validateEmail('   '), 'auth.error.emailRequired');
  for (const value of ['maria', 'maria@', '@exemplo.com', 'maria@exemplo', 'a b@c.com']) {
    assert.equal(validateEmail(value), 'auth.error.emailInvalid', value);
  }
});

test('enforces the project password policy', () => {
  assert.equal(validatePassword('senha2026'), null);
  assert.equal(validatePassword(''), 'auth.error.passwordRequired');
  assert.equal(validatePassword('curta1'), 'auth.error.passwordShort');
  assert.equal(validatePassword('semnumeros'), 'auth.error.passwordWeak');
  assert.equal(validatePassword('12345678'), 'auth.error.passwordWeak');
});

test('login only checks that a password was typed', () => {
  assert.equal(validatePasswordPresence('abc'), null);
  assert.equal(validatePasswordPresence(''), 'auth.error.passwordRequired');
});

test('confirmation must match exactly', () => {
  assert.equal(validatePasswordConfirmation('senha2026', 'senha2026'), null);
  assert.equal(
    validatePasswordConfirmation('senha2026', 'senha2027'),
    'auth.error.passwordMismatch',
  );
});

test('display name requires 2 to 80 characters after trimming', () => {
  assert.equal(validateDisplayName(' Ana '), null);
  assert.equal(validateDisplayName(' A '), 'auth.error.nameShort');
  assert.equal(validateDisplayName('x'.repeat(81)), 'auth.error.nameShort');
});
