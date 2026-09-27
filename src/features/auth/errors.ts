/**
 * Tradução de erros do Supabase Auth para mensagens do catálogo pt-BR.
 *
 * Função pura para poder ser testada sem rede. A mensagem original do servidor
 * nunca é exibida ao usuário: ela vem em inglês e às vezes revela detalhe de
 * implementação.
 */

export type AuthErrorKey =
  | 'auth.error.invalidCredentials'
  | 'auth.error.emailNotConfirmed'
  | 'auth.error.userExists'
  | 'auth.error.weakPassword'
  | 'auth.error.samePassword'
  | 'auth.error.linkExpired'
  | 'auth.error.rateLimited'
  | 'auth.error.signupDisabled'
  | 'auth.error.network'
  | 'auth.error.unexpected';

/** Formato mínimo comum a AuthError, AuthApiError e erros de rede. */
export type AuthErrorShape = {
  code?: string | null;
  status?: number | null;
  name?: string | null;
  message?: string | null;
};

const BY_CODE: Record<string, AuthErrorKey> = {
  invalid_credentials: 'auth.error.invalidCredentials',
  email_not_confirmed: 'auth.error.emailNotConfirmed',
  user_already_exists: 'auth.error.userExists',
  email_exists: 'auth.error.userExists',
  weak_password: 'auth.error.weakPassword',
  same_password: 'auth.error.samePassword',
  otp_expired: 'auth.error.linkExpired',
  over_email_send_rate_limit: 'auth.error.rateLimited',
  over_request_rate_limit: 'auth.error.rateLimited',
  signup_disabled: 'auth.error.signupDisabled',
  email_provider_disabled: 'auth.error.signupDisabled',
};

export function mapAuthError(error: AuthErrorShape | null | undefined): AuthErrorKey {
  if (!error) return 'auth.error.unexpected';

  const byCode = error.code ? BY_CODE[error.code] : undefined;
  if (byCode) return byCode;

  if (error.status === 429) return 'auth.error.rateLimited';

  // `AuthRetryableFetchError` e falhas de fetch não trazem `code`.
  const message = (error.message ?? '').toLowerCase();
  if (
    error.name === 'AuthRetryableFetchError' ||
    error.status === 0 ||
    message.includes('network request failed') ||
    message.includes('failed to fetch')
  ) {
    return 'auth.error.network';
  }

  return 'auth.error.unexpected';
}
