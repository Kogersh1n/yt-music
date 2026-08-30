import { memo, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Вертикальный градиент без нативного модуля.
 *
 * Заменяет expo-linear-gradient: в связке с React Native 0.86 его нативная
 * вьюха отвергает проп `colors` («Cannot set prop 'colors' on view
 * LinearGradientView») — обёртка прогоняет цвета через processColor, и
 * результат больше не приводится к IntArray, которого ждёт нативная сторона.
 * Градиент на экране просто не рисовался.
 *
 * Здесь он собирается из полос сплошного цвета. Это обычные View, никакой
 * нативной прослойки, ломаться нечему. При 48 полосах переход на глаз
 * непрерывный, а стоимость — те же 48 плоских прямоугольников без слоёв
 * и без перерисовки (цвета считаются один раз на смену палитры).
 */

interface GradientProps {
  /** Цвета остановок сверху вниз, минимум два. Формат `#rrggbb`. */
  colors: readonly string[];
  /** Позиции остановок 0..1. По умолчанию распределяются равномерно. */
  locations?: readonly number[];
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/** Сколько полос рисуем. 48 — граница, за которой полосатость уже не видна. */
const BANDS = 48;

export const Gradient = memo(function Gradient({
  colors,
  locations,
  style,
  children,
}: GradientProps) {
  const bands = useMemo(() => buildBands(colors, locations), [colors, locations]);

  return (
    <View style={style}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {bands.map((color, index) => (
          <View key={index} style={{ flex: 1, backgroundColor: color }} />
        ))}
      </View>
      {children}
    </View>
  );
});

function buildBands(colors: readonly string[], locations?: readonly number[]): string[] {
  if (colors.length === 0) return [];
  if (colors.length === 1) return [colors[0]];

  const stops = colors.map(parseHex);
  const positions =
    locations && locations.length === colors.length
      ? locations
      : colors.map((_, index) => index / (colors.length - 1));

  const result: string[] = [];

  for (let band = 0; band < BANDS; band++) {
    // Берём середину полосы, а не край: так крайние полосы не «съедают»
    // цвет первой и последней остановки.
    const t = (band + 0.5) / BANDS;

    // Находим пару остановок, между которыми оказалась полоса.
    let upper = positions.findIndex((position) => position >= t);
    if (upper <= 0) upper = t <= positions[0] ? 1 : positions.length - 1;

    const lower = upper - 1;
    const span = positions[upper] - positions[lower];
    // span === 0 — две остановки в одной точке; берём верхнюю, а не делим на ноль.
    const ratio = span > 0 ? (t - positions[lower]) / span : 1;
    const clamped = Math.max(0, Math.min(1, ratio));

    result.push(mix(stops[lower], stops[upper], clamped));
  }

  return result;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseHex(hex: string): Rgb {
  const value = hex.replace('#', '');
  // Поддерживаем и короткую запись `#abc`, чтобы компонент не был капризным.
  const full =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value;
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0,
  };
}

function mix(from: Rgb, to: Rgb, ratio: number): string {
  const channel = (a: number, b: number) => Math.round(a + (b - a) * ratio);
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(channel(from.r, to.r))}${hex(channel(from.g, to.g))}${hex(channel(from.b, to.b))}`;
}
