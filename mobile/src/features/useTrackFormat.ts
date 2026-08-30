import { useEffect, useState } from 'react';
import TrackPlayer from 'react-native-track-player';
import { resolveStreamUrl } from '../player/streamUrls';
import type { Track } from '../api/types';

/**
 * Формат и битрейт трека.
 *
 * В API этих полей нет — `SongResponse` содержит только название, автора,
 * длительность и ключи файлов. Поэтому размер берётся у хранилища запросом
 * первого байта: ответ на `Range: bytes=0-0` несёт заголовок `Content-Range`
 * с полным размером, а `Content-Type` — тип файла.
 *
 * Именно ranged GET, а не HEAD: ссылка подписана для метода GET, и смена
 * метода сломала бы подпись.
 */

export interface TrackFormat {
  /** «MP3», «AAC», «OPUS». */
  codec: string;
  /** Средний битрейт в кбит/с. null — размер получить не удалось. */
  kbps: number | null;
}

/** Дольше ждать нет смысла: это украшение, а не содержимое экрана. */
const TIMEOUT_MS = 8000;

/** Тип содержимого → короткое имя кодека. */
const BY_MIME: [RegExp, string][] = [
  [/opus/i, 'OPUS'],
  [/(aac|mp4a|m4a)/i, 'AAC'],
  [/(mpeg|mp3)/i, 'MP3'],
  [/flac/i, 'FLAC'],
  [/(vorbis|ogg)/i, 'OGG'],
  [/wav/i, 'WAV'],
];

function codecFromMime(mime: string | null): string | null {
  if (!mime) return null;
  for (const [pattern, name] of BY_MIME) {
    if (pattern.test(mime)) return name;
  }
  return null;
}

/** Запасной вариант — расширение в ссылке, когда сервер не сказал тип. */
function codecFromUrl(url: string): string | null {
  const withoutQuery = url.split('?')[0];
  const match = /\.([a-z0-9]{2,4})$/i.exec(withoutQuery);
  if (!match) return null;
  const extension = match[1].toUpperCase();
  return extension === 'M4A' ? 'AAC' : extension;
}

/** `bytes 0-0/12345678` → 12345678. */
function totalFromContentRange(header: string | null): number | null {
  if (!header) return null;
  const match = /\/(\d+)\s*$/.exec(header);
  if (!match) return null;
  const total = Number(match[1]);
  return Number.isFinite(total) && total > 0 ? total : null;
}

const cache = new Map<string, TrackFormat>();

/**
 * Длительность, на которую делим размер.
 *
 * Предпочитаем ту, что знает движок: она измерена по самому файлу. Значение
 * из метаданных бывает приблизительным (а у демо-набора и вовсе выдуманным),
 * и битрейт тогда врёт пропорционально расхождению.
 *
 * Читаем разово, без подписки: useProgress() обновляется раз в секунду и
 * перерисовывал бы весь экран плеера.
 */
async function resolveDuration(track: Track): Promise<number> {
  try {
    const active = await TrackPlayer.getActiveTrack();
    if (active?.id === track.id) {
      const progress = await TrackPlayer.getProgress();
      if (progress.duration > 0) return progress.duration;
    }
  } catch {
    // Плеер мог быть ещё не поднят — берём метаданные.
  }
  return track.duration;
}

async function probe(track: Track, signal: AbortSignal): Promise<TrackFormat | null> {
  const url = await resolveStreamUrl(track);

  const response = await fetch(url, {
    method: 'GET',
    headers: { Range: 'bytes=0-0' },
    signal,
  });

  // 206 — сервер понял диапазон. 200 значит, что он прислал файл целиком:
  // читать его ради размера не станем.
  const total =
    response.status === 206
      ? totalFromContentRange(response.headers.get('content-range'))
      : null;

  const codec =
    codecFromMime(response.headers.get('content-type')) ?? codecFromUrl(url) ?? 'AUDIO';

  const duration = await resolveDuration(track);
  const kbps =
    total !== null && duration > 0 ? Math.round((total * 8) / duration / 1000) : null;

  return { codec, kbps };
}

/**
 * Формат текущего трека. Пока не определился — возвращает null, и бейдж
 * не показывается: пустая рамка хуже её отсутствия.
 */
export function useTrackFormat(track: Track | null): TrackFormat | null {
  const [format, setFormat] = useState<TrackFormat | null>(null);

  useEffect(() => {
    if (!track) {
      setFormat(null);
      return;
    }

    const cached = cache.get(track.id);
    if (cached) {
      setFormat(cached);
      return;
    }

    setFormat(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    void probe(track, controller.signal)
      .then((result) => {
        if (!result || controller.signal.aborted) return;
        cache.set(track.id, result);
        setFormat(result);
      })
      // Не достучались — просто не показываем бейдж.
      .catch(() => undefined)
      .finally(() => clearTimeout(timer));

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [track]);

  return format;
}
