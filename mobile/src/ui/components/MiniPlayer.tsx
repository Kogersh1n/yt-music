import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useProgress } from 'react-native-track-player';
import { Thumb } from './Thumb';
import { useTheme, useThemedStyles, type Theme } from '../theme';
import { useCurrentTrack } from '../../player/queueStore';
import { usePlayback } from '../../player/usePlayback';

/**
 * Мини-плеер — плашка, приклеенная над нижней навигацией. Не исчезает при
 * переходах между вкладками, по нажатию раскрывается в полноэкранный плеер.
 */
export const MiniPlayer = memo(function MiniPlayer() {
  const track = useCurrentTrack();
  const router = useRouter();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { isPlaying, isBuffering, toggle, next } = usePlayback();

  if (!track) return null;

  return (
    <View style={styles.wrapper}>
      <ProgressLine />

      <Pressable
        style={styles.bar}
        onPress={() => router.push('/player')}
        android_ripple={{ color: 'rgba(128,128,128,0.14)' }}
      >
        <Thumb uri={track.artwork} seed={track.title} size={40} />

        <View style={styles.text}>
          <Text numberOfLines={1} style={styles.title}>
            {track.title}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {track.author}
          </Text>
        </View>

        <Pressable onPress={toggle} hitSlop={10} style={styles.control}>
          <MaterialIcons
            name={isBuffering ? 'hourglass-empty' : isPlaying ? 'pause' : 'play-arrow'}
            size={26}
            color={theme.colors.text}
          />
        </Pressable>

        <Pressable onPress={() => void next()} hitSlop={10} style={styles.control}>
          <MaterialIcons name="skip-next" size={26} color={theme.colors.text} />
        </Pressable>
      </Pressable>
    </View>
  );
});

/** Сколько сегментов рисовать, когда тема просит ступенчатый прогресс. */
const SEGMENTS = 24;

/**
 * Полоска прогресса поверх плашки.
 *
 * Отдельный компонент намеренно: useProgress() обновляется раз в секунду,
 * и перерисовываться должна только полоска, а не весь мини-плеер с обложкой
 * и текстом.
 */
const ProgressLine = memo(function ProgressLine() {
  const { position, duration } = useProgress(1000);
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const ratio = duration > 0 ? Math.min(position / duration, 1) : 0;

  // Ступенчатый вариант: прогресс дискретен, как в пиксельных интерфейсах.
  if (theme.components.progress === 'stepped') {
    const filled = Math.round(ratio * SEGMENTS);
    return (
      <View style={styles.progressStepped}>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <View
            key={i}
            style={[styles.segment, i < filled ? styles.segmentOn : styles.segmentOff]}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
    </View>
  );
});

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrapper: {
      backgroundColor: t.colors.player,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    progressTrack: { height: 2, backgroundColor: t.colors.border },
    progressFill: { height: 2, backgroundColor: t.colors.text },
    progressStepped: { height: 3, flexDirection: 'row', gap: 2 },
    segment: { flex: 1, height: 3 },
    segmentOn: { backgroundColor: t.colors.text },
    segmentOff: { backgroundColor: t.colors.border },
    bar: {
      height: t.layout.miniPlayerHeight,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: t.spacing.md,
      gap: t.spacing.md,
    },
    text: { flex: 1, gap: 1 },
    title: { ...t.type.trackTitle, color: t.colors.text },
    meta: { ...t.type.meta, color: t.colors.textDim },
    control: { width: 40, alignItems: 'center', justifyContent: 'center' },
  });
