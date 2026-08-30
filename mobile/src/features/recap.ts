import { useMemo } from 'react';
import { eventsBetween, usePlayEvents, type PlayEvent } from '../local/plays';

/**
 * Месячный рекап — считается на устройстве из журнала прослушиваний.
 *
 * Сервер не нужен: данные и так лежат локально, а без сети рекап должен
 * открываться так же, как с ней.
 *
 * Ранжируем по времени, а не по числу запусков. Запуск легко накрутить
 * перелистыванием, а секунды — нет: они отражают, что действительно
 * слушали, а не что попалось в очереди.
 */

export interface ArtistSummary {
  author: string;
  seconds: number;
  plays: number;
}

export interface TrackSummary {
  trackId: string;
  title: string;
  author: string;
  seconds: number;
  plays: number;
}

export interface Recap {
  /** Границы периода, unix ms. */
  from: number;
  to: number;

  totalSeconds: number;
  totalPlays: number;
  uniqueTracks: number;
  uniqueArtists: number;

  topArtists: ArtistSummary[];
  topTracks: TrackSummary[];
  /** Исполнители, которых не было в предыдущем периоде. */
  newArtists: string[];

  /** День с наибольшим временем прослушивания, unix ms начала суток. */
  busiestDay: number | null;
  /** Час суток 0–23, в который слушали больше всего. */
  favoriteHour: number | null;
  /** Доля дослушанных треков, 0–1. Показывает, насколько попадало во вкус. */
  completionRate: number;

  isEmpty: boolean;
}

/** Границы месяца по смещению: 0 — текущий, 1 — прошлый, и так далее. */
export function monthRange(offset = 0): { from: number; to: number } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - offset, 1).getTime();
  const to = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1).getTime();
  return { from, to };
}

function startOfDay(timestamp: number): number {
  const d = new Date(timestamp);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function topBy<T>(map: Map<string, T>, seconds: (item: T) => number, limit: number): T[] {
  return [...map.values()].sort((a, b) => seconds(b) - seconds(a)).slice(0, limit);
}

export function computeRecap(
  events: readonly PlayEvent[],
  from: number,
  to: number,
  previous: readonly PlayEvent[] = [],
  limit = 10,
): Recap {
  const empty: Recap = {
    from,
    to,
    totalSeconds: 0,
    totalPlays: 0,
    uniqueTracks: 0,
    uniqueArtists: 0,
    topArtists: [],
    topTracks: [],
    newArtists: [],
    busiestDay: null,
    favoriteHour: null,
    completionRate: 0,
    isEmpty: true,
  };

  if (events.length === 0) return empty;

  const artists = new Map<string, ArtistSummary>();
  const tracks = new Map<string, TrackSummary>();
  const byDay = new Map<number, number>();
  const byHour = new Array<number>(24).fill(0);

  let totalSeconds = 0;
  let completed = 0;

  for (const event of events) {
    totalSeconds += event.seconds;
    if (event.completed) completed += 1;

    const artist = artists.get(event.author) ?? {
      author: event.author,
      seconds: 0,
      plays: 0,
    };
    artist.seconds += event.seconds;
    artist.plays += 1;
    artists.set(event.author, artist);

    const track = tracks.get(event.trackId) ?? {
      trackId: event.trackId,
      title: event.title,
      author: event.author,
      seconds: 0,
      plays: 0,
    };
    track.seconds += event.seconds;
    track.plays += 1;
    tracks.set(event.trackId, track);

    const day = startOfDay(event.startedAt);
    byDay.set(day, (byDay.get(day) ?? 0) + event.seconds);
    byHour[new Date(event.startedAt).getHours()] += event.seconds;
  }

  const before = new Set(previous.map((e) => e.author));
  const newArtists = [...artists.keys()].filter((name) => !before.has(name));

  let busiestDay: number | null = null;
  let busiestSeconds = 0;
  for (const [day, seconds] of byDay) {
    if (seconds > busiestSeconds) {
      busiestSeconds = seconds;
      busiestDay = day;
    }
  }

  const peak = Math.max(...byHour);
  const favoriteHour = peak > 0 ? byHour.indexOf(peak) : null;

  return {
    from,
    to,
    totalSeconds,
    totalPlays: events.length,
    uniqueTracks: tracks.size,
    uniqueArtists: artists.size,
    topArtists: topBy(artists, (a) => a.seconds, limit),
    topTracks: topBy(tracks, (t) => t.seconds, limit),
    newArtists: newArtists.slice(0, limit),
    busiestDay,
    favoriteHour,
    completionRate: events.length > 0 ? completed / events.length : 0,
    isEmpty: false,
  };
}

/**
 * Рекап за месяц. offset: 0 — текущий, 1 — прошлый.
 *
 * Подписан на журнал, поэтому пересчитывается по мере прослушивания —
 * текущий месяц виден в реальном времени, а не только первого числа.
 */
export function useMonthlyRecap(offset = 0, limit = 10): Recap {
  const all = usePlayEvents();

  return useMemo(() => {
    const { from, to } = monthRange(offset);
    const previous = monthRange(offset + 1);
    return computeRecap(
      eventsBetween(from, to),
      from,
      to,
      eventsBetween(previous.from, previous.to),
      limit,
    );
    // all в зависимостях намеренно: сам массив не используется, но его
    // смена — сигнал, что журнал пополнился и пора пересчитать.
  }, [all, offset, limit]);
}
