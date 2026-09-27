import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ActionButton, Field, FormNotice } from '@/components/form';
import { Card, Copy, Page } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { createUserFood } from '@/features/nutrition/repository';
import {
  EMPTY_CUSTOM_FOOD,
  validateCustomFood,
  type CustomFoodDraft,
  type CustomFoodIssues,
} from '@/features/nutrition/validation';
import type { TranslationKey } from '@/lib/i18n/keys';
import { parseDecimal } from '@/lib/number';
import { getSupabaseClient } from '@/services/supabase/client';
import { theme } from '@/theme/tokens';

/** Cadastro de alimento do usuário (seção 30, "alimentos cadastrados pelo usuário"). */
export default function NewFoodScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();

  const [draft, setDraft] = useState<CustomFoodDraft>(EMPTY_CUSTOM_FOOD);
  const [issues, setIssues] = useState<CustomFoodIssues>({});
  const [formError, setFormError] = useState<TranslationKey | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof CustomFoodDraft>(key: K, value: CustomFoodDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setIssues((current) => ({ ...current, [key]: undefined }));
  }

  async function onSave() {
    const nextIssues = validateCustomFood(draft);
    setIssues(nextIssues);
    setFormError(null);
    if (Object.keys(nextIssues).length > 0) return;

    const client = getSupabaseClient();
    const serving = parseDecimal(draft.servingSize);
    const calories = parseDecimal(draft.calories);
    const protein = parseDecimal(draft.proteinG);
    const carbs = parseDecimal(draft.carbsG);
    const fat = parseDecimal(draft.fatG);
    if (
      !client ||
      !user ||
      serving === null ||
      calories === null ||
      protein === null ||
      carbs === null ||
      fat === null
    ) {
      setFormError('nutrition.error.saveFailed');
      return;
    }

    setSaving(true);
    const result = await createUserFood(client, user.id, {
      name: draft.name.trim(),
      serving_size: serving,
      serving_unit: draft.servingUnit.trim(),
      calories,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
    });
    setSaving(false);
    if (!result.ok) {
      setFormError('nutrition.error.saveFailed');
      return;
    }
    // Volta para a busca, onde o alimento recém-criado já aparece.
    router.back();
  }

  return (
    <Page
      quiet
      eyebrow={t('nutrition.title')}
      title={t('nutrition.custom.title')}
      subtitle={t('nutrition.custom.subtitle')}
    >
      <Card>
        {formError ? <FormNotice tone="error">{t(formError)}</FormNotice> : null}
        <Field
          label={t('nutrition.custom.name')}
          placeholder={t('nutrition.custom.namePlaceholder')}
          value={draft.name}
          onChangeText={(value) => set('name', value)}
          error={issues.name ? t(issues.name) : null}
          autoCapitalize="sentences"
          maxLength={160}
        />
        <View style={s.row}>
          <View style={s.half}>
            <Field
              label={t('nutrition.custom.servingSize')}
              value={draft.servingSize}
              onChangeText={(value) => set('servingSize', value)}
              error={issues.servingSize ? t(issues.servingSize) : null}
              inputMode="decimal"
              keyboardType="numeric"
              maxLength={8}
            />
          </View>
          <View style={s.half}>
            <Field
              label={t('nutrition.custom.servingUnit')}
              placeholder={t('nutrition.custom.servingUnitPlaceholder')}
              value={draft.servingUnit}
              onChangeText={(value) => set('servingUnit', value)}
              error={issues.servingUnit ? t(issues.servingUnit) : null}
              autoCapitalize="none"
              maxLength={20}
            />
          </View>
        </View>
        <Field
          label={t('nutrition.custom.caloriesLabel')}
          value={draft.calories}
          onChangeText={(value) => set('calories', value)}
          error={issues.calories ? t(issues.calories) : null}
          inputMode="decimal"
          keyboardType="numeric"
          maxLength={7}
        />
        <Field
          label={t('nutrition.custom.proteinLabel')}
          value={draft.proteinG}
          onChangeText={(value) => set('proteinG', value)}
          error={issues.proteinG ? t(issues.proteinG) : null}
          inputMode="decimal"
          keyboardType="numeric"
          maxLength={7}
        />
        <Field
          label={t('nutrition.custom.carbsLabel')}
          value={draft.carbsG}
          onChangeText={(value) => set('carbsG', value)}
          error={issues.carbsG ? t(issues.carbsG) : null}
          inputMode="decimal"
          keyboardType="numeric"
          maxLength={7}
        />
        <Field
          label={t('nutrition.custom.fatLabel')}
          value={draft.fatG}
          onChangeText={(value) => set('fatG', value)}
          error={issues.fatG ? t(issues.fatG) : null}
          inputMode="decimal"
          keyboardType="numeric"
          maxLength={7}
        />
        <Copy style={s.caption}>{t('fitness.estimateNotice')}</Copy>
      </Card>

      <View style={s.actions}>
        <ActionButton
          label={t('nutrition.custom.save')}
          onPress={() => void onSave()}
          loading={saving}
        />
        <ActionButton label={t('profile.cancel')} tone="quiet" onPress={() => router.back()} />
      </View>
    </Page>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1, minWidth: 0 },
  caption: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: 'row-reverse', gap: 12, flexWrap: 'wrap' },
});
