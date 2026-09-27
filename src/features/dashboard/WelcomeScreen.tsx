import Feather from '@expo/vector-icons/Feather';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Card, Copy, IconTile, NavButton, Page } from '@/components/ui';
import { theme } from '@/theme/tokens';

export function WelcomeScreen() {
  const { t } = useTranslation();
  const wide = useWindowDimensions().width >= 760;
  return (
    <Page title={t('today.title')} subtitle={t('today.subtitle')} eyebrow={t('today.eyebrow')}>
      <View style={[s.hero, wide && s.heroWide]}>
        <View style={s.heroContent}>
          <Copy style={s.heroEyebrow}>{t('today.heroEyebrow')}</Copy>
          <Text accessibilityRole="header" style={s.heroTitle}>
            {t('today.heroTitle')}
          </Text>
          <Copy style={s.heroBody}>{t('today.heroBody')}</Copy>
          <NavButton href="/about" label={t('common.learnMore')} light />
        </View>
        {wide && (
          <View accessible={false} style={s.orbitOuter}>
            <View style={s.orbitMiddle}>
              <View style={s.orbitInner}>
                <Feather
                  accessible={false}
                  aria-hidden
                  name="sun"
                  size={36}
                  color={theme.colors.lime}
                />
                <Copy style={s.orbitText}>{t('today.heroMark')}</Copy>
              </View>
            </View>
          </View>
        )}
      </View>
      <View style={s.sectionHeading}>
        <Text accessibilityRole="header" style={s.sectionTitle}>
          {t('today.priorities')}
        </Text>
        <Copy style={s.muted}>{t('today.prioritiesSubtitle')}</Copy>
      </View>
      <View style={[s.steps, wide && s.row]}>
        {(['1', '2', '3'] as const).map((step) => (
          <View key={step} style={s.step}>
            <View style={s.stepNumber}>
              <Copy style={s.stepNumberText}>{`0${step}`}</Copy>
            </View>
            <View style={s.stepCopy}>
              <Copy style={s.cardTitle}>{t(`today.step${step}Title`)}</Copy>
              <Copy style={s.muted}>{t(`today.step${step}Body`)}</Copy>
            </View>
          </View>
        ))}
      </View>
      <View style={s.sectionHeading}>
        <Text accessibilityRole="header" style={s.sectionTitle}>
          {t('today.overview')}
        </Text>
        <Copy style={s.muted}>{t('today.overviewSubtitle')}</Copy>
      </View>
      <View style={[s.cards, wide && s.row]}>
        <Link href="/nutrition" asChild>
          <Pressable accessibilityRole="link" style={s.cardLink}>
            <Card style={s.module}>
              <View style={s.moduleTop}>
                <IconTile name="coffee" tone="warm" />
                <Feather
                  accessible={false}
                  aria-hidden
                  name="arrow-up-right"
                  size={20}
                  color={theme.colors.muted}
                />
              </View>
              <Copy style={s.cardTitle}>{t('today.nutritionTitle')}</Copy>
              <Copy style={s.muted}>{t('today.nutritionBody')}</Copy>
            </Card>
          </Pressable>
        </Link>
        <Link href="/workouts" asChild>
          <Pressable accessibilityRole="link" style={s.cardLink}>
            <Card style={s.module}>
              <View style={s.moduleTop}>
                <IconTile name="activity" />
                <Feather
                  accessible={false}
                  aria-hidden
                  name="arrow-up-right"
                  size={20}
                  color={theme.colors.muted}
                />
              </View>
              <Copy style={s.cardTitle}>{t('today.workoutTitle')}</Copy>
              <Copy style={s.muted}>{t('today.workoutBody')}</Copy>
            </Card>
          </Pressable>
        </Link>
      </View>
      <View style={s.water}>
        <IconTile name="droplet" tone="water" />
        <View style={s.stepCopy}>
          <Copy style={s.cardTitle}>{t('today.waterTitle')}</Copy>
          <Copy style={s.muted}>{t('today.waterBody')}</Copy>
        </View>
      </View>
      <Copy style={s.footer}>{t('today.footer')}</Copy>
    </Page>
  );
}

const s = StyleSheet.create({
  hero: {
    borderRadius: 26,
    backgroundColor: theme.colors.primary,
    padding: 28,
    overflow: 'hidden',
  },
  heroWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 36,
  },
  heroContent: { gap: 17, maxWidth: 490, flexShrink: 1 },
  heroEyebrow: { color: theme.colors.lime, fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  heroTitle: {
    color: theme.colors.onPrimary,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '600',
    letterSpacing: -0.8,
  },
  heroBody: { color: theme.colors.onPrimaryMuted, fontSize: 14, lineHeight: 23, marginBottom: 5 },
  orbitOuter: {
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 1,
    borderColor: '#3B5D4B',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 24,
  },
  orbitMiddle: {
    width: 184,
    height: 184,
    borderRadius: 92,
    borderWidth: 1,
    borderColor: '#567449',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbitInner: {
    width: 138,
    height: 138,
    borderRadius: 69,
    borderWidth: 1,
    borderColor: '#8C9F59',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  orbitText: {
    color: theme.colors.lime,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 17,
    letterSpacing: 3,
  },
  sectionHeading: { gap: 4, marginTop: 6 },
  sectionTitle: { color: theme.colors.ink, fontSize: 21, fontWeight: '600', letterSpacing: -0.5 },
  muted: { color: theme.colors.muted, fontSize: 13, lineHeight: 21 },
  steps: { gap: 22 },
  row: { flexDirection: 'row' },
  step: { flex: 1, flexDirection: 'row', gap: 14 },
  stepNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#CFD8C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { color: theme.colors.primary, fontSize: 11, fontWeight: '700' },
  stepCopy: { flex: 1, gap: 5 },
  cardTitle: { fontWeight: '600', fontSize: 15, lineHeight: 22 },
  cards: { gap: 16 },
  cardLink: { flex: 1 },
  module: { flex: 1, gap: 8 },
  moduleTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  water: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#EDF2EF',
  },
  footer: { textAlign: 'center', color: theme.colors.muted, fontSize: 11, marginVertical: 4 },
});
