import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { ActionButton, FormNotice } from '@/components/form';
import { Card, Copy, IconTile, NavButton, Page, UpcomingButton } from '@/components/ui';
import { PillGroup, SwitchRow } from '@/components/choice';
import { useAuth } from '@/features/auth/AuthProvider';
import { useNotificationPreferences } from '@/features/notifications/useNotificationPreferences';
import { theme } from '@/theme/tokens';

const REMINDER_TIME_OPTIONS = ['09:00', '12:00', '15:00', '18:00'];
const SUMMARY_TIME_OPTIONS = ['19:00', '21:00', '22:00'];

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { status, user, profile, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const notifications = useNotificationPreferences();

  const signedIn = status === 'signedIn';
  const notificationsSupported = Platform.OS !== 'web';
  const prefs = notifications.preferences;

  async function performSignOut() {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    router.replace('/sign-in');
  }

  function confirmSignOut() {
    // `Alert` não existe na web; ali a confirmação usa o diálogo do navegador.
    if (Platform.OS === 'web') {
      const confirmed =
        typeof globalThis.confirm === 'function'
          ? globalThis.confirm(t('profile.signOutConfirmBody'))
          : true;
      if (confirmed) void performSignOut();
      return;
    }
    Alert.alert(t('profile.signOutConfirmTitle'), t('profile.signOutConfirmBody'), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('profile.signOutConfirm'),
        style: 'destructive',
        onPress: () => void performSignOut(),
      },
    ]);
  }

  return (
    <Page title={t('profile.title')} subtitle={t('profile.subtitle')}>
      {status === 'unconfigured' ? (
        <FormNotice tone="error">{t('profile.offlineBody')}</FormNotice>
      ) : null}

      <Card>
        <IconTile name="user" />
        {signedIn ? (
          <>
            <Copy style={s.title}>{t('profile.accountTitle')}</Copy>
            <View style={s.row}>
              <Copy style={s.muted}>{t('profile.nameLabel')}</Copy>
              <Copy>{profile?.display_name?.trim() || t('profile.nameMissing')}</Copy>
            </View>
            <View style={s.row}>
              <Copy style={s.muted}>{t('profile.emailLabel')}</Copy>
              <Copy>{user?.email ?? t('profile.nameMissing')}</Copy>
            </View>
          </>
        ) : (
          <>
            <Copy style={s.title}>{t('profile.guest')}</Copy>
            <Copy style={s.muted}>{t('profile.guestBody')}</Copy>
            <UpcomingButton label={t('profile.account')} />
          </>
        )}
      </Card>

      <Card>
        <Copy style={s.title}>{t('profile.preferences')}</Copy>
        <View style={s.row}>
          <Copy style={s.muted}>{t('profile.language')}</Copy>
          <Copy>{t('profile.languageValue')}</Copy>
        </View>
        <View style={s.row}>
          <Copy style={s.muted}>{t('profile.units')}</Copy>
          <Copy>{t('profile.unitsValue')}</Copy>
        </View>
      </Card>

      {signedIn ? (
        <Card>
          <Copy style={s.title}>{t('notifications.title')}</Copy>
          <Copy style={s.muted}>{t('notifications.subtitle')}</Copy>
          {!notificationsSupported ? (
            <Copy style={s.muted}>{t('notifications.unsupportedWeb')}</Copy>
          ) : (
            <>
              <SwitchRow
                label={t('notifications.water.label')}
                value={prefs?.water_enabled ?? false}
                onChange={(value) => void notifications.setEnabled('water_enabled', value)}
              />
              <SwitchRow
                label={t('notifications.workout.label')}
                value={prefs?.workout_enabled ?? false}
                onChange={(value) => void notifications.setEnabled('workout_enabled', value)}
              />
              <SwitchRow
                label={t('notifications.weight.label')}
                value={prefs?.weight_enabled ?? false}
                onChange={(value) => void notifications.setEnabled('weight_enabled', value)}
              />
              <SwitchRow
                label={t('notifications.summary.label')}
                value={prefs?.summary_enabled ?? false}
                onChange={(value) => void notifications.setEnabled('summary_enabled', value)}
              />
              {notifications.permissionDenied ? (
                <FormNotice tone="error">{t('notifications.permissionDenied')}</FormNotice>
              ) : null}
              <PillGroup
                label={t('notifications.reminderTimeLabel')}
                options={REMINDER_TIME_OPTIONS.map((value) => ({ value, label: value }))}
                value={prefs?.reminder_time?.slice(0, 5) ?? null}
                onChange={(value) => void notifications.setTime('reminder_time', value)}
              />
              <PillGroup
                label={t('notifications.summaryTimeLabel')}
                options={SUMMARY_TIME_OPTIONS.map((value) => ({ value, label: value }))}
                value={prefs?.summary_time?.slice(0, 5) ?? null}
                onChange={(value) => void notifications.setTime('summary_time', value)}
              />
            </>
          )}
        </Card>
      ) : null}

      <Card>
        <IconTile name="shield" />
        <Copy style={s.title}>{t('profile.privacyTitle')}</Copy>
        <Copy style={s.muted}>{t('profile.privacyBody')}</Copy>
      </Card>

      <NavButton href="/about" label={t('profile.about')} />

      {signedIn ? (
        <ActionButton
          label={t('profile.signOut')}
          tone="quiet"
          icon="log-out"
          onPress={confirmSignOut}
          loading={signingOut}
        />
      ) : null}

      <Copy style={s.version}>
        {t('profile.version', { version: Constants.expoConfig?.version ?? '0.1.0' })}
      </Copy>
    </Page>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '600' },
  muted: { color: theme.colors.muted, fontSize: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  version: { color: theme.colors.muted, fontSize: 12 },
});
