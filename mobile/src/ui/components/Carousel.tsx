import { memo, useCallback } from 'react';
import { FlatList, type ListRenderItemInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { Thumb } from './Thumb';
import { useTheme, useThemedStyles, type Theme } from '../theme';
import type { Track } from '../../api/types';

/**
 * Горизонтальная карусель карточек — основной приём главной страницы:
 * крупный квадрат обложки, под ним название и исполнитель.
 */

interface CarouselProps {
  title: string;
  tracks: readonly Track[];
  onPressTrack: (tracks: readonly Track[], index: number) => void;
}

export const Carousel = memo(function Carousel({ title, tracks, onPressTrack }: CarouselProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Track>) => (
      <Card track={item} onPress={() => onPressTrack(tracks, index)} />
    ),
    [tracks, onPressTrack],
  );

  const keyExtractor = useCallback((item: Track) => item.id, []);

  // Размеры карточек фиксированы — подсказываем списку, чтобы он не измерял
  // каждый элемент при скролле.
  const itemWidth = theme.layout.cardWidth + theme.spacing.md;
  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: itemWidth,
      offset: itemWidth * index,
      index,
    }),
    [itemWidth],
  );

  if (tracks.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      <FlatList
        data={tracks as Track[]}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        removeClippedSubviews
      />
    </View>
  );
});

const Card = memo(function Card({ track, onPress }: { track: Track; onPress: () => void }) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <Thumb
        uri={track.artwork}
        seed={track.title}
        size={theme.layout.cardWidth}
        rounded={theme.components.thumb === 'square' ? 0 : theme.radius.card}
      />
      <Text numberOfLines={2} style={styles.cardTitle}>
        {track.title}
      </Text>
      <Text numberOfLines={1} style={styles.cardMeta}>
        {track.author}
      </Text>
    </Pressable>
  );
});

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    section: { gap: t.spacing.md },
    title: { ...t.type.section, color: t.colors.text, paddingHorizontal: t.layout.screenPadding },
    list: { paddingHorizontal: t.layout.screenPadding, gap: t.spacing.md },
    card: { width: t.layout.cardWidth, gap: t.spacing.xs },
    cardTitle: { ...t.type.trackTitle, color: t.colors.text, marginTop: t.spacing.xs },
    cardMeta: { ...t.type.meta, color: t.colors.textDim },
  });
