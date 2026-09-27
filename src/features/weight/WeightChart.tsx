import Svg, { Circle, Line as SvgLine, Path, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Copy } from '@/components/ui';
import { theme } from '@/theme/tokens';
import type { DailyWeight } from './trend';
import { movingAverage, TREND_WINDOW_DAYS } from './trend';

const HEIGHT = 180;
const PADDING_X = 12;
const PADDING_Y = 20;
const DOT_RADIUS = 4; // >= 4, per the mark spec (8px diameter minimum).
const RING_WIDTH = 2; // surface ring around each dot, so it stays legible crossing the line.

/**
 * Linha de peso diário com a média móvel de 7 dias sobreposta.
 *
 * Esquema **monocromático por desenho**, não por limitação: os dois traços
 * representam a mesma grandeza (peso), não duas categorias diferentes, então
 * não há identidade a separar por matiz. A distinção é por forma — pontos
 * soltos para o registro bruto, linha contínua para a tendência — o que já
 * atende à seção 91 (números não podem depender só de cor) sem precisar de
 * uma segunda cor.
 *
 * O eixo Y não começa em zero: é peso corporal, não contagem, e forçar o zero
 * achataria a variação real a ponto de escondê-la.
 *
 * Dia sem registro vira lacuna — a linha não é interpolada sobre um dado que
 * não existe.
 *
 * Sem tooltip por toque nesta primeira versão (registrado como limite
 * conhecido); o resumo textual abaixo do desenho e o histórico em lista na
 * tela cobrem o "table view" que a acessibilidade exige.
 */
export function WeightChart({ series, width }: { series: DailyWeight[]; width: number }) {
  const { t } = useTranslation();

  if (series.length < 2) return null;

  const chartWidth = Math.max(width - PADDING_X * 2, 1);
  const weights = series.map((entry) => entry.weightKg);
  const rawMin = Math.min(...weights);
  const rawMax = Math.max(...weights);
  // Uma margem de respiro; sem ela, um dia estável vira uma linha reta na
  // borda do gráfico.
  const span = Math.max(rawMax - rawMin, 0.5);
  const min = rawMin - span * 0.15;
  const max = rawMax + span * 0.15;

  const firstDay = series[0].dayKey;
  const lastDay = series[series.length - 1].dayKey;
  const totalDays = Math.max(
    1,
    Math.round((Date.parse(lastDay) - Date.parse(firstDay)) / 86_400_000),
  );

  function x(dayKey: string): number {
    const offset = Math.round((Date.parse(dayKey) - Date.parse(firstDay)) / 86_400_000);
    return PADDING_X + (offset / totalDays) * chartWidth;
  }
  function y(weightKg: number): number {
    return PADDING_Y + (1 - (weightKg - min) / (max - min)) * (HEIGHT - PADDING_Y * 2);
  }

  // A média móvel só existe a partir do dia em que há dados suficientes na
  // janela; antes disso a linha de tendência fica em branco, não em zero.
  const trendPoints = series
    .map((entry) => {
      const value = movingAverage(series, entry.dayKey, Math.min(TREND_WINDOW_DAYS, series.length));
      return value === null ? null : { dayKey: entry.dayKey, value };
    })
    .filter((point): point is { dayKey: string; value: number } => point !== null);

  const trendPath = trendPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.dayKey)} ${y(point.value)}`)
    .join(' ');

  const latest = series[series.length - 1];
  const first = series[0];

  return (
    <View accessibilityRole="image" accessibilityLabel={t('progress.chartLabel')} style={s.wrapper}>
      <Svg width={chartWidth + PADDING_X * 2} height={HEIGHT}>
        {/* Linhas de referência do eixo, cor recessiva, nunca tracejadas. */}
        <SvgLine
          x1={PADDING_X}
          y1={y(max)}
          x2={chartWidth + PADDING_X}
          y2={y(max)}
          stroke={theme.colors.line}
          strokeWidth={1}
        />
        <SvgLine
          x1={PADDING_X}
          y1={y(min)}
          x2={chartWidth + PADDING_X}
          y2={y(min)}
          stroke={theme.colors.line}
          strokeWidth={1}
        />
        <SvgText x={PADDING_X} y={y(max) - 6} fontSize={11} fill={theme.colors.muted}>
          {max.toFixed(1)}
        </SvgText>
        <SvgText x={PADDING_X} y={y(min) + 14} fontSize={11} fill={theme.colors.muted}>
          {min.toFixed(1)}
        </SvgText>

        {/* Tendência: linha sólida de 2px, a cor de tinta primária. */}
        {trendPath ? (
          <Path
            d={trendPath}
            stroke={theme.colors.primary}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {/* Registros brutos: pontos soltos, sem conectar — a forma (ponto vs
            linha) é o que os diferencia da tendência, não a cor. */}
        {series.map((entry) => (
          <Circle
            key={entry.dayKey}
            cx={x(entry.dayKey)}
            cy={y(entry.weightKg)}
            r={DOT_RADIUS}
            fill={theme.colors.muted}
            stroke={theme.colors.surface}
            strokeWidth={RING_WIDTH}
          />
        ))}
      </Svg>

      <View style={s.legend}>
        <View style={s.legendItem}>
          <View style={s.legendDot} />
          <Copy style={s.legendLabel}>{t('progress.chartRaw')}</Copy>
        </View>
        <View style={s.legendItem}>
          <View style={s.legendLine} />
          <Copy style={s.legendLabel}>{t('progress.chartTrend')}</Copy>
        </View>
      </View>

      {/* Resumo textual: cobre leitor de tela e serve de "tabela" equivalente
          ao desenho, já que não há interação por toque nesta versão. */}
      <Copy style={s.summary}>
        {t('progress.chartSummary', {
          first: `${first.weightKg.toFixed(1)}`,
          last: `${latest.weightKg.toFixed(1)}`,
          min: min.toFixed(1),
          max: max.toFixed(1),
        })}
      </Copy>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { gap: 8 },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.muted,
  },
  legendLine: {
    width: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: theme.colors.primary,
  },
  legendLabel: { fontSize: 12, color: theme.colors.muted },
  summary: { fontSize: 12, color: theme.colors.muted, lineHeight: 18 },
});
