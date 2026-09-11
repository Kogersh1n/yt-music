import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useIsPlaying } from 'react-native-track-player';
import { useTheme, useThemedStyles, type Theme } from '../theme';

/**
 * Отметка играющего трека — три столбика эквалайзера.
 *
 * Зачем форма, а не цвет. Активную строку помечал только красный текст,
 * и это плохо дважды: при беглом взгляде цвет теряется, а в теме `brand`
 * и `danger` — одно и то же значение, то есть «играет сейчас» выглядело
 * так же, как «удалить».
 *
 * Столбики двигаются, только пока идёт звук: на паузе они замирают,
 * и это само по себе сообщает состояние, не занимая места под ещё один
 * значок.
 */

const BARS = [
  { min: 0.35, max: 1, duration: 520 },
  { min: 0.55, max: 0.75, duration: 380 },
  { min: 0.25, max: 0.9, duration: 620 },
];

export const NowPlayingMark = memo(function NowPlayingMark() {
  const styles = useThemedStyles(makeStyles);
  const { playing } = useIsPlaying();
  const isPlaying = playing === true;

  return (
    <View style={styles.wrap} accessibilityLabel={isPlaying ? 'Играет' : 'На паузе'}>
      {BARS.map((bar, index) => (
        <Bar key={index} {...bar} playing={isPlaying} />
      ))}
    </View>
  );
});

function Bar({
  min,
  max,
  duration,
  playing,
}: {
  min: number;
  max: number;
  duration: number;
  playing: boolean;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const scale = useSharedValue(min);

  useEffect(() => {
    if (!playing || theme.motion.scale === 0) {
      cancelAnimation(scale);
      // На паузе столбики замирают на средней высоте: так видно,
      // что трек выбран, но звука нет.
      scale.value = withTiming((min + max) / 2, { duration: 160 });
      return;
    }

    scale.value = withRepeat(
      withTiming(max, {
        duration: Math.round(duration * theme.motion.scale),
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );

    return () => cancelAnimation(scale);
  }, [playing, min, max, duration, scale, theme.motion.scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.value }] }));

  return <Animated.View style={[styles.bar, style]} />;
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      height: 14,
      width: 14,
    },
    bar: {
      flex: 1,
      height: 14,
      borderRadius: 1,
      backgroundColor: t.colors.brand,
    },
  });
