/**
 * Реестр гарнитур, доступных темам.
 *
 * Здесь только описания — без require() шрифтовых файлов. Так резолвер тем
 * остаётся чистым модулем: его можно проверить обычным прогоном в Node,
 * не поднимая React Native.
 *
 * Тема называет гарнитуру по имени, а не приносит файл: JSON не может
 * содержать шрифт, а тянуть его из сети нельзя — приложение должно работать
 * офлайн, да и загружать произвольные файлы по ссылке из чужого конфига
 * не стоит. Неизвестное имя молча падает на системную гарнитуру.
 */

export interface FontEntry {
  /** Как гарнитура называется в теме. */
  id: string;
  /** Как её показать в настройках. */
  label: string;
  /**
   * Имена семейств по начертаниям. `undefined` — системная гарнитура
   * (на Android это Roboto, ничего грузить не нужно).
   *
   * Начертания приходится разделять: на Android нельзя задать fontFamily
   * встроенного шрифта и попросить у него жирный вес — система не найдёт
   * такое начертание и откатится на Roboto целиком. Поэтому под каждый вес
   * подставляется свой файл.
   */
  faces?: { regular: string; bold: string };
  hint: string;
}

export const FONTS: FontEntry[] = [
  {
    id: 'system',
    label: 'Системная',
    faces: undefined,
    hint: 'Roboto на Android — как в YouTube Music',
  },
  {
    id: 'IBM Plex Sans',
    label: 'IBM Plex Sans',
    faces: { regular: 'IBMPlexSans_400Regular', bold: 'IBMPlexSans_700Bold' },
    hint: 'Спокойная, чуть характернее системной',
  },
  {
    id: 'Handjet',
    label: 'Handjet',
    faces: { regular: 'Handjet_400Regular', bold: 'Handjet_700Bold' },
    hint: 'Точечная, как матричный принтер. С кириллицей',
  },
  {
    id: 'Pixelify Sans',
    label: 'Pixelify Sans',
    faces: { regular: 'PixelifySans_400Regular', bold: 'PixelifySans_700Bold' },
    hint: 'Пиксельная, помягче. С кириллицей',
  },
];

/**
 * Почему не Silkscreen и не Press Start 2P, которые просятся для пиксельной
 * темы: в них нет кириллицы. В русском интерфейсе латиница отрисовывалась бы
 * растровым шрифтом, а русский текст — системным, и тема выглядела бы
 * наполовину применённой. Проверяйте subsets, прежде чем добавлять гарнитуру.
 */

const BY_ID = new Map(FONTS.map((font) => [font.id, font]));

/**
 * Имя из темы и вес роли → имя семейства для стилей.
 * Неизвестное имя гарнитуры молча даёт системную.
 */
export function resolveFontFamily(
  id: string | undefined,
  weight: '400' | '500' | '600' | '700',
): string | undefined {
  if (!id) return undefined;
  const faces = BY_ID.get(id)?.faces;
  if (!faces) return undefined;
  // 600 к жирному ближе, чем к обычному — округляем туда.
  return weight === '700' || weight === '600' ? faces.bold : faces.regular;
}

export function isKnownFont(id: string): boolean {
  return BY_ID.has(id);
}
