import { useSyncExternalStore, useCallback } from 'react';
import { readJSON, writeJSON } from './storage';
import { addLike, removeLike, listLiked } from '../api/songs';
import { trackFromSong, trackKey, type SongResponse, type Track } from '../api/types';

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

/**
 * Снятые лайки, о которых сервер ещё не знает.
 *
 * Нужны, потому что снятие могло не доехать: связь пропала, приложение
 * закрыли. Без этого списка сведение при следующем входе увидело бы лайк
 * на сервере и вернуло его обратно — то есть снять лайк офлайн было бы
 * невозможно в принципе.
 */
const UNLIKED_KEY = 'likes.unliked.v1';

/**
 * Сами лайкнутые треки, а не только их ключи.
 *
 * Ключей было достаточно, пока лайкали медиатеку: название и обложку
 * брали из неё же. Но приложение стало ютуб-плеером — в медиатеке три
 * трека, а слушают радио и подсказки. У лайкнутого ютуб-трека записи
 * в медиатеке нет, и по одному ключу его не показать и не включить:
 * экран «Понравившиеся» фильтровал медиатеку и находил пустоту.
 *
 * Теперь рядом с ключами лежат сами треки. Место копеечное — сотня
 * лайков это десятки килобайт.
 */
const TRACKS_KEY = 'likes.tracks.v1';

let liked: Set<string> = new Set(readJSON<string[]>(KEY, []));
let likedTracks: Track[] = readJSON<Track[]>(TRACKS_KEY, []);
let unliked: Set<string> = new Set(readJSON<string[]>(UNLIKED_KEY, []));
const listeners = new Set<() => void>();
/** Снимок для useSyncExternalStore должен быть стабильным по ссылке. */
let snapshot: readonly string[] = Object.freeze([...liked]);
let tracksSnapshot: readonly Track[] = Object.freeze([...likedTracks]);

function commit(): void {
  snapshot = Object.freeze([...liked]);
  tracksSnapshot = Object.freeze([...likedTracks]);
  writeJSON(KEY, [...liked]);
  writeJSON(TRACKS_KEY, likedTracks);
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

  if (nowLiked) {
    liked.add(key);
    unliked.delete(key);
    // Новые сверху: список читают как «что понравилось недавно».
    likedTracks = [track, ...likedTracks.filter((item) => trackKey(item) !== key)];
  } else {
    liked.delete(key);
    likedTracks = likedTracks.filter((item) => trackKey(item) !== key);
    // Помним о снятии, пока сервер его не подтвердит.
    if (track.source === 'library') unliked.add(key);
  }
  writeJSON(UNLIKED_KEY, [...unliked]);
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

/**
 * Лайкнутые треки целиком — для экрана «Понравившиеся».
 *
 * Сюда попадают и треки с ютуба, у которых нет записи в медиатеке:
 * именно их раньше и не было видно.
 */
export function useLikedTracks(): readonly Track[] {
  return useSyncExternalStore(subscribe, () => tracksSnapshot);
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
export async function syncLikes(library: readonly Track[]): Promise<boolean> {
  let songs: SongResponse[];
  try {
    songs = await listLiked();
  } catch {
    // Нет связи или нет входа — работаем с тем, что на устройстве.
    // Возвращаем false, чтобы вызывающий не считал сведение состоявшимся
    // и повторил его позже.
    return false;
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
    // Ключ берём тем же способом, что и везде, а не собираем вручную:
    // правило живёт в одном месте и не может разойтись.
    const key = trackKey(trackFromSong(song));

    // Снятые лайки не воскрешаем. Если ключ значится снятым, значит
    // снятие не доехало до сервера — повторяем его, а не откатываем
    // действие пользователя. Без этого снять лайк было невозможно:
    // сведение возвращало его обратно при каждом входе.
    if (unliked.has(key)) {
      void removeLike(song.id).catch(() => undefined);
      continue;
    }

    if (!liked.has(key)) {
      liked.add(key);
      changed = true;
    }
  }
  if (changed) commit();

  const remoteSet = new Set(songs.map((song) => song.id));

  // Локальные → серверные.
  //
  // Здесь медиатека нужна по-настоящему: чтобы отправить лайк, нужен UUID
  // записи песни, а локально хранится youtubeId. Отсюда и ограничение —
  // отправится только то, что успело подгрузиться. Лайки на треках
  // из незагруженных страниц уедут при следующем входе.
  for (const track of library) {
    if (remoteSet.has(track.id)) continue;
    if (!liked.has(trackKey(track))) continue;
    void addLike(track.id).catch(() => undefined);
  }

  // Отработавшие снятия можно забыть: сервер о них уже знает.
  if (unliked.size > 0) {
    unliked.clear();
    writeJSON(UNLIKED_KEY, []);
  }

  return true;
}
