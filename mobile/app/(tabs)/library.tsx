import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Chip } from '../../src/ui/components/Chip';
import { TrackRow } from '../../src/ui/components/TrackRow';
import { ActionSheet, type SheetAction } from '../../src/ui/components/ActionSheet';
import { AddToPlaylistSheet } from '../../src/ui/components/AddToPlaylistSheet';
import { EmptyState, ErrorState, TrackListSkeleton } from '../../src/ui/components/states';
import { useTheme, useThemedStyles, type Theme } from '../../src/ui/theme';
import { useLibrary, useLibraryFilter } from '../../src/features/useLibrary';
import { useLikedIds, useLikedTracks, toggleLike, syncLikes } from '../../src/local/likes';
import { useIsSignedIn } from '../../src/auth/session';
import { downloadTrack } from '../../src/features/download';
import { notifySuccess } from '../../src/ui/haptics';
import { deleteSong } from '../../src/api/songs';
import { useCachedKeys, useCachedTracks, removeDownload } from '../../src/local/audioCache';
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

  const signedIn = useIsSignedIn();
  const likedIds = useLikedIds();

  /**
   * Сведение лайков с сервером.
   *
   * Здесь, а не в корневом layout, потому что для сопоставления нужна
   * медиатека: серверный лайк ссылается на запись песни, а локальный
   * ключ — это youtubeId. Медиатека уже загружена именно на этом экране.
   *
   * Один раз за вход: список меняется редко, а гонять сверку на каждое
   * появление экрана незачем.
   */
  const syncedCountRef = useRef(0);

  useEffect(() => {
    if (!signedIn || tracks.length === 0) return;

    // Повторяем по мере подгрузки страниц, а не один раз.
    //
    // Отправка локальных лайков на сервер требует UUID записи песни,
    // а он известен только для загруженного. Медиатека приходит
    // страницами по тридцать, и единственный прогон после первой
    // страницы навсегда пропустил бы всё остальное.
    //
    // Считаем по числу известных треков: выросло — сводим снова.
    if (tracks.length <= syncedCountRef.current) return;

    const attempted = tracks.length;

    // Отметку ставим по успеху, а не по попытке: сведение, сорвавшееся
    // из-за плохой связи, должно повториться, а не пропасть до перезапуска.
    void syncLikes(tracks).then((ok) => {
      if (ok) syncedCountRef.current = attempted;
    });
  }, [signedIn, tracks]);

  useEffect(() => {
    if (!signedIn) syncedCountRef.current = 0;
  }, [signedIn]);
  const cachedKeys = useCachedKeys();
  const likedTracks = useLikedTracks();
  const cachedTracks = useCachedTracks();

  // Лайки в ref: меню читает их в момент нажатия, а зависимость от массива
  // пересоздавала бы обработчик и с ним весь renderItem списка.
  const likedIdsRef = useRef(new Set(likedIds));
  likedIdsRef.current = new Set(likedIds);
  const cachedKeysRef = useRef(new Set(cachedKeys));
  cachedKeysRef.current = new Set(cachedKeys);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { play } = usePlayback();

  const removeSong = useMutation({
    mutationFn: (songId: string) => deleteSong(songId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['songs'] }),
    onError: (error: Error) =>
      Alert.alert(
        'Не удалось удалить',
        // Удаление требует входа — иначе сервер отвечает 401, и без
        // пояснения это выглядит как сбой.
        error.message.includes('401') ? 'Войдите в аккаунт, чтобы удалять треки.' : error.message,
      ),
  });

  /**
   * Фильтр «Понравившиеся».
   *
   * Ключ — trackKey(), а не track.id. Раньше здесь стоял id, и фильтр был
   * всегда пуст для всего, что импортировано с ютуба: лайк кладётся под
   * youtubeId, а спрашивали по UUID. Сердечко в строке горело, а список
   * «Понравившиеся» показывал пустоту.
   */
  const byFilter = useMemo(() => {
    // Списки берутся из локальных хранилищ, а не фильтрацией медиатеки.
    //
    // Раньше оба фильтра просеивали `tracks` — то есть медиатеку. Но
    // приложение стало ютуб-плеером: в медиатеке три трека, а слушают
    // радио и подсказки. Лайкнутый ютуб-трек в медиатеку не попадает,
    // и «Понравившиеся» показывали пустоту при горящем сердечке.
    //
    // Теперь и лайки, и кэш хранят сами треки, а медиатека добавляется
    // к ним для тех записей, что старше этого изменения.
    if (filter === 'liked') {
      const set = new Set(likedIds);
      const fromLibrary = tracks.filter((track) => set.has(trackKey(track)));
      const known = new Set(likedTracks.map((track) => trackKey(track)));
      return [...likedTracks, ...fromLibrary.filter((t) => !known.has(trackKey(t)))];
    }
    if (filter === 'downloaded') {
      const set = new Set(cachedKeys);
      const fromLibrary = tracks.filter((track) => set.has(trackKey(track)));
      const known = new Set(cachedTracks.map((track) => trackKey(track)));
      return [...cachedTracks, ...fromLibrary.filter((t) => !known.has(trackKey(t)))];
    }
    return tracks;
  }, [filter, tracks, likedIds, cachedKeys, likedTracks, cachedTracks]);

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

  /**
   * Меню трека.
   *
   * Свой лист, а не Alert.alert: системный диалог рисуется белой панелью
   * поверх тёмного экрана, раскладывает кнопки в обратном порядке
   * и не показывает опасное действие опасным.
   */
  const [menuTrack, setMenuTrack] = useState<Track | null>(null);
  const [playlistTrack, setPlaylistTrack] = useState<Track | null>(null);
  const handleMenu = useCallback((track: Track) => setMenuTrack(track), []);

  const menuActions = useMemo<SheetAction[]>(() => {
    if (!menuTrack) return [];
    const key = trackKey(menuTrack);
    const liked = likedIdsRef.current.has(key);

    const actions: SheetAction[] = [
      {
        label: liked ? 'Убрать из понравившихся' : 'Нравится',
        icon: liked ? 'heart-broken' : 'favorite',
        onPress: () => toggleLike(menuTrack),
      },
    ];

    // Скачивание работает для любого трека: файл кладётся на телефон,
    // запись на сервере для этого не нужна. Раньше кнопки не было вовсе —
    // в кэш попадало только то, что послушали десять секунд подряд.
    const downloaded = cachedKeysRef.current.has(key);
    actions.push(
      downloaded
        ? {
            label: 'Удалить загрузку',
            icon: 'delete-sweep',
            onPress: () => removeDownload(menuTrack),
          }
        : {
            label: 'Скачать',
            icon: 'download',
            onPress: () => {
              void downloadTrack(menuTrack).then((ok) => {
                if (ok) notifySuccess();
              });
            },
          },
    );

    // Раньше стояло ограничение «только медиатека»: плейлист держится
    // на идентификаторе песни, а у играющего по ссылке его не было.
    // Теперь запись заводится по требованию (features/ensureSong.ts),
    // и ограничение снято.
    actions.push({
      label: 'Добавить в плейлист',
      icon: 'playlist-add',
      onPress: () => setPlaylistTrack(menuTrack),
    });

    // Удалять можно только то, что лежит в медиатеке: у треков,
    // играющих по ссылке, удалять на сервере нечего.
    if (menuTrack.source === 'library') {
      actions.push({
        label: 'Удалить из медиатеки',
        icon: 'delete-outline',
        destructive: true,
        onPress: () =>
          Alert.alert('Удалить трек?', 'Файл и запись исчезнут безвозвратно.', [
            { text: 'Отмена', style: 'cancel' },
            {
              text: 'Удалить',
              style: 'destructive',
              onPress: () => removeSong.mutate(menuTrack.id),
            },
          ]),
      });
    }

    return actions;
  }, [menuTrack, removeSong]);

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

      {/* Вход в плейлисты: модуль на бэкенде был написан целиком
          и всё это время оставался без единого экрана. */}
      <Pressable
        style={styles.playlistsLink}
        onPress={() => router.push('/playlists')}
        android_ripple={{ color: 'rgba(128,128,128,0.14)' }}
      >
        <MaterialIcons name="queue-music" size={20} color={theme.colors.text} />
        <Text style={styles.playlistsLabel}>Плейлисты</Text>
        <MaterialIcons name="chevron-right" size={20} color={theme.colors.textFaint} />
      </Pressable>

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

      <AddToPlaylistSheet track={playlistTrack} onClose={() => setPlaylistTrack(null)} />

      <ActionSheet
        visible={menuTrack !== null}
        title={menuTrack?.title ?? ''}
        subtitle={menuTrack?.author}
        actions={menuActions}
        onClose={() => setMenuTrack(null)}
      />
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
        hint="Треки попадают сюда сами: последние пять из тех, что слушали дольше десяти секунд."
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
    playlistsLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      marginHorizontal: t.layout.screenPadding,
      marginTop: t.spacing.md,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.md,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.chip,
    },
    playlistsLabel: { ...t.type.body, color: t.colors.text, flex: 1 },
    chips: {
      flexDirection: 'row',
      gap: t.spacing.sm,
      paddingHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.md,
    },
    list: { paddingBottom: t.spacing.xxl },
    footer: { height: t.spacing.xxl },
  });
