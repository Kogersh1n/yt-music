import { Image } from 'expo-image';
import { averageColorFromBlurhash, rgbToHex, type Rgb } from './blurhash';
import { readJSON, writeJSON } from '../local/storage';

/**
 * Доминирующий цвет обложки.
 *
 * Берётся из blurhash, который expo-image умеет считать по картинке на
 * устройстве: хэш с компонентами 1×1 — это ровно усреднённый цвет. Такой путь
 * не требует ни нативного модуля, ни поля на бэкенде, а картинка к этому
 * моменту всё равно уже загружена и лежит в кэше.
 *
 * Результат кэшируется навсегда: обложка трека не меняется.
 */

const STORAGE_KEY = 'cover-colors.v1';

/** Сколько цветов помним между запусками. Одна запись — около 40 байт. */
const LIMIT = 500;

const memory = new Map<string, string>(Object.entries(readJSON<Record<string, string>>(STORAGE_KEY, {})));
/** Чтобы не считать один и тот же хэш дважды при быстром перелистывании. */
const inFlight = new Map<string, Promise<string | null>>();

function persist(): void {
  // При переполнении выбрасываем самые старые: Map сохраняет порядок вставки.
  const entries = [...memory.entries()].slice(-LIMIT);
  memory.clear();
  for (const [key, value] of entries) memory.set(key, value);
  writeJSON(STORAGE_KEY, Object.fromEntries(entries));
}

/** Уже известный цвет — синхронно, для первого кадра. */
export function peekDominantColor(uri: string | null): string | null {
  if (!uri) return null;
  return memory.get(uri) ?? null;
}

/**
 * Считает цвет обложки. Возвращает null, если картинки нет или посчитать
 * не удалось — вызывающий откатывается на цвет из темы.
 */
export function resolveDominantColor(uri: string | null): Promise<string | null> {
  if (!uri) return Promise.resolve(null);

  const cached = memory.get(uri);
  if (cached) return Promise.resolve(cached);

  const running = inFlight.get(uri);
  if (running) return running;

  const task = (async () => {
    try {
      // 1×1 компонент — минимум работы: нужен только DC-член.
      const hash = await Image.generateBlurhashAsync(uri, [1, 1]);
      if (!hash) return null;

      const rgb = averageColorFromBlurhash(hash);
      if (!rgb) return null;

      const hex = rgbToHex(rgb);
      memory.set(uri, hex);
      persist();
      return hex;
    } catch {
      // Картинка могла не скачаться или оказаться битой. Оформление
      // из-за этого падать не должно.
      return null;
    } finally {
      inFlight.delete(uri);
    }
  })();

  inFlight.set(uri, task);
  return task;
}

export function toRgb(hex: string): Rgb | null {
  const value = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}
