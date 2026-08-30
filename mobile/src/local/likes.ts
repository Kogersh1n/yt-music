import { useSyncExternalStore, useCallback } from 'react';
import { readJSON, writeJSON } from './storage';

/**
 * «Мои лайки» на устройстве.
 *
 * На бэкенде персональных лайков пока нет: `SongResponse.liked` — это общий
 * счётчик, а `POST /songs/{id}/like` не имеет тела в сервисе и ничего не делает.
 * Поэтому храним лайки локально. Интерфейс совпадает с будущим серверным:
 * когда появится auth и `/me/likes`, меняется только реализация этого файла.
 */

const KEY = 'likes.v1';

let liked: Set<string> = new Set(readJSON<string[]>(KEY, []));
const listeners = new Set<() => void>();
/** Снимок для useSyncExternalStore должен быть стабильным по ссылке. */
let snapshot: readonly string[] = Object.freeze([...liked]);

function commit(): void {
  snapshot = Object.freeze([...liked]);
  writeJSON(KEY, [...liked]);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function toggleLike(songId: string): void {
  if (liked.has(songId)) liked.delete(songId);
  else liked.add(songId);
  commit();
}

export function isLiked(songId: string): boolean {
  return liked.has(songId);
}

/** Все лайки. Порядок — как добавляли. */
export function useLikedIds(): readonly string[] {
  return useSyncExternalStore(subscribe, () => snapshot);
}

/** Подписка на один трек: перерисовывается только эта строка, а не весь список. */
export function useIsLiked(songId: string): boolean {
  const getSnapshot = useCallback(() => liked.has(songId), [songId]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
