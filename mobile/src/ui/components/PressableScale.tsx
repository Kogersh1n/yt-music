import { memo, useCallback } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type WithTimingConfig,
} from 'react-native-reanimated';
import { useTheme } from '../theme';

/**
 * Нажатие с отдачей: элемент чуть проседает под пальцем и возвращается.
 *
 * Зачем. Между касанием и тем, что от него происходит, почти всегда есть
 * задержка — запрос ссылки, переход на другой экран. Всё это время экран
 * выглядит замершим, и нажатие хочется повторить. Подсветка (ripple)
 * отвечает на касание, но она плоская и на тёмном фоне почти не читается.
 * Изменение размера видно всегда и мгновенно.
 *
 * Почему reanimated, а не Animated из React Native. Анимация живёт целиком
 * в UI-потоке: пока JS занят разбором ответа поиска, она всё равно идёт
 * гладко. Именно ради этого случая она и нужна — в спокойный момент
 * разницы не было бы.
 *
 * Тема вправе это отключить: пиксельным темам плавность противопоказана,
 * и motion.scale = 0 убирает анимацию целиком, а не ускоряет её.
 */

/** Насколько проседает. Меньше — незаметно, больше — похоже на дрожь. */
const PRESSED = 0.97;

/** Вниз быстрее, чем вверх: так нажатие ощущается отзывчивым, а отпускание мягким. */
const DOWN_MS = 90;
const UP_MS = 160;

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Своя глубина проседания — крупным карточкам идёт меньшая. */
  depth?: number;
}

export const PressableScale = memo(function PressableScale({
  style,
  depth = PRESSED,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const theme = useTheme();
  const motion = theme.motion.scale;
  const scale = useSharedValue(1);

  const timing = useCallback(
    (duration: number): WithTimingConfig => ({ duration: Math.round(duration * motion) }),
    [motion],
  );

  const handleIn = useCallback(
    (event: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) => {
      // При motion.scale = 0 withTiming с нулевой длительностью ставит
      // значение сразу — отдельная ветка не нужна, но и проседать тогда
      // незачем: тема просила без анимации вовсе.
      if (motion > 0) scale.value = withTiming(depth, timing(DOWN_MS));
      onPressIn?.(event);
    },
    [motion, depth, scale, timing, onPressIn],
  );

  const handleOut = useCallback(
    (event: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) => {
      if (motion > 0) scale.value = withTiming(1, timing(UP_MS));
      onPressOut?.(event);
    },
    [motion, scale, timing, onPressOut],
  );

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animated}>
      <Pressable style={style} onPressIn={handleIn} onPressOut={handleOut} {...rest} />
    </Animated.View>
  );
});
