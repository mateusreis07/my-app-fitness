import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { WeightLog } from '../../services/supabase/database.types';
import {
  changeSinceStart,
  dailySeries,
  movingAverage,
  progressToTarget,
  weeklyComparison,
  TREND_WINDOW_DAYS,
} from './trend.ts';

function log(dayKey: string, weightKg: number, id = `${dayKey}-${weightKg}`): WeightLog {
  return {
    id,
    user_id: 'owner',
    weight_kg: weightKg,
    recorded_at: `${dayKey}T12:00:00.000Z`,
    recorded_date: dayKey,
    recorded_timezone: 'America/Sao_Paulo',
    notes: null,
    created_at: `${dayKey}T12:00:00.000Z`,
  };
}

test('a série sai em ordem crescente de dia, uma entrada por dia', () => {
  const series = dailySeries([log('2026-09-23', 90), log('2026-09-21', 92), log('2026-09-22', 91)]);
  assert.deepEqual(
    series.map((entry) => entry.dayKey),
    ['2026-09-21', '2026-09-22', '2026-09-23'],
  );
});

test('dia com mais de um registro vira a média do dia, não o último valor', () => {
  const series = dailySeries([log('2026-09-23', 90, 'a'), log('2026-09-23', 92, 'b')]);
  assert.equal(series.length, 1);
  assert.equal(series[0].weightKg, 91);
  assert.equal(series[0].samples, 2, 'a quantidade de pesagens fica visível');
});

test('registro inválido é descartado em vez de contaminar a média', () => {
  const series = dailySeries([
    log('2026-09-23', 90),
    log('2026-09-23', Number.NaN as unknown as number, 'nan'),
    log('2026-09-23', 0, 'zero'),
    log('2026-09-23', -5, 'neg'),
  ]);
  assert.equal(series[0].weightKg, 90);
  assert.equal(series[0].samples, 1);
});

test('a série usa o dia gravado, não o instante — o fuso já foi resolvido na escrita', () => {
  // Registro às 23h em São Paulo cai no dia seguinte em UTC. O recorded_date manda.
  const noite: WeightLog = {
    ...log('2026-09-23', 90),
    recorded_at: '2026-09-24T02:00:00.000Z',
  };
  assert.equal(dailySeries([noite])[0].dayKey, '2026-09-23');
});

test('média móvel cobre a janela de sete dias, incluindo as duas pontas', () => {
  const series = dailySeries([
    log('2026-09-16', 100), // fora: a janela que termina em 23 começa em 17
    log('2026-09-17', 96), // primeiro dia dentro
    log('2026-09-23', 90), // último dia dentro
  ]);
  assert.equal(movingAverage(series, '2026-09-23'), 93); // (96 + 90) / 2
  assert.equal(TREND_WINDOW_DAYS, 7);
});

test('média móvel sem registro na janela devolve null, nunca zero', () => {
  const series = dailySeries([log('2026-09-01', 90)]);
  assert.equal(movingAverage(series, '2026-09-23'), null);
  assert.equal(movingAverage([], '2026-09-23'), null);
});

test('dia sem registro não é interpolado: a janela usa só o que existe', () => {
  const series = dailySeries([log('2026-09-20', 92), log('2026-09-23', 90)]);
  // Dois registros em sete dias: média dos dois, não de sete.
  assert.equal(movingAverage(series, '2026-09-23'), 91);
});

test('comparação semanal precisa de registro nas duas janelas', () => {
  const soUmaSemana = dailySeries([log('2026-09-20', 92), log('2026-09-23', 90)]);
  assert.equal(weeklyComparison(soUmaSemana, '2026-09-23'), null);

  const duasSemanas = dailySeries([
    log('2026-09-10', 95),
    log('2026-09-14', 93),
    log('2026-09-20', 92),
    log('2026-09-23', 90),
  ]);
  const comparacao = weeklyComparison(duasSemanas, '2026-09-23');
  assert.ok(comparacao);
  assert.equal(comparacao.current, 91); // (92 + 90) / 2
  assert.equal(comparacao.previous, 94); // janela 10 a 16: (95 + 93) / 2
  assert.ok(comparacao.differenceKg < 0, 'peso caindo é diferença negativa');
});

test('variação desde o início precisa de dois dias distintos', () => {
  assert.equal(changeSinceStart(dailySeries([log('2026-09-23', 90)])), null);
  assert.equal(changeSinceStart([]), null);

  const mudanca = changeSinceStart(dailySeries([log('2026-09-16', 96), log('2026-09-23', 90)]));
  assert.ok(mudanca);
  assert.equal(mudanca.differenceKg, -6);
  assert.equal(mudanca.days, 7);
});

test('progresso até a meta funciona na perda de peso', () => {
  const meio = progressToTarget(96, 93, 90);
  assert.ok(meio);
  assert.equal(meio.fraction, 0.5);
  assert.equal(meio.remainingKg, 3);
  assert.equal(meio.reached, false);
});

test('progresso até a meta funciona no ganho de peso', () => {
  const meio = progressToTarget(70, 73, 76);
  assert.ok(meio);
  assert.equal(meio.fraction, 0.5);
  assert.equal(meio.remainingKg, 3);
  assert.equal(meio.reached, false);
});

test('chegar ou passar da meta conta como alcançada, sem faltante negativo', () => {
  for (const atual of [90, 88]) {
    const resultado = progressToTarget(96, atual, 90);
    assert.ok(resultado);
    assert.equal(resultado.reached, true, `peso ${atual}`);
    assert.equal(resultado.remainingKg, 0, 'faltante nunca fica negativo');
    assert.equal(resultado.fraction, 1);
  }
});

test('andar para o lado errado não vira progresso negativo', () => {
  const piorou = progressToTarget(96, 98, 90);
  assert.ok(piorou);
  assert.equal(piorou.fraction, 0, 'a barra não recua para baixo de zero');
  assert.equal(piorou.remainingKg, 8);
  assert.equal(piorou.reached, false);
});

test('sem dado ou sem caminho a percorrer não existe progresso a mostrar', () => {
  assert.equal(progressToTarget(null, 93, 90), null);
  assert.equal(progressToTarget(96, null, 90), null);
  assert.equal(progressToTarget(96, 93, null), null);
  assert.equal(progressToTarget(90, 90, 90), null, 'partida igual à meta não tem caminho');
  assert.equal(progressToTarget(Number.NaN, 93, 90), null);
  assert.equal(progressToTarget(0, 93, 90), null);
});

test('nenhuma função devolve data prevista de chegada', () => {
  const series = dailySeries([log('2026-09-16', 96), log('2026-09-23', 90)]);
  const resultados: unknown[] = [
    movingAverage(series, '2026-09-23'),
    weeklyComparison(series, '2026-09-23'),
    changeSinceStart(series),
    progressToTarget(96, 90, 85),
  ];
  for (const resultado of resultados) {
    if (resultado === null || typeof resultado !== 'object') continue;
    for (const [campo, valor] of Object.entries(resultado)) {
      assert.equal(
        typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor),
        false,
        `campo ${campo} não pode conter data prevista`,
      );
    }
  }
});
