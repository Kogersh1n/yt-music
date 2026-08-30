import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Thumb } from './Thumb';
import { SwipeableRow } from './SwipeableRow';
import { useTheme, useThemedStyles, formatDuration, type Theme } from '../theme';
import { useIsLiked, toggleLike } from '../../local/likes';
import { useQueue } from '../../player/queueStore';
import { tapMedium, notifySuccess } from '../haptics';
import type { Track } from '../../api/types';

/**
 * Строка трека — основная единица интерфейса.
 *
 * Мемоизирована, обработчики стабильны: в медиатеке таких строк сотни,
 * и каждая лишняя перерисовка видна на скролле. Стили пересобираются
 * только при смене темы.
 */

interface TrackRowProps {
  track: Track;
  index: number;
  /** Подсветка играющего трека. */
  isActive?: boolean;
  onPress: (index: number) => void;
  onMenu?: (track: Track) => void;
  /**
   * Смахивание. Выключается там, где оно мешает: в очереди строку тянут
   * для переупорядочивания, а не для лайка.
   */
  swipeable?: boolean;
}

export const TrackRow = memo(function TrackRow({
  track,
  index,
  isActive = false,
  onPress,
  onMenu,
  swipeable = true,
}: TrackRowProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const liked = useIsLiked(track.id);
  const addToQueue = useQueue((state) => state.addToQueue);

  const handlePress = useCallback(() => onPress(index), [onPress, index]);
  const handleMenu = useCallback(() => onMenu?.(track), [onMenu, track]);

  const handleLike = useCallback(() => {
    toggleLike(track.id);
    tapMedium();
  }, [track.id]);

  const handleQueue = useCallback(() => {
    addToQueue(track);
    notifySuccess();
  }, [addToQueue, track]);

  const row = (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      android_ripple={{ color: 'rgba(128,128,128,0.16)' }}
    >
      <Thumb uri={track.artwork} seed={track.title} size={theme.layout.rowThumb} />

      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.title, isActive && styles.activeTitle]}>
          {track.title}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {track.author}
          {track.duration > 0 ? ` • ${formatDuration(track.duration)}` : ''}
        </Text>
      </View>

      {/* Отметка лайка — чтобы результат смахивания был виден на месте. */}
      {liked ? (
        <MaterialIcons name="favorite" size={16} color={theme.colors.brand} />
      ) : null}

      {onMenu ? (
        <Pressable
          onPress={handleMenu}
          hitSlop={12}
          style={styles.menu}
          android_ripple={{ color: 'rgba(128,128,128,0.24)', borderless: true, radius: 20 }}
        >
          <MaterialIcons name="more-vert" size={20} color={theme.colors.textFaint} />
        </Pressable>
      ) : null}
    </Pressable>
  );

  if (!swipeable) return row;

  return (
    <SwipeableRow
      onSwipeRight={{
        icon: liked ? 'heart-broken' : 'favorite',
        label: liked ? 'Убрать' : 'Нравится',
        run: handleLike,
      }}
      onSwipeLeft={{ icon: 'queue-music', label: 'В очередь', run: handleQueue }}
    >
      {row}
    </SwipeableRow>
  );
});

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: t.layout.screenPadding,
      // Высота строки задаётся плотностью темы.
      minHeight: t.layout.rowHeight,
      paddingVertical: t.spacing.sm,
      gap: t.spacing.md,
    },
    pressed: { backgroundColor: t.colors.surface },
    text: { flex: 1, gap: 2 },
    title: { ...t.type.trackTitle, color: t.colors.text },
    activeTitle: { color: t.colors.brand },
    meta: { ...t.type.meta, color: t.colors.textDim },
    menu: { width: 32, alignItems: 'center', justifyContent: 'center' },
  });
