import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { parseThemeJson } from './validate';
import { ThemeError } from './resolve';
import type { ThemeSource } from './types';

/**
 * Ввоз и вывоз тем.
 *
 * Все пути ведут в один разбор: получить текст → parseThemeJson → готовый
 * ThemeSource. Проверка контраста и применение остаются на вызывающем, чтобы
 * ошибку можно было показать рядом с кнопкой, которую нажали.
 */

/** Сколько ждать чужой сервер. Тема — маленький файл, дольше ждать незачем. */
const FETCH_TIMEOUT_MS = 15_000;
/** Разумный потолок для JSON-темы. Защита от «скачаем сюда весь интернет». */
const MAX_BYTES = 256 * 1024;

/** Выбор .json на устройстве. Возвращает null, если пользователь передумал. */
export async function importFromFile(): Promise<ThemeSource | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    // Некоторые файловые менеджеры отдают json как text/plain — берём оба типа.
    type: ['application/json', 'text/plain'],
    copyToCacheDirectory: true,
  });

  if (picked.canceled || picked.assets.length === 0) return null;

  const asset = picked.assets[0];
  if (asset.size !== undefined && asset.size > MAX_BYTES) {
    throw new ThemeError('файл слишком большой для темы — больше 256 КБ');
  }

  const text = await new File(asset.uri).text();
  return parseThemeJson(text);
}

/** Разбор JSON из буфера обмена — самый быстрый способ поделиться темой в чате. */
export async function importFromClipboard(): Promise<ThemeSource> {
  const text = await Clipboard.getStringAsync();
  if (!text || text.trim() === '') {
    throw new ThemeError('в буфере обмена пусто');
  }
  return parseThemeJson(text);
}

/**
 * Загрузка по ссылке — например, с гиста.
 *
 * Скачиваем только по http(s) и только ограниченный объём: адрес приходит
 * от пользователя, и на том конце может оказаться что угодно.
 */
export async function importFromUrl(url: string): Promise<ThemeSource> {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new ThemeError('нужна ссылка, начинающаяся с http:// или https://');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(trimmed, { signal: controller.signal });
    if (!response.ok) {
      throw new ThemeError(`сервер ответил ${response.status}`);
    }

    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > MAX_BYTES) {
      throw new ThemeError('файл по ссылке слишком большой для темы');
    }

    const text = await response.text();
    if (text.length > MAX_BYTES) {
      throw new ThemeError('файл по ссылке слишком большой для темы');
    }
    return parseThemeJson(text);
  } catch (error) {
    if (error instanceof ThemeError) throw error;
    if (controller.signal.aborted) throw new ThemeError('сервер не ответил вовремя');
    throw new ThemeError('не удалось скачать — проверьте ссылку и сеть');
  } finally {
    clearTimeout(timer);
  }
}

export function serializeTheme(source: ThemeSource): string {
  return JSON.stringify(source, null, 2) + '\n';
}

export async function copyThemeToClipboard(source: ThemeSource): Promise<void> {
  await Clipboard.setStringAsync(serializeTheme(source));
}

/**
 * Отдать тему файлом через системный «Поделиться».
 *
 * Пишем во временную папку под именем темы — чтобы получатель увидел
 * `my-rice.json`, а не случайный набор символов.
 */
export async function shareTheme(source: ThemeSource): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;

  // Имя файла — из идентификатора темы, чтобы получатель увидел
  // `my-rice.json`, а не случайный набор символов.
  const safeName = source.id.replace(/[^a-zA-Z0-9._-]/g, '-') || 'theme';
  const file = new File(Paths.cache, `${safeName}.json`);

  if (file.exists) file.delete();
  file.create();
  file.write(serializeTheme(source));

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: `Тема «${source.name ?? source.id}»`,
  });
  return true;
}
