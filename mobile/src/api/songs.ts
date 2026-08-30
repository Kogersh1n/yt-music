import { request, LONG_TIMEOUT_MS } from './client';
import type {
  SongPaginationResponse,
  SongResponse,
  SongStreamResponse,
  SongCoverResponse,
  YouTubeSearchResponse,
} from './types';

/** Лента медиатеки. Курсорная пагинация: next_cursor из предыдущего ответа. */
export function listSongs(
  params: { cursor?: string | null; limit?: number } = {},
  signal?: AbortSignal,
): Promise<SongPaginationResponse> {
  const query = new URLSearchParams({ limit: String(params.limit ?? 30) });
  if (params.cursor) query.set('cursor', params.cursor);
  return request<SongPaginationResponse>(`/songs/?${query}`, { signal });
}

export function getSong(songId: string, signal?: AbortSignal): Promise<SongResponse> {
  return request<SongResponse>(`/songs/${songId}`, { signal });
}

/**
 * Свежая ссылка на аудио. Отдаётся presigned-URL с ограниченным сроком жизни,
 * поэтому её нельзя кэшировать надолго — см. src/player/streamUrls.ts.
 */
export function getStream(songId: string, signal?: AbortSignal): Promise<SongStreamResponse> {
  return request<SongStreamResponse>(`/songs/${songId}/stream`, { signal });
}

export function getCover(songId: string, signal?: AbortSignal): Promise<SongCoverResponse> {
  return request<SongCoverResponse>(`/songs/${songId}/cover`, { signal });
}

/**
 * Поиск по YouTube.
 *
 * Намеренно НЕ используем `/songs/search`: в роутере он объявлен как
 * `list[SongResponse]`, а сервис возвращает `{results, query}` с YouTube —
 * ответ не проходит валидацию и эндпоинт всегда падает. Поиск по своей
 * медиатеке делаем локально, по уже загруженному кэшу.
 */
export function searchYouTube(
  query: string,
  signal?: AbortSignal,
): Promise<YouTubeSearchResponse> {
  return request<YouTubeSearchResponse>(`/songs/youtube/search?q=${encodeURIComponent(query)}`, {
    signal,
  });
}

/** Прямая ссылка на поток YouTube без сохранения в медиатеку — «послушать сейчас». */
export function getYouTubeStream(
  videoId: string,
  signal?: AbortSignal,
): Promise<{ stream_url?: string; url?: string; duration?: number }> {
  return request(`/songs/youtube/stream/${encodeURIComponent(videoId)}`, { signal });
}

/**
 * Импорт трека в медиатеку. Долгая операция: yt-dlp скачивает аудио,
 * потом оно заливается в хранилище — отсюда увеличенный таймаут.
 */
export function importFromYouTube(url: string, signal?: AbortSignal): Promise<SongResponse> {
  return request<SongResponse>('/songs/import/youtube', {
    method: 'POST',
    body: JSON.stringify({ query: url }),
    timeoutMs: LONG_TIMEOUT_MS,
    signal,
  });
}

export function deleteSong(songId: string, signal?: AbortSignal): Promise<void> {
  return request<void>(`/songs/${songId}`, { method: 'DELETE', signal });
}
