import { getStream, getYouTubeStream } from '../api/songs';
import { extractStreamUrl } from '../api/youtube';
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
  /** Момент, после которого ссылку нельзя использовать. */
  expiresAt: number;
}

/**
 * Потолок кэша.
 *
 * Ссылки googlevideo длинные — под тысячу символов каждая, — а кэш ничего
 * не удалял: за долгую сессию он копил запись на каждый когда-либо
 * включённый трек и не отпускал ни одной. Ста хватает с запасом: столько
 * треков подряд за сеанс не слушают, а протухшие всё равно перезапрашиваются.
 */
const CACHE_LIMIT = 100;

const cache = new Map<string, CachedUrl>();

function isFresh(entry: CachedUrl): boolean {
  return Date.now() < entry.expiresAt - SAFETY_MARGIN_MS;
}

/**
 * Освободить место под новую запись.
 *
 * Сначала выбрасываем протухшее — оно бесполезно по определению. Если
 * всё ещё тесно, уходит самая старая запись: Map хранит порядок вставки,
 * и для очереди воспроизведения он совпадает с порядком обращения.
 */
function evictIfNeeded(): void {
  if (cache.size < CACHE_LIMIT) return;

  for (const [key, entry] of cache) {
    if (!isFresh(entry)) cache.delete(key);
  }

  while (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/**
 * Ссылка на аудио трека. Берётся из кэша, пока та заведомо жива,
 * иначе перезапрашивается.
 */
export async function resolveStreamUrl(track: Track, force = false): Promise<string> {
  const cached = cache.get(track.id);
  if (!force && cached && isFresh(cached)) return cached.url;

  const resolved = await fetchStreamUrl(track);
  evictIfNeeded();
  cache.set(track.id, resolved);
  return resolved.url;
}

async function fetchStreamUrl(track: Track): Promise<CachedUrl> {
  if (isDemoId(track.id)) {
    return { url: demoStreamUrl(track.id), expiresAt: Date.now() + ASSUMED_TTL_MS };
  }

  if (track.source === 'youtube' && track.youtubeId) {
    return fetchYouTubeUrl(track.youtubeId);
  }

  const response = await getStream(track.id);
  return { url: response.stream_url, expiresAt: Date.now() + ASSUMED_TTL_MS };
}

/**
 * Ссылка на поток YouTube: сначала пробуем достать её сами, потом бэкенд.
 *
 * Порядок именно такой, потому что телефон сидит на обычном домашнем или
 * мобильном адресе, а сервер — на адресе дата-центра, который YouTube
 * отклоняет примерно в трёх случаях из четырёх. То есть телефон здесь
 * не запасной путь, а основной.
 *
 * Бэкенд остаётся откатом на случай, когда извлечение не удалось: смена
 * протокола, обрыв связи с youtube.com при живом соединении с нашим API.
 * Терять воспроизведение целиком из-за этого не хочется.
 */
async function fetchYouTubeUrl(videoId: string): Promise<CachedUrl> {
  try {
    const stream = await extractStreamUrl(videoId);
    return { url: stream.url, expiresAt: stream.expiresAt };
  } catch (error) {
    if (__DEV__) console.warn('Извлечение на устройстве не удалось:', error);
  }

  const response = await getYouTubeStream(videoId);
  // Бэкенд возвращает то, что отдал yt-dlp; ключ отличается между ветками кода.
  const url = response.stream_url ?? response.url;
  if (!url) throw new Error('Не удалось получить ссылку на поток YouTube');
  return { url, expiresAt: Date.now() + ASSUMED_TTL_MS };
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
