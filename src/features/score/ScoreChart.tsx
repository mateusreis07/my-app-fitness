import Svg, { Line as SvgLine, Rect, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Copy } from '@/components/ui';
import { theme } from '@/theme/tokens';
import type { ScoreDay } from './model';

const HEIGHT = 160;
const PADDING_X = 12;
const PADDING_Y = 20;
const BAR_RADIUS = 4;
const MIN_GAP = 3;

/**
 * Barras do KORA Score dos últimos dias — eixo fixo de 0 a 100 (é um índice,
 * não uma grandeza física, então não há motivo para recortar a escala). Uma
 * cor só: é uma série única, o título já nomeia a grandeza (seção 91 exige
 * separar identidade por mais que cor só quando há mais de uma série).
 *
 * Dia sem score fechado vira lacuna — barra ausente, nunca barra zero, que
 * inventaria um "péssimo" que não existe.
 */
export function ScoreChart({ days, width }: { days: ScoreDay[]; width: number }) {
  const { t } = useTranslation();
  if (days.length === 0) return null;

  // `days` chega do mais recente para o mais antigo; o gráfico lê da
  // esquerda (mais antigo) para a direita (mais recente).
  const chronological = [...days].reverse();
  const chartWidth = Math.max(width - PADDING_X * 2, 1);
  const slot = chartWidth / chronological.length;
  const barWidth = Math.max(4, slot - MIN_GAP);

  function y(value: number): number {
    return PADDING_Y + (1 - value / 100) * (HEIGHT - PADDING_Y * 2);
  }

  const withData = chronological
    .map((day) => day.totalScore)
    .filter((value): value is number => value !== null);
  const first = withData.at(0) ?? null;
  const last = withData.at(-1) ?? null;
  const average =
    withData.length > 0
      ? Math.round(withData.reduce((sum, value) => sum + value, 0) / withData.length)
      : null;

  return (
    <View accessibilityRole="image" accessibilityLabel={t('score.chartLabel')} style={s.wrapper}>
      <Svg width={chartWidth + PADDING_X * 2} height={HEIGHT}>
        <SvgLine
          x1={PADDING_X}
          y1={y(100)}
          x2={chartWidth + PADDING_X}
          y2={y(100)}
          stroke={theme.colors.line}
          strokeWidth={1}
        />
        <SvgLine
          x1={PADDING_X}
          y1={y(0)}
          x2={chartWidth + PADDING_X}
          y2={y(0)}
          stroke={theme.colors.line}
          strokeWidth={1}
        />
        <SvgText x={PADDING_X} y={y(100) - 6} fontSize={11} fill={theme.colors.muted}>
          100
        </SvgText>
        <SvgText x={PADDING_X} y={y(0) + 14} fontSize={11} fill={theme.colors.muted}>
          0
        </SvgText>

        {chronological.map((day, index) => {
          if (day.totalScore === null) return null;
          const barHeight = Math.max(0, y(0) - y(day.totalScore));
          const x = PADDING_X + index * slot + (slot - barWidth) / 2;
          return (
            <Rect
              key={day.dayKey}
              x={x}
              y={y(day.totalScore)}
              width={barWidth}
              height={barHeight}
              rx={BAR_RADIUS}
              fill={theme.colors.primary}
            />
          );
        })}
      </Svg>

      {/* Resumo textual: cobre leitor de tela e serve de "tabela" equivalente ao desenho. */}
      <Copy style={s.summary}>
        {first !== null && last !== null && average !== null
          ? t('score.chartSummary', { first, last, average })
          : t('score.chartUnavailable')}
      </Copy>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { gap: 8 },
  summary: { fontSize: 12, color: theme.colors.muted, lineHeight: 18 },
});
