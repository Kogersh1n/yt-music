import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { listSongs, searchYouTube } from '../api/songs';
import { ping } from '../api/client';
import { DEMO_SONGS } from '../api/demo';
import { trackFromSong, trackFromYouTube, type Track } from '../api/types';
import { fuzzyFilter } from './fuzzy';

/**
 * Данные медиатеки.
 *
 * Правило: компоненты не ходят в сеть сами — только через эти хуки.
 * Тогда кэш, дедупликация и отмена запросов работают на всё приложение сразу.
 */

/**
 * Доступен ли бэкенд. От этого зависит, показывать реальную медиатеку
 * или демо-набор: приложение должно открываться и играть даже с выключенным
 * сервером — иначе его невозможно показать.
 */
export function useBackendAvailable() {
  return useQuery({
    queryKey: ['backend-alive'],
    queryFn: ping,
    // Проверяем редко: если сервер поднялся, пользователь всё равно потянет
    // список вниз для обновления.
    staleTime: 60_000,
    retry: false,
  });
}

/**
 * Лента медиатеки. Курсорная пагинация бэкенда ложится на useInfiniteQuery
 * один в один: next_cursor из ответа становится параметром следующей страницы.
 */
export function useLibrary() {
  const { data: online, isPending: checkingBackend } = useBackendAvailable();

  const query = useInfiniteQuery({
    queryKey: ['songs'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => listSongs({ cursor: pageParam, limit: 30 }, signal),
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.next_cursor : undefined),
    // Данные медиатеки меняются редко — не дёргаем сервер при каждом
    // возврате на экран.
    staleTime: 5 * 60_000,
    enabled: online === true,
  });

  const tracks = useMemo<Track[]>(() => {
    if (online === false) return DEMO_SONGS.map(trackFromSong);
    const pages = query.data?.pages ?? [];
    return pages.flatMap((page) => page.items.map(trackFromSong));
  }, [query.data, online]);

  return {
    tracks,
    isDemo: online === false,
    isLoading: checkingBackend || (online === true && query.isPending),
    error: query.error,
    hasNextPage: online === true && query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}

/** Название важнее исполнителя: ищут обычно трек, а не всё его авторство. */
const SEARCH_FIELDS = [
  { get: (track: Track) => track.title, weight: 1 },
  { get: (track: Track) => track.author, weight: 0.8 },
];

/**
 * Поиск по своей медиатеке — мгновенный, без сети.
 *
 * Идёт по уже загруженному кэшу: серверный `/songs/search` сломан (объявлен
 * как list[SongResponse], а возвращает YouTube-ответ), запрос к нему всегда
 * падает. Отсюда же ограничение: находится только то, что успело подгрузиться
 * пагинацией, а не вся база.
 *
 * Совпадение нечёткое — подпоследовательностью, а не подстрокой: в названиях
 * много служебных слов, и набирают обрывками.
 */
export function useLocalSearch(query: string, tracks: readonly Track[]): Track[] {
  return useMemo(() => {
    if (!query.trim()) return [];
    return fuzzyFilter(tracks, query, SEARCH_FIELDS);
  }, [query, tracks]);
}

/**
 * То же, но пустой запрос возвращает весь список. Для экрана медиатеки,
 * где поиск — это фильтр поверх всего, а не отдельный режим.
 */
export function useLibraryFilter(query: string, tracks: readonly Track[]): Track[] {
  return useMemo(() => fuzzyFilter(tracks, query, SEARCH_FIELDS), [query, tracks]);
}

/**
 * Поиск по YouTube. Запрос уходит только для непустой строки; React Query
 * сам отменяет предыдущий через signal, поэтому гонок при быстром вводе нет.
 */
/**
 * Сколько результатов просить у ютуба. Десяти не хватало — выдача
 * обрывалась там, где искомое ещё не встретилось. Потолок на бэкенде — сто.
 */
const YOUTUBE_SEARCH_LIMIT = 30;

export function useYouTubeSearch(query: string, enabled: boolean) {
  const trimmed = query.trim();

  const result = useQuery({
    queryKey: ['youtube-search', trimmed],
    queryFn: ({ signal }) => searchYouTube(trimmed, YOUTUBE_SEARCH_LIMIT, signal),
    enabled: enabled && trimmed.length > 0,
    // Результаты поиска живут дольше экрана — возврат к тому же запросу
    // не бьёт по yt-dlp повторно.
    staleTime: 10 * 60_000,
    retry: false,
  });

  const tracks = useMemo<Track[]>(
    () => (result.data?.results ?? []).map(trackFromYouTube),
    [result.data],
  );

  return { tracks, isLoading: result.isFetching, error: result.error };
}
