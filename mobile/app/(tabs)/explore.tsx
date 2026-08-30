import { useCallback, useMemo, useState } from 'react';
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
import { Chip } from '../../src/ui/components/Chip';
import { TrackRow } from '../../src/ui/components/TrackRow';
import { EmptyState, ErrorState, TrackListSkeleton } from '../../src/ui/components/states';
import { useTheme, useThemedStyles, type Theme } from '../../src/ui/theme';
import { useLibrary, useLocalSearch, useYouTubeSearch } from '../../src/features/useLibrary';
import { useDebounced } from '../../src/features/useDebounced';
import { usePlayback } from '../../src/player/usePlayback';
import { importFromYouTube } from '../../src/api/songs';
import type { Track } from '../../src/api/types';

type Scope = 'library' | 'youtube';

/**
 * Поиск. Два источника: своя медиатека (по загруженному кэшу) и YouTube
 * (через бэкенд). Ввод дебаунсится, предыдущий запрос отменяется — иначе при
 * быстром наборе результаты «прыгают», как это происходит в вебе.
 */
export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('library');
  const debouncedQuery = useDebounced(query, 400);

  const { tracks: library, isDemo } = useLibrary();
  const { play } = usePlayback();
  const queryClient = useQueryClient();

  const localResults = useLocalSearch(debouncedQuery, library);
  const youtube = useYouTubeSearch(debouncedQuery, scope === 'youtube' && !isDemo);

  const results = scope === 'library' ? localResults : youtube.tracks;

  const importSong = useMutation({
    mutationFn: (url: string) => importFromYouTube(url),
    onSuccess: () => {
      // Медиатека изменилась — сбрасываем её кэш, чтобы новый трек появился.
      void queryClient.invalidateQueries({ queryKey: ['songs'] });
      Alert.alert('Готово', 'Трек добавлен в медиатеку');
    },
    onError: (error: Error) => Alert.alert('Не удалось добавить', error.message),
  });

  const handlePress = useCallback(
    (index: number) => play(results, index),
    [play, results],
  );

  const handleMenu = useCallback(
    (track: Track) => {
      if (track.source !== 'youtube' || !track.youtubeId) return;
      Alert.alert(track.title, 'Добавить трек в медиатеку?', [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Добавить',
          onPress: () =>
            importSong.mutate(`https://www.youtube.com/watch?v=${track.youtubeId}`),
        },
      ]);
    },
    [importSong],
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

      <View style={styles.chips}>
        <Chip
          label="Моя медиатека"
          active={scope === 'library'}
          onPress={() => setScope('library')}
        />
        <Chip label="YouTube" active={scope === 'youtube'} onPress={() => setScope('youtube')} />
      </View>

      {importSong.isPending ? (
        <View style={styles.importBar}>
          <ActivityIndicator color={theme.colors.text} size="small" />
          <Text style={styles.importText}>
            Скачиваем и загружаем трек — это может занять до минуты
          </Text>
        </View>
      ) : null}

      <Body
        query={debouncedQuery}
        scope={scope}
        isDemo={isDemo}
        results={results}
        isLoading={scope === 'youtube' && youtube.isLoading}
        error={scope === 'youtube' ? youtube.error : null}
        renderItem={renderItem}
        contentContainerStyle={listContent}
      />
    </View>
  );
}

function Body({
  query,
  scope,
  isDemo,
  results,
  isLoading,
  error,
  renderItem,
  contentContainerStyle,
}: {
  query: string;
  scope: Scope;
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
        hint={
          scope === 'library'
            ? 'Поиск идёт по загруженной медиатеке.'
            : 'Найдите трек на YouTube и добавьте его к себе.'
        }
      />
    );
  }

  if (scope === 'youtube' && isDemo) {
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
      keyExtractor={(item) => item.id}
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
    chips: {
      flexDirection: 'row',
      gap: t.spacing.sm,
      paddingHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.md,
    },
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
