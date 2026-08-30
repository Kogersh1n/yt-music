import { useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Gradient } from '../src/ui/components/Gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Thumb } from '../src/ui/components/Thumb';
import { Glow } from '../src/ui/components/Glow';
import { FormatBadge } from '../src/ui/components/FormatBadge';
import { Scrubber } from '../src/ui/components/Scrubber';
import { useTrackFormat } from '../src/features/useTrackFormat';
import { EmptyState } from '../src/ui/components/states';
import { artworkGradient, artworkGlow } from '../src/ui/artworkColor';
import { peekDominantColor, resolveDominantColor } from '../src/ui/dominantColor';
import { useTheme, useThemedStyles, type Theme } from '../src/ui/theme';
import { useCurrentTrack, useQueue } from '../src/player/queueStore';
import { usePlayback } from '../src/player/usePlayback';
import { useIsLiked, toggleLike } from '../src/local/likes';

/**
 * «Сейчас играет» — полноэкранный плеер.
 *
 * Фон — градиент, выведенный из трека: это то, что сильнее всего делает экран
 * похожим на YT Music, где подложка подбирается под обложку.
 */
export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const track = useCurrentTrack();

  const { isPlaying, isBuffering, toggle, next, previous } = usePlayback();
  const repeat = useQueue((state) => state.repeat);
  const shuffle = useQueue((state) => state.shuffle);
  const cycleRepeat = useQueue((state) => state.cycleRepeat);
  const toggleShuffle = useQueue((state) => state.toggleShuffle);
  const error = useQueue((state) => state.error);

  const liked = useIsLiked(track?.id ?? '');
  const format = useTrackFormat(track);

  // Цвет обложки считается асинхронно. До ответа берётся уже известный
  // (из кэша) — тогда при возврате на экран свечение не мигает.
  const [dominant, setDominant] = useState<string | null>(() =>
    peekDominantColor(track?.artwork ?? null),
  );

  useEffect(() => {
    let cancelled = false;
    const uri = track?.artwork ?? null;

    setDominant(peekDominantColor(uri));
    void resolveDominantColor(uri).then((color) => {
      if (!cancelled) setDominant(color);
    });

    return () => {
      cancelled = true;
    };
  }, [track?.artwork]);

  const seed = track ? track.id + track.title : 'empty';

  const gradient = useMemo(
    () => artworkGradient(seed, theme.mode, theme.colors.bg, dominant),
    [seed, theme.mode, theme.colors.bg, dominant],
  );

  const glowColor = useMemo(
    () => artworkGlow(seed, theme.mode, dominant),
    [seed, theme.mode, dominant],
  );

  // Обложка — квадрат по ширине экрана с полями, но не выше, чем позволяет
  // высота: на узких и низких экранах иначе уезжают элементы управления.
  const artSize = useMemo(() => {
    const { width, height } = Dimensions.get('window');
    return Math.min(width - theme.spacing.xl * 2, height * 0.42);
  }, [theme.spacing.xl]);

  if (!track) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Ничего не играет" hint="Выберите трек в медиатеке." />
      </View>
    );
  }

  return (
    <Gradient colors={gradient} locations={GRADIENT_STOPS} style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerButton}>
          <MaterialIcons name="keyboard-arrow-down" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerLabel}>Сейчас играет</Text>
        <Pressable onPress={() => router.push('/queue')} hitSlop={12} style={styles.headerButton}>
          <MaterialIcons name="queue-music" size={24} color={theme.colors.text} />
        </Pressable>
      </View>

      <View style={styles.art}>
        <Glow color={glowColor} size={artSize} />
        <Thumb
          uri={track.artwork}
          seed={track.title}
          size={artSize}
          rounded={theme.components.thumb === 'square' ? 0 : theme.radius.card}
        />
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + theme.spacing.xl }]}>
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Text numberOfLines={1} style={styles.title}>
              {track.title}
            </Text>
            <View style={styles.authorRow}>
              <Text numberOfLines={1} style={styles.author}>
                {track.author}
              </Text>
              <FormatBadge format={format} />
            </View>
          </View>

          <Pressable onPress={() => toggleLike(track.id)} hitSlop={12} style={styles.like}>
            <MaterialIcons
              name={liked ? 'favorite' : 'favorite-border'}
              size={24}
              color={liked ? theme.colors.brand : theme.colors.text}
            />
          </Pressable>
        </View>

        <Scrubber />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.controls}>
          <Pressable onPress={() => void toggleShuffle()} hitSlop={12}>
            <MaterialIcons
              name="shuffle"
              size={22}
              color={shuffle ? theme.colors.text : theme.colors.textFaint}
            />
          </Pressable>

          <Pressable onPress={() => void previous()} hitSlop={12}>
            <MaterialIcons name="skip-previous" size={40} color={theme.colors.text} />
          </Pressable>

          <Pressable onPress={() => void toggle()} style={styles.playButton}>
            <MaterialIcons
              name={isBuffering ? 'hourglass-empty' : isPlaying ? 'pause' : 'play-arrow'}
              size={36}
              color={theme.colors.onAccent}
            />
          </Pressable>

          <Pressable onPress={() => void next()} hitSlop={12}>
            <MaterialIcons name="skip-next" size={40} color={theme.colors.text} />
          </Pressable>

          {/* Повтор одного трека — та же иконка с цифрой, как в системных плеерах. */}
          <Pressable onPress={() => void cycleRepeat()} hitSlop={12}>
            <MaterialIcons
              name={repeat === 'one' ? 'repeat-one' : 'repeat'}
              size={22}
              color={repeat !== 'off' ? theme.colors.text : theme.colors.textFaint}
            />
          </Pressable>
        </View>
      </View>
    </Gradient>
  );
}

/** Цветная часть держится в верхних 55% — ниже фон уходит в чёрный,
 *  чтобы элементы управления не спорили с подложкой. */
const GRADIENT_STOPS = [0, 0.55, 1] as const;

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: t.spacing.lg,
    },
    headerButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerLabel: { ...t.type.meta, fontSize: 11, color: t.colors.text, letterSpacing: 1 },
    art: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    bottom: { paddingHorizontal: t.spacing.xl, gap: t.spacing.sm },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
    titleText: { flex: 1, gap: 2 },
    title: { ...t.type.title, fontSize: t.type.title.fontSize - 2, color: t.colors.text },
    authorRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    author: { ...t.type.body, color: t.colors.textDim, flexShrink: 1 },
    like: { width: 36, alignItems: 'center' },
    error: { ...t.type.meta, color: t.colors.danger, textAlign: 'center' },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: t.spacing.md,
    },
    playButton: {
      width: 64,
      height: 64,
      // Форма кнопки — из темы: круг, квадрат или пилюля.
      borderRadius:
        t.components.playButton === 'square' ? 0 : t.components.playButton === 'pill' ? 16 : 32,
      backgroundColor: t.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
