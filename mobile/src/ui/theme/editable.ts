import type { ThemeColors, ThemeSource } from './types';

/**
 * Что именно редактор даёт менять и как это называется по-русски.
 *
 * Список отдельно от типа темы намеренно: в схеме ролей больше, чем стоит
 * показывать (скелетоны, подложки), а порядок в интерфейсе должен идти
 * от заметного к второстепенному, а не по алфавиту.
 */

export interface EditableColor {
  key: keyof ThemeColors;
  label: string;
  hint: string;
}

export const EDITABLE_COLORS: EditableColor[] = [
  { key: 'bg', label: 'Фон', hint: 'Основной фон приложения' },
  { key: 'text', label: 'Текст', hint: 'Названия треков, заголовки' },
  { key: 'textDim', label: 'Вторичный текст', hint: 'Исполнитель, подписи' },
  { key: 'accent', label: 'Акцент', hint: 'Кнопка воспроизведения, активный чип' },
  { key: 'onAccent', label: 'Поверх акцента', hint: 'Иконка на кнопке воспроизведения' },
  { key: 'brand', label: 'Бренд', hint: 'Играющий трек, логотип' },
  { key: 'surface', label: 'Поверхность', hint: 'Карточки, поле поиска' },
  { key: 'player', label: 'Плашка плеера', hint: 'Полоса над навигацией' },
  { key: 'border', label: 'Разделители', hint: 'Линии и рамки' },
  { key: 'textFaint', label: 'Третичный текст', hint: 'Неактивные вкладки' },
];

/**
 * Заготовка новой темы на основе текущей.
 *
 * Наследуемся от базовой по светлоте, а роли выписываем целиком и уже
 * разрешёнными: тема, начатая из редактора, не должна зависеть от чужой
 * палитры, иначе правка одного цвета непредсказуемо потянет остальные.
 */
export function draftFrom(
  colors: ThemeColors,
  mode: 'dark' | 'light',
  base: ThemeSource,
): ThemeSource {
  return {
    schema: 'ytmusic-theme/1',
    id: `my-${Date.now().toString(36)}`,
    name: 'Моя тема',
    extends: mode === 'light' ? 'base-light' : 'base-dark',
    mode,
    colors: { ...colors },
    radius: base.radius,
    typography: base.typography,
    layout: base.layout,
    components: base.components,
    motion: base.motion,
    decor: base.decor,
  };
}
