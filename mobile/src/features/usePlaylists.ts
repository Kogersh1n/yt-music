import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  addSongToPlaylist,
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  listPlaylists,
  removeSongFromPlaylist,
  renamePlaylist,
} from '../api/playlists';
import { trackFromSong, type Track } from '../api/types';
import { useIsSignedIn } from '../auth/session';

/**
 * Плейлисты.
 *
 * Живут только на сервере и только у вошедшего пользователя — локальной
 * копии нет намеренно. Лайки мы держим на телефоне, потому что их ставят
 * на бегу и они должны работать офлайн; плейлисты собирают осознанно
 * и редко, и куда важнее, чтобы они не пропали при переустановке.
 *
 * Все изменения сбрасывают кэш списка: бэкенд возвращает пересчитанные
 * длительность и число треков, и держать их в согласии вручную —
 * лишний повод для расхождений.
 */

const KEY = ['playlists'] as const;

export function usePlaylists() {
  const signedIn = useIsSignedIn();

  const query = useQuery({
    queryKey: KEY,
    queryFn: ({ signal }) => listPlaylists(signal),
    // Без входа запрос не уходит: сервер ответит 401, а это вызовет
    // разлогин в клиенте — то есть попытка показать пустой список
    // выкинула бы пользователя из аккаунта.
    enabled: signedIn,
    staleTime: 60_000,
  });

  return {
    playlists: query.data ?? [],
    isLoading: signedIn && query.isPending,
    error: query.error as Error | null,
    signedIn,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}

export function usePlaylist(playlistId: string | undefined) {
  const query = useQuery({
    queryKey: ['playlist', playlistId],
    queryFn: ({ signal }) => getPlaylist(playlistId!, signal),
    enabled: Boolean(playlistId),
    staleTime: 30_000,
  });

  const tracks = useMemo<Track[]>(
    () => (query.data?.songs ?? []).map(trackFromSong),
    [query.data],
  );

  return {
    playlist: query.data ?? null,
    tracks,
    isLoading: query.isPending,
    error: query.error as Error | null,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}

/** Действия над плейлистами. Каждое обновляет и список, и открытый плейлист. */
export function usePlaylistActions() {
  const client = useQueryClient();

  const invalidate = (playlistId?: string) => {
    void client.invalidateQueries({ queryKey: KEY });
    if (playlistId) void client.invalidateQueries({ queryKey: ['playlist', playlistId] });
  };

  return {
    create: useMutation({
      mutationFn: (name: string) => createPlaylist(name),
      onSuccess: () => invalidate(),
    }),
    rename: useMutation({
      mutationFn: ({ id, name }: { id: string; name: string }) => renamePlaylist(id, name),
      onSuccess: (_data, variables) => invalidate(variables.id),
    }),
    remove: useMutation({
      mutationFn: (id: string) => deletePlaylist(id),
      onSuccess: () => invalidate(),
    }),
    addSong: useMutation({
      mutationFn: ({ id, songId }: { id: string; songId: string }) =>
        addSongToPlaylist(id, songId),
      onSuccess: (_data, variables) => invalidate(variables.id),
    }),
    removeSong: useMutation({
      mutationFn: ({ id, songId }: { id: string; songId: string }) =>
        removeSongFromPlaylist(id, songId),
      onSuccess: (_data, variables) => invalidate(variables.id),
    }),
  };
}
