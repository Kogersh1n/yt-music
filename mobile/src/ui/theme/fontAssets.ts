/**
 * Импорты подпутями, а не из индекса пакета.
 *
 * Это не вкусовщина, а вес сборки. Индекс `@expo-google-fonts/ibm-plex-sans`
 * делает require() всех четырнадцати начертаний (семь весов × прямой
 * и курсив), и Metro тянет их в APK целиком — независимо от того, какие
 * четыре имени мы из него достали. То же у Handjet: девять весов вместо
 * двух. Замер до правки: 28 файлов Google Fonts в APK при нужных семи.
 *
 * Подпуть `@expo-google-fonts/<пакет>/<Начертание>` подключает ровно
 * один файл.
 */
import { Handjet_400Regular } from '@expo-google-fonts/handjet/400Regular';
import { Handjet_700Bold } from '@expo-google-fonts/handjet/700Bold';
import { PixelifySans_400Regular } from '@expo-google-fonts/pixelify-sans/400Regular';
import { PixelifySans_700Bold } from '@expo-google-fonts/pixelify-sans/700Bold';
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';
import { IBMPlexSans_700Bold } from '@expo-google-fonts/ibm-plex-sans/700Bold';

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
