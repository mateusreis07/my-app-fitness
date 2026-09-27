import { Redirect, Stack } from 'expo-router';

import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuth, useOnboardingComplete } from '@/features/auth/AuthProvider';
import { theme } from '@/theme/tokens';

/** Mesma guarda do onboarding: registro exige sessão e plano inicial concluído. */
export default function LoggingLayout() {
  const { status, profileLoading } = useAuth();
  const complete = useOnboardingComplete();

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'unconfigured') return <Redirect href="/" />;
  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  if (profileLoading) return <LoadingScreen />;
  if (!complete) return <Redirect href="/onboarding" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}
