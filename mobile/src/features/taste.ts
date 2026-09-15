import { songSignature } from '../api/songText';
import type { PlayEvent } from '../local/plays';

/**
 * Профиль вкуса — что мы знаем о слушателе по его собственным действиям.
 *
 * Считается целиком на устройстве: журнал прослушиваний и лайки и так
 * лежат локально, а отправлять историю прослушивания на сервер ради
 * подсказок — обмен, который делать не хочется.
 *
 * Три сигнала, и они очень разной силы:
 *
 *   Дослушал до конца — сильный плюс. Человек не переключил, хотя мог
 *   в любую секунду. Это самое честное «нравится», какое есть.
 *
 *   Пропустил — сильный минус, и по объёму данных он главный. Лайк ставят
 *   редко и вдумчиво, пропускают часто и не задумываясь, поэтому именно
 *   пропуски быстрее всего очерчивают границы вкуса.
 *
 *   Лайк — тоже плюс, самый весомый на событие, но их единицы. Затухания
 *   у него нет намеренно: лайк это не «понравилось тогда», а «нравится».
 *
 * Всё остальное — веса и полураспад — подобрано, а не выведено. Менять их
 * стоит, глядя на выдачу, а не на формулу.
 *
 * Модуль намеренно не знает ни про React, ни про хранилище: только вход,
 * только выход. Иначе его нельзя было бы проверить, не поднимая всё
 * приложение целиком — см. __tests__/taste.check.ts. Хук живёт
 * в recommend.ts.
 */

/** Дослушал ≥80% (так считает plays.ts) — самый надёжный плюс. */
const WEIGHT_COMPLETED = 3;
/** Слушал заметную часть, но переключил — слабый плюс. */
const WEIGHT_PARTIAL = 1;
/** Выключил почти сразу. */
const WEIGHT_SKIP = -2;
/** Лайк. Не затухает. */
const WEIGHT_LIKE = 5;

/** Ниже этой доли считаем, что трек не слушали, а пролистнули. */
const SKIP_RATIO = 0.3;

/**
 * За сколько дней вклад события падает вдвое.
 *
 * Месяц — компромисс. Короче, и профиль дёргается от одного вечера;
 * длиннее, и то, что разонравилось полгода назад, продолжает
 * определять выдачу.
 */
const HALF_LIFE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Идентификатор ролика на ютубе — ровно 11 символов из ограниченного набора. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export interface ArtistTaste {
  author: string;
  score: number;
  plays: number;
  skips: number;
}

export interface Seed {
  videoId: string;
  title: string;
  author: string;
  score: number;
}

export interface TasteProfile {
  /** Исполнители по убыванию симпатии. Отрицательные тоже здесь. */
  artists: ArtistTaste[];
  /** Треки, от которых имеет смысл строить радио. Уже разнесены по исполнителям. */
  seeds: Seed[];
  /** Услышанные videoId. Точное совпадение ролика. */
  heard: ReadonlySet<string>;
  /**
   * Отпечатки услышанных песен. Ловят ту же песню в другой загрузке —
   * клип, концерт, перезалив: videoId у них разные, песня одна.
   */
  heardSongs: ReadonlySet<string>;
  /** Исполнители, которых стабильно пропускают. */
  avoided: ReadonlySet<string>;
  /** Сколько событий легло в основу. По нему решаем, хватает ли данных. */
  sampleSize: number;
  isEmpty: boolean;
}

const EMPTY: TasteProfile = {
  artists: [],
  seeds: [],
  heard: new Set(),
  heardSongs: new Set(),
  avoided: new Set(),
  sampleSize: 0,
  isEmpty: true,
};

/**
 * Насколько событие ещё весит. Сегодняшнее — единица, месячной
 * давности — половина, двухмесячное — четверть.
 */
function decay(startedAt: number, now: number): number {
  const ageDays = Math.max(0, (now - startedAt) / DAY_MS);
  return 0.5 ** (ageDays / HALF_LIFE_DAYS);
}

