import { Redirect, Stack } from 'expo-router';

import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuth, useOnboardingComplete } from '@/features/auth/AuthProvider';
import { theme } from '@/theme/tokens';

export default function OnboardingLayout() {
  const { status, profileLoading } = useAuth();
  const complete = useOnboardingComplete();

  if (status === 'loading') return <LoadingScreen />;
  // Sem backend configurado o app segue no modo prévia da Fase 0.
  if (status === 'unconfigured') return <Redirect href="/" />;
  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  if (profileLoading) return <LoadingScreen />;
  if (complete) return <Redirect href="/" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}
