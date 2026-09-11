import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TrackRow } from '../../src/ui/components/TrackRow';
import { ActionSheet, type SheetAction } from '../../src/ui/components/ActionSheet';
import { MiniPlayer } from '../../src/ui/components/MiniPlayer';
import { EmptyState, ErrorState, TrackListSkeleton } from '../../src/ui/components/states';
import { useTheme, useThemedStyles, formatDuration, type Theme } from '../../src/ui/theme';
import { usePlaylist, usePlaylistActions } from '../../src/features/usePlaylists';
import { usePlayback } from '../../src/player/usePlayback';
import { toggleLike } from '../../src/local/likes';
import { trackKey, type Track } from '../../src/api/types';
import { plural } from '../playlists';

/**
 * Один плейлист: состав, воспроизведение, удаление треков.
 *
 * Порядок треков задаёт сервер — своего поля сортировки у связи нет,
 * поэтому переупорядочивание здесь не предлагается: кнопка, которая
 * ничего не меняет после перезагрузки, хуже отсутствующей.
 */
export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  const { playlist, tracks, isLoading, error, refetch, isRefetching } = usePlaylist(id);
  const actions = usePlaylistActions();
  const { play } = usePlayback();

  const [menuTrack, setMenuTrack] = useState<Track | null>(null);

  // Список в ref: иначе обработчик пересоздаётся на каждое обновление
  // плейлиста и утягивает за собой renderItem всего списка.
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  const handlePress = useCallback((index: number) => play(tracksRef.current, index), [play]);
  const handleMenu = useCallback((track: Track) => setMenuTrack(track), []);

  const menuActions = useMemo<SheetAction[]>(() => {
    if (!menuTrack || !id) return [];
    return [
      { label: 'Нравится', icon: 'favorite', onPress: () => toggleLike(trackKey(menuTrack)) },
      {
        label: 'Убрать из плейлиста',
        icon: 'playlist-remove',
        destructive: true,
        onPress: () =>
          actions.removeSong.mutate(
            { id, songId: menuTrack.id },
            { onError: (e: Error) => Alert.alert('Не удалось убрать', e.message) },
          ),
      },
    ];
  }, [menuTrack, id, actions.removeSong]);

  const renderItem = useCallback(
    ({ item, index }: { item: Track; index: number }) => (
      <TrackRow track={item} index={index} onPress={handlePress} onMenu={handleMenu} swipeable={false} />
    ),
    [handlePress, handleMenu],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + theme.spacing.sm }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerButton}>
          <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={styles.headerTitle}>
            {playlist?.playlist_name ?? 'Плейлист'}
          </Text>
          {playlist ? (
            <Text style={styles.headerMeta}>
              {playlist.songs_count === 0
                ? 'Пока пусто'
                : `${playlist.songs_count} ${plural(playlist.songs_count)} · ${formatDuration(playlist.playlist_duration)}`}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => tracks.length > 0 && play(tracks, 0)}
          hitSlop={12}
          style={styles.headerButton}
          disabled={tracks.length === 0}
        >
          <MaterialIcons
            name="play-circle-filled"
            size={30}
            color={tracks.length > 0 ? theme.colors.accent : theme.colors.textFaint}
          />
        </Pressable>
      </View>

      {isLoading ? (
        <TrackListSkeleton rows={6} />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => void refetch()} />
      ) : tracks.length === 0 ? (
        <EmptyState
          icon="♪"
          title="Плейлист пуст"
          hint="Добавьте треки через «⋮» в медиатеке."
        />
      ) : (
        <FlashList
          data={tracks}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
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
        />
      )}

      <ActionSheet
        visible={menuTrack !== null}
        title={menuTrack?.title ?? ''}
        subtitle={menuTrack?.author}
        actions={menuActions}
        onClose={() => setMenuTrack(null)}
      />

      <MiniPlayer standalone />
    </View>
  );
}

const keyExtractor = (item: Track) => item.id;

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      paddingBottom: t.spacing.sm,
    },
    headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerText: { flex: 1 },
    headerTitle: { ...t.type.title, fontSize: t.type.title.fontSize - 6, color: t.colors.text },
    headerMeta: { ...t.type.meta, color: t.colors.textDim },
    list: { paddingBottom: t.spacing.xxl },
  });
