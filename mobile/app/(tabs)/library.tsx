import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Chip } from '../../src/ui/components/Chip';
import { TrackRow } from '../../src/ui/components/TrackRow';
import { EmptyState, ErrorState, TrackListSkeleton } from '../../src/ui/components/states';
import { useTheme, useThemedStyles, type Theme } from '../../src/ui/theme';
import { useLibrary, useLibraryFilter } from '../../src/features/useLibrary';
import { useLikedIds, toggleLike } from '../../src/local/likes';
import { trackKey } from '../../src/api/types';
import { usePlayback } from '../../src/player/usePlayback';
import type { Track } from '../../src/api/types';

type Filter = 'all' | 'liked' | 'downloaded';

/** Вынесен из компонента: иначе новая функция на каждый рендер списка. */
const keyExtractor = (item: Track) => item.id;

/**
 * Медиатека. Длинный список, поэтому FlashList: строки переиспользуются,
 * и скролл по сотням треков не проседает.
 */
export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const {
    tracks,
    isLoading,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useLibrary();

  const likedIds = useLikedIds();
  const { play } = usePlayback();

  /**
   * Фильтр «Понравившиеся» работает по локальным лайкам.
   *
   * Серверный `liked` — это общий счётчик по всем пользователям, а не «мой
   * лайк»: фильтровать по нему бессмысленно. Когда на бэкенде появятся
   * персональные лайки, сюда встанет отдельный запрос вместо фильтрации.
   */
  const byFilter = useMemo(() => {
    if (filter === 'liked') {
      const set = new Set(likedIds);
      return tracks.filter((track) => set.has(track.id));
    }
    if (filter === 'downloaded') return [];
    return tracks;
  }, [filter, tracks, likedIds]);

  // Фильтрация локальная и мгновенная — сеть не трогаем, дебаунс не нужен.
  const visible = useLibraryFilter(query, byFilter);

  // Отфильтрованный список держим в ref, а не в замыкании обработчика.
  //
  // Пока handlePress зависел от visible, он пересоздавался на каждое нажатие
  // клавиши в поиске, за ним пересоздавался renderItem, а FlashList на смену
  // renderItem перерисовывает все видимые строки. Теперь обработчик стабилен,
  // и при вводе перерисовывается только то, что реально изменилось.
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const handlePress = useCallback((index: number) => play(visibleRef.current, index), [play]);

  const handleMenu = useCallback((track: Track) => toggleLike(trackKey(track)), []);

  const renderItem = useCallback(
    ({ item, index }: { item: Track; index: number }) => (
      <TrackRow track={item} index={index} onPress={handlePress} onMenu={handleMenu} />
    ),
    [handlePress, handleMenu],
  );

  const handleEndReached = useCallback(() => {
    // Подгружаем следующую страницу заранее, а не когда список уже кончился.
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + theme.spacing.md }]}>
      <Text style={styles.title}>Медиатека</Text>

      <View style={styles.searchWrap}>
        <MaterialIcons name="search" size={20} color={theme.colors.textDim} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск по медиатеке"
          placeholderTextColor={theme.colors.textFaint}
          style={styles.searchInput}
          autoCorrect={false}
          selectionColor={theme.colors.brand}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <MaterialIcons name="close" size={18} color={theme.colors.textDim} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.chips}>
        <Chip label="Все треки" active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip
          label="Понравившиеся"
          active={filter === 'liked'}
          onPress={() => setFilter('liked')}
        />
        <Chip
          label="Скачанное"
          active={filter === 'downloaded'}
          onPress={() => setFilter('downloaded')}
        />
      </View>

      {isLoading ? (
        <TrackListSkeleton rows={10} />
      ) : error && tracks.length === 0 ? (
        <ErrorState message={error.message} onRetry={() => void refetch()} />
      ) : visible.length === 0 ? (
        query.trim() ? (
          <EmptyState
            icon="⌕"
            title="Ничего не найдено"
            hint={`По запросу «${query.trim()}» в загруженной части медиатеки пусто.`}
          />
        ) : (
          <EmptyBody filter={filter} />
        )
      ) : (
        <FlashList
          data={visible as Track[]}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.6}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={theme.colors.text}
              colors={[theme.colors.text]}
              progressBackgroundColor={theme.colors.surface}
            />
          }
          ListFooterComponent={
            isFetchingNextPage ? <TrackListSkeleton rows={2} /> : <View style={styles.footer} />
          }
        />
      )}
    </View>
  );
}

function EmptyBody({ filter }: { filter: Filter }) {
  if (filter === 'liked') {
    return (
      <EmptyState
        icon="♡"
        title="Пока ничего не понравилось"
        hint="Нажмите «⋮» у трека, чтобы добавить его сюда."
      />
    );
  }
  if (filter === 'downloaded') {
    return (
      <EmptyState
        icon="↓"
        title="Загрузок пока нет"
        hint="Офлайн-режим ещё не подключён — треки играют по сети."
      />
    );
  }
  return (
    <EmptyState
      title="Медиатека пуста"
      hint="Добавьте трек через «Обзор» → YouTube."
    />
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    title: { ...t.type.title, color: t.colors.text, paddingHorizontal: t.layout.screenPadding },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      marginHorizontal: t.layout.screenPadding,
      marginTop: t.spacing.md,
      paddingHorizontal: t.spacing.md,
      height: 42,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.chip,
    },
    searchInput: { flex: 1, color: t.colors.text, fontSize: t.type.body.fontSize, padding: 0 },
    chips: {
      flexDirection: 'row',
      gap: t.spacing.sm,
      paddingHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.md,
    },
    list: { paddingBottom: t.spacing.xxl },
    footer: { height: t.spacing.xxl },
  });
