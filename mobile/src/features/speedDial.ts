import { useMemo } from 'react';
import { usePlayEvents, type PlayEvent } from '../local/plays';
import { useRecents } from '../local/recents';
import { trackKey, type Track } from '../api/types';

/**
 * Быстрый набор — то, к чему тянешься чаще всего.
 *
 * Как «Speed dial» на главной YouTube Music: сетка обложек, листается
 * страницами. Смысл не в новизне, а наоборот — здесь лежит привычное,
 * то, что включают не выбирая. Поэтому подсказки («Для вас») и быстрый
 * набор не конкурируют: первые про то, чего вы не слышали, второй — про
 * то, что слушаете постоянно.
 *
 * Чем это отличается от «Слушать снова». Там строгий порядок по времени:
 * что играло последним, то и первое. Здесь — по тому, как часто
 * возвращаются, и один вечер запоя одним треком не выбивает из сетки
 * всё остальное.
 */

/** Три страницы по девять плиток — как в оригинале. */
export const TILES_PER_PAGE = 9;
const PAGES = 3;
const LIMIT = TILES_PER_PAGE * PAGES;

/**
 * Насколько давнее прослушивание ещё считается.
 *
 * Мягче, чем в профиле вкуса (там месяц): быстрый набор про привычки,
 * а привычки живут дольше, чем настроение.
 */
const HALF_LIFE_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

interface Candidate {
  track: Track;
  score: number;
}

function trackFromEvent(event: PlayEvent): Track | null {
  if (!event.youtubeId) return null;

  return {
    id: `yt:${event.youtubeId}`,
    title: event.title,
    author: event.author,
    duration: event.duration,
    artwork: `https://i.ytimg.com/vi/${event.youtubeId}/hq720.jpg`,
    source: 'youtube',
    youtubeId: event.youtubeId,
  };
}

/**
 * Собрать сетку.
 *
 * Считаем не время, а число возвращений: длинный трек не должен
 * вытеснять короткий только потому, что он длиннее. Пропуски не
 * вычитаем — сюда человек и так попадает по своей воле.
 */
export function buildSpeedDial(
  events: readonly PlayEvent[],
  recents: readonly Track[],
  now: number = Date.now(),
  limit = LIMIT,
): Track[] {
  const byKey = new Map<string, Candidate>();

  for (const event of events) {
    const track = trackFromEvent(event);
    if (!track) continue;

    // Совсем мимолётные запуски не считаем: пролистнули — не значит слушали.
    if (event.seconds < 15) continue;

    const key = trackKey(track);
    const ageDays = Math.max(0, (now - event.startedAt) / DAY_MS);
    const weight = 0.5 ** (ageDays / HALF_LIFE_DAYS);

    const found = byKey.get(key);
    if (found) found.score += weight;
    else byKey.set(key, { track, score: weight });
  }

  const ranked = [...byKey.values()].sort((a, b) => b.score - a.score).map((c) => c.track);

  // Журнал ещё тонкий — добираем недавним, чтобы сетка не была дырявой.
  // У недавнего обложка настоящая, а не собранная из videoId, поэтому
  // при равных правах оно даже лучше.
  if (ranked.length < limit) {
    const known = new Set(ranked.map((track) => trackKey(track)));
    for (const track of recents) {
      if (known.has(trackKey(track))) continue;
      ranked.push(track);
      if (ranked.length >= limit) break;
    }
  }

  return ranked.slice(0, limit);
}

export function useSpeedDial(): readonly Track[] {
  const events = usePlayEvents();
  const recents = useRecents();

  return useMemo(() => buildSpeedDial(events, recents), [events, recents]);
}
