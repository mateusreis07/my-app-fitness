import Feather from '@expo/vector-icons/Feather';
import { Link, type Href } from 'expo-router';
import type { ComponentProps, PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextProps,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/theme/tokens';

export type IconName = ComponentProps<typeof Feather>['name'];

export function Copy({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.copy, style]} />;
}

export function Card({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, style]} />;
}

export function IconTile({
  name,
  tone = 'green',
}: {
  name: IconName;
  tone?: 'green' | 'water' | 'warm';
}) {
  const palette = {
    green: [theme.colors.primarySoft, theme.colors.primary],
    water: [theme.colors.waterSoft, theme.colors.water],
    warm: [theme.colors.warmSoft, theme.colors.warm],
  }[tone];
  return (
    <View style={[styles.iconTile, { backgroundColor: palette[0] }]}>
      <Feather accessible={false} aria-hidden name={name} size={23} color={palette[1]} />
    </View>
  );
}

export function NavButton({
  href,
  label,
  light = false,
}: {
  href: Href;
  label: string;
  light?: boolean;
}) {
  // O visual fica em uma View interna, não no Pressable.
  //
  // Com `Link asChild`, o elemento é clonado para virar âncora na web e o
  // `style` em forma de função do Pressable se perde: o botão renderizava sem
  // fundo, sem padding e sem layout em linha. No card escuro isso deixava o
  // rótulo verde escuro invisível sobre verde escuro, sobrando só a seta.
  // Um filho comum sempre carrega o próprio estilo.
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" style={styles.navPressable}>
        <View style={[styles.button, light && styles.lightButton]}>
          <Copy style={[styles.buttonText, light && { color: theme.colors.primary }]}>{label}</Copy>
          <Feather
            accessible={false}
            aria-hidden
            name="arrow-up-right"
            size={19}
            color={light ? theme.colors.primary : theme.colors.onPrimary}
          />
        </View>
      </Pressable>
    </Link>
  );
}

export function UpcomingButton({ label }: { label: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.upcoming}>
      <Pressable
        disabled
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        accessibilityHint={t('common.unavailable')}
        style={styles.disabledButton}
      >
        <Feather accessible={false} aria-hidden name="lock" size={16} color={theme.colors.muted} />
        <Copy style={styles.disabledText}>{label}</Copy>
      </Pressable>
      <Copy style={styles.caption}>{t('common.unavailable')}</Copy>
    </View>
  );
}

export function Page({
  children,
  title,
  subtitle,
  eyebrow,
  quiet = false,
}: PropsWithChildren<{
  title: string;
  subtitle: string;
  eyebrow?: string;
  /** Telas fora do app logado (conta, onboarding) não levam atalhos de navegação. */
  quiet?: boolean;
}>) {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.brandRow}>
            {quiet ? (
              <Text style={styles.brand}>
                {t('common.brand')}
                <Text style={styles.brandDot}>.</Text>
              </Text>
            ) : (
              <Link href="/" accessibilityLabel={t('common.backHome')}>
                <Text style={styles.brand}>
                  {t('common.brand')}
                  <Text style={styles.brandDot}>.</Text>
                </Text>
              </Link>
            )}
            {quiet ? null : (
              <Link href="/about" asChild>
                <Pressable style={styles.preview}>
                  <View style={styles.dot} />
                  <Copy style={styles.previewText}>{t('common.preview')}</Copy>
                </Pressable>
              </Link>
            )}
          </View>
          <View style={styles.heading}>
            <Copy style={styles.eyebrow}>{eyebrow ?? t('common.yourSpace')}</Copy>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Copy style={styles.subtitle}>{subtitle}</Copy>
          </View>
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 22, paddingBottom: 36 },
  content: { width: '100%', maxWidth: theme.contentWidth, alignSelf: 'center', gap: 24 },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 24,
  },
  brand: { fontSize: 29, letterSpacing: -1.5, fontWeight: '900', color: theme.colors.primary },
  brandDot: { color: '#71933E' },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 30,
    backgroundColor: theme.colors.primarySoft,
  },
  previewText: { fontSize: 11, fontWeight: '600', color: theme.colors.primary },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.primary },
  heading: { gap: 9, paddingTop: 10 },
  eyebrow: { color: theme.colors.muted, fontSize: 10, letterSpacing: 2, fontWeight: '700' },
  title: {
    color: theme.colors.ink,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -1.3,
    fontWeight: '700',
  },
  subtitle: { color: theme.colors.muted, fontSize: 14, lineHeight: 22 },
  copy: { color: theme.colors.ink, fontSize: 15, lineHeight: 23 },
  card: {
    backgroundColor: theme.colors.surface,
    padding: 24,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.line,
    gap: 16,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
    minHeight: 48,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary,
    alignSelf: 'flex-start',
  },
  lightButton: { backgroundColor: theme.colors.lime },
  /** O Pressable é só a área de toque; o visual mora na View interna. */
  navPressable: { alignSelf: 'flex-start' },
  buttonText: { color: theme.colors.onPrimary, fontWeight: '700', fontSize: 14 },
  pressed: { opacity: 0.7 },
  upcoming: { gap: 10 },
  disabledButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
    borderRadius: 12,
    padding: 14,
    minHeight: 48,
    backgroundColor: theme.colors.primarySoft,
  },
  disabledText: { color: theme.colors.muted, fontSize: 14, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 18, color: theme.colors.muted },
});
