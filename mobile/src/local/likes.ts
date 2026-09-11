import { useSyncExternalStore, useCallback } from 'react';
import { readJSON, writeJSON } from './storage';
import { addLike, removeLike, listLiked } from '../api/songs';
import { trackKey, type SongResponse, type Track } from '../api/types';

/**
 * Лайки.
 *
 * Хранятся и на устройстве, и на сервере, и это не дублирование,
 * а разделение ролей.
 *
 * Локальная копия — источник для интерфейса: лайк ставят на бегу, отклик
 * должен быть мгновенным и работать без сети. Она же единственное место,
 * где живут лайки на треки, которых нет в медиатеке: связь на сервере
 * ведёт на запись песни, а у играющего по ссылке такой записи нет.
 *
 * Сервер — то, что переживёт переустановку. Раньше лайки были только
 * в MMKV, и снос приложения стирал их подчистую, хотя таблица
 * liked_songs и ручка /songs/liked на бэкенде давно работали.
 *
 * Расхождение решается в пользу объединения: при входе серверные лайки
 * добавляются к локальным, а локальные уезжают на сервер. Терять лайк
 * из-за того, что он поставлен не на том устройстве, хуже, чем получить
 * лишний.
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

/**
 * Переключить лайк.
 *
 * Принимает трек, а не строку: чтобы сообщить серверу, нужен UUID записи
 * песни, а ключ локального хранилища — это youtubeId, если он есть.
 * Раньше функция брала уже готовый ключ и о самой песне ничего не знала.
 *
 * Локально применяется сразу, на сервер уходит фоном. Ошибка отправки
 * не откатывает локальный лайк: связь пропадает чаще, чем случаются
 * ошибки, и отменять действие пользователя из-за метро — неправильно.
 * Расхождение подберётся при следующем входе.
 */
export function toggleLike(track: Track): void {
  const key = trackKey(track);
  const nowLiked = !liked.has(key);

  if (nowLiked) liked.add(key);
  else liked.delete(key);
  commit();

  // На сервере лайк связан с записью песни. У треков, играющих по ссылке
  // с ютуба, такой записи нет — они остаются только в локальном списке.
  if (track.source !== 'library') return;

  const request = nowLiked ? addLike(track.id) : removeLike(track.id);
  void request.catch(() => undefined);
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

/**
 * Свести локальные лайки с серверными. Вызывается после входа.
 *
 * Объединение, а не замена: на телефоне могли остаться лайки, поставленные
 * до входа, и терять их при первом же входе было бы странно.
 */
export async function syncLikes(library: readonly Track[]): Promise<void> {
  let songs: SongResponse[];
  try {
    songs = await listLiked();
  } catch {
    // Нет связи или нет входа — работаем с тем, что на устройстве.
    return;
  }

  // Серверные → локальные.
  //
  // Ключ выводим из самого ответа, а не ищем трек в медиатеке. Медиатека
  // подгружается страницами, и для песни из ещё не загруженной страницы
  // поиск не нашёл бы ничего — ключом стал бы UUID вместо youtubeId.
  // Лайк тогда не отобразился бы в интерфейсе (там ключ считается
  // по трекам), а в хранилище копилась бы мёртвая запись.
  //
  // Правило совпадает с trackKey() и обязано совпадать: если оно
  // изменится там, менять надо и здесь.
  let changed = false;
  for (const song of songs) {
    const key = song.youtube_id ?? song.id;
    if (!liked.has(key)) {
      liked.add(key);
      changed = true;
    }
  }
  if (changed) commit();

  const remote = songs.map((song) => song.id);

  // Локальные → серверные.
  //
  // Здесь медиатека нужна по-настоящему: чтобы отправить лайк, нужен UUID
  // записи песни, а локально хранится youtubeId. Отсюда и ограничение —
  // отправится только то, что успело подгрузиться. Лайки на треках
  // из незагруженных страниц уедут при следующем входе.
  const remoteSet = new Set(remote);
  for (const track of library) {
    if (remoteSet.has(track.id)) continue;
    if (!liked.has(trackKey(track))) continue;
    void addLike(track.id).catch(() => undefined);
  }
}
