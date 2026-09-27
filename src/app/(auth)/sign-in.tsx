import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ActionButton, Field, FormNotice, TextLink } from '@/components/form';
import { Card, Page } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import type { AuthErrorKey } from '@/features/auth/errors';
import {
  validateEmail,
  validatePasswordPresence,
  type AuthFieldError,
} from '@/features/auth/validation';

export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signIn, status } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: AuthFieldError; password?: AuthFieldError }>({});
  const [formError, setFormError] = useState<AuthErrorKey | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    const nextErrors = {
      email: validateEmail(email) ?? undefined,
      password: validatePasswordPresence(password) ?? undefined,
    };
    setErrors(nextErrors);
    setFormError(null);
    if (nextErrors.email || nextErrors.password) return;

    setSubmitting(true);
    const result = await signIn({ email, password });
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    // O layout de rotas reage à sessão; o replace evita voltar para o login.
    router.replace('/');
  }

  return (
    <Page
      quiet
      eyebrow={t('auth.eyebrow')}
      title={t('auth.signInTitle')}
      subtitle={t('auth.signInSubtitle')}
    >
      <Card>
        {formError ? <FormNotice tone="error">{t(formError)}</FormNotice> : null}
        <Field
          label={t('auth.email')}
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChangeText={setEmail}
          error={errors.email ? t(errors.email) : null}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          inputMode="email"
        />
        <Field
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          error={errors.password ? t(errors.password) : null}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={() => void onSubmit()}
          returnKeyType="go"
        />
        <ActionButton
          label={t('auth.signIn')}
          onPress={() => void onSubmit()}
          loading={submitting}
        />
        <View>
          <TextLink href="/forgot-password" label={t('auth.forgotPassword')} />
          <TextLink href="/sign-up" label={t('auth.noAccount')} />
        </View>
      </Card>
    </Page>
  );
}