/** Во что превращается одно событие журнала. */
function eventWeight(event: PlayEvent): number {
  if (event.completed) return WEIGHT_COMPLETED;

  const ratio = event.duration > 0 ? event.seconds / event.duration : 0;
  return ratio < SKIP_RATIO ? WEIGHT_SKIP : WEIGHT_PARTIAL;
}

/**
 * Затравки разносим по исполнителям.
 *
 * Без этого верх списка занимает один артист, которого слушали последнюю
 * неделю, все радио строятся от него, и выдача схлопывается в него же.
 * Один трек на исполнителя — и подсказки покрывают весь круг интересов,
 * а не последнее увлечение.
 */
function spreadByArtist(seeds: Seed[], limit: number): Seed[] {
  const used = new Set<string>();
  const out: Seed[] = [];

  for (const seed of seeds) {
    if (used.has(seed.author)) continue;
    used.add(seed.author);
    out.push(seed);
    if (out.length >= limit) break;
  }

  // Исполнителей оказалось меньше, чем нужно затравок — добираем
  // лучшими из оставшихся, повторы уже допустимы.
  if (out.length < limit) {
    for (const seed of seeds) {
      if (out.includes(seed)) continue;
      out.push(seed);
      if (out.length >= limit) break;
    }
  }

  return out;
}

export function computeTaste(
  events: readonly PlayEvent[],
  likedIds: readonly string[],
  now: number = Date.now(),
  seedLimit = 4,
): TasteProfile {
  if (events.length === 0 && likedIds.length === 0) return EMPTY;

  const artists = new Map<string, ArtistTaste>();
  const tracks = new Map<string, Seed>();
  const heard = new Set<string>();
  const heardSongs = new Set<string>();

  for (const event of events) {
    const weight = eventWeight(event) * decay(event.startedAt, now);

    const artist = artists.get(event.author) ?? {
      author: event.author,
      score: 0,
      plays: 0,
      skips: 0,
    };
    artist.score += weight;
    artist.plays += 1;
    if (weight < 0) artist.skips += 1;
    artists.set(event.author, artist);

    // Отпечаток считаем и для треков из медиатеки: песня могла быть
    // услышана там, а прийти в подсказках уже с ютуба.
    heardSongs.add(songSignature(event.title, event.author));

    if (!event.youtubeId) continue;
    heard.add(event.youtubeId);

    const track = tracks.get(event.youtubeId) ?? {
      videoId: event.youtubeId,
      title: event.title,
      author: event.author,
      score: 0,
    };
    track.score += weight;
    tracks.set(event.youtubeId, track);
  }

  // Лайки поверх журнала. Ключ лайкнутого трека с ютуба — это и есть
  // videoId (см. trackKey), поэтому лайк работает затравкой даже для
  // трека, которого в журнале нет: включили и сразу лайкнули.
  for (const id of likedIds) {
    if (!VIDEO_ID.test(id)) continue; // ключ из медиатеки — это UUID, радио по нему не построить

    const known = tracks.get(id);
    if (known) {
      known.score += WEIGHT_LIKE;
      const artist = artists.get(known.author);
      if (artist) artist.score += WEIGHT_LIKE;
    } else {
      tracks.set(id, {
        videoId: id,
        title: '',
        author: '',
        score: WEIGHT_LIKE,
      });
    }
  }

  const rankedArtists = [...artists.values()].sort((a, b) => b.score - a.score);

  const avoided = new Set(
    rankedArtists
      // Одного пропуска мало: мимо трека можно пролистнуть случайно.
      // Два и устойчиво отрицательный итог — уже закономерность.
      .filter((artist) => artist.score < 0 && artist.skips >= 2)
      .map((artist) => artist.author),
  );

  const rankedSeeds = [...tracks.values()]
    .filter((seed) => seed.score > 0 && !avoided.has(seed.author))
    .sort((a, b) => b.score - a.score);

  return {
    artists: rankedArtists,
    seeds: spreadByArtist(rankedSeeds, seedLimit),
    heard,
    heardSongs,
    avoided,
    sampleSize: events.length,
    isEmpty: rankedSeeds.length === 0,
  };
}
