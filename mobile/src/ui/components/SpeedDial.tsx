import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { PressableScale } from './PressableScale';
import { useTheme, useThemedStyles, type Theme } from '../theme';
import { displayTitle } from '../../api/songText';
import { TILES_PER_PAGE } from '../../features/speedDial';
import { useCurrentTrack } from '../../player/queueStore';
import { trackKey, type Track } from '../../api/types';

/**
 * Быстрый набор: сетка 3×3, листается страницами.
 *
 * Почему страницами, а не бесконечной лентой. В ленте взгляд ищет —
 * прокручивает, сравнивает, выбирает. В сетке из девяти он узнаёт:
 * плитка всегда на одном и том же месте, и через неделю рука тянется
 * туда не глядя. Ради этого приёма блок и существует, поэтому порядок
 * здесь должен быть устойчивым, а не «свежим».
 */

/** Отступы и зазоры заданы здесь, потому что от них считается размер плитки. */
const GAP = 8;

interface SpeedDialProps {
  tracks: readonly Track[];
  onPressTrack: (tracks: readonly Track[], index: number) => void;
}

export const SpeedDial = memo(function SpeedDial({ tracks, onPressTrack }: SpeedDialProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [page, setPage] = useState(0);

  const width = Dimensions.get('window').width;
  const pad = theme.layout.screenPadding;
  const tile = Math.floor((width - pad * 2 - GAP * 2) / 3);

  // Свежий список держим в ref: иначе обработчик меняется на каждый
  // рендер и тянет за собой перерисовку всех плиток.
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  const handlePress = useCallback(
    (index: number) => onPressTrack(tracksRef.current, index),
    [onPressTrack],
  );

  /** Режем на страницы по девять — каждая страница шириной в экран. */
  const pages = useMemo(() => {
    const out: { items: Track[]; from: number }[] = [];
    for (let i = 0; i < tracks.length; i += TILES_PER_PAGE) {
      out.push({ items: tracks.slice(i, i + TILES_PER_PAGE), from: i });
    }
    return out;
  }, [tracks]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      setPage((prev) => (prev === next ? prev : next));
    },
    [width],
  );

  const renderPage = useCallback(
    ({ item }: { item: { items: Track[]; from: number } }) => (
      <View style={[styles.page, { width, paddingHorizontal: pad }]}>
        {item.items.map((track, offset) => (
          <Tile
            key={track.id}
            track={track}
            size={tile}
            index={item.from + offset}
            onPress={handlePress}
          />
        ))}
      </View>
    ),
    [styles.page, width, pad, tile, handlePress],
  );

  if (tracks.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text style={styles.title}>Быстрый набор</Text>
        <Text style={styles.subtitle}>То, к чему вы возвращаетесь чаще всего</Text>
      </View>

      <FlatList
        data={pages}
        renderItem={renderPage}
        keyExtractor={(item) => String(item.from)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={64}
        // Размер страницы фиксирован — списку незачем измерять каждую.
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      />

      {pages.length > 1 ? (
        <View style={styles.dots}>
          {pages.map((item, index) => (
            <View
              key={item.from}
              style={[styles.dot, index === page ? styles.dotOn : styles.dotOff]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
});

/**
 * Плитка: обложка и название поверх неё.
 *
 * Название кладётся на затемнение внизу, а не под обложкой: так плитки
 * одинаковой высоты независимо от длины названия, и сетка не разъезжается.
 */
const Tile = memo(function Tile({
  track,
  size,
  index,
  onPress,
}: {
  track: Track;
  size: number;
  index: number;
  onPress: (index: number) => void;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const current = useCurrentTrack();

  const playing = current !== null && trackKey(current) === trackKey(track);
  const handlePress = useCallback(() => onPress(index), [onPress, index]);

  const parsed = useMemo(() => displayTitle(track.title), [track.title]);

  return (
    <PressableScale
      onPress={handlePress}
      depth={0.95}
      style={[
        styles.tile,
        { width: size, height: size },
        playing && { borderColor: theme.colors.brand, borderWidth: 2 },
      ]}
    >
      <Text style={[styles.tileLetter, { fontSize: size * 0.3 }]}>
        {parsed.title.slice(0, 1).toUpperCase()}
      </Text>

      {track.artwork ? (
        <Image
          source={{ uri: track.artwork }}
          style={StyleSheet.absoluteFill}
          cachePolicy="memory-disk"
          recyclingKey={track.artwork}
          contentFit="cover"
          transition={theme.motion.scale === 0 ? 0 : Math.round(150 * theme.motion.scale)}
        />
      ) : null}

      <View style={styles.tileShade} />
      <Text numberOfLines={1} style={styles.tileTitle}>
        {parsed.title}
      </Text>
    </PressableScale>
  );
});

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    section: { gap: t.spacing.sm },
    heading: { paddingHorizontal: t.layout.screenPadding, gap: 1 },
    title: { ...t.type.section, color: t.colors.text },
    subtitle: { ...t.type.meta, color: t.colors.textDim },

    page: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },

    tile: {
      borderRadius: t.radius.thumb,
      overflow: 'hidden',
      backgroundColor: t.colors.surfaceHigh,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Буква под обложкой: у части роликов картинки нет, и плитка
    // не должна становиться пустым квадратом.
    tileLetter: { color: t.colors.textFaint, fontWeight: '700' },
    tileShade: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      top: '55%',
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    tileTitle: {
      ...t.type.meta,
      color: '#fff',
      fontWeight: '600',
      position: 'absolute',
      left: 6,
      right: 6,
      bottom: 6,
    },

    dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 2 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    dotOn: { backgroundColor: t.colors.text },
    dotOff: { backgroundColor: t.colors.border },
  });
