import Feather from '@expo/vector-icons/Feather';
import { Redirect } from 'expo-router';
import { Tabs, TabList, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/LoadingScreen';
import { Copy, type IconName } from '@/components/ui';
import { useAuth, useOnboardingComplete } from '@/features/auth/AuthProvider';
import { useNotificationScheduler } from '@/features/notifications/useNotificationScheduler';
import { theme } from '@/theme/tokens';

function TabButton({
  children,
  isFocused,
  icon,
  ...props
}: TabTriggerSlotProps & { icon: IconName }) {
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      aria-selected={isFocused}
      style={({ pressed }) => [styles.tab, pressed && { opacity: 0.65 }]}
    >
      <View style={[styles.icon, isFocused && styles.activeIcon]}>
        <Feather
          accessible={false}
          aria-hidden
          name={icon}
          size={21}
          color={isFocused ? theme.colors.primary : theme.colors.muted}
        />
      </View>
      <Copy style={[styles.label, isFocused && styles.activeLabel]}>{children}</Copy>
    </Pressable>
  );
}

export default function TabLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { status, profileLoading } = useAuth();
  const onboardingComplete = useOnboardingComplete();
  // Sem usuário, os hooks internos simplesmente não buscam nada — seguro
  // chamar antes das guardas abaixo, que o Rules of Hooks exige de qualquer forma.
  useNotificationScheduler();

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  if (status === 'signedIn') {
    if (profileLoading) return <LoadingScreen />;
    if (!onboardingComplete) return <Redirect href="/onboarding" />;
  }
  // `unconfigured`: sem backend, o app segue como prévia navegável da Fase 0.

  return (
    <Tabs style={styles.container}>
      <TabSlot style={styles.slot} />
      <TabList style={[styles.tabList, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TabTrigger name="today" href="/" asChild>
          <TabButton icon="grid">{t('nav.today')}</TabButton>
        </TabTrigger>
        <TabTrigger name="nutrition" href="/nutrition" asChild>
          <TabButton icon="coffee">{t('nav.nutrition')}</TabButton>
        </TabTrigger>
        <TabTrigger name="workouts" href="/workouts" asChild>
          <TabButton icon="activity">{t('nav.workouts')}</TabButton>
        </TabTrigger>
        <TabTrigger name="progress" href="/progress" asChild>
          <TabButton icon="bar-chart-2">{t('nav.progress')}</TabButton>
        </TabTrigger>
        <TabTrigger name="profile" href="/profile" asChild>
          <TabButton icon="user">{t('nav.profile')}</TabButton>
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  slot: { flex: 1 },
  tabList: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 8,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  tab: { flex: 1, maxWidth: 180, alignItems: 'center', gap: 2, paddingVertical: 4, minHeight: 56 },
  icon: { paddingHorizontal: 17, paddingVertical: 5, borderRadius: 12 },
  activeIcon: { backgroundColor: theme.colors.primarySoft },
  label: { color: theme.colors.muted, fontSize: 10, lineHeight: 15 },
  activeLabel: { color: theme.colors.primary, fontWeight: '700' },
});
