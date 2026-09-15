import { collect, getVisitorData, innertube } from './innertube';
import { MUSIC } from './ytmusic';
import type { Track } from './types';

/**
 * Радио — похожие треки к заданному.
 *
 * Это и есть источник рекомендаций. Своего движка похожести у приложения
 * нет и быть не может: он строится на том, что миллионы людей слушают
 * подряд, а у нас один пользователь. Зато такой движок есть у YouTube,
 * и он доступен тем же запросом, которым мы уже ходим за обложками.
 *
 * Приём. Обычный `next` по videoId возвращает один трек — сам себя.
 * Очередь разворачивается, только если попросить конкретный плейлист:
 * `RDAMVM<videoId>` — это идентификатор авторадио по ролику. Тогда в
 * ответ приходит полсотни треков того же круга. Проверено: Bohemian
 * Rhapsody даёт Beatles, AC/DC, Guns N' Roses, a-ha — ровно ту музыку,
 * рядом с которой её и слушают.
 *
 * Что здесь наше, а что нет. Список кандидатов — от YouTube. Выбор
 * затравок, отсев уже слышанного и перемешивание по исполнителям —
 * наше, см. features/recommend.ts. Без этой части радио выродилось бы
 * в «ещё пять песен того же исполнителя».
 */

/** Префикс авторадио по ролику. Без него очередь состоит из одного трека. */
const RADIO_PREFIX = 'RDAMVM';

interface PanelItem {
  videoId?: string;
  title?: { runs?: { text?: string }[] };
  /** Чистое имя исполнителя. В longBylineText к нему примешаны просмотры и лайки. */
  shortBylineText?: { runs?: { text?: string }[] };
  lengthText?: { runs?: { text?: string }[] };
  thumbnail?: { thumbnails?: { url?: string; width?: number }[] };
}

function firstRun(node: { runs?: { text?: string }[] } | undefined): string {
  return node?.runs?.[0]?.text ?? '';
}

/** «4:56» → 296, «1:19:21» → 4761. Непонятное — ноль, трек от этого не сломается. */
function seconds(label: string): number {
  const parts = label.split(':').map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

/**
 * Обложка — из ответа, а не собранная из videoId.
 *
 * Собирать адрес самому заманчиво, но hq720.jpg существует не у каждого
 * ролика: у части их просто нет, и карточка оставалась чёрной. Радио же
 * присылает готовые миниатюры, и они уже обрезаны сервером в 16:9
 * (400×225, 480×270) — это не тот hqdefault.jpg с вжатыми полями,
 * от которого мы отказались раньше.
 *
 * Запасной путь оставлен на случай ответа без миниатюр.
 */
function artwork(item: PanelItem, videoId: string): string {
  const list = item.thumbnail?.thumbnails ?? [];

  let best: string | null = null;
  let widest = 0;
  for (const thumb of list) {
    if (thumb.url && (thumb.width ?? 0) >= widest) {
      widest = thumb.width ?? 0;
      best = thumb.url;
    }
  }

  return best ?? `https://i.ytimg.com/vi/${videoId}/hq720.jpg`;
}

function toTrack(item: PanelItem): Track | null {
  const videoId = item.videoId;
  if (!videoId) return null;

  const title = firstRun(item.title);
  if (!title) return null;

  return {
    id: `yt:${videoId}`,
    title,
    author: firstRun(item.shortBylineText) || 'Неизвестный исполнитель',
    duration: seconds(firstRun(item.lengthText)),
    artwork: artwork(item, videoId),
    source: 'youtube',
    youtubeId: videoId,
  };
}

/**
 * Треки, которые YouTube ставит рядом с этим.
 *
 * Первый элемент ответа — сам исходный трек, поэтому он отбрасывается.
 * Ошибку не глушим: вызывающий решает, показать ли раздел вообще.
 */
export async function relatedTracks(videoId: string, limit = 25): Promise<Track[]> {
  const visitor = await getVisitorData();

  const data = await innertube<unknown>(
    MUSIC,
    'next',
    {
      videoId,
      playlistId: `${RADIO_PREFIX}${videoId}`,
      isAudioOnly: true,
    },
    visitor,
  );

  const panel = collect(data, 'playlistPanelVideoRenderer') as PanelItem[];

  const tracks: Track[] = [];
  for (const item of panel) {
    // Затравка стоит первой в собственном радио — она пользователю не новость.
    if (item.videoId === videoId) continue;

    const track = toTrack(item);
    if (track) tracks.push(track);
    if (tracks.length >= limit) break;
  }

  return tracks;
}
