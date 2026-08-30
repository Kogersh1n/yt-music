import { BASES, BASE_DARK } from './base';
import { withAlpha, contrastRatio } from './color';
import { resolveFontFamily } from './fonts';
import type {
  Theme,
  ThemeColors,
  ThemeSource,
  ThemeType,
  TypeRole,
  TypeRoleName,
} from './types';

/**
 * Превращение JSON-темы в готовый объект оформления.
 *
 * Три шага: слияние с базой по цепочке `extends`, разрешение ссылок `$имя`
 * в палитру, вычисление производных значений (размеры текста с учётом
 * множителя, высота строки по плотности).
 */

const ROLE_NAMES: TypeRoleName[] = [
  'title',
  'section',
  'trackTitle',
  'meta',
  'body',
  'label',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Глубокое слияние: значения из `over` перекрывают `base`, объекты сливаются. */
function deepMerge<T>(base: T, over: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(over)) {
    return (over === undefined ? base : (over as T));
  }
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(over)) {
    const incoming = over[key];
    if (incoming === undefined) continue;
    result[key] =
      isPlainObject(base[key]) && isPlainObject(incoming)
        ? deepMerge(base[key], incoming)
        : incoming;
  }
  return result as T;
}

/**
 * Разворачивает цепочку `extends` в один объект.
 *
 * Цепочка ограничена по длине: тема, которая ссылается сама на себя (или две
 * темы друг на друга), иначе повесила бы приложение на старте.
 */
function flatten(source: ThemeSource, depth = 0): ThemeSource {
  if (depth > 8) throw new ThemeError('слишком длинная цепочка extends — похоже на цикл');

  const parentId = source.extends;
  if (!parentId) return source;

  const parent = BASES[parentId];
  if (!parent) {
    throw new ThemeError(
      `extends ссылается на «${parentId}», а такой встроенной темы нет ` +
        `(доступны: ${Object.keys(BASES).join(', ')})`,
    );
  }
  return deepMerge(flatten(parent, depth + 1), source);
}

export class ThemeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ThemeError';
  }
}

/**
 * Значение роли: либо готовый цвет, либо ссылка в палитру.
 * `$mauve` — цвет как есть, `$crust@70` — он же с прозрачностью 70%.
 */
function resolveRef(value: string, palette: Record<string, string>, role: string): string {
  if (typeof value !== 'string') {
    throw new ThemeError(`colors.${role}: ожидается строка, получено ${typeof value}`);
  }
  if (value.charAt(0) !== '$') return value;

  const [name, alpha] = value.slice(1).split('@');
  const hex = palette[name];
  if (!hex) {
    throw new ThemeError(`colors.${role}: в palette нет цвета «${name}»`);
  }
  if (alpha === undefined) return hex;

  const parsed = Number(alpha);
  if (!Number.isFinite(parsed)) {
    throw new ThemeError(`colors.${role}: «${alpha}» не похоже на прозрачность в процентах`);
  }
  const rgba = withAlpha(hex, parsed);
  if (!rgba) {
    throw new ThemeError(`colors.${role}: цвет «${name}» (${hex}) не похож на HEX`);
  }
  return rgba;
}

export function resolveTheme(source: ThemeSource): Theme {
  // Порядок принципиален: сначала разворачиваем цепочку extends, и только
  // потом подставляем BASE_DARK как последний пол для незаполненного.
  // Если слить BASE_DARK раньше, его тёмные значения перекроют светлую базу,
  // и `extends: "base-light"` перестанет работать для всего, что тема
  // не переопределила явно.
  const merged = deepMerge(BASE_DARK, flatten(source));
  const palette = merged.palette ?? {};

  // --- цвета ---
  const rawColors = (merged.colors ?? {}) as Record<string, string>;
  const colors = {} as ThemeColors;
  for (const key of Object.keys(BASE_DARK.colors ?? {}) as (keyof ThemeColors)[]) {
    colors[key] = resolveRef(rawColors[key], palette, key);
  }

  // `onAccent` выводится из акцента, если тема задала акцент, но не задала
  // подпись на нём. Иначе унаследованное значение почти наверняка не подойдёт
  // к новому цвету — и тема из четырёх строк («поменять акцент») сразу
  // упиралась бы в проверку контраста. Явно указанный onAccent не трогаем.
  const setsAccent = source.colors?.accent !== undefined;
  const setsOnAccent = source.colors?.onAccent !== undefined;
  if (setsAccent && !setsOnAccent) {
    const onBlack = contrastRatio('#000000', colors.accent) ?? 0;
    const onWhite = contrastRatio('#ffffff', colors.accent) ?? 0;
    colors.onAccent = onBlack >= onWhite ? '#000000' : '#ffffff';
  }

  // --- текст ---
  const typography = merged.typography ?? {};
  const scale = typography.scale ?? 1;
  const extraTracking = typography.letterSpacing ?? 0;

  const type = {} as ThemeType;
  for (const role of ROLE_NAMES) {
    const base = BASE_DARK.typography?.roles?.[role] as TypeRole;
    const over = typography.roles?.[role] ?? {};
    const fontSize = Math.round((over.fontSize ?? base.fontSize) * scale);
    const fontWeight = over.fontWeight ?? base.fontWeight;
    type[role] = {
      fontSize,
      fontWeight,
      // Разрядка в теме задана в долях кегля — приводим к абсолютной,
      // иначе крупный заголовок и мелкая подпись разъедутся по ощущению.
      letterSpacing: (over.letterSpacing ?? base.letterSpacing) + extraTracking * fontSize,
      // Файл шрифта подбирается под вес роли — см. комментарий в fonts.ts.
      fontFamily: resolveFontFamily(typography.family, fontWeight),
    };
  }

  // --- метрики ---
  const layoutSource = merged.layout ?? {};
  const compact = layoutSource.density === 'compact';
  const layout = {
    miniPlayerHeight: layoutSource.miniPlayerHeight ?? 64,
    tabBarHeight: layoutSource.tabBarHeight ?? 56,
    rowThumb: layoutSource.rowThumb ?? 48,
    cardWidth: layoutSource.cardWidth ?? 150,
    screenPadding: layoutSource.screenPadding ?? 16,
    rowHeight: compact ? 54 : 64,
  };

  return {
    id: merged.id,
    name: merged.name ?? merged.id,
    mode: merged.mode ?? 'dark',
    colors,
    radius: merged.radius as Theme['radius'],
    spacing: merged.spacing as Theme['spacing'],
    type,
    layout,
    components: merged.components as Theme['components'],
    motion: merged.motion as Theme['motion'],
    decor: merged.decor as Theme['decor'],
  };
}

