import { memo, useCallback, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import TrackPlayer, { useProgress } from 'react-native-track-player';
import { runOnJS } from 'react-native-reanimated';
import { useTheme, useThemedStyles, formatDuration, type Theme } from '../theme';
import { tapLight } from '../haptics';

/**
 * Полоса перемотки.
 *
 * Отдельный компонент, потому что useProgress() обновляется раз в секунду:
 * перерисовываться должна только полоса, а не весь экран плеера с обложкой.
 * Во время перетаскивания показываем позицию пальца, а не позицию плеера —
 * иначе ползунок дёргается назад между обновлениями.
 */

const SEGMENTS = 32;

export const Scrubber = memo(function Scrubber() {
  const { position, duration } = useProgress(1000);
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [width, setWidth] = useState(0);
  const [dragRatio, setDragRatio] = useState<number | null>(null);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width),
    [],
  );

  const clamp = useCallback(
    (x: number) => (width > 0 ? Math.max(0, Math.min(x / width, 1)) : 0),
    [width],
  );

  const drag = useCallback((x: number) => setDragRatio(clamp(x)), [clamp]);

  const seekTo = useCallback(
    (x: number) => {
      // Отклик на отпускании, а не на каждом движении: иначе вибрация
      // не смолкает всё время перетаскивания.
      tapLight();
      if (duration > 0) void TrackPlayer.seekTo(clamp(x) * duration);
      setDragRatio(null);
    },
    [clamp, duration],
  );

  // Колбэки жеста babel-плагин превращает в worklet'ы — они идут на UI-потоке.
  // Считать здесь ничего нельзя: clamp — обычная JS-функция, и синхронный
  // вызов её с UI-потока роняет приложение. Наружу уходит сырой event.x,
  // вся арифметика живёт на JS-стороне (так же сделано в Slider).
  const gesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((event) => runOnJS(drag)(event.x))
    .onUpdate((event) => runOnJS(drag)(event.x))
    .onEnd((event) => runOnJS(seekTo)(event.x));

  const playedRatio = duration > 0 ? Math.min(position / duration, 1) : 0;
  const ratio = dragRatio ?? playedRatio;
  const shownPosition = dragRatio !== null ? dragRatio * duration : position;

  const stepped = theme.components.progress === 'stepped';
  const filled = Math.round(ratio * SEGMENTS);

  return (
    <View style={styles.wrap}>
      <GestureDetector gesture={gesture}>
        {/* Полоса тонкая, а зона нажатия должна быть удобной — отсюда паддинг. */}
        <View style={styles.hitArea} onLayout={onLayout}>
          {stepped ? (
            <View style={styles.stepped}>
              {Array.from({ length: SEGMENTS }, (_, i) => (
                <View
                  key={i}
                  style={[styles.segment, i < filled ? styles.segmentOn : styles.segmentOff]}
                />
              ))}
            </View>
          ) : (
            <>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
              </View>
              <View style={[styles.knob, { left: `${ratio * 100}%` }]} />
            </>
          )}
        </View>
      </GestureDetector>

      <View style={styles.times}>
        <Text style={styles.time}>{formatDuration(shownPosition)}</Text>
        <Text style={styles.time}>{formatDuration(duration)}</Text>
      </View>
    </View>
  );
});

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: { gap: t.spacing.xs },
    hitArea: { paddingVertical: t.spacing.md, justifyContent: 'center' },
    track: { height: 3, backgroundColor: t.colors.border, borderRadius: 2 },
    fill: { height: 3, backgroundColor: t.colors.text, borderRadius: 2 },
    knob: {
      position: 'absolute',
      width: 12,
      height: 12,
      borderRadius: t.components.playButton === 'square' ? 0 : 6,
      backgroundColor: t.colors.text,
      marginLeft: -6,
    },
    stepped: { height: 6, flexDirection: 'row', gap: 2 },
    segment: { flex: 1, height: 6 },
    segmentOn: { backgroundColor: t.colors.text },
    segmentOff: { backgroundColor: t.colors.border },
    times: { flexDirection: 'row', justifyContent: 'space-between' },
    time: {
      ...t.type.meta,
      fontSize: 11,
      color: t.colors.textDim,
      fontVariant: ['tabular-nums'],
    },
  });
