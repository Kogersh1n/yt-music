import { looksLikeSame, tokens } from './songText';
import type { Track } from './types';
import {
  collect,
  findFirst,
  getVisitorData,
  innertube,
  isString,
  type InnertubeClient,
} from './innertube';

/**
 * То, что знает YouTube Music и не знает обычный YouTube.
 *
 * Две вещи, ради которых сюда ходим:
 *
 *   Обложка. У обычного ролика есть только кадр 16:9 — обрезанный клип
 *   с чёрными полями по бокам, если его вписать в квадрат. У YouTube Music
 *   на ту же песню лежит настоящая обложка альбома, квадратная.
 *
 *   Текст. У клипа его нет вовсе: вкладка «Текст» в ответе приходит
 *   отключённой. Он есть у аудиозаписи — отдельной сущности с собственным
 *   идентификатором. Поэтому и нужен поиск: по названию и исполнителю
 *   находим аудиозапись и дальше работаем уже с ней.
 */

export const MUSIC: InnertubeClient = {
  name: 'WEB_REMIX',
  version: '1.20250101.01.00',
  id: '67',
  host: 'music.youtube.com',
  extra: { hl: 'ru', gl: 'KZ' },
};

/**
 * Фильтр «Песни» в поиске.
 *
 * Закодированное protobuf-поле; без него в выдачу попадают клипы, альбомы
 * и плейлисты, а нужна именно аудиозапись — только у неё есть текст.
 */
const SONGS_FILTER = 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D';

export interface MusicTrack {
  /** Идентификатор аудиозаписи. Не тот же, что у клипа. */
  videoId: string;
  title: string;
  artist: string;
  /** Квадратная обложка, уже нужного размера. */
  coverUrl: string | null;
}

/**
 * Подогнать размер обложки.
 *
 * В выдаче приходит миниатюра 120×120 — для полноэкранного плеера это
 * мыло. Размер зашит в сам адрес, и его можно попросить любым: сервер
 * отдаёт готовый файл, а не масштабирует клиент.
 */
function sized(url: string, size: number): string {
  const base = url.split('=')[0];
  return `${base}=w${size}-h${size}-l90-rj`;
}

interface Thumb {
  url: string;
  width: number;
  height: number;
}

function isThumbList(value: unknown): value is Thumb[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof (value[0] as Thumb)?.url === 'string' &&
    typeof (value[0] as Thumb)?.width === 'number'
  );
}

/** Текст колонки списка: он разложен на «пробеги» и склеивается обратно. */
function columnText(column: unknown): string {
  const runs = findFirst<{ text?: string }[]>(
    column,
    'runs',
    (v): v is { text?: string }[] => Array.isArray(v),
  );
  if (!runs) return '';
  return runs.map((run) => run.text ?? '').join('');
}

/**
 * Найти аудиозапись по названию и исполнителю.
 *
 * Берём первый результат — выдача отсортирована по релевантности, — но
 * только если он действительно похож на запрошенное. Иначе возвращаем null:
 * у любительских загрузок и миксов аудиозаписи в YouTube Music просто нет,
 * и честнее не показать обложку, чем показать чужую.
 */
export async function findSong(
  title: string,
  artist: string,
  coverSize = 544,
): Promise<MusicTrack | null> {
  const visitor = await getVisitorData();
  const data = await innertube<unknown>(MUSIC, 'search', {
    query: `${title} ${artist}`.trim(),
    params: SONGS_FILTER,
  }, visitor);

  const items = collect(data, 'musicResponsiveListItemRenderer');
  if (items.length === 0) return null;

  const item = items[0];
  const videoId = findFirst(item, 'videoId', isString);
  if (!videoId) return null;

  const thumbs = findFirst(item, 'thumbnails', isThumbList);
  const square = thumbs?.filter((t) => t.width === t.height) ?? [];
  const best = square.length > 0 ? square[square.length - 1] : null;

  const columns = (item as { flexColumns?: unknown[] })?.flexColumns ?? [];
  const foundTitle = columnText(columns[0]) || title;
  const foundArtist = columnText(columns[1]).split('•')[0].trim() || artist;

  if (!looksLikeSame(`${title} ${artist}`, `${foundTitle} ${foundArtist}`)) return null;

  return {
    videoId,
    title: foundTitle,
    artist: foundArtist,
    coverUrl: best ? sized(best.url, coverSize) : null,
  };
}

