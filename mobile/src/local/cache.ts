import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';

/**
 * Учёт и очистка кэша.
 *
 * Размер приходится считать обходом каталогов: ни expo-image, ни
 * react-native-track-player не отдают занятый объём. У expo-image есть только
 * `getCachePathAsync(ключ)` — путь одного файла, не сумма; у плеера можно
 * задать `maxCacheSize`, но не прочитать текущий.
 */

/** Глубина обхода. Кэши раскладывают файлы по подпапкам, но неглубоко. */
const MAX_DEPTH = 4;

/** Имена каталогов, в которых лежит кэш картинок и аудио. */
const IMAGE_HINTS = ['image', 'expo-image', 'glide', 'sdk'];
const AUDIO_HINTS = ['track', 'exoplayer', 'media', 'audio'];

export interface CacheUsage {
  imagesBytes: number;
  audioBytes: number;
  otherBytes: number;
  totalBytes: number;
}

function sizeOfDirectory(directory: Directory, depth = 0): number {
  if (depth > MAX_DEPTH) return 0;

  let total = 0;
  let entries: (File | Directory)[];
  try {
    entries = directory.list();
  } catch {
    // Каталог может быть недоступен — не повод ронять подсчёт целиком.
    return 0;
  }

  for (const entry of entries) {
    if (entry instanceof Directory) {
      total += sizeOfDirectory(entry, depth + 1);
    } else {
      total += entry.size ?? 0;
    }
  }
  return total;
}

function matches(name: string, hints: string[]): boolean {
  const lower = name.toLowerCase();
  return hints.some((hint) => lower.includes(hint));
}

/**
 * Считает, сколько занимает кэш. Операция синхронная и обходит файловую
 * систему, поэтому вызывать её стоит по запросу, а не при каждом рендере.
 */
export async function measureCache(): Promise<CacheUsage> {
  const usage: CacheUsage = { imagesBytes: 0, audioBytes: 0, otherBytes: 0, totalBytes: 0 };

  let entries: (File | Directory)[];
  try {
    entries = Paths.cache.list();
  } catch {
    return usage;
  }

  for (const entry of entries) {
    const size = entry instanceof Directory ? sizeOfDirectory(entry) : (entry.size ?? 0);
    if (matches(entry.name, IMAGE_HINTS)) usage.imagesBytes += size;
    else if (matches(entry.name, AUDIO_HINTS)) usage.audioBytes += size;
    else usage.otherBytes += size;
  }

  usage.totalBytes = usage.imagesBytes + usage.audioBytes + usage.otherBytes;
  return usage;
}

/**
 * Чистит кэш. Обложки удаляются штатным способом, всё остальное — обходом
 * каталога; медиатека и настройки не затрагиваются, они лежат не в кэше.
 */
export async function clearCache(): Promise<void> {
  await Image.clearMemoryCache();
  await Image.clearDiskCache();

  let entries: (File | Directory)[];
  try {
    entries = Paths.cache.list();
  } catch {
    return;
  }

  for (const entry of entries) {
    try {
      entry.delete();
    } catch {
      // Файл может быть занят проигрывателем — пропускаем, остальное удалится.
    }
  }
}

/** 15728640 → «15,0 МБ». */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 МБ';
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return 'меньше 0,1 МБ';
  if (mb < 1024) return `${mb.toFixed(1).replace('.', ',')} МБ`;
  return `${(mb / 1024).toFixed(2).replace('.', ',')} ГБ`;
}
