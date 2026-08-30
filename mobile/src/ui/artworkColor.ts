/**
 * Цвет фона для экрана «Сейчас играет».
 *
 * Тон берётся из обложки — доминирующий цвет считается по blurhash
 * (см. dominantColor.ts). Насыщенность и светлота из обложки НЕ берутся:
 * их диктует тема, иначе светлая обложка сделала бы тёмную тему белёсой,
 * а тёмная в светлой теме — нечитаемой. От картинки остаётся только оттенок,
 * всё остальное подчиняется оформлению.
 *
 * Пока цвет не посчитан (или обложки нет), тон выводится из идентификатора
 * трека: он стабилен и разный для разных треков.
 */

/** Простой строковый хэш — одинаковый вход всегда даёт один и тот же оттенок. */
function hash(value: string): number {
  let result = 0;
  for (let i = 0; i < value.length; i++) {
    result = (result * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(result);
}

/**
 * HSL → HEX. Насыщенность и светлота задаются в процентах (0–100).
 *
 * Светлоту обязательно нормализовать в 0–1 ДО `Math.min(l, 1 - l)`: иначе при
 * l > 1 минимум уходит в отрицательные значения, канал вылезает за пределы
 * 0–255 и на выходе получается мусор вида `#-a33ab8ab8`. Такую строку
 * нативный градиент разобрать не может и падает с
 * «Cannot set prop 'colors'».
 */
function hslToHex(h: number, s: number, l: number): string {
  const lightness = l / 100;
  const a = (s / 100) * Math.min(lightness, 1 - lightness);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const value = lightness - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    // Подстраховка от краевых значений: канал обязан остаться в 0–255,
    // иначе toString(16) даст не две цифры.
    const byte = Math.min(255, Math.max(0, Math.round(255 * value)));
    return byte.toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/**
 * Градиент под обложку: сверху приглушённый цветной тон, снизу — фон темы,
 * чтобы элементы управления не спорили с подложкой.
 *
 * Светлота подбирается под тему, а не фиксируется: в светлой теме текст
 * тёмный, и тёмный градиент сделал бы экран плеера нечитаемым. Проверка
 * контраста этого не поймает — градиент не входит в палитру темы, поэтому
 * согласовывать его приходится здесь.
 */
export function artworkGradient(
  seed: string,
  mode: 'dark' | 'light',
  background: string,
  /** Доминирующий цвет обложки в HEX. Нет — тон выводится из seed. */
  dominant?: string | null,
): [string, string, string] {
  const { hue, saturationScale } = tintFor(seed, dominant);
  const scale = (value: number) => Math.round(value * saturationScale);

  return mode === 'light'
    ? [hslToHex(hue, scale(46), 82), hslToHex(hue, scale(30), 92), background]
    : [hslToHex(hue, scale(42), 26), hslToHex(hue, scale(34), 13), background];
}

/**
 * Цвет подсветки под обложкой — тот же оттенок, но насыщеннее и заметнее,
 * чем фон: это ореол, а не подложка.
 */
export function artworkGlow(
  seed: string,
  mode: 'dark' | 'light',
  dominant?: string | null,
): string {
  const { hue, saturationScale } = tintFor(seed, dominant);
  const saturation = Math.round((mode === 'light' ? 62 : 58) * saturationScale);
  return mode === 'light' ? hslToHex(hue, saturation, 68) : hslToHex(hue, saturation, 46);
}

interface Tint {
  hue: number;
  /**
   * Во сколько раз приглушить насыщенность. Единица — обычный цветной ореол,
   * около нуля — почти серый.
   */
  saturationScale: number;
}

/**
 * Три случая, и различать их обязательно:
 *
 * 1. Цвет обложки посчитан и он цветной — берём его оттенок.
 * 2. Цвет посчитан, но обложка почти серая (чёрно-белое фото, тёмный кадр) —
 *    ореол должен быть нейтральным. Подставлять сюда случайный оттенок нельзя:
 *    ярко-розовое свечение вокруг чёрно-белого снимка выглядит поломкой.
 * 3. Цвет ещё не посчитан или обложки нет — временный оттенок из имени трека,
 *    приглушённый: он ничего не значит, и заявлять им лишнего не стоит.
 */
function tintFor(seed: string, dominant: string | null | undefined): Tint {
  const measured = hueFrom(dominant);

  if (measured !== null) return { hue: measured.hue, saturationScale: measured.strength };

  return { hue: hash(seed) % 360, saturationScale: dominant ? 0.12 : 0.75 };
}

/**
 * Оттенок и насыщенность из HEX. `null` — цвет разобрать не удалось.
 * Для почти серых значений `strength` близка к нулю: тон у них случаен,
 * и опираться на него нельзя.
 */
function hueFrom(hex: string | null | undefined): { hue: number; strength: number } | null {
  if (!hex) return null;

  const value = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;

  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  // Ниже этого порога считаем цвет серым: тон вычислится, но будет шумом.
  if (delta < 0.06) return null;

  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;

  // Приглушённая обложка даёт приглушённый ореол — насыщенность
  // не выдумываем, а наследуем. Потолок, чтобы кислотная обложка
  // не выжигала экран.
  return { hue, strength: Math.min(delta * 2.5, 1) };
}
