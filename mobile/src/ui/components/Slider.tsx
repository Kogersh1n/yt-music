import { memo, useCallback, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useThemedStyles, type Theme } from '../theme';
import { selectionChanged } from '../haptics';

/**
 * Ползунок. Свой, а не из библиотеки: нужен всего один, зато полностью
 * подчиняющийся теме — в пиксельном оформлении он должен быть квадратным
 * и без сглаживания.
 */

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Шаг округления. Для радиусов — 1, для масштаба текста — 0.05. */
  step: number;
  /** Как показать значение рядом с подписью. */
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

export const Slider = memo(function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: SliderProps) {
  const styles = useThemedStyles(makeStyles);
  const [width, setWidth] = useState(0);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width),
    [],
  );

  const emit = useCallback(
    (x: number) => {
      if (width <= 0) return;
      const ratio = Math.max(0, Math.min(x / width, 1));
      const raw = min + ratio * (max - min);
      // Округление к шагу, потом к разрядности шага — иначе 0.7000000000000001.
      const snapped = Math.round(raw / step) * step;
      const decimals = step < 1 ? String(step).split('.')[1]?.length ?? 2 : 0;
      const next = Number(snapped.toFixed(decimals));
      // Отклик только на реальную смену значения, а не на каждое движение
      // пальца внутри одного шага.
      if (next !== value) selectionChanged();
      onChange(next);
    },
    [width, min, max, step, value, onChange],
  );

  const gesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((event) => runOnJS(emit)(event.x))
    .onUpdate((event) => runOnJS(emit)(event.x));

  const ratio = max > min ? Math.max(0, Math.min((value - min) / (max - min), 1)) : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{format ? format(value) : String(value)}</Text>
      </View>

      <GestureDetector gesture={gesture}>
        {/* Полоса тонкая, зона нажатия должна быть удобной — отсюда паддинг. */}
        <View style={styles.hitArea} onLayout={onLayout}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
          </View>
          <View style={[styles.knob, { left: `${ratio * 100}%` }]} />
        </View>
      </GestureDetector>
    </View>
  );
});

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: { gap: 2 },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { ...t.type.meta, color: t.colors.textDim },
    value: { ...t.type.meta, color: t.colors.text, fontVariant: ['tabular-nums'] },
    hitArea: { paddingVertical: t.spacing.sm, justifyContent: 'center' },
    track: { height: 3, backgroundColor: t.colors.border, borderRadius: t.radius.chip ? 2 : 0 },
    fill: { height: 3, backgroundColor: t.colors.accent, borderRadius: t.radius.chip ? 2 : 0 },
    knob: {
      position: 'absolute',
      width: 16,
      height: 16,
      // В пиксельной теме ползунок квадратный — как и всё остальное.
      borderRadius: t.components.playButton === 'square' ? 0 : 8,
      backgroundColor: t.colors.accent,
      marginLeft: -8,
    },
  });
