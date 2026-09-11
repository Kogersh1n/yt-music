import { useCallback, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { findSong, getLyrics, type MusicTrack } from '../api/ytmusic';
import { readJSON, writeJSON } from '../local/storage';
import { trackKey, type Track } from '../api/types';

/**
 * Данные из YouTube Music: обложка альбома и текст песни.
 *
 * Оба требуют одного и того же предварительного шага — найти аудиозапись
 * по названию и исполнителю. Поэтому он вынесен в отдельный запрос, а текст
 * и обложка нанизаны на его результат: иначе открытие текста стоило бы
 * второго поиска, уже сделанного ради обложки.
 */

const MATCH_KEY = 'ytmusic.match.v1';

/**
 * Сопоставления, пережившие перезапуск.
 *
 * React Query держит кэш в памяти — после перезапуска приложение искало бы
 * обложку каждого трека заново, а это сетевой запрос на каждую строку
 * списка. Строки дешёвые, поэтому храним их на диске.
 *
 * Потолок нужен, чтобы файл не рос бесконечно: на каждую песню уходит
 * около двухсот байт, тысячи с запасом хватает любой медиатеке.
 */
const MATCH_LIMIT = 1000;

type MatchMap = Record<string, MusicTrack | null>;

let matches: MatchMap = readJSON<MatchMap>(MATCH_KEY, {});

/**
 * Подписка на найденные соответствия.
 *
 * Списки показывают обложку из того, что уже нашлось. Без уведомления
 * строка узнала бы о новой обложке только при следующей перерисовке
 * по какой-нибудь посторонней причине — то есть когда придётся.
 */
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function rememberMatch(key: string, value: MusicTrack | null): void {
  matches = { ...matches, [key]: value };

  const keys = Object.keys(matches);
  if (keys.length > MATCH_LIMIT) {
    // Порядок вставки у объекта сохраняется, поэтому самые старые — первые.
    const trimmed: MatchMap = {};
    for (const k of keys.slice(keys.length - MATCH_LIMIT)) trimmed[k] = matches[k];
    matches = trimmed;
  }

  writeJSON(MATCH_KEY, matches);
  listeners.forEach((listener) => listener());
}

/**
 * Аудиозапись в YouTube Music, соответствующая треку.
 *
 * Возвращает null, если ничего не нашлось, — это обычный исход для
 * любительских загрузок и миксов, а не ошибка, поэтому запрос
 * не повторяется.
 */
export function useSongMatch(track: Track | null) {
  const key = track ? trackKey(track) : '';

  return useQuery({
    queryKey: ['ytmusic-match', key],
    enabled: Boolean(track && track.title),
    // Соответствие «трек → аудиозапись» не меняется, поэтому не протухает.
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    initialData: () => (key in matches ? (matches[key] ?? null) : undefined),
    queryFn: async () => {
      if (!track) return null;
      const found = await findSong(track.title, track.author);
      rememberMatch(key, found);
      return found;
    },
  });
}

/** Обложка из YouTube Music — квадратная, в отличие от кадра клипа. */
export function useMusicCover(track: Track | null): string | null {
  const { data } = useSongMatch(track);
  return data?.coverUrl ?? null;
}

/**
 * Обложка, если она уже известна, — без единого запроса.
 *
 * Для списков. Поиск стоит одного обращения к сети на трек: тридцать строк
 * на экране означали бы тридцать запросов при каждой прокрутке, и это
 * несоразмерно ради картинки.
 *
 * Поэтому списки берут только то, что уже нашлось раньше — а находится оно
 * в плеере, на полноэкранной обложке, где качество и правда видно. То есть
 * медиатека хорошеет по мере того, как её слушают.
 */
export function useCachedCover(track: Track): string | null {
  const key = trackKey(track);
  const get = useCallback(() => matches[key]?.coverUrl ?? null, [key]);
  return useSyncExternalStore(subscribe, get);
}

export interface LyricsState {
  text: string | null;
  source: string | null;
  isLoading: boolean;
  /** Поиск завершился, текста у этой записи нет. Это не ошибка. */
  isAbsent: boolean;
  error: Error | null;
}

/** Текст песни. Грузится только когда экран текста открыт. */
export function useLyrics(track: Track | null, enabled: boolean): LyricsState {
  const match = useSongMatch(track);
  const songId = match.data?.videoId ?? null;

  const query = useQuery({
    queryKey: ['ytmusic-lyrics', songId],
    enabled: enabled && Boolean(songId),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
    queryFn: () => getLyrics(songId!),
  });

  const searching = enabled && (match.isPending || query.isPending);
  const nothingToShow = enabled && !match.isPending && !match.data;

  return {
    text: query.data?.text ?? null,
    source: query.data?.source ?? null,
    isLoading: searching && !nothingToShow,
    isAbsent: nothingToShow || (query.isSuccess && !query.data),
    error: (match.error ?? query.error) as Error | null,
  };
}
