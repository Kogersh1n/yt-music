import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';

/**
 * Ореол под обложкой.
 *
 * Радиального градиента в React Native нет, а тянуть ради одного эффекта Skia
 * несоразмерно. Ореол собирается из нескольких вложенных скруглённых слоёв
 * одного цвета с падающей непрозрачностью: на глаз это мягкое свечение,
 * по стоимости — четыре плоских View без перерисовки.
 */

interface GlowProps {
  /** Цвет свечения. */
  color: string;
  /** Сторона обложки — ореол строится относительно неё. */
  size: number;
  /** Насколько ярко. 0 — выключено. */
  intensity?: number;
}

/**
 * Сколько слоёв в ореоле. Четырёх мало — между ними видны кольца;
 * десять уже неразличимы на глаз и стоят ровно столько же.
 */
const LAYER_COUNT = 10;
/** Насколько ореол шире обложки на самом краю. */
const MAX_SCALE = 1.7;
/** Непрозрачность самого плотного, внутреннего слоя. */
const PEAK_OPACITY = 0.16;

/**
 * Слои от большого и бледного к маленькому и плотному.
 *
 * Непрозрачность падает квадратично, а не линейно: линейная даёт видимую
 * границу на внешнем крае, квадратичная растворяет ореол в фоне.
 */
const LAYERS = Array.from({ length: LAYER_COUNT }, (_, index) => {
  // 0 — внешний слой, 1 — внутренний.
  const depth = (index + 1) / LAYER_COUNT;
  return {
    scale: 1 + (MAX_SCALE - 1) * (1 - depth),
    opacity: PEAK_OPACITY * depth * depth,
  };
});

export const Glow = memo(function Glow({ color, size, intensity = 1 }: GlowProps) {
  const theme = useTheme();

  // Тема может запретить украшения вместе с анимациями — тогда ореола нет.
  const enabled = intensity > 0 && theme.motion.scale > 0;

  const layers = useMemo(
    () =>
      LAYERS.map((layer) => {
        const side = size * layer.scale;
        return {
          width: side,
          height: side,
          // Скругление в половину стороны даёт круг — мягче, чем квадрат.
          borderRadius: side / 2,
          backgroundColor: color,
          opacity: layer.opacity * intensity,
          position: 'absolute' as const,
        };
      }),
    [color, size, intensity],
  );

  if (!enabled) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      {layers.map((layer, index) => (
        <View key={index} style={layer} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
