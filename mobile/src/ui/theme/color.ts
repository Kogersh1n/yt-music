/**
 * Работа с цветом: разбор HEX, прозрачность, контраст по WCAG.
 * Без зависимостей — всё нужное здесь три десятка строк.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** `#abc` и `#aabbcc` → каналы. Всё остальное (включая rgba-строки) → null. */
export function parseHex(value: string): Rgb | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim().replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((char) => char + char)
          .join('')
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function withAlpha(hex: string, alphaPercent: number): string | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const alpha = Math.min(100, Math.max(0, alphaPercent)) / 100;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

/** Относительная яркость канала по формуле WCAG. */
function channelLuminance(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

/**
 * Контрастность пары цветов: от 1 (неразличимы) до 21 (чёрное на белом).
 * Возвращает null, если хотя бы один цвет не HEX — полупрозрачные значения
 * считать бессмысленно, под ними неизвестно что.
 */
export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/* ------------------------------------------------------------------ */
/* Преобразования для редактора цвета                                  */
/* ------------------------------------------------------------------ */

export interface Hsl {
  /** Тон, 0–360. */
  h: number;
  /** Насыщенность, 0–100. */
  s: number;
  /** Светлота, 0–100. */
  l: number;
}

export function hexToHsl(hex: string): Hsl | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) return { h: 0, s: 0, l: Math.round(lightness * 100) };

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));

  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;

  return { h: hue, s: Math.round(saturation * 100), l: Math.round(lightness * 100) };
}

/**
 * HSL → HEX. Светлоту обязательно нормализовать в 0–1 ДО `Math.min(l, 1 - l)`:
 * иначе при l > 1 минимум уходит в отрицательные значения и канал вылезает
 * за пределы 0–255.
 */
export function hslToHex({ h, s, l }: Hsl): string {
  const lightness = l / 100;
  const a = (s / 100) * Math.min(lightness, 1 - lightness);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const value = lightness - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    const byte = Math.min(255, Math.max(0, Math.round(255 * value)));
    return byte.toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}
