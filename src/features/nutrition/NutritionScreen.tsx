import Feather from '@expo/vector-icons/Feather';
import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton, FormNotice } from '@/components/form';
import { Card, Copy, Page } from '@/components/ui';
import { Metric } from '@/features/dashboard/DashboardView';
import { getSupabaseClient } from '@/services/supabase/client';
import type { MealItem, MealType } from '@/services/supabase/database.types';
import { theme } from '@/theme/tokens';
import { MEAL_TYPES, mealTypeLabelKey, type MealWithItems } from './model';
import { removeMealItem } from './repository';
import { buildMealTotals } from './totals';
import { useNutritionDay } from './useNutritionDay';

const number = (value: number) => value.toLocaleString('pt-BR');

export function NutritionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { loading, error, dayKey, meals, totals, targets, reload } = useNutritionDay();

  const byType = new Map<MealType, MealWithItems>();
  for (const meal of meals) byType.set(meal.mealType, meal);
  const hasAnyItem = meals.some((meal) => meal.items.length > 0);

  async function performRemove(itemId: string) {
    const client = getSupabaseClient();
    if (!client) return;
    const result = await removeMealItem(client, itemId);
    if (result.ok) reload();
  }

  function confirmRemove(itemId: string) {
    // `Alert` não existe na web; ali a confirmação usa o diálogo do navegador.
    if (Platform.OS === 'web') {
      const confirmed =
        typeof globalThis.confirm === 'function'
          ? globalThis.confirm(t('nutrition.removeConfirmBody'))
          : true;
      if (confirmed) void performRemove(itemId);
      return;
    }
    Alert.alert(t('nutrition.removeConfirmTitle'), t('nutrition.removeConfirmBody'), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('nutrition.remove'),
        style: 'destructive',
        onPress: () => void performRemove(itemId),
      },
    ]);
  }

  return (
    <Page title={t('nutrition.title')} subtitle={t('nutrition.subtitle')}>
      {error ? (
        <Card style={s.errorCard}>
          <FormNotice tone="error">{t('nutrition.loadError')}</FormNotice>
          <ActionButton label={t('nutrition.retry')} tone="quiet" onPress={reload} />
        </Card>
      ) : null}

      <Card style={s.totalCard}>
        <Copy style={s.totalLabel}>{t('nutrition.dayTotal')}</Copy>
        <View style={s.totalRow}>
          <Text accessibilityRole="header" style={s.totalValue}>
            {loading ? t('dashboard.unknown') : number(totals.calories)}
          </Text>
          <Copy style={s.totalUnit}>
            {targets
              ? t('dashboard.metricValue', {
                  consumed: '',
                  target: number(targets.calories),
                  unit: t('fitness.caloriesUnit'),
                }).trim()
              : t('fitness.caloriesUnit')}
          </Copy>
        </View>
        <Metric
          label={t('fitness.proteinLabel')}
          consumed={loading ? null : totals.proteinG}
          target={targets?.protein_g ?? null}
          unit={t('fitness.gramsUnit')}
        />
        <Metric
          label={t('fitness.carbsLabel')}
          consumed={loading ? null : totals.carbsG}
          target={targets?.carbs_g ?? null}
          unit={t('fitness.gramsUnit')}
        />
        <Metric
          label={t('fitness.fatLabel')}
          consumed={loading ? null : totals.fatG}
          target={targets?.fat_g ?? null}
          unit={t('fitness.gramsUnit')}
        />
        {targets === null ? <Copy style={s.caption}>{t('nutrition.noTargetNotice')}</Copy> : null}
      </Card>

      {!loading && !error && !hasAnyItem ? (
        <Card style={s.empty}>
          <Text accessibilityRole="header" style={s.emptyTitle}>
            {t('nutrition.emptyTitle')}
          </Text>
          <Copy style={s.caption}>{t('nutrition.emptyBody')}</Copy>
        </Card>
      ) : null}

      {MEAL_TYPES.map((mealType) => {
        const meal = byType.get(mealType);
        const items = meal?.items ?? [];
        const mealTotals = buildMealTotals(items);
        return (
          <Card key={mealType} style={s.meal}>
            <View style={s.mealTop}>
              <Copy style={s.mealTitle}>{t(mealTypeLabelKey(mealType))}</Copy>
              {items.length > 0 ? (
                <Copy style={s.mealTotal}>
                  {number(mealTotals.calories)} {t('fitness.caloriesUnit')}
                </Copy>
              ) : null}
            </View>

            {items.length === 0 ? (
              <Copy style={s.caption}>{t('nutrition.emptyMeal')}</Copy>
            ) : (
              items.map((item: MealItem) => (
                <View key={item.id} style={s.item}>
                  <View style={s.itemCopy}>
                    <Copy style={s.itemName}>{item.name_snapshot}</Copy>
                    <Copy style={s.caption}>
                      {number(Number(item.quantity))} {item.serving_unit} ·{' '}
                      {number(Number(item.calories_snapshot))} {t('fitness.caloriesUnit')}
                    </Copy>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${t('nutrition.remove')}: ${item.name_snapshot}`}
                    onPress={() => confirmRemove(item.id)}
                    style={s.removeButton}
                  >
                    <Feather
                      accessible={false}
                      aria-hidden
                      name="x"
                      size={18}
                      color={theme.colors.muted}
                    />
                  </Pressable>
                </View>
              ))
            )}

            <Link href={{ pathname: '/add-food', params: { meal: mealType, day: dayKey } }} asChild>
              <Pressable accessibilityRole="link" style={s.addPressable}>
                <View style={s.addButton}>
                  <Feather
                    accessible={false}
                    aria-hidden
                    name="plus"
                    size={17}
                    color={theme.colors.primary}
                  />
                  <Copy style={s.addLabel}>{t('nutrition.addFood')}</Copy>
                </View>
              </Pressable>
            </Link>
          </Card>
        );
      })}

      <Copy style={s.caption}>{t('fitness.estimateNotice')}</Copy>
      <View style={s.spacer} />
      <ActionButton
        label={t('nutrition.search.createNew')}
        tone="quiet"
        icon="plus-circle"
        onPress={() => router.push('/new-food')}
      />
    </Page>
  );
}

const s = StyleSheet.create({
  errorCard: { gap: 12 },
  totalCard: { gap: 14 },
  totalLabel: {
    color: theme.colors.muted,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  totalValue: { fontSize: 36, lineHeight: 42, fontWeight: '800', color: theme.colors.primary },
  totalUnit: { color: theme.colors.muted, fontSize: 13 },
  empty: { gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.ink },
  meal: { gap: 12 },
  mealTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  mealTitle: { fontSize: 16, fontWeight: '700' },
  mealTotal: { color: theme.colors.muted, fontSize: 13, fontWeight: '600' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemCopy: { flex: 1, gap: 2 },
  itemName: { fontSize: 15 },
  removeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
  },
  addPressable: { alignSelf: 'flex-start' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
  },
  addLabel: { color: theme.colors.primary, fontWeight: '700', fontSize: 13 },
  caption: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
  spacer: { height: 4 },
});