export interface Lyrics {
  text: string;
  /** Кто предоставил текст — YouTube требует это показывать. */
  source: string | null;
}

/**
 * Текст аудиозаписи.
 *
 * Два шага, и первый нельзя пропустить: идентификатор страницы с текстом
 * выдаётся в ответе `next` и у каждой записи свой. Если вкладка пришла
 * отключённой — текста для этой записи нет, и это нормальный ответ,
 * а не сбой.
 */
export async function getLyrics(songVideoId: string): Promise<Lyrics | null> {
  const visitor = await getVisitorData();
  const next = await innertube<unknown>(MUSIC, 'next', { videoId: songVideoId }, visitor);

  const tabs = collect(next, 'tabRenderer');
  const lyricsTab = tabs.find((tab) => {
    const title = (tab as { title?: string })?.title;
    return title === 'Текст' || title === 'Lyrics';
  }) as { unselectable?: boolean; endpoint?: unknown } | undefined;

  if (!lyricsTab || lyricsTab.unselectable) return null;

  const browseId = findFirst(lyricsTab.endpoint, 'browseId', isString);
  if (!browseId) return null;

  const page = await innertube<unknown>(MUSIC, 'browse', { browseId }, visitor);

  // Текст приходит одним куском в самом длинном «пробеге» на странице.
  // Разбирать по точному пути нельзя: он отличается у песен с таймкодами
  // и без них.
  const runs = collect(page, 'runs') as { text?: string }[][];
  let longest = '';
  for (const run of runs) {
    if (!Array.isArray(run)) continue;
    const joined = run.map((r) => r.text ?? '').join('');
    if (joined.length > longest.length) longest = joined;
  }

  if (longest.trim().length < 40) return null;

  const footer = findFirst(page, 'footer', (v): v is unknown => v !== undefined);
  const source = footer ? columnText(footer) || null : null;

  return { text: longest, source };
}

/**
 * Песни исполнителя.
 *
 * Берём поиском по имени с фильтром «Песни», а не страницей артиста.
 * Причина простая: страница артиста адресуется browseId, а у нас на руках
 * почти всегда только имя — оно приходит из журнала прослушиваний, где
 * идентификаторов каналов нет. Искать по имени работает всегда.
 *
 * Отсев по исполнителю обязателен: поиск по имени охотно подмешивает
 * каверы, ремиксы чужих исполнителей и просто похожие названия. Сверяем
 * значимые слова имени — той же функцией, что и везде.
 */
