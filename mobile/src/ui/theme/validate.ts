import { ThemeError } from './resolve';
import type { ThemeSource } from './types';

/**
 * Проверка сырого JSON темы.
 *
 * Правила намеренно мягкие: незнакомые ключи игнорируются (тема из будущей
 * версии должна открыться, просто без новых возможностей), а вот неверный тип
 * у знакомого ключа — это ошибка с конкретным сообщением. Молча подставлять
 * значение по умолчанию нельзя: автор темы решит, что всё сработало.
 *
 * Схему не выносим в отдельную библиотеку — набор ключей известен и невелик,
 * зато сообщения получаются ровно такие, какие нужно показать человеку.
 */

const COLOR_KEYS = [
  'bg', 'surface', 'surfaceHigh', 'player', 'border',
  'text', 'textDim', 'textFaint',
  'brand', 'accent', 'onAccent',
  'danger', 'scrim', 'skeleton', 'skeletonHighlight',
] as const;

const RADIUS_KEYS = ['thumb', 'card', 'sheet', 'chip'] as const;
const SPACING_KEYS = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'] as const;
const ROLE_KEYS = ['title', 'section', 'trackTitle', 'meta', 'body', 'label'] as const;
const LAYOUT_KEYS = [
  'miniPlayerHeight', 'tabBarHeight', 'rowThumb', 'cardWidth', 'screenPadding',
] as const;

const WEIGHTS = ['400', '500', '600', '700'];
const PLAY_BUTTONS = ['circle', 'square', 'pill'];
const PROGRESS = ['line', 'stepped'];
const THUMBS = ['rounded', 'square', 'circle'];
const OVERLAYS = ['none', 'scanlines'];
const DENSITIES = ['compact', 'comfortable'];
const MODES = ['dark', 'light'];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'список';
  if (typeof value === 'string') return `«${value}»`;
  return String(value);
}

function expectObject(value: unknown, path: string): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (!isObject(value)) {
    throw new ThemeError(`${path}: ожидается объект, получено ${describe(value)}`);
  }
  return value;
}

function expectNumber(value: unknown, path: string): void {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ThemeError(`${path}: ожидается число, получено ${describe(value)}`);
  }
  if (value < 0) {
    throw new ThemeError(`${path}: отрицательное значение (${value})`);
  }
}

function expectString(value: unknown, path: string): void {
  if (value === undefined) return;
  if (typeof value !== 'string') {
    throw new ThemeError(`${path}: ожидается строка, получено ${describe(value)}`);
  }
}

function expectOneOf(value: unknown, allowed: string[], path: string): void {
  if (value === undefined) return;
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new ThemeError(
      `${path}: допустимо ${allowed.map((v) => `«${v}»`).join(', ')}, получено ${describe(value)}`,
    );
  }
}

function expectBoolean(value: unknown, path: string): void {
  if (value === undefined) return;
  if (typeof value !== 'boolean') {
    throw new ThemeError(`${path}: ожидается true или false, получено ${describe(value)}`);
  }
}

/**
 * Разбирает и проверяет объект темы. Бросает ThemeError с человеческим
 * текстом — его можно показать пользователю как есть.
 */
export function validateThemeSource(input: unknown): ThemeSource {
  const root = expectObject(input, 'тема');
  if (!root) throw new ThemeError('тема: пустой файл');

  if (root.schema !== undefined) {
    expectString(root.schema, 'schema');
    if (!String(root.schema).startsWith('ytmusic-theme/1')) {
      throw new ThemeError(
        `schema: поддерживается только «ytmusic-theme/1», в файле ${describe(root.schema)}`,
      );
    }
  }

  if (typeof root.id !== 'string' || root.id.trim() === '') {
    throw new ThemeError('id: обязательное поле, короткая строка без пробелов');
  }
  expectString(root.name, 'name');
  expectString(root.author, 'author');
  expectString(root.extends, 'extends');
  expectOneOf(root.mode, MODES, 'mode');

  const palette = expectObject(root.palette, 'palette');
  if (palette) {
    for (const key of Object.keys(palette)) {
      expectString(palette[key], `palette.${key}`);
    }
  }

  const colors = expectObject(root.colors, 'colors');
  if (colors) {
    for (const key of COLOR_KEYS) expectString(colors[key], `colors.${key}`);
  }

  const radius = expectObject(root.radius, 'radius');
  if (radius) {
    for (const key of RADIUS_KEYS) expectNumber(radius[key], `radius.${key}`);
  }

  const spacing = expectObject(root.spacing, 'spacing');
  if (spacing) {
    for (const key of SPACING_KEYS) expectNumber(spacing[key], `spacing.${key}`);
  }

  const typography = expectObject(root.typography, 'typography');
  if (typography) {
    expectString(typography.family, 'typography.family');
    expectNumber(typography.scale, 'typography.scale');
    if (typeof typography.scale === 'number' && (typography.scale < 0.5 || typography.scale > 2)) {
      throw new ThemeError(
        `typography.scale: разумный диапазон 0.5–2, получено ${typography.scale}`,
      );
    }
    if (typography.letterSpacing !== undefined && typeof typography.letterSpacing !== 'number') {
      throw new ThemeError(
        `typography.letterSpacing: ожидается число, получено ${describe(typography.letterSpacing)}`,
      );
    }
    const roles = expectObject(typography.roles, 'typography.roles');
    if (roles) {
      for (const role of ROLE_KEYS) {
        const entry = expectObject(roles[role], `typography.roles.${role}`);
        if (!entry) continue;
        expectNumber(entry.fontSize, `typography.roles.${role}.fontSize`);
        expectOneOf(entry.fontWeight, WEIGHTS, `typography.roles.${role}.fontWeight`);
      }
    }
  }

  const layout = expectObject(root.layout, 'layout');
  if (layout) {
    for (const key of LAYOUT_KEYS) expectNumber(layout[key], `layout.${key}`);
    expectOneOf(layout.density, DENSITIES, 'layout.density');
  }

  const components = expectObject(root.components, 'components');
  if (components) {
    expectOneOf(components.playButton, PLAY_BUTTONS, 'components.playButton');
    expectOneOf(components.progress, PROGRESS, 'components.progress');
    expectOneOf(components.thumb, THUMBS, 'components.thumb');
    expectBoolean(components.tabBarLabels, 'components.tabBarLabels');
  }

  const motion = expectObject(root.motion, 'motion');
  if (motion) expectNumber(motion.scale, 'motion.scale');

  const decor = expectObject(root.decor, 'decor');
  if (decor) expectOneOf(decor.overlay, OVERLAYS, 'decor.overlay');

  return root as unknown as ThemeSource;
}

/** Разбор текста файла. Отдельно, чтобы отличить «не JSON» от «не та схема». */
export function parseThemeJson(text: string): ThemeSource {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ThemeError(`файл не разобрался как JSON — ${detail}`);
  }
  return validateThemeSource(parsed);
}
