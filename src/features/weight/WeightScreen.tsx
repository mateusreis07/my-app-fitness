import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet } from 'react-native';
import { ActionButton, Field, FormNotice } from '@/components/form';
import { Card, Copy, NavButton, Page } from '@/components/ui';
import { theme } from '@/theme/tokens';
import { parseWeight } from './model';
import { useWeightHistory } from './useWeightHistory';

/**
 * Registro de peso — KORA_MASTER_CONTEXT.md seção 35.
 *
 * Campos: peso, observação opcional. Data e horário são o momento do registro;
 * não há campo para retroagir nesta fase (fora de escopo, ver docs/PHASE_7.md).
 * A recomendação de horário consistente é sugerida, nunca exigida.
 */
export function WeightScreen() {
  const { t } = useTranslation();
  const weight = useWeightHistory();
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const blocked = weight.busy || Boolean(weight.pending);

  async function submit() {
    const parsed = parseWeight(value);
    setInvalid(parsed === null);
    if (parsed !== null && (await weight.save(parsed, notes))) {
      setValue('');
      setNotes('');
    }
  }

  return (
    <Page title={t('weight.title')} subtitle={t('weight.subtitle')}>
      <NavButton href="/progress" label={t('common.backHome')} />
      <ActionButton
        label={t('dashboard.refresh')}
        onPress={() => void weight.reload()}
        loading={weight.refreshing}
        tone="quiet"
      />

      {weight.feedback ? (
        <FormNotice tone={weight.feedback.endsWith('Failed') ? 'error' : 'success'}>
          {t(`weight.${weight.feedback}`)}
        </FormNotice>
      ) : null}

      {weight.pending && !weight.busy ? (
        <Card>
          <Copy>{t('weight.uncertain')}</Copy>
          <ActionButton label={t('weight.retrySave')} onPress={() => void weight.save()} />
          <ActionButton label={t('weight.dismiss')} onPress={weight.clearPending} tone="quiet" />
        </Card>
      ) : null}

      <Card>
        <Copy style={s.caption}>{t('weight.consistencyHint')}</Copy>
        <Field
          label={t('weight.label')}
          value={value}
          onChangeText={(text) => {
            setValue(text);
            setInvalid(false);
          }}
          keyboardType="decimal-pad"
          editable={!blocked}
          error={invalid ? t('weight.invalidWeight') : null}
        />
        <Field
          label={t('weight.notes')}
          value={notes}
          onChangeText={setNotes}
          editable={!blocked}
        />
        <ActionButton
          label={t('weight.save')}
          onPress={() => void submit()}
          disabled={blocked}
          loading={weight.busy}
        />
      </Card>

      <Card>
        <Copy style={s.heading}>{t('weight.history')}</Copy>
        {weight.loading ? (
          <Copy>{t('common.loading')}</Copy>
        ) : weight.error ? (
          <Copy>{t('weight.loadFailed')}</Copy>
        ) : weight.logs.length === 0 ? (
          <Copy>{t('weight.empty')}</Copy>
        ) : (
          weight.logs.map((log) => (
            <View key={log.id} style={s.entry}>
              <Copy>
                {t('weight.entry', {
                  weight: Number(log.weight_kg).toFixed(1),
                  date: new Intl.DateTimeFormat('pt-BR', {
                    timeZone: log.recorded_timezone,
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(log.recorded_at)),
                })}
              </Copy>
              {log.notes ? <Copy style={s.caption}>{log.notes}</Copy> : null}
              {confirmId === log.id ? (
                <>
                  <Copy>{t('weight.confirmRemove')}</Copy>
                  <View style={s.row}>
                    <ActionButton
                      label={t('weight.remove')}
                      disabled={blocked}
                      onPress={() => {
                        void weight.remove(log.id);
                        setConfirmId(null);
                      }}
                      tone="quiet"
                    />
                    <ActionButton
                      label={t('weight.cancel')}
                      onPress={() => setConfirmId(null)}
                      tone="quiet"
                    />
                  </View>
                </>
              ) : (
                <ActionButton
                  label={t('weight.remove')}
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
  entry: { gap: 6, borderTopWidth: 1, borderTopColor: theme.colors.line, paddingTop: 14 },
});
