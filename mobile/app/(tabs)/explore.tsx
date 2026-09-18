import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { TrackRow } from '../../src/ui/components/TrackRow';
import { EmptyState, ErrorState, TrackListSkeleton } from '../../src/ui/components/states';
import { useTheme, useThemedStyles, type Theme } from '../../src/ui/theme';
import { useLibrary, useYouTubeSearch } from '../../src/features/useLibrary';
import { useIsSignedIn } from '../../src/auth/session';
import { useDebounced } from '../../src/features/useDebounced';
import { usePlayback } from '../../src/player/usePlayback';
import { enqueue } from '../../src/features/importQueue';
import { useRecommendations } from '../../src/features/recommend';
import { ImportPanel } from '../../src/ui/components/ImportPanel';
import { SearchSections } from '../../src/ui/components/SearchSections';
import type { Track } from '../../src/api/types';

/** Вынесен из компонента: иначе новая функция на каждый рендер. */
const keyExtractor = (item: Track) => item.id;

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, 400);

  const { tracks: library, isDemo } = useLibrary();
  const signedIn = useIsSignedIn();
  const router = useRouter();
  const { play } = usePlayback();
  const queryClient = useQueryClient();

  const youtube = useYouTubeSearch(debouncedQuery, !isDemo);
  const results = youtube.tracks;

  // Пустой поиск — не повод показывать пустоту: подсказки здесь уместнее
  // приглашения что-нибудь ввести, и это та же лента, что на главной.
  const suggestions = useRecommendations();

  // Свежий список держим в ref, а не в замыкании: иначе обработчик
  // меняется на каждый рендер и тянет за собой перерисовку всех строк.
  const suggestionsRef = useRef(suggestions.tracks);
  suggestionsRef.current = suggestions.tracks;

  const playSuggestion = useCallback(
    (index: number) => play(suggestionsRef.current, index),
    [play],
  );

  /**
   * Выбранные треки.
   *
   * null означает «режим выбора выключен» — в нём нажатие играет, как
   * и раньше. Режим включается долгим нажатием: отдельная кнопка
   * «выбрать» занимала бы место ради действия, которое нужно изредка.
   */
  const [selected, setSelected] = useState<Set<string> | null>(null);

  // Список результатов — в ref: иначе новый handlePress на каждую выдачу
  // поиска пересоздаёт renderItem и перерисовывает весь список целиком.
  const resultsRef = useRef(results);
  resultsRef.current = results;

  // Что уже есть в медиатеке — по идентификаторам ютуба.
  //
  // Нужно, чтобы не начинать импорт того, что и так на месте: без проверки
  // телефон качал бы несколько мегабайт, заливал их в хранилище и только
  // потом получал отказ от базы.
  const importedIds = useMemo(
    () => new Set(library.map((item) => item.youtubeId).filter(Boolean) as string[]),
    [library],
  );

  const toggleSelected = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handlePress = useCallback(
    (index: number) => {
      const track = resultsRef.current[index];
      if (!track) return;
      // В режиме выбора нажатие отмечает, а не играет.
      if (selected !== null) toggleSelected(track.id);
      else play(resultsRef.current, index);
    },
    [play, selected, toggleSelected],
  );

  const handleLongPress = useCallback(
    (track: Track) => {
      if (track.source !== 'youtube') return;
      setSelected((current) => new Set(current ?? []).add(track.id));
    },
    [],
  );

  /**
   * Проверка входа перед добавлением.
   *
   * Ручки заливки требуют авторизации, и без неё импорт всё равно
   * сорвётся — но сорвётся поздно: телефон успеет скачать по несколько
   * мегабайт на трек, и только потом получит отказ. Хуже того, клиент
   * трактует 401 как потерю сессии и уводит на экран входа, то есть
   * человек, просто листавший поиск, внезапно оказывается в форме логина.
   *
   * Проверяем заранее и предлагаем войти, не тратя ни байта.
   */
  const requireSignIn = useCallback((): boolean => {
    if (signedIn) return true;
    Alert.alert(
      'Нужен вход',
      'Треки добавляются в медиатеку на сервере — для этого нужен аккаунт.',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Войти', onPress: () => router.push('/(auth)/login') },
      ],
    );
    return false;
  }, [signedIn, router]);

  /** Отправить выбранное в очередь. Уже добавленное молча пропускается. */
  const addSelected = useCallback(() => {
    if (!selected) return;
    if (!requireSignIn()) return;
    const tracks = resultsRef.current.filter(
      (track) => selected.has(track.id) && !importedIds.has(track.youtubeId ?? ''),
    );
    enqueue(tracks);
    setSelected(null);
  }, [selected, importedIds, requireSignIn]);

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
          onPress: () => {
            if (requireSignIn()) enqueue([track]);
          },
        },
      ]);
    },
    [importedIds, requireSignIn],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Track; index: number }) => (
      <TrackRow
        track={item}
        index={index}
        onPress={handlePress}
        onMenu={selected === null && item.source === 'youtube' ? handleMenu : undefined}
        selected={selected === null ? undefined : selected.has(item.id)}
        onLongPress={item.source === 'youtube' ? handleLongPress : undefined}
      />
    ),
    [handlePress, handleMenu, handleLongPress, selected],
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


      {selected !== null ? (
        <View style={styles.selectBar}>
          <Pressable onPress={() => setSelected(null)} hitSlop={10}>
            <MaterialIcons name="close" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.selectCount}>Выбрано {selected.size}</Text>
          <Pressable
            onPress={addSelected}
            disabled={selected.size === 0}
            style={[styles.addButton, selected.size === 0 && styles.addDisabled]}
          >
            <Text style={styles.addLabel}>Добавить</Text>
          </Pressable>
        </View>
      ) : null}

      <ImportPanel />

      <Body
        query={debouncedQuery}
        isDemo={isDemo}
        results={results}
        isLoading={youtube.isLoading}
        error={youtube.error}
        renderItem={renderItem}
        contentContainerStyle={listContent}
        suggestions={suggestions.tracks}
        suggestionsLoading={suggestions.isLoading}
        onPlaySuggestion={playSuggestion}
        onPickAlbum={setQuery}
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
  suggestions,
  suggestionsLoading,
  onPlaySuggestion,
  onPickAlbum,
}: {
  query: string;
  isDemo: boolean;
  results: readonly Track[];
  isLoading: boolean;
  error: Error | null;
  renderItem: ({ item, index }: { item: Track; index: number }) => React.ReactElement;
  contentContainerStyle: object;
  suggestions: readonly Track[];
  suggestionsLoading: boolean;
  onPlaySuggestion: (index: number) => void;
  onPickAlbum: (query: string) => void;
}) {
  const styles = useThemedStyles(makeStyles);

  if (!query.trim()) {
    if (suggestionsLoading) return <TrackListSkeleton rows={7} />;

    if (suggestions.length > 0) {
      return (
        <FlashList
          data={suggestions as Track[]}
          renderItem={({ item, index }) => (
            <TrackRow track={item} index={index} onPress={onPlaySuggestion} />
          )}
          keyExtractor={keyExtractor}
          contentContainerStyle={contentContainerStyle}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.suggestHead}>
              <Text style={styles.suggestTitle}>Может понравиться</Text>
              <Text style={styles.suggestHint}>
                Собрано по тому, что вы слушаете. Ничего из этого вы ещё не включали.
              </Text>
            </View>
          }
        />
      );
    }

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
      // Исполнители и альбомы едут в шапке списка, а не отдельным блоком
      // сверху: иначе они не прокручивались бы вместе с песнями и
      // занимали бы половину экрана постоянно.
      ListHeaderComponent={<SearchSections query={query} onPickAlbum={onPickAlbum} />}
    />
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    suggestHead: {
      paddingHorizontal: t.layout.screenPadding,
      paddingTop: t.spacing.sm,
      paddingBottom: t.spacing.md,
      gap: 2,
    },
    suggestTitle: { ...t.type.section, color: t.colors.text },
    suggestHint: { ...t.type.meta, color: t.colors.textDim, lineHeight: 17 },
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
    selectBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      marginHorizontal: t.layout.screenPadding,
      marginBottom: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
      borderRadius: t.radius.chip,
      backgroundColor: t.colors.surfaceHigh,
    },
    selectCount: { ...t.type.body, color: t.colors.text, flex: 1 },
    addButton: {
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.xs,
      borderRadius: t.radius.chip,
      backgroundColor: t.colors.accent,
    },
    addDisabled: { opacity: 0.4 },
    addLabel: { ...t.type.meta, fontWeight: '600', color: t.colors.onAccent },
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
