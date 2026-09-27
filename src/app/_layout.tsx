import '@/lib/i18n';
import Feather from '@expo/vector-icons/Feather';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Copy, Page, styles } from '@/components/ui';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { theme } from '@/theme/tokens';

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  return (
    <SafeAreaProvider>
      <Page title={t('error.title')} subtitle={t('error.body')} quiet>
        <Pressable accessibilityRole="button" onPress={retry} style={styles.button}>
          <Copy style={styles.buttonText}>{t('error.retry')}</Copy>
        </Pressable>
      </Page>
    </SafeAreaProvider>
  );
}

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(Feather.font);
  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);
  if (fontError) throw fontError;
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(logging)" />
          <Stack.Screen name="about" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
