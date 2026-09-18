import { downloadNow } from '../local/audioCache';
import { resolveStreamUrl } from '../player/streamUrls';
import type { Track } from '../api/types';

/**
 * Скачать трек по нажатию.
 *
 * Живёт здесь, а не в audioCache: ссылку добывает streamUrls, который сам
 * зависит от audioCache (проверяет, нет ли трека уже на диске). Положить
 * добычу ссылки внутрь кэша — получить кольцо импортов.
 */
export async function downloadTrack(track: Track): Promise<boolean> {
  try {
    const url = await resolveStreamUrl(track);
    return await downloadNow(track, url);
  } catch {
    return false;
  }
}
