/**
 * Типы ответов бэкенда. Сняты один-в-один с
 * backend/app/src/modules/songs/schemas.py — не «по памяти», иначе фронт и бэк
 * разойдутся незаметно (ровно это уже произошло в вебе: там ApiSong.liked
 * объявлен boolean, а бэкенд отдаёт число).
 */

export interface SongResponse {
  id: string;
  /** video_id, если песня пришла с ютуба. У залитых файлом его нет. */
  youtube_id?: string | null;
  title: string;
  author: string;
  duration: number;

  /** Счётчик прослушиваний по всем пользователям. */
  listened: number;
  /**
   * ВНИМАНИЕ: это счётчик лайков (int), а НЕ «мой лайк».
   * Персональные лайки живут локально — см. src/local/likes.ts.
   */
  liked: number;

  audio_file_key: string;
  cover_file_key: string | null;
  cover_url: string | null;
}

export interface SongPaginationResponse {
  items: SongResponse[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface SongStreamResponse {
  /** Presigned-ссылка. Живёт R2_PRESIGNED_URL_EXPIRE_SECONDS (по умолчанию час). */
  stream_url: string;
  duration: number;
}

export interface SongCoverResponse {
  cover_url: string | null;
}

export interface YouTubeSearchResult {
  video_id: string;
  title: string;
  author: string | null;
  duration: number;
  cover: string;
  url: string;
}

export interface YouTubeSearchResponse {
  results: YouTubeSearchResult[];
  query: string;
}

/** Ответ ручек upload-url и upload-cover-url: куда лить и под каким ключом. */
export interface UploadCredentialsResponse {
  upload_url: string;
  file_key: string;
}

/**
 * Единая форма трека внутри приложения. Приводим к ней и локальные песни,
 * и результаты YouTube — плееру и спискам всё равно, откуда трек взялся.
 */
export interface Track {
  /** Для локальных — UUID песни, для YouTube — `yt:<video_id>`. */
  id: string;
  title: string;
  author: string;
  duration: number;
  artwork: string | null;
  source: 'library' | 'youtube';
  /** video_id, если трек играется напрямую с YouTube без сохранения. */
  youtubeId?: string;
}

/**
 * Устойчивый идентификатор трека — по нему считаются лайки, история
 * и «недавнее».
 *
 * Проблема, которую он решает: у одной и той же песни два разных `id`.
 * Скачанная в медиатеку — это UUID, она же напрямую с ютуба — `yt:<video_id>`.
 * Пока ключом был `id`, лайк, поставленный при прослушивании с ютуба,
 * не виден на скачанной версии, а в истории они считались разными треками.
 *
 * `youtubeId` есть у обеих форм, поэтому он и берётся за основу. Для
 * залитых файлом песен его нет — там остаётся UUID, и это верно: у такой
 * песни второй формы не существует.
 *
 * Для самого плеера по-прежнему используется `id`: движок и очередь
 * должны сходиться между собой, а канонический ключ нужен там, где
 * речь о песне как о сущности, а не о конкретной позиции в очереди.
 */
export function trackKey(track: Track): string {
  return track.youtubeId ?? track.id;
}

export function trackFromSong(song: SongResponse): Track {
  return {
    id: song.id,
    title: song.title,
    author: song.author,
    duration: song.duration,
    artwork: song.cover_url,
    source: 'library',
    // Переносим обязательно: без него скачанная песня и она же,
    // сыгранная напрямую с ютуба, выглядят как два разных трека —
    // лайк на одной не виден на другой. См. trackKey ниже.
    youtubeId: song.youtube_id ?? undefined,
  };
}

export function trackFromYouTube(result: YouTubeSearchResult): Track {
  return {
    id: `yt:${result.video_id}`,
    title: result.title,
    author: result.author ?? 'Неизвестный исполнитель',
    duration: result.duration,
    artwork: result.cover,
    source: 'youtube',
    youtubeId: result.video_id,
  };
}

/* ------------------------------------------------------------------ */
/* Авторизация                                                         */
/* ------------------------------------------------------------------ */

/**
 * Пара токенов. Снято с backend/app/src/modules/auth/schemas.py.
 *
 * access_token — JWT, живёт ~15 минут, подставляется в Authorization.
 * refresh_token — непрозрачная строка (не JWT), одноразовая: сервер помечает
 * её использованной при обмене и выдаёт новую. Повторное предъявление
 * старого токена сервер считает кражей и гасит всю цепочку сессии —
 * поэтому обновление должно быть строго одно на всё приложение,
 * см. refreshSession() в src/auth/session.ts.
 */
export interface TokensResponse {
  access_token: string;
  refresh_token: string;
}
