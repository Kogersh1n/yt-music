import { useSyncExternalStore } from 'react';
import { readJSON, writeJSON } from './storage';
import { trackKey, type Track } from '../api/types';

/**
 * Недавно прослушанное — источник для секции «Слушать снова» на главной.
 * Хранится целиком (а не только id), чтобы главная рисовалась мгновенно,
 * не дожидаясь сети.
 */

const KEY = 'recents.v1';
const LIMIT = 20;

let recents: Track[] = readJSON<Track[]>(KEY, []);
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function pushRecent(track: Track): void {
  // Тот же трек не должен плодить дубликаты — поднимаем его наверх.
  // Сравниваем по каноническому ключу: скачанная песня и она же с ютуба
  // это одна вещь, и в «недавнем» она должна быть одной строкой.
  const key = trackKey(track);
  const next = [track, ...recents.filter((item) => trackKey(item) !== key)].slice(0, LIMIT);
  recents = next;
  writeJSON(KEY, next);
  listeners.forEach((listener) => listener());
}

export function useRecents(): readonly Track[] {
  return useSyncExternalStore(subscribe, () => recents);
}