/* ------------------------------------------------------------------ */
/* Проверка читаемости                                                 */
/* ------------------------------------------------------------------ */

export interface ContrastCheck {
  label: string;
  ratio: number | null;
  required: number;
  passed: boolean;
}

/**
 * Пары, которые обязаны читаться. Порог 4.5:1 — требование WCAG AA для
 * основного текста; для бренда достаточно 3:1, он крупный и декоративный.
 */
export function checkContrast(colors: ThemeColors): ContrastCheck[] {
  const pairs: [string, string, string, number][] = [
    ['Текст на фоне', colors.text, colors.bg, 4.5],
    ['Вторичный текст', colors.textDim, colors.bg, 4.5],
    ['Подпись на акценте', colors.onAccent, colors.accent, 4.5],
    ['Текст на поверхности', colors.text, colors.surface, 4.5],
    ['Бренд на фоне', colors.brand, colors.bg, 3],
  ];

  return pairs.map(([label, a, b, required]) => {
    const ratio = contrastRatio(a, b);
    return {
      label,
      ratio,
      required,
      // Полупрозрачный цвет посчитать нельзя — не заваливаем тему из-за этого.
      passed: ratio === null ? true : ratio >= required,
    };
  });
}

export function failedChecks(colors: ThemeColors): ContrastCheck[] {
  return checkContrast(colors).filter((check) => !check.passed);
}

/** Для каждой проверяемой пары — какую роль правим, чтобы её починить. */
const FIXABLE: Record<string, { foreground: keyof ThemeColors; background: keyof ThemeColors }> = {
  'Текст на фоне': { foreground: 'text', background: 'bg' },
  'Вторичный текст': { foreground: 'textDim', background: 'bg' },
  'Подпись на акценте': { foreground: 'onAccent', background: 'accent' },
  'Текст на поверхности': { foreground: 'text', background: 'surface' },
  'Бренд на фоне': { foreground: 'brand', background: 'bg' },
};

/**
 * Подбирает цвета так, чтобы тема прошла проверку читаемости.
 *
 * Правится только передний план и только на чёрный или белый — тот из двух,
 * что читается лучше. Приём грубый, зато предсказуемый: пользователь видит,
 * что именно поменялось, и может доправить вручную. Фон не трогаем — его
 * выбирают осознанно, он задаёт характер темы.
 *
 * Один и тот же цвет может проверяться против нескольких фонов: `text`
 * читается и на `bg`, и на `surface`. Поэтому решение принимается сразу по
 * всем его фонам, по худшему из контрастов — иначе починка одной пары
 * ломала бы другую.
 */
export function suggestReadableColors(colors: ThemeColors): ThemeColors {
  const fixed = { ...colors };

  // Собираем, какие фоны важны для каждой роли переднего плана.
  const backgroundsFor = new Map<keyof ThemeColors, (keyof ThemeColors)[]>();
  for (const pair of Object.values(FIXABLE)) {
    const list = backgroundsFor.get(pair.foreground) ?? [];
    list.push(pair.background);
    backgroundsFor.set(pair.foreground, list);
  }

  const broken = new Set(
    checkContrast(colors)
      .filter((check) => !check.passed)
      .map((check) => FIXABLE[check.label]?.foreground)
      .filter((role): role is keyof ThemeColors => role !== undefined),
  );

  for (const role of broken) {
    const backgrounds = backgroundsFor.get(role) ?? [];
    const worst = (candidate: string) =>
      Math.min(...backgrounds.map((bg) => contrastRatio(candidate, fixed[bg]) ?? Infinity));
    fixed[role] = worst('#000000') >= worst('#ffffff') ? '#000000' : '#ffffff';
  }

  return fixed;
}
