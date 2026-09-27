import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ActionButton, Field, FormNotice, TextLink } from '@/components/form';
import { Card, Page } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import type { AuthErrorKey } from '@/features/auth/errors';
import { normalizeEmail, validateEmail, type AuthFieldError } from '@/features/auth/validation';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { sendPasswordReset, status } = useAuth();

  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<AuthFieldError | null>(null);
  const [formError, setFormError] = useState<AuthErrorKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (status === 'unconfigured') {
    return (
      <Page
        quiet
        eyebrow={t('auth.eyebrow')}
        title={t('auth.notConfiguredTitle')}
        subtitle={t('auth.notConfiguredBody')}
      >
        <TextLink href="/about" label={t('profile.about')} />
      </Page>
    );
  }

  async function onSubmit() {
    const error = validateEmail(email);
    setFieldError(error);
    setFormError(null);
    if (error) return;

    setSubmitting(true);
    const result = await sendPasswordReset(email);
    setSubmitting(false);
    // Sucesso e "e-mail inexistente" produzem a mesma resposta de propósito:
    // confirmar quais endereços têm conta seria vazamento de informação.
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setSentTo(normalizeEmail(email));
  }

  return (
    <Page
      quiet
      eyebrow={t('auth.eyebrow')}
      title={t('auth.forgotTitle')}
      subtitle={t('auth.forgotSubtitle')}
    >
      <Card>
        {formError ? <FormNotice tone="error">{t(formError)}</FormNotice> : null}
        {sentTo ? (
          <FormNotice tone="success">{t('auth.resetSent', { email: sentTo })}</FormNotice>
        ) : null}
        <Field
          label={t('auth.email')}
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChangeText={setEmail}
          error={fieldError ? t(fieldError) : null}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          inputMode="email"
          onSubmitEditing={() => void onSubmit()}
          returnKeyType="send"
        />
        <ActionButton
          label={t('auth.sendResetLink')}
          onPress={() => void onSubmit()}
          loading={submitting}
        />
        <TextLink href="/sign-in" label={t('auth.backToSignIn')} />
      </Card>
    </Page>
  );
}
