/**
 * Разбор blurhash — ровно настолько, чтобы достать средний цвет картинки.
 *
 * Полное декодирование не нужно: первые компоненты хэша (DC-член) и есть
 * усреднённый цвет изображения. Это даёт доминирующий оттенок обложки без
 * нативного модуля и без правок на бэкенде — картинку всё равно уже загрузили.
 */

/** Алфавит base83 из спецификации blurhash. Порядок значим. */
const ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';

const VALUES = new Map<string, number>();
for (let i = 0; i < ALPHABET.length; i++) VALUES.set(ALPHABET[i], i);

function decode83(value: string): number | null {
  let result = 0;
  for (const char of value) {
    const digit = VALUES.get(char);
    if (digit === undefined) return null;
    result = result * 83 + digit;
  }
  return result;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Средний цвет из blurhash.
 *
 * DC-член лежит в символах 2..6 и хранится уже в sRGB — дополнительное
 * преобразование не нужно. Возвращает null для строки, которая не похожа
 * на blurhash: генерация могла не удаться, и падать из-за оформления нельзя.
 */
export function averageColorFromBlurhash(hash: string): Rgb | null {
  if (typeof hash !== 'string' || hash.length < 6) return null;

  const dc = decode83(hash.slice(2, 6));
  if (dc === null) return null;

  return {
    r: (dc >> 16) & 255,
    g: (dc >> 8) & 255,
    b: dc & 255,
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const channel = (value: number) =>
    Math.min(255, Math.max(0, Math.round(value)))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Относительная яркость 0..1 — чтобы понять, тёмная обложка или светлая. */
export function brightness({ r, g, b }: Rgb): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
