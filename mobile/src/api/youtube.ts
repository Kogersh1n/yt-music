import {
  getVisitorData,
  innertube,
  INNERTUBE_USER_AGENT,
  type InnertubeClient,
} from './innertube';

/**
 * Извлечение ссылки на аудио прямо на телефоне.
 *
 * Зачем это здесь, а не на бэкенде. YouTube отказывает адресам дата-центров
 * («Sign in to confirm you're not a bot»): с сервера Oracle проходит примерно
 * один запрос из четырёх, с домашнего адреса — все. Телефон сидит на обычном
 * мобильном или домашнем интернете, и для ютуба он неотличим от любого
 * другого зрителя. Поэтому ссылку достаёт тот, кто будет по ней играть.
 *
 * Почему клиент VISIONOS. Обычные клиенты плеера (web, android, ios, tv)
 * переведены на SABR: вместо прямой ссылки они отдают serverAbrStreamingUrl,
 * играть по которому без реализации протокола нельзя. VISIONOS на SABR ещё
 * не перевели — он продолжает отдавать обычные ссылки в adaptiveFormats.
 *
 * Почему это укладывается в сотню строк. У VISIONOS нет ни подписи,
 * требующей запуска JS-плеера, ни PO-токена, ни авторизации. Весь протокол —
 * два обычных HTTP-запроса, и оба умеет fetch.
 */

const PLAYER: InnertubeClient = {
  name: 'VISIONOS',
  version: '1.02',
  id: '101',
  host: 'www.youtube.com',
  extra: {
    deviceMake: 'Apple',
    deviceModel: 'RealityDevice17,1',
    userAgent: INNERTUBE_USER_AGENT,
    osName: 'visionOS',
    osVersion: '26.5.23O471',
    hl: 'en',
    timeZone: 'UTC',
    utcOffsetMinutes: 0,
  },
};

export interface ExtractedStream {
  url: string;
  /** Момент, когда ссылка перестанет работать. Взят из самой ссылки. */
  expiresAt: number;
  mimeType: string;
  bitrate: number;
  durationSec: number;
  title: string;
  author: string;
}

interface AdaptiveFormat {
  itag: number;
  url?: string;
  mimeType?: string;
  bitrate?: number;
  signatureCipher?: string;
}

/**
 * Выбор формата.
 *
 * Предпочитаем audio/mp4 (itag 140): ExoPlayer работает с ним стабильнее
 * всего, а главное — у прогрессивного mp4 корректно считается позиция,
 * от чего зависит перемотка. Opus берём, только если mp4 не пришёл.
 */
function pickFormat(formats: AdaptiveFormat[]): AdaptiveFormat | null {
  const playable = formats.filter(
    (f) => f.url && !f.signatureCipher && f.mimeType?.startsWith('audio/'),
  );
  if (playable.length === 0) return null;

  const byBitrate = (a: AdaptiveFormat, b: AdaptiveFormat) => (b.bitrate ?? 0) - (a.bitrate ?? 0);

  const mp4 = playable.filter((f) => f.mimeType!.startsWith('audio/mp4'));
  return (mp4.length > 0 ? mp4 : playable).sort(byBitrate)[0];
}

/**
 * Срок жизни ссылки записан в ней самой, в параметре expire (unix-секунды).
 * Берём его, а не выдумываем свой: угадать короче — лишние запросы,
 * угадать длиннее — обрыв воспроизведения на середине трека.
 */
function expiryFromUrl(url: string): number {
  const match = url.match(/[?&]expire=(\d+)/);
  if (!match) return Date.now() + 60 * 60 * 1000;
  return Number(match[1]) * 1000;
}

interface PlayerResponse {
  playabilityStatus?: { status?: string; reason?: string };
  streamingData?: { adaptiveFormats?: AdaptiveFormat[] };
  videoDetails?: { title?: string; author?: string; lengthSeconds?: string };
}

function requestPlayer(videoId: string, visitor: string): Promise<PlayerResponse> {
  return innertube<PlayerResponse>(
    PLAYER,
    'player',
    {
      videoId,
      playbackContext: { contentPlaybackContext: { html5Preference: 'HTML5_PREF_WANTS' } },
      // Без этих двух флагов ролики с пометками отвечают отказом ещё до формата.
      contentCheckOk: true,
      racyCheckOk: true,
    },
    visitor,
  );
}

/**
 * Достаёт играбельную ссылку на аудио.
 *
 * Бросает исключение при любом отказе — вызывающий код должен уметь
 * откатиться на бэкенд, а не показывать пустой плеер.
 */
export async function extractStreamUrl(videoId: string): Promise<ExtractedStream> {
  let visitor = await getVisitorData();
  let data = await requestPlayer(videoId, visitor);

  // Просроченная метка сессии выглядит как LOGIN_REQUIRED. Она живёт долго,
  // но не вечно, поэтому один раз пробуем обновить её и повторить.
  if (data?.playabilityStatus?.status === 'LOGIN_REQUIRED') {
    visitor = await getVisitorData(true);
    data = await requestPlayer(videoId, visitor);
  }

  const status = data?.playabilityStatus?.status;
  if (status !== 'OK') {
    const reason = data?.playabilityStatus?.reason ?? status ?? 'причина неизвестна';
    throw new Error(`YouTube не отдал трек: ${reason}`);
  }

  const format = pickFormat(data?.streamingData?.adaptiveFormats ?? []);
  if (!format?.url) {
    // Так выглядит перевод клиента на SABR: статус OK, а ссылок нет.
    throw new Error('YouTube не отдал прямых ссылок на аудио');
  }

  return {
    url: format.url,
    expiresAt: expiryFromUrl(format.url),
    mimeType: format.mimeType ?? 'audio/mp4',
    bitrate: format.bitrate ?? 0,
    durationSec: Number(data?.videoDetails?.lengthSeconds ?? 0),
    title: String(data?.videoDetails?.title ?? ''),
    author: String(data?.videoDetails?.author ?? ''),
  };
}
