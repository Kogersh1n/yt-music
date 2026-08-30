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
 * Файлы шрифтов для загрузки при старте.
 *
 * Вынесено из fonts.ts отдельно: здесь происходит require() бинарных ассетов,
 * который работает только внутри сборки React Native. Реестр гарнитур от этого
 * не зависит, поэтому резолвер тем можно прогонять в обычном Node.
 *
 * Ключ — имя семейства, под которым шрифт виден в стилях; оно должно совпадать
 * с полем `family` в FONTS.
 */
export const FONT_ASSETS = {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
  Handjet_400Regular,
  Handjet_700Bold,
  PixelifySans_400Regular,
  PixelifySans_700Bold,
} as const;
