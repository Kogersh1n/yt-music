import { Handjet_400Regular, Handjet_700Bold } from '@expo-google-fonts/handjet';
import {
  PixelifySans_400Regular,
  PixelifySans_700Bold,
} from '@expo-google-fonts/pixelify-sans';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';

/**
 * Файлы шрифтов.
 *
 * Вынесено из fonts.ts отдельно: здесь происходит require() бинарных ассетов,
 * который работает только внутри сборки React Native. Реестр гарнитур от этого
 * не зависит, поэтому резолвер тем можно прогонять в обычном Node.
 *
 * Ключ — имя семейства, под которым шрифт виден в стилях; оно должно совпадать
 * с полем `family` в FONTS.
 */
/**
 * Гарнитура по умолчанию — единственная, которую ждём до первого кадра.
 *
 * Остальные принадлежат другим темам, и до переключения на них не нужны.
 * Раньше грузились все восемь начертаний (1.3 МБ), и приложение не рисовало
 * ничего, пока не догрузится последнее: чёрный экран ради шрифтов темы,
 * которую человек, возможно, никогда не включит.
 */
export const FONT_ASSETS = {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} as const;

/**
 * Шрифты остальных тем. Догружаются после первого кадра, в фоне.
 *
 * Пока не загрузились, темы на них откатываются на системную гарнитуру —
 * это заметно только тому, кто включил такую тему и сразу после запуска
 * смотрит на заголовок. Чёрный экран при каждом старте заметнее.
 */
export const EXTRA_FONT_ASSETS = {
  Handjet_400Regular,
  Handjet_700Bold,
  PixelifySans_400Regular,
  PixelifySans_700Bold,
} as const;
