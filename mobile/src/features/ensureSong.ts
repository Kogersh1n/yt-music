import { createExternalSong } from '../api/songs';
import type { Track } from '../api/types';

/**
 * Идентификатор песни на сервере — для связей.
 *
 * Плейлисты и серверные лайки держатся на `song_id`. У трека из
 * медиатеки он уже есть, у играющего по ссылке с ютуба — нет, и
 * поэтому добавить такой трек в плейлист было нельзя в принципе.
 *
 * Здесь запись заводится по требованию: файл не скачивается, на сервере
 * появляется только метаданные и youtube_id. Повторный вызов возвращает
 * ту же запись, так что помнить о заведённых не нужно.
 */
export async function ensureSongId(track: Track): Promise<string> {
  if (track.source === 'library') return track.id;
  if (!track.youtubeId) throw new Error('У трека нет идентификатора на ютубе');

  const song = await createExternalSong({
    youtubeId: track.youtubeId,
    title: track.title,
    author: track.author,
    duration: track.duration,
  });

  return song.id;
}
