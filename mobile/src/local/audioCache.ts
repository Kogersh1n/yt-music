import { useSyncExternalStore } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import { readJSON, writeJSON } from './storage';
import { trackKey, type Track } from '../api/types';

/**
 * Кэш последних прослушанных треков на устройстве.
 *
 * Зачем. Ссылка на поток живёт несколько часов и добывается запросом к
 * ютубу — а значит, без сети не играет ничего, даже то, что слушали минуту
 * назад. Скачанный файл играет всегда и начинается мгновенно: ни извлечения,
 * ни буферизации.
 *
 * Почему так мало. Пять треков — это около 25 МБ при среднем битрейте.
 * Кэш лежит в системном каталоге для кэша: место, которое Android вправе
 * освободить сам, когда на устройстве кончается память. Поэтому наличие
 * файла всегда проверяется, а не берётся на веру из указателя.
 *
 * Ключ — trackKey(), тот же канонический ключ, что у лайков и журнала:
 * один трек, пришедший из медиатеки и из истории, не должен скачаться дважды.
 */

/** Пять штук — как просили. Больше и не нужно: это кэш, а не офлайн-медиатека. */
const LIMIT = 5;
const DIR_NAME = 'tracks';
const INDEX_KEY = 'audio-cache.v1';

/**
 * Пауза перед скачиванием.
 *
 * Без неё перелистывание очереди тянуло бы файл на каждый трек, мимо
 * которого пролистнули. Десять секунд — признак того, что трек действительно
 * слушают, а не проскочили.
 */
const SETTLE_MS = 10_000;

interface CacheEntry {
  key: string;
  /** Имя файла внутри каталога кэша, а не полный путь: путь между запусками меняется. */
  name: string;
  at: number;
}

let index: CacheEntry[] = readJSON<CacheEntry[]>(INDEX_KEY, []);

/**
 * Подписка на состав кэша: экран медиатеки показывает по нему фильтр
 * «Скачанное», и список должен обновляться сам, когда трек докачался.
 *
 * Снимок обязан быть стабильным по ссылке, иначе useSyncExternalStore
 * зациклится на перерисовке.
 */
const listeners = new Set<() => void>();
let snapshot: readonly string[] = Object.freeze(index.map((entry) => entry.key));

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Треки, которые качаются прямо сейчас — чтобы не начать второй раз. */
const inFlight = new Set<string>();

function dir(): Directory {
  const directory = new Directory(Paths.cache, DIR_NAME);
  if (!directory.exists) directory.create({ idempotent: true });
  return directory;
}

function save(): void {
  writeJSON(INDEX_KEY, index);
  snapshot = Object.freeze(index.map((entry) => entry.key));
  listeners.forEach((listener) => listener());
}

/**
 * Имя файла из ключа трека.
 *
 * Ключ может содержать что угодно, включая символы, недопустимые в имени
 * файла, поэтому оставляем только безопасные, а остальное заменяем.
 */
function fileName(key: string): string {
  return `${key.replace(/[^A-Za-z0-9_-]/g, '_')}.audio`;
}

/**
 * Путь к скачанному треку или null.
 *
 * Проверяет файл на месте: система могла вычистить каталог кэша, и указатель
 * без проверки привёл бы плеер к несуществующему файлу.
 */
export function cachedUri(track: Track): string | null {
  const key = trackKey(track);
  const entry = index.find((item) => item.key === key);
  if (!entry) return null;

  const file = new File(dir(), entry.name);
  if (!file.exists) {
    // Файл вычистила система — забываем о нём, чтобы не проверять каждый раз.
    index = index.filter((item) => item.key !== key);
    save();
    return null;
  }

  return file.uri;
}

/** Убрать лишнее сверх лимита. Самые старые уходят первыми. */
function evict(): void {
  const keep = index.slice(0, LIMIT);
  const drop = index.slice(LIMIT);

  for (const entry of drop) {
    try {
      const file = new File(dir(), entry.name);
      if (file.exists) file.delete();
    } catch {
      // Не удалось удалить — не повод ломать воспроизведение.
      // Запись из указателя всё равно уходит, файл подчистит система.
    }
  }

  index = keep;
  save();
}

/**
 * Запомнить трек для офлайна.
 *
 * Вызывается при старте воспроизведения и ничего не возвращает: это фоновая
 * работа, и её неудача не должна быть видна пользователю — трек и так играет
 * по сети. Скачивание начинается не сразу, см. SETTLE_MS.
 *
 * @param url ссылка, по которой трек уже играет. Отдельно её не добываем:
 *            лишний запрос к ютубу ради того, что уже есть на руках.
 * @param stillWanted проверка перед скачиванием — слушают ли трек до сих пор.
 */
export async function rememberTrack(
  track: Track,
  url: string,
  stillWanted: () => boolean,
): Promise<void> {
  // Локальный файл уже играет — качать нечего, только освежить давность.
  if (url.startsWith('file://')) {
    touch(trackKey(track));
    return;
  }

  const key = trackKey(track);
  if (inFlight.has(key)) return;
  if (cachedUri(track)) {
    touch(key);
    return;
  }

  inFlight.add(key);
  try {
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    if (!stillWanted()) return;

    const target = new File(dir(), fileName(key));
    if (target.exists) target.delete();

    // Имя берём из того, что вернула загрузка, а не из того, что просили:
    // API вправе дописать расширение по типу содержимого, и тогда указатель
    // ссылался бы на несуществующий файл.
    const downloaded = await File.downloadFileAsync(url, target);
    if (!downloaded.exists) return;

    index = [
      { key, name: downloaded.name, at: Date.now() },
      ...index.filter((item) => item.key !== key),
    ];
    evict();
  } catch {
    // Сеть отвалилась, место кончилось, ссылка протухла — всё это
    // не повод для ошибки на экране: трек играет, кэш просто не сложился.
  } finally {
    inFlight.delete(key);
  }
}

/** Поднять трек наверх списка: он снова свежий и переживёт вытеснение. */
function touch(key: string): void {
  const entry = index.find((item) => item.key === key);
  if (!entry) return;
  index = [{ ...entry, at: Date.now() }, ...index.filter((item) => item.key !== key)];
  save();
}

/** Сколько занято и сколько треков лежит — для экрана настроек. */
export function audioCacheStats(): { count: number; bytes: number } {
  let bytes = 0;
  let count = 0;

  for (const entry of index) {
    try {
      const file = new File(dir(), entry.name);
      if (file.exists) {
        count += 1;
        bytes += file.size ?? 0;
      }
    } catch {
      // Недоступный файл просто не считаем.
    }
  }

  return { count, bytes };
}

/** Стереть кэш целиком. */
export function clearAudioCache(): void {
  for (const entry of index) {
    try {
      const file = new File(dir(), entry.name);
      if (file.exists) file.delete();
    } catch {
      // см. evict()
    }
  }
  index = [];
  save();
}

/** Ключи скачанных треков. Для фильтра «Скачанное» в медиатеке. */
export function useCachedKeys(): readonly string[] {
  return useSyncExternalStore(subscribe, () => snapshot);
}
