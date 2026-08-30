import { getStream, getYouTubeStream } from '../api/songs';
import { demoStreamUrl, isDemoId } from '../api/demo';
import type { Track } from '../api/types';

/**
 * Выдача и обновление ссылок на аудио.
 *
 * Бэкенд отдаёт presigned-URL с ограниченным сроком жизни
 * (R2_PRESIGNED_URL_EXPIRE_SECONDS, по умолчанию час). Если положить такую
 * ссылку в очередь и вернуться к треку через два часа — воспроизведение
 * упадёт. Поэтому ссылки кэшируются с отметкой времени и обновляются
 * заранее, до истечения.
 */

/** Считаем ссылку протухшей за 10 минут до реального срока — с запасом на паузу. */
const SAFETY_MARGIN_MS = 10 * 60 * 1000;
const ASSUMED_TTL_MS = 60 * 60 * 1000;

interface CachedUrl {
  url: string;
  fetchedAt: number;
  /** У демо и YouTube-потоков своя логика жизни, presigned-срока нет. */
  ttlMs: number;
}

const cache = new Map<string, CachedUrl>();

function isFresh(entry: CachedUrl): boolean {
  return Date.now() - entry.fetchedAt < entry.ttlMs - SAFETY_MARGIN_MS;
}

/**
 * Ссылка на аудио трека. Берётся из кэша, пока та заведомо жива,
 * иначе перезапрашивается.
 */
export async function resolveStreamUrl(track: Track, force = false): Promise<string> {
  const cached = cache.get(track.id);
  if (!force && cached && isFresh(cached)) return cached.url;

  const url = await fetchStreamUrl(track);
  cache.set(track.id, { url, fetchedAt: Date.now(), ttlMs: ASSUMED_TTL_MS });
  return url;
}

async function fetchStreamUrl(track: Track): Promise<string> {
  if (isDemoId(track.id)) return demoStreamUrl(track.id);

  if (track.source === 'youtube' && track.youtubeId) {
    const response = await getYouTubeStream(track.youtubeId);
    // Бэкенд возвращает то, что отдал yt-dlp; ключ отличается между ветками кода.
    const url = response.stream_url ?? response.url;
    if (!url) throw new Error('Бэкенд не вернул ссылку на поток YouTube');
    return url;
  }

  const response = await getStream(track.id);
  return response.stream_url;
}

/** Сбросить кэш конкретного трека — например, после ошибки воспроизведения. */
export function invalidateStreamUrl(trackId: string): void {
  cache.delete(trackId);
}

/**
 * Прогреть ссылку заранее. Вызывается для следующего трека в очереди,
 * чтобы переход прошёл без паузы на сетевой запрос.
 */
export function prefetchStreamUrl(track: Track): void {
  const cached = cache.get(track.id);
  if (cached && isFresh(cached)) return;
  // Ошибку намеренно гасим: это фоновая оптимизация, а не обязательный шаг.
  void resolveStreamUrl(track).catch(() => undefined);
}
