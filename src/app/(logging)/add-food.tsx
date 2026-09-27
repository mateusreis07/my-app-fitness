import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChoiceGroup } from '@/components/choice';
import { ActionButton, Field, FormNotice } from '@/components/form';
import { Card, Copy, Page } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  MEAL_TYPE_OPTIONS,
  mealTypeLabelKey,
  type SelectableFood,
} from '@/features/nutrition/model';
import { buildSnapshot } from '@/features/nutrition/quantity';
import { listRecentFoods, logMealItem, searchFoods } from '@/features/nutrition/repository';
import { validateQuantity } from '@/features/nutrition/validation';
import type { TranslationKey } from '@/lib/i18n/keys';
import { parseDecimal } from '@/lib/number';
import { getSupabaseClient } from '@/services/supabase/client';
import type { MealType } from '@/services/supabase/database.types';
import { theme } from '@/theme/tokens';

const number = (value: number) => value.toLocaleString('pt-BR');

/** Etapas da seção 31: refeição, busca, seleção, quantidade e confirmação. */
export default function AddFoodScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ meal?: string; day?: string }>();

  const [mealType, setMealType] = useState<MealType | null>(
    MEAL_TYPE_OPTIONS.some((option) => option.value === params.meal)
      ? (params.meal as MealType)
      : null,
  );
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<SelectableFood[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [selected, setSelected] = useState<SelectableFood | null>(null);
  const [quantity, setQuantity] = useState('');
  const [quantityError, setQuantityError] = useState<TranslationKey | null>(null);
  const [formError, setFormError] = useState<TranslationKey | null>(null);
  const [saving, setSaving] = useState(false);
  const searchRequest = useRef(0);

  const dayKey = typeof params.day === 'string' ? params.day : '';

  // Nomes recentes servem de atalho de digitação; o alimento em si volta pela
  // busca, para a porção vir sempre da fonte atual.
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !user) return;
    let active = true;
    void listRecentFoods(client, user.id).then((result) => {
      if (active && result.ok) setRecent(result.data.map((item) => item.name));
    });
    return () => {
      active = false;
    };
  }, [user]);

  const runSearch = useCallback(
    (value: string) => {
      const client = getSupabaseClient();
      if (!client || !user) return;
      const id = ++searchRequest.current;
      void searchFoods(client, user.id, value).then((result) => {
        if (id !== searchRequest.current) return;
        setResults(result.ok ? result.data : []);
      });
    },
    [user, setResults],
  );

  function onChangeTerm(value: string) {
    setTerm(value);
    setSelected(null);
    runSearch(value);
  }

  async function onConfirm() {
    const client = getSupabaseClient();
    const parsed = parseDecimal(quantity);
    const error = validateQuantity(quantity);
    setQuantityError(error);
    setFormError(null);
    if (error || parsed === null || !selected || !mealType || !client || !user || !dayKey) {
      if (!error && (!selected || !mealType)) setFormError('nutrition.error.saveFailed');
      return;
    }

    const snapshot = buildSnapshot(selected, parsed);
    if (!snapshot) {
      setFormError('nutrition.error.saveFailed');
      return;
    }

    setSaving(true);
    const result = await logMealItem(client, user.id, {
      dayKey,
      mealType,
      food: selected,
      quantity: parsed,
      snapshot,
    });
    setSaving(false);
    if (!result.ok) {
      setFormError('nutrition.error.saveFailed');
      return;
    }
    router.back();
  }

  const parsedQuantity = parseDecimal(quantity);
  const preview =
    selected && parsedQuantity !== null ? buildSnapshot(selected, parsedQuantity) : null;

  return (
    <Page
      quiet
      eyebrow={t('nutrition.title')}
      title={t('nutrition.search.title')}
      subtitle={t('nutrition.search.subtitle')}
    >
      <Card>
        <ChoiceGroup
          label={t('nutrition.addToMeal', { meal: '' }).replace(' ', '')}
          options={MEAL_TYPE_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
          value={mealType}
          onChange={setMealType}
        />
      </Card>

      <Card>
        <Field
          label={t('nutrition.search.title')}
          placeholder={t('nutrition.search.placeholder')}
          value={term}
          onChangeText={onChangeTerm}
          autoCapitalize="sentences"
        />

        {recent.length > 0 && term.trim().length === 0 ? (
          <View style={s.recent}>
            <Copy style={s.sectionLabel}>{t('nutrition.search.recent')}</Copy>
            <View style={s.chips}>
              {recent.map((name) => (
                <Pressable
                  key={name}
                  accessibilityRole="button"
                  onPress={() => onChangeTerm(name)}
                  style={s.chip}
                >
                  <Copy style={s.chipLabel}>{name}</Copy>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {term.trim().length > 0 ? (
          results.length === 0 ? (
            <Copy style={s.caption}>{t('nutrition.search.empty')}</Copy>
          ) : (
            <View style={s.results}>
              <Copy style={s.sectionLabel}>{t('nutrition.search.results')}</Copy>
              {results.map((food) => {
                const active = selected?.origin === food.origin && selected?.id === food.id;
                return (
                  <Pressable
                    key={`${food.origin}:${food.id}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active, checked: active }}
                    onPress={() => setSelected(food)}
                    style={[s.result, active && s.resultActive]}
                  >
                    <Copy style={[s.resultName, active && s.resultNameActive]}>{food.name}</Copy>
                    <Copy style={s.caption}>
                      {t('nutrition.search.perServing', {
                        size: number(food.servingSize),
                        unit: food.servingUnit,
                        calories: number(food.calories),
                      })}
                    </Copy>
                  </Pressable>
                );
              })}
            </View>
          )
        ) : null}

        <ActionButton
          label={t('nutrition.search.createNew')}
          tone="quiet"
          icon="plus-circle"
          onPress={() => router.push('/new-food')}
        />
      </Card>

      {selected ? (
        <Card>
          <Copy style={s.sectionLabel}>{t('nutrition.quantity.title')}</Copy>
          <Copy style={s.caption}>{t('nutrition.quantity.subtitle')}</Copy>
          <Field
            label={t('nutrition.quantity.label', { unit: selected.servingUnit })}
            value={quantity}
            onChangeText={(value) => {
              setQuantity(value);
              setQuantityError(null);
            }}
            error={quantityError ? t(quantityError) : null}
            inputMode="decimal"
            keyboardType="numeric"
            maxLength={8}
          />
          {preview ? (
            <FormNotice tone="info">
              {t('nutrition.quantity.preview', {
                calories: number(preview.calories),
                protein: number(preview.proteinG),
                carbs: number(preview.carbsG),
                fat: number(preview.fatG),
              })}
            </FormNotice>
          ) : null}
        </Card>
      ) : null}

      {formError ? <FormNotice tone="error">{t(formError)}</FormNotice> : null}

      <View style={s.actions}>
        <ActionButton
          label={
            mealType
              ? t('nutrition.addToMeal', { meal: t(mealTypeLabelKey(mealType)) })
              : t('nutrition.quantity.confirm')
          }
          onPress={() => void onConfirm()}
          loading={saving}
          disabled={!selected || !mealType}
        />
        <ActionButton label={t('profile.cancel')} tone="quiet" onPress={() => router.back()} />
      </View>
    </Page>
  );
}

const s = StyleSheet.create({
  sectionLabel: { fontSize: 13, fontWeight: '700' },
  caption: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
  recent: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
  },
  chipLabel: { color: theme.colors.primary, fontSize: 13, fontWeight: '600' },
  results: { gap: 8 },
  result: {
    gap: 2,
    padding: 14,
    minHeight: 56,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  resultActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  resultName: { fontSize: 15 },
  resultNameActive: { fontWeight: '700', color: theme.colors.primary },
  actions: { flexDirection: 'row-reverse', gap: 12, flexWrap: 'wrap' },
});
