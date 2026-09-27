/**
 * Validação de formulários de autenticação.
 *
 * Funções puras, sem React e sem Supabase, para que a regra seja testável
 * isoladamente (KORA_MASTER_CONTEXT.md seção 106, regras 3 e 4). Cada função
 * devolve a chave de tradução do erro, ou `null` quando o valor é aceito.
 */

export type AuthFieldError =
  | 'auth.error.emailRequired'
  | 'auth.error.emailInvalid'
  | 'auth.error.passwordRequired'
  | 'auth.error.passwordShort'
  | 'auth.error.passwordWeak'
  | 'auth.error.passwordMismatch'
  | 'auth.error.nameShort';

/** Mínimo do projeto. O Supabase aceita 6; aqui a regra é mais estrita. */
export const PASSWORD_MIN_LENGTH = 8;
export const DISPLAY_NAME_MAX_LENGTH = 80;

// Suficiente para barrar erro de digitação no cliente. A confirmação real de
// existência do endereço é feita pelo e-mail de verificação.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateEmail(value: string): AuthFieldError | null {
  const email = normalizeEmail(value);
  if (!email) return 'auth.error.emailRequired';
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return 'auth.error.emailInvalid';
  return null;
}

export function validatePassword(value: string): AuthFieldError | null {
  if (!value) return 'auth.error.passwordRequired';
  if (value.length < PASSWORD_MIN_LENGTH) return 'auth.error.passwordShort';
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) return 'auth.error.passwordWeak';
  return null;
}

/** No login não se reaplica a política de senha: só a presença do campo. */
export function validatePasswordPresence(value: string): AuthFieldError | null {
  return value ? null : 'auth.error.passwordRequired';
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): AuthFieldError | null {
  return password === confirmation ? null : 'auth.error.passwordMismatch';
}

export function validateDisplayName(value: string): AuthFieldError | null {
  const name = value.trim();
  if (name.length < 2 || name.length > DISPLAY_NAME_MAX_LENGTH) return 'auth.error.nameShort';
  return null;
}
