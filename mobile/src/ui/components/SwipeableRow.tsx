import { memo, useCallback, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme, useThemedStyles, type Theme } from '../theme';

/**
 * Строка со смахиванием.
 *
 * Действие срабатывает по отпусканию за порогом, а не по его пересечению:
 * так его можно передумать, вернув палец назад. Пока тянут, из-под строки
 * проступает подложка с иконкой — видно, что произойдёт.
 */

interface SwipeableRowProps {
  children: ReactNode;
  /** Смахивание вправо. Обычно — лайк. */
  onSwipeRight?: { icon: React.ComponentProps<typeof MaterialIcons>['name']; label: string; run: () => void };
  /** Смахивание влево. Обычно — «в очередь». */
  onSwipeLeft?: { icon: React.ComponentProps<typeof MaterialIcons>['name']; label: string; run: () => void };
}

/** За сколько пикселей смещения действие считается подтверждённым. */
const THRESHOLD = 96;
/** Дальше строка не тянется — чтобы не открывать пустоту. */
const MAX_TRAVEL = 130;

export const SwipeableRow = memo(function SwipeableRow({
  children,
  onSwipeRight,
  onSwipeLeft,
}: SwipeableRowProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const offset = useSharedValue(0);

  const settle = useCallback(
    (finalOffset: number) => {
      if (finalOffset > THRESHOLD) onSwipeRight?.run();
      else if (finalOffset < -THRESHOLD) onSwipeLeft?.run();
    },
    [onSwipeRight, onSwipeLeft],
  );

  const gesture = Gesture.Pan()
    // Горизонтальная активация: иначе жест перехватывал бы вертикальный скролл.
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      const allowed =
        (event.translationX > 0 && onSwipeRight) || (event.translationX < 0 && onSwipeLeft);
      if (!allowed) return;
      offset.value = Math.max(-MAX_TRAVEL, Math.min(event.translationX, MAX_TRAVEL));
    })
    .onEnd(() => {
      runOnJS(settle)(offset.value);
      // Возврат мгновенный, если тема отключила анимации.
      offset.value =
        theme.motion.scale === 0 ? 0 : withTiming(0, { duration: 180 * theme.motion.scale });
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  // Подложка проявляется по мере вытягивания — до порога бледная, за ним яркая.
  const rightStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offset.value, [0, THRESHOLD], [0, 1], 'clamp'),
  }));
  const leftStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offset.value, [0, -THRESHOLD], [0, 1], 'clamp'),
  }));

  return (
    <View style={styles.wrap}>
      {onSwipeRight ? (
        <Animated.View style={[styles.action, styles.actionLeftSide, rightStyle]}>
          <MaterialIcons name={onSwipeRight.icon} size={20} color={theme.colors.onAccent} />
          <Text style={styles.actionLabel}>{onSwipeRight.label}</Text>
        </Animated.View>
      ) : null}

      {onSwipeLeft ? (
        <Animated.View style={[styles.action, styles.actionRightSide, leftStyle]}>
          <MaterialIcons name={onSwipeLeft.icon} size={20} color={theme.colors.onAccent} />
          <Text style={styles.actionLabel}>{onSwipeLeft.label}</Text>
        </Animated.View>
      ) : null}

      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.row, rowStyle]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
});

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: { position: 'relative' },
    // Строка непрозрачна — иначе подложка просвечивала бы сквозь неё.
    row: { backgroundColor: t.colors.bg },
    action: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.xl,
      backgroundColor: t.colors.accent,
    },
    actionLeftSide: { justifyContent: 'flex-start' },
    actionRightSide: { justifyContent: 'flex-end' },
    actionLabel: { ...t.type.meta, color: t.colors.onAccent, fontWeight: '600' },
  });
