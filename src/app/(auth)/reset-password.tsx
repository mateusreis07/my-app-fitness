import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ActionButton, Field, FormNotice, TextLink } from '@/components/form';
import { Card, Page } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import type { AuthErrorKey } from '@/features/auth/errors';
import {
  validatePassword,
  validatePasswordConfirmation,
  type AuthFieldError,
} from '@/features/auth/validation';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { updatePassword, status, recovering } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<{
    password?: AuthFieldError;
    confirmation?: AuthFieldError;
  }>({});
  const [formError, setFormError] = useState<AuthErrorKey | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // A troca de senha só é possível com a sessão temporária criada pelo link do
  // e-mail. Sem ela, o Supabase recusaria a operação de qualquer forma.
  const hasRecoverySession = status === 'signedIn';

  async function onSubmit() {
    const nextErrors = {
      password: validatePassword(password) ?? undefined,
      confirmation: validatePasswordConfirmation(password, confirmation) ?? undefined,
    };
    setErrors(nextErrors);
    setFormError(null);
    if (nextErrors.password || nextErrors.confirmation) return;

    setSubmitting(true);
    const result = await updatePassword(password);
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    router.replace('/');
  }

  return (
    <Page
      quiet
      eyebrow={t('auth.eyebrow')}
      title={t('auth.resetTitle')}
      subtitle={t('auth.resetSubtitle')}
    >
      <Card>
        {!hasRecoverySession ? (
          <FormNotice tone="error">{t('auth.resetNeedsLink')}</FormNotice>
        ) : null}
        {formError ? <FormNotice tone="error">{t(formError)}</FormNotice> : null}
        <Field
          label={t('auth.password')}
          hint={t('auth.passwordHint')}
          value={password}
          onChangeText={setPassword}
          error={errors.password ? t(errors.password) : null}
          editable={hasRecoverySession}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <Field
          label={t('auth.passwordConfirm')}
          value={confirmation}
          onChangeText={setConfirmation}
          error={errors.confirmation ? t(errors.confirmation) : null}
          editable={hasRecoverySession}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={() => void onSubmit()}
          returnKeyType="go"
        />
        <ActionButton
          label={t('auth.updatePassword')}
          onPress={() => void onSubmit()}
          loading={submitting}
          disabled={!hasRecoverySession}
        />
        {!recovering ? <TextLink href="/sign-in" label={t('auth.backToSignIn')} /> : null}
      </Card>
    </Page>
  );
}
