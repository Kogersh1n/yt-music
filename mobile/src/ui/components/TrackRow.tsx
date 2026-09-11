import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Thumb } from './Thumb';
import { SwipeableRow } from './SwipeableRow';
import { NowPlayingMark } from './NowPlayingMark';
import { useTheme, useThemedStyles, formatDuration, type Theme } from '../theme';
import { useIsLiked, toggleLike } from '../../local/likes';
import { trackKey } from '../../api/types';
import { useQueue } from '../../player/queueStore';
import { tapMedium, notifySuccess } from '../haptics';
import type { Track } from '../../api/types';

/**
 * Строка трека — основная единица интерфейса.
 *
 * Мемоизирована, обработчики стабильны: в медиатеке таких строк сотни,
 * и каждая лишняя перерисовка видна на скролле. Стили пересобираются
 * только при смене темы.
 *
 * Подсветку играющего трека строка берёт подпиской, а не свойством.
 * Со свойством её приходилось вычислять в renderItem списка, renderItem
 * менялся при каждой смене трека, и вместе с ним перерисовывались все
 * строки разом. Селектор отдаёт булево, поэтому при переключении трека
 * обновляются ровно две строки: та, что погасла, и та, что зажглась.
 */

interface TrackRowProps {
  track: Track;
  index: number;
  onPress: (index: number) => void;
  /**
   * Режим выбора: строка не играет по нажатию, а отмечается.
   *
   * Undefined означает «выбора нет вовсе» — тогда галочка не рисуется
   * и место под неё не резервируется. Именно undefined, а не false:
   * false это «выбор идёт, но эта строка не отмечена».
   */
  selected?: boolean;
  onLongPress?: (track: Track) => void;
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
  onPress,
  onMenu,
  selected,
  onLongPress,
  swipeable = true,
}: TrackRowProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const liked = useIsLiked(trackKey(track));
  const addToQueue = useQueue((state) => state.addToQueue);
  const isActive = useQueue((state) => state.queue[state.index]?.id === track.id);


  const handlePress = useCallback(() => onPress(index), [onPress, index]);
  const handleLongPress = useCallback(() => onLongPress?.(track), [onLongPress, track]);
  const handleMenu = useCallback(() => onMenu?.(track), [onMenu, track]);

  const handleLike = useCallback(() => {
    toggleLike(track);
    tapMedium();
  }, [track]);

  const handleQueue = useCallback(() => {
    addToQueue(track);
    notifySuccess();
  }, [addToQueue, track]);

  const row = (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress ? handleLongPress : undefined}
      delayLongPress={350}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, selected && styles.selected]}
      android_ripple={{ color: 'rgba(128,128,128,0.16)' }}
    >
      {selected !== undefined ? (
        <MaterialIcons
          name={selected ? 'check-circle' : 'radio-button-unchecked'}
          size={20}
          color={selected ? theme.colors.brand : theme.colors.textFaint}
        />
      ) : null}

      <Thumb track={track} size={theme.layout.rowThumb} />

      {/* Форма, а не только цвет: красный в теме означает и «играет»,
          и «удалить», а при беглом взгляде цвет теряется вовсе. */}
      {isActive ? <NowPlayingMark /> : null}

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

  // В режиме выбора смахивание выключено: жест конфликтует с отметкой,
  // и лайк посреди набора списка — точно не то, чего ждут.
  if (!swipeable || selected !== undefined) return row;

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
    selected: { backgroundColor: t.colors.surfaceHigh },
    text: { flex: 1, gap: 2 },
    title: { ...t.type.trackTitle, color: t.colors.text },
    activeTitle: { color: t.colors.brand },
    meta: { ...t.type.meta, color: t.colors.textDim },
    menu: { width: 32, alignItems: 'center', justifyContent: 'center' },
  });
