/**
 * Leituras e escritas do KORA Score.
 *
 * Mesmo contrato das fases anteriores: `Result<T>` tagueado, `try/catch` que
 * nunca deixa exceção escapar, `abortSignal` em toda consulta, filtro
 * explícito por dono mesmo com RLS. Reusa a leitura de um dia já pronta em
 * nutrição, hidratação e treino — nada de duplicar consulta.
 */
import { addDaysIso } from '../../lib/date.ts';
import type { KoraClient } from '@/services/supabase/client';
import type { DailyScore, NutritionTargets } from '@/services/supabase/database.types';
import { loadDay } from '../nutrition/repository.ts';
import { buildDayTotals } from '../nutrition/totals.ts';
import { loadWaterDay } from '../hydration/repository.ts';
import { waterTotals } from '../hydration/model.ts';
import { loadTodaySignal } from '../workouts/repository.ts';
import {
  dayComponents,
  totalScore,
  SCORE_ALGORITHM_VERSION,
  HISTORY_LOOKBACK_DAYS,
} from './model.ts';

export type Result<T> = { ok: true; data: T } | { ok: false };

const FAILED = { ok: false } as const;

export const SCORE_PAGE_SIZE = 200;

/** A meta vigente num dia qualquer — não só "a atual", como `fetchCurrentTargets`. */
export async function loadTargetsForDay(
  client: KoraClient,
  userId: string,
  day: string,
  signal?: AbortSignal,
): Promise<Result<NutritionTargets | null>> {
  try {
    const query = client
      .from('nutrition_targets')
      .select('*')
      .eq('user_id', userId)
      .lte('effective_from', day)
      .or(`effective_until.is.null,effective_until.gt.${day}`)
      .order('effective_from', { ascending: false })
      .limit(1);
    if (signal) query.abortSignal(signal);
    const { data, error } = await query.maybeSingle();
    return error ? FAILED : { ok: true, data: data ?? null };
  } catch {
    return FAILED;
  }
}

/**
 * Fecha um dia: lê metas, totais de nutrição/água e sinal de treino daquele
 * dia, calcula os componentes e grava por chave natural
 * (`user_id, score_date`) — escrita derivada e determinística, não um toque
 * do usuário sujeito a duplo-clique, então não precisa do protocolo de UUID
 * de cliente das Fases 6/7.
 */
export async function closeDayScore(
  client: KoraClient,
  userId: string,
  day: string,
  signal?: AbortSignal,
): Promise<Result<DailyScore>> {
  try {
    // Sequencial, não `Promise.all`: mais simples de testar com um cliente
    // simulado de fila única, e o fechamento de dia roda em segundo plano,
    // sem pressa de latência.
    const targets = await loadTargetsForDay(client, userId, day, signal);
    if (!targets.ok) return FAILED;
    const mealsResult = await loadDay(client, userId, day, signal);
    if (!mealsResult.ok) return FAILED;
    const waterResult = await loadWaterDay(client, userId, day, signal);
    if (!waterResult.ok) return FAILED;
    const workoutResult = await loadTodaySignal(client, userId, day, signal);
    if (!workoutResult.ok) return FAILED;

    const dayTotals = buildDayTotals(day, mealsResult.data);
    // `waterTotals` só devolve `null` diante de dado corrompido (amount_ml
    // inválido) — dia sem registro nenhum já vem como `consumedMl: 0`.
    const water = waterTotals(day, waterResult.data);
    const target = targets.data;

    const components = dayComponents({
      consumedKcal: dayTotals.calories,
      targetKcal: target ? Number(target.calories) : null,
      consumedProteinG: dayTotals.proteinG,
      targetProteinG: target ? Number(target.protein_g) : null,
      consumedWaterMl: water?.consumedMl ?? null,
      targetWaterMl: target ? Number(target.water_ml) : null,
      workoutScheduled: workoutResult.data.scheduled,
      workoutCompleted: workoutResult.data.completed,
      loggedMeal: dayTotals.mealCount > 0,
      loggedWater: waterResult.data.length > 0,
      loggedWorkout: workoutResult.data.completed,
    });
    const total = totalScore(components);

    const { data, error } = await client
      .from('daily_scores')
      .upsert(
        {
          user_id: userId,
          score_date: day,
          nutrition_score: components.nutrition,
          protein_score: components.protein,
          hydration_score: components.hydration,
          workout_score: components.workout,
          consistency_score: components.consistency,
          total_score: total,
          algorithm_version: SCORE_ALGORITHM_VERSION,
        },
        { onConflict: 'user_id,score_date' },
      )
      .select('*')
      .maybeSingle();
    if (error || !data) return FAILED;
    return { ok: true, data };
  } catch {
    return FAILED;
  }
}

/**
 * Fecha os últimos `HISTORY_LOOKBACK_DAYS` dias que ainda não têm linha,
 * sempre excluindo hoje (calculado ao vivo, nunca persistido enquanto o dia
 * não termina). Um hiato maior que a janela vira lacuna no histórico, como
 * qualquer outro "dia sem registro" do projeto — sem esforço ilimitado de
 * backfill.
 */
export async function ensureRecentScoresClosed(
  client: KoraClient,
  userId: string,
  todayDayKey: string,
  signal?: AbortSignal,
): Promise<Result<null>> {
  try {
    const fromDay = addDaysIso(todayDayKey, -HISTORY_LOOKBACK_DAYS);
    const existingQuery = client
      .from('daily_scores')
      .select('score_date')
      .eq('user_id', userId)
      .gte('score_date', fromDay)
      .lt('score_date', todayDayKey);
    if (signal) existingQuery.abortSignal(signal);
    const existing = await existingQuery;
    if (existing.error) return FAILED;
    const closed = new Set((existing.data ?? []).map((row) => row.score_date));

    for (let day = fromDay; day < todayDayKey; day = addDaysIso(day, 1)) {
      if (closed.has(day)) continue;
      // Best-effort: uma falha isolada num dia não impede os demais.
      await closeDayScore(client, userId, day, signal);
    }
    return { ok: true, data: null };
  } catch {
    return FAILED;
  }
}

/** Histórico paginado por cursor, mais recente primeiro, para o gráfico e o streak. */
export async function loadScoreHistory(
  client: KoraClient,
  userId: string,
  fromDay: string,
  signal?: AbortSignal,
): Promise<Result<DailyScore[]>> {
  try {
    const rows: DailyScore[] = [];
    let after: string | null = null;
    for (;;) {
      const query = client
        .from('daily_scores')
        .select('*')
        .eq('user_id', userId)
        .gte('score_date', fromDay)
        .order('id', { ascending: true })
        .limit(SCORE_PAGE_SIZE);
      if (after) query.gt('id', after);
      if (signal) query.abortSignal(signal);
      const { data, error } = await query;
      if (error || !data) return FAILED;
      rows.push(...data);
      if (data.length < SCORE_PAGE_SIZE) break;
      const next = data.at(-1)!.id;
      if (next === after) return FAILED;
      after = next;
    }
    rows.sort((a, b) => b.score_date.localeCompare(a.score_date));
    return { ok: true, data: rows };
  } catch {
    return FAILED;
  }
}
