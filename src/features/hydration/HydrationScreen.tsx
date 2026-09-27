import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet } from 'react-native';
import { ActionButton, Field, FormNotice } from '@/components/form';
import { Card, Copy, NavButton, Page } from '@/components/ui';
import { Metric } from '@/features/dashboard/DashboardView';
import { metricProgress } from '@/features/dashboard/model';
import { parseWaterAmount, WATER_SHORTCUTS } from './model';
import { useHydrationDay } from './useHydrationDay';
import { theme } from '@/theme/tokens';

export function HydrationScreen() {
  const { t } = useTranslation();
  const water = useHydrationDay();
  const [amount, setAmount] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const progress = metricProgress(water.totals?.consumedMl ?? null, water.target?.water_ml ?? null);
  async function custom() {
    const parsed = parseWaterAmount(amount);
    setInvalid(parsed === null);
    if (parsed !== null && (await water.save(parsed))) setAmount('');
  }
  const blocked = water.busy || Boolean(water.pending);
  return (
    <Page title={t('hydration.title')} subtitle={t('hydration.subtitle')}>
      <NavButton href="/" label={t('common.backHome')} />
      <ActionButton
        label={t('dashboard.refresh')}
        onPress={() => void water.reload()}
        loading={water.refreshing}
        tone="quiet"
      />
      {water.loading ? (
        <Copy>{t('common.loading')}</Copy>
      ) : water.error ? (
        <FormNotice tone="error">{t('hydration.loadFailed')}</FormNotice>
      ) : (
        <Card>
          <Metric
            label={t('hydration.today')}
            consumed={water.totals?.consumedMl ?? null}
            target={water.target?.water_ml ?? null}
            unit={t('fitness.waterUnit')}
          />
          {progress ? (
            <Copy>
              {t(progress.remaining > 0 ? 'hydration.remaining' : 'hydration.reached', {
                amount: progress.remaining.toLocaleString('pt-BR'),
              })}
            </Copy>
          ) : (
            <Copy>{t(water.targetError ? 'hydration.targetFailed' : 'hydration.noTarget')}</Copy>
          )}
          <Copy style={s.caption}>{t('hydration.estimate')}</Copy>
        </Card>
      )}
      {water.feedback ? (
        <FormNotice tone={water.feedback.endsWith('Failed') ? 'error' : 'success'}>
          {t(`hydration.${water.feedback}`)}
        </FormNotice>
      ) : null}
      {water.pending && !water.busy ? (
        <Card>
          <Copy>{t('hydration.uncertain')}</Copy>
          <ActionButton label={t('hydration.retrySave')} onPress={() => void water.save()} />
          <ActionButton label={t('hydration.dismiss')} onPress={water.clearPending} tone="quiet" />
        </Card>
      ) : null}
      <Card>
        <Copy style={s.heading}>{t('hydration.add')}</Copy>
        <View style={s.row}>
          {WATER_SHORTCUTS.map((value) => (
            <ActionButton
              key={value}
              label={t('dashboard.waterShortcut', { amount: value })}
              onPress={() => void water.save(value)}
              disabled={blocked}
            />
          ))}
        </View>
        <Field
          label={t('hydration.custom')}
          hint={t('hydration.amountHint')}
          value={amount}
          onChangeText={(text) => {
            setAmount(text);
            setInvalid(false);
          }}
          keyboardType="number-pad"
          editable={!blocked}
          error={invalid ? t('hydration.invalidAmount') : null}
        />
        <ActionButton
          label={t('hydration.save')}
          onPress={() => void custom()}
          disabled={blocked}
          loading={water.busy}
        />
      </Card>
      <Card>
        <Copy style={s.heading}>{t('hydration.history')}</Copy>
        {water.loading ? (
          <Copy>{t('common.loading')}</Copy>
        ) : water.error ? (
          <Copy>{t('hydration.loadFailed')}</Copy>
        ) : water.logs.length === 0 ? (
          <Copy>{t('hydration.empty')}</Copy>
        ) : (
          water.logs.map((log) => (
            <View key={log.id} style={s.entry}>
              <Copy>
                {t('hydration.entry', {
                  amount: log.amount_ml.toLocaleString('pt-BR'),
                  time: new Intl.DateTimeFormat('pt-BR', {
                    timeZone: log.recorded_timezone,
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(log.recorded_at)),
                })}
              </Copy>
              {confirmId === log.id ? (
                <>
                  <Copy>{t('hydration.confirmRemove')}</Copy>
                  <View style={s.row}>
                    <ActionButton
                      label={t('hydration.remove')}
                      disabled={blocked}
                      onPress={() => {
                        void water.remove(log.id);
                        setConfirmId(null);
                      }}
                      tone="quiet"
                    />
                    <ActionButton
                      label={t('hydration.cancel')}
                      onPress={() => setConfirmId(null)}
                      tone="quiet"
                    />
                  </View>
                </>
              ) : (
                <ActionButton
                  label={t('hydration.remove')}
                  disabled={blocked}
                  onPress={() => setConfirmId(log.id)}
                  tone="quiet"
                />
              )}
            </View>
          ))
        )}
      </Card>
    </Page>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  heading: { fontSize: 18, fontWeight: '700' },
  caption: { fontSize: 12, color: theme.colors.muted },
  entry: { gap: 10, borderTopWidth: 1, borderTopColor: theme.colors.line, paddingTop: 14 },
});
