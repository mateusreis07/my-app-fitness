import { Redirect, Stack } from 'expo-router';

import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuth } from '@/features/auth/AuthProvider';
import { theme } from '@/theme/tokens';

export default function AuthLayout() {
  const { status, recovering } = useAuth();

  if (status === 'loading') return <LoadingScreen />;
  // Na recuperação de senha existe sessão, mas o usuário precisa permanecer
  // aqui até definir a nova senha.
  if (status === 'signedIn' && !recovering) return <Redirect href="/" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}
