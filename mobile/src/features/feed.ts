import { songSignature, songTitleKey } from '../api/songText';
import type { Track } from '../api/types';
import type { TasteProfile } from './taste';

/**
 * Сборка ленты подсказок из нескольких радио.
 *
 * Чистые функции, без React и без сети: именно здесь живёт вся наша часть
 * рекомендаций, и именно её имеет смысл проверять. Кто и когда их зовёт —
 * дело recommend.ts.
 */

/** Итоговая длина ленты. */
const FEED_LIMIT = 40;
/** Не больше двух треков одного исполнителя во всей ленте. */
const MAX_PER_ARTIST = 2;

/**
 * Забирает из каждого радио по одному по кругу.
 *
 * Обычная склейка списков дала бы двадцать пять треков первой затравки,
 * потом двадцать пять второй. До второй затравки пользователь при этом
 * не доскроллит никогда.
 */
export function interleave(lists: readonly Track[][]): Track[] {
  const out: Track[] = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));

  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const track = list[i];
      if (track) out.push(track);
    }
  }

  return out;
}

/**
 * Отсев и потолок на исполнителя. Порядок сохраняется — он уже
 * осмысленный после перемешивания.
 */
export function refine(
  candidates: readonly Track[],
  taste: Pick<TasteProfile, 'heard' | 'heardSongs' | 'avoided'>,
  limit = FEED_LIMIT,
): Track[] {
  const seen = new Set<string>();
  const seenSongs = new Set<string>();
  const perArtist = new Map<string, number>();
  const out: Track[] = [];

  for (const track of candidates) {
    const id = track.youtubeId;
    if (!id) continue;

    if (seen.has(id)) continue;            // тот же ролик попал в два радио
    if (taste.heard.has(id)) continue;     // уже слышали — это не подсказка
    if (taste.avoided.has(track.author)) continue;

    // Уже слышали эту песню у этого же исполнителя — не подсказка.
    if (taste.heardSongs.has(songSignature(track.title, track.author))) continue;

    // Внутри одной ленты одно название встречается один раз, кто бы его
    // ни исполнял: два «We Will Rock You» подряд читаются как сбой.
    const song = songTitleKey(track.title, track.author);
    if (seenSongs.has(song)) continue;

    const count = perArtist.get(track.author) ?? 0;
    if (count >= MAX_PER_ARTIST) continue;

    seen.add(id);
    seenSongs.add(song);
    perArtist.set(track.author, count + 1);
    out.push(track);

    if (out.length >= limit) break;
  }

  return out;
}
