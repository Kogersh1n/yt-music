import { request } from './client';
import type { Track } from './types';

/**
 * Каталог из YouTube Music: лайки и рекомендации.
 *
 * Треки отсюда НЕ скачаны — это ссылки. Играются как `source: 'youtube'`,
 * плеер сам возьмёт поток через streamUrls.ts. Поэтому лайки доступны
 * сразу, без ожидания загрузки в хранилище.
 */

interface WantedTrack {
  video_id: string;
  title: string;
  author: string;
  duration: number;
  cover: string | null;
}

interface RecommendationDto extends WantedTrack {
  score: number;
  because_of: string;
}

export interface SyncStatus {
  authenticated: boolean;
  liked_total: number;
  in_library: number;
  wanted: number;
}

export interface Recommended extends Track {
  /** На скольких твоих треков похож. Чем больше, тем увереннее совпадение. */
  score: number;
  /** Трек, с которого началась цепочка — чтобы подпись «похоже на …». */
  becauseOf: string;
}

function toTrack(dto: WantedTrack): Track {
  return {
    // Префикс yt: отличает ссылку от сохранённой песни — см. Track.id.
    id: `yt:${dto.video_id}`,
    title: dto.title,
    author: dto.author,
    duration: dto.duration,
    artwork: dto.cover,
    source: 'youtube',
    youtubeId: dto.video_id,
  };
}

export function getSyncStatus(signal?: AbortSignal): Promise<SyncStatus> {
  return request<SyncStatus>('/sync/status', { signal });
}

/** Лайки из YouTube Music, которых ещё нет в медиатеке. */
export async function getLikedCatalog(limit = 200, signal?: AbortSignal): Promise<Track[]> {
  const items = await request<WantedTrack[]>(`/sync/wanted?limit=${limit}`, { signal });
  return items.map(toTrack);
}

export async function getRecommendations(
  params: { seeds?: number; limit?: number } = {},
  signal?: AbortSignal,
): Promise<Recommended[]> {
  const query = new URLSearchParams({
    seeds: String(params.seeds ?? 15),
    limit: String(params.limit ?? 30),
  });
  const items = await request<RecommendationDto[]>(`/sync/recommendations?${query}`, { signal });

  return items.map((dto) => ({
    ...toTrack(dto),
    score: dto.score,
    becauseOf: dto.because_of,
  }));
}
