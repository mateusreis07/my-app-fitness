import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Copy } from '@/components/ui';
import { theme } from '@/theme/tokens';

/** Espera curta enquanto a sessão ou o perfil são resolvidos. */
export function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <View style={s.container}>
      <ActivityIndicator
        accessibilityLabel={t('common.loading')}
        size="large"
        color={theme.colors.primary}
      />
      <Copy style={s.label}>{t('common.loading')}</Copy>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: theme.colors.background,
  },
  label: { color: theme.colors.muted, fontSize: 13 },
});
