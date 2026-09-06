import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TrackRow } from '../../src/ui/components/TrackRow';
import { EmptyState, ErrorState, TrackListSkeleton } from '../../src/ui/components/states';
import { useTheme, useThemedStyles, type Theme } from '../../src/ui/theme';
import { useLibrary, useYouTubeSearch } from '../../src/features/useLibrary';
import { useDebounced } from '../../src/features/useDebounced';
import { usePlayback } from '../../src/player/usePlayback';
import { importTrack, type ImportProgress } from '../../src/features/importTrack';
import type { Track } from '../../src/api/types';

/**
 * Что показывать на каждой стадии. Трек качается на телефон и оттуда же
 * уходит в хранилище, поэтому стадий четыре, а не одна.
 */
const STAGE_LABEL: Record<ImportProgress['stage'], string> = {
  extract: 'Ищем аудиодорожку…',
  download: 'Качаем трек на телефон…',
  upload: 'Загружаем в медиатеку…',
  save: 'Сохраняем…',
};

/**
 * Поиск по YouTube.
 *
 * Только по ютубу: поиск по своей медиатеке живёт на вкладке «Медиатека»,
 * рядом с самой медиатекой, и второй такой же здесь был лишним выбором
 * на каждом открытии экрана.
 *
 * Ввод дебаунсится, предыдущий запрос отменяется — иначе при быстром наборе
 * результаты «прыгают», как это происходит в вебе.
 */
/** Вынесен из компонента: иначе новая функция на каждый рендер. */
const keyExtractor = (item: Track) => item.id;

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, 400);

  const { tracks: library, isDemo } = useLibrary();
  const { play } = usePlayback();
  const queryClient = useQueryClient();

  const youtube = useYouTubeSearch(debouncedQuery, !isDemo);
  const results = youtube.tracks;

  // Стадия импорта — чтобы полоска говорила, что именно происходит:
  // операция идёт секунды, и одинаковый текст всё это время выглядит
  // как зависание.
  const [stage, setStage] = useState<ImportProgress['stage'] | null>(null);

  const importSong = useMutation({
    mutationFn: (track: Track) => importTrack(track, (progress) => setStage(progress.stage)),
    onSuccess: () => {
      // Медиатека изменилась — сбрасываем её кэш, чтобы новый трек появился.
      void queryClient.invalidateQueries({ queryKey: ['songs'] });
      Alert.alert('Готово', 'Трек добавлен в медиатеку');
    },
    onError: (error: Error) => Alert.alert('Не удалось добавить', error.message),
    onSettled: () => setStage(null),
  });

  // Список результатов — в ref: иначе новый handlePress на каждую выдачу
  // поиска пересоздаёт renderItem и перерисовывает весь список целиком.
  const resultsRef = useRef(results);
  resultsRef.current = results;

  const handlePress = useCallback((index: number) => play(resultsRef.current, index), [play]);

  // Что уже есть в медиатеке — по идентификаторам ютуба.
  //
  // Нужно, чтобы не начинать импорт того, что и так на месте: без проверки
  // телефон качал бы несколько мегабайт, заливал их в хранилище и только
  // потом получал отказ от базы.
  const importedIds = useMemo(
    () => new Set(library.map((item) => item.youtubeId).filter(Boolean) as string[]),
    [library],
  );

  const handleMenu = useCallback(
    (track: Track) => {
      if (track.source !== 'youtube' || !track.youtubeId) return;

      if (importedIds.has(track.youtubeId)) {
        Alert.alert(track.title, 'Этот трек уже в медиатеке.');
        return;
      }

      Alert.alert(track.title, 'Добавить трек в медиатеку?', [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Добавить',
          onPress: () => importSong.mutate(track),
        },
      ]);
    },
    [importSong, importedIds],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Track; index: number }) => (
      <TrackRow
        track={item}
        index={index}
        onPress={handlePress}
        onMenu={item.source === 'youtube' ? handleMenu : undefined}
      />
    ),
    [handlePress, handleMenu],
  );

  const listContent = useMemo(
    () => ({ paddingBottom: theme.spacing.xxl }),
    [theme.spacing.xxl],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + theme.spacing.sm }]}>
      <View style={styles.searchWrap}>
        <MaterialIcons name="search" size={22} color={theme.colors.textDim} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Треки, исполнители"
          placeholderTextColor={theme.colors.textFaint}
          style={styles.input}
          returnKeyType="search"
          autoCorrect={false}
          selectionColor={theme.colors.brand}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <MaterialIcons name="close" size={18} color={theme.colors.textDim} />
          </Pressable>
        ) : null}
      </View>


      {importSong.isPending ? (
        <View style={styles.importBar}>
          <ActivityIndicator color={theme.colors.text} size="small" />
          <Text style={styles.importText}>{STAGE_LABEL[stage ?? 'extract']}</Text>
        </View>
      ) : null}

      <Body
        query={debouncedQuery}
        isDemo={isDemo}
        results={results}
        isLoading={youtube.isLoading}
        error={youtube.error}
        renderItem={renderItem}
        contentContainerStyle={listContent}
      />
    </View>
  );
}

function Body({
  query,
  isDemo,
  results,
  isLoading,
  error,
  renderItem,
  contentContainerStyle,
}: {
  query: string;
  isDemo: boolean;
  results: readonly Track[];
  isLoading: boolean;
  error: Error | null;
  renderItem: ({ item, index }: { item: Track; index: number }) => React.ReactElement;
  contentContainerStyle: object;
}) {
  const styles = useThemedStyles(makeStyles);
  if (!query.trim()) {
    return (
      <EmptyState
        icon="⌕"
        title="Что послушаем?"
        hint="Найдите трек на YouTube — его можно слушать сразу или добавить к себе." 
      />
    );
  }

  if (isDemo) {
    return (
      <EmptyState
        icon="⚡"
        title="Нужен сервер"
        hint="Поиск по YouTube выполняет бэкенд. Запустите его, чтобы искать."
      />
    );
  }

  if (isLoading) return <TrackListSkeleton rows={7} />;
  if (error) return <ErrorState message={error.message} />;

  if (results.length === 0) {
    return <EmptyState title="Ничего не найдено" hint={`По запросу «${query}» пусто.`} />;
  }

  return (
    <FlashList
      data={results as Track[]}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps="handled"
    />
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      marginHorizontal: t.layout.screenPadding,
      paddingHorizontal: t.spacing.md,
      height: 44,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.chip,
    },
    input: { flex: 1, color: t.colors.text, fontSize: t.type.body.fontSize + 1, padding: 0 },
    importBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      marginHorizontal: t.layout.screenPadding,
      marginBottom: t.spacing.sm,
      padding: t.spacing.md,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
    },
    importText: { ...t.type.meta, color: t.colors.textDim, flex: 1, lineHeight: 17 },
  });
