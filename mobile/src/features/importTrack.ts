import { Directory, File, Paths, UploadType } from 'expo-file-system';
import { extractStreamUrl } from '../api/youtube';
import { createSong, getAudioUploadUrl, getCoverUploadUrl } from '../api/songs';
import { ApiError } from '../api/client';
import type { SongResponse, Track } from '../api/types';

/**
 * Добавление трека в медиатеку — целиком с телефона.
 *
 * Почему не бэкендом. Ручка /songs/import/youtube качает трек сама, а YouTube
 * отклоняет адреса дата-центров: замер на сервере дал один успех из восьми,
 * остальные семь — бот-проверка. Телефон сидит на обычном домашнем или
 * мобильном интернете, и для ютуба он неотличим от любого зрителя.
 *
 * Порядок такой:
 *   1. телефон достаёт ссылку сам (тот же путь, что и для воспроизведения),
 *   2. качает аудио и обложку к себе,
 *   3. просит у бэкенда presigned-ссылки и льёт файлы прямо в R2 —
 *      мимо сервера, иначе трек шёл бы через него дважды,
 *   4. и только потом создаёт запись о песне.
 *
 * Запись создаётся последней намеренно: если что-то сорвётся на середине,
 * в медиатеке не появится строки, ведущей в никуда. Мусор в хранилище
 * при этом остаётся, но он невидим и дешевле битой записи.
 */

const WORK_DIR = 'import';

/**
 * Расширение и MIME по типу из ютуба.
 *
 * Бэкенд принимает ограниченный набор (ALLOWED_AUDIO_EXTENSIONS), и webm
 * в него не входит. Обычно приходит audio/mp4 — извлечение само предпочитает
 * его. Если пришло что-то другое, честнее сказать об этом, чем получить
 * невнятный отказ от ручки выдачи ссылки.
 */
function audioFormat(mimeType: string): { ext: string; type: string } {
  const base = mimeType.split(';')[0].trim();
  if (base === 'audio/mp4') return { ext: 'm4a', type: 'audio/mp4' };
  throw new Error(
    `YouTube отдал ${base || 'неизвестный формат'}, а медиатека принимает только m4a`,
  );
}

function workDir(): Directory {
  const directory = new Directory(Paths.cache, WORK_DIR);
  if (!directory.exists) directory.create({ idempotent: true });
  return directory;
}

/** Залить файл по presigned-ссылке. Бросает, если хранилище не приняло. */
async function put(file: File, url: string, contentType: string): Promise<void> {
  const result = await file.upload(url, {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    headers: { 'Content-Type': contentType },
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Хранилище отклонило файл (${result.status})`);
  }
}

/**
 * Ответ сервера — в понятную фразу.
 *
 * Коды здесь не абстрактные: 409 отдаётся при повторном импорте (youtube_id
 * в базе уникален), 401 — если ручки заливки требуют входа, а его нет.
 * Без перевода пользователь видел бы «Internal Server Error» на ситуации
 * «трек уже добавлен», то есть обычное дело выглядело бы как поломка.
 */
function asHumanError(error: unknown): Error {
  if (!(error instanceof ApiError)) return error as Error;

  if (error.status === 409) {
    return new Error(error.message || 'Этот трек уже есть в медиатеке');
  }
  if (error.status === 401 || error.status === 403) {
    return new Error('Войдите в аккаунт, чтобы добавлять треки в медиатеку');
  }
  if (error.isNetwork) {
    return new Error('Нет связи с сервером');
  }
  return error;
}

function remove(file: File | null): void {
  try {
    if (file?.exists) file.delete();
  } catch {
    // Временный файл лежит в системном кэше — не удалось стереть,
    // сотрёт система. Ронять из-за этого импорт незачем.
  }
}

export interface ImportProgress {
  stage: 'extract' | 'download' | 'upload' | 'save';
}

/**
 * Скачивает трек с ютуба и кладёт его в медиатеку.
 *
 * @param track трек из выдачи поиска — из него берутся название и автор.
 * @param onProgress куда сообщать стадию: операция занимает секунды,
 *                   и молчащая кнопка выглядит как зависшая.
 */
export async function importTrack(
  track: Track,
  onProgress?: (progress: ImportProgress) => void,
): Promise<SongResponse> {
  const videoId = track.youtubeId;
  if (!videoId) throw new Error('У трека нет идентификатора YouTube');

  let audio: File | null = null;
  let cover: File | null = null;

  try {
    onProgress?.({ stage: 'extract' });
    const stream = await extractStreamUrl(videoId);
    const { ext, type } = audioFormat(stream.mimeType);

    onProgress?.({ stage: 'download' });
    audio = await File.downloadFileAsync(stream.url, new File(workDir(), `${videoId}.${ext}`));
    if (!audio.exists) throw new Error('Не удалось скачать аудио');

    // Обложку берём по стандартному адресу превью.
    //
    // hq720 первым: hqdefault приходит как 480x360, то есть 4:3 с вшитыми
    // чёрными полями, и обрезка по квадрату их не убирает. Но hq720 есть
    // не у всех роликов — у старых и малого разрешения его может не быть,
    // поэтому запасной вариант остаётся.
    for (const name of ['hq720', 'hqdefault']) {
      try {
        const file = await File.downloadFileAsync(
          `https://i.ytimg.com/vi/${videoId}/${name}.jpg`,
          new File(workDir(), `${videoId}.jpg`),
        );
        // Заглушка «нет превью» весит около килобайта — по размеру и отличаем.
        if (file.exists && (file.size ?? 0) > 2048) {
          cover = file;
          break;
        }
      } catch {
        // Пробуем следующий размер; без обложки трек всё равно полноценен.
      }
    }

    onProgress?.({ stage: 'upload' });
    let audioSlot;
    try {
      audioSlot = await getAudioUploadUrl(`${videoId}.${ext}`, type);
    } catch (error) {
      throw asHumanError(error);
    }
    await put(audio, audioSlot.upload_url, type);

    let coverKey: string | null = null;
    if (cover?.exists) {
      try {
        const coverSlot = await getCoverUploadUrl(`${videoId}.jpg`, 'image/jpeg');
        await put(cover, coverSlot.upload_url, 'image/jpeg');
        coverKey = coverSlot.file_key;
      } catch {
        // Обложка не залилась — трек всё равно добавляем.
        coverKey = null;
      }
    }

    onProgress?.({ stage: 'save' });
    try {
      return await createSong({
        // Название из выдачи поиска вернее: в ответе плеера оно бывает
        // с техническими хвостами вроде «(Official Video)».
        title: track.title || stream.title,
        author: track.author || stream.author,
        duration: track.duration || stream.durationSec,
        audio_file_key: audioSlot.file_key,
        cover_file_key: coverKey,
        youtube_id: videoId,
      });
    } catch (error) {
      throw asHumanError(error);
    }
  } finally {
    remove(audio);
    remove(cover);
  }
}
