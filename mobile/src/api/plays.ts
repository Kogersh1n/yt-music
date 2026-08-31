import { request } from './client';
import type { PlayEvent } from '../local/plays';

/**
 * Отправка журнала прослушиваний на сервер.
 *
 * Сервер принимает пачку идемпотентно: повторная отправка тех же событий
 * дублей не создаёт. Поэтому при обрыве связи можно спокойно повторять —
 * ровно на это и рассчитан протокол.
 */

/** Тот же потолок, что и на сервере: длиннее пачку он не примет. */
export const MAX_BATCH = 500;

interface BatchResult {
  accepted: number;
  duplicates: number;
}

/** Форма события на сервере: snake_case, время в миллисекундах. */
function toWire(event: PlayEvent) {
  return {
    track_id: event.trackId,
    youtube_id: event.youtubeId,
    author: event.author,
    title: event.title,
    started_at: event.startedAt,
    seconds: event.seconds,
    duration: event.duration,
    completed: event.completed,
  };
}

export function uploadPlays(events: PlayEvent[], signal?: AbortSignal): Promise<BatchResult> {
  return request<BatchResult>('/plays/batch', {
    method: 'POST',
    body: JSON.stringify(events.map(toWire)),
    signal,
  });
}
