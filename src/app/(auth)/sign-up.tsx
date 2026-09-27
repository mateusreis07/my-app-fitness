import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ActionButton, Field, FormNotice, TextLink } from '@/components/form';
import { Card, Page } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import type { AuthErrorKey } from '@/features/auth/errors';
import {
  normalizeEmail,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  type AuthFieldError,
} from '@/features/auth/validation';

type Errors = Partial<Record<'name' | 'email' | 'password' | 'confirmation', AuthFieldError>>;

export default function SignUpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signUp, status } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<Errors>({});
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

  if (sentTo) {
    return (
      <Page
        quiet
        eyebrow={t('auth.eyebrow')}
        title={t('auth.checkEmailTitle')}
        subtitle={t('auth.confirmSent', { email: sentTo })}
      >
        <Card>
          <TextLink href="/sign-in" label={t('auth.backToSignIn')} />
        </Card>
      </Page>
    );
  }

  async function onSubmit() {
    const nextErrors: Errors = {
      name: validateDisplayName(name) ?? undefined,
      email: validateEmail(email) ?? undefined,
      password: validatePassword(password) ?? undefined,
      confirmation: validatePasswordConfirmation(password, confirmation) ?? undefined,
    };
    setErrors(nextErrors);
    setFormError(null);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    const result = await signUp({ email, password, displayName: name });
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    if (result.data.needsConfirmation) {
      setSentTo(normalizeEmail(email));
      return;
    }
    // Projeto sem confirmação obrigatória: a sessão já existe, segue ao plano.
    router.replace('/onboarding');
  }

  return (
    <Page
      quiet
      eyebrow={t('auth.eyebrow')}
      title={t('auth.signUpTitle')}
      subtitle={t('auth.signUpSubtitle')}
    >
      <Card>
        {formError ? <FormNotice tone="error">{t(formError)}</FormNotice> : null}
        <Field
          label={t('auth.name')}
          placeholder={t('auth.namePlaceholder')}
          value={name}
          onChangeText={setName}
          error={errors.name ? t(errors.name) : null}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
        />
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
          hint={t('auth.passwordHint')}
          value={password}
          onChangeText={setPassword}
          error={errors.password ? t(errors.password) : null}
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
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={() => void onSubmit()}
          returnKeyType="go"
        />
        <ActionButton
          label={t('auth.signUp')}
          onPress={() => void onSubmit()}
          loading={submitting}
        />
        <View>
          <TextLink href="/sign-in" label={t('auth.hasAccount')} />
        </View>
      </Card>
    </Page>
  );
}