export async function artistTracks(artist: string, limit = 30): Promise<Track[]> {
  const visitor = await getVisitorData();
  const data = await innertube<unknown>(MUSIC, 'search', {
    query: artist,
    params: SONGS_FILTER,
  }, visitor);

  const items = collect(data, 'musicResponsiveListItemRenderer');
  const wanted = tokens(artist);

  const out: Track[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const videoId = findFirst(item, 'videoId', isString);
    if (!videoId || seen.has(videoId)) continue;

    const columns = (item as { flexColumns?: unknown[] })?.flexColumns ?? [];
    const title = columnText(columns[0]);
    const found = columnText(columns[1]).split('•')[0].trim();
    if (!title) continue;

    // Имя исполнителя должно совпасть хотя бы наполовину значимых слов,
    // иначе в список артиста попадают чужие каверы.
    const got = tokens(found);
    if (wanted.size > 0 && got.size > 0) {
      let hits = 0;
      for (const word of wanted) if (got.has(word)) hits += 1;
      if (hits / wanted.size < 0.5) continue;
    }

    const thumbs = findFirst(item, 'thumbnails', isThumbList);
    const square = thumbs?.filter((t) => t.width === t.height) ?? [];
    const best = square.length > 0 ? square[square.length - 1] : null;

    seen.add(videoId);
    out.push({
      id: `yt:${videoId}`,
      title,
      author: found || artist,
      duration: 0,
      artwork: best ? sized(best.url, 256) : `https://i.ytimg.com/vi/${videoId}/hq720.jpg`,
      source: 'youtube',
      youtubeId: videoId,
    });

    if (out.length >= limit) break;
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Поиск по разделам                                                   */
/* ------------------------------------------------------------------ */

/**
 * Фильтры выдачи. Те же закодированные protobuf-поля, что и у песен:
 * без них поиск возвращает смесь всего подряд, разложенную по секциям,
 * и разбирать её пришлось бы по структуре ответа, которая меняется.
 * Отдельный запрос на раздел надёжнее.
 */
const ARTISTS_FILTER = 'EgWKAQIgAWoKEAkQChAFEAMQBA%3D%3D';
const ALBUMS_FILTER = 'EgWKAQIYAWoKEAkQChAFEAMQBA%3D%3D';

export interface FoundArtist {
  name: string;
  /** Идентификатор канала. Пригодится, когда понадобится страница артиста целиком. */
  browseId: string | null;
  /** Настоящий портрет, а не обложка трека. */
  avatar: string | null;
  /** «Исполнитель • 102 млн слушателей в месяц». */
  subtitle: string;
}

export interface FoundAlbum {
  title: string;
  /** «Альбом • Queen • 1991» — разбирать на части не пытаемся, показываем как есть. */
  subtitle: string;
  cover: string | null;
}

/** Текст колонки выдачи: у разных разделов он собран из нескольких кусков. */
function flexText(column: unknown): string {
  const runs =
    (column as { musicResponsiveListItemFlexColumnRenderer?: { text?: { runs?: { text?: string }[] } } })
      ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? [];
  return runs.map((run) => run.text ?? '').join('');
}

function biggest(item: unknown, size: number): string | null {
  const thumbs = findFirst(item, 'thumbnails', isThumbList);
  if (!thumbs || thumbs.length === 0) return null;

  const last = thumbs[thumbs.length - 1];
  return sized(last.url, size);
}

export async function searchArtists(query: string, limit = 8): Promise<FoundArtist[]> {
  const visitor = await getVisitorData();
  const data = await innertube<unknown>(MUSIC, 'search', { query, params: ARTISTS_FILTER }, visitor);

  const out: FoundArtist[] = [];
  for (const item of collect(data, 'musicResponsiveListItemRenderer')) {
    const columns = (item as { flexColumns?: unknown[] })?.flexColumns ?? [];
    const name = flexText(columns[0]);
    if (!name) continue;

    out.push({
      name,
      browseId: findFirst(item, 'browseId', isString),
      avatar: biggest(item, 240),
      subtitle: flexText(columns[1]),
    });

    if (out.length >= limit) break;
  }
  return out;
}

export async function searchAlbums(query: string, limit = 12): Promise<FoundAlbum[]> {
  const visitor = await getVisitorData();
  const data = await innertube<unknown>(MUSIC, 'search', { query, params: ALBUMS_FILTER }, visitor);

  const out: FoundAlbum[] = [];
  for (const item of collect(data, 'musicResponsiveListItemRenderer')) {
    const columns = (item as { flexColumns?: unknown[] })?.flexColumns ?? [];
    const title = flexText(columns[0]);
    if (!title) continue;

    out.push({ title, subtitle: flexText(columns[1]), cover: biggest(item, 320) });
    if (out.length >= limit) break;
  }
  return out;
}
