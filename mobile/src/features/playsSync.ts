import { getSyncedUpTo, markSynced, unsyncedEvents } from '../local/plays';
import { uploadPlays, MAX_BATCH } from '../api/plays';

/**
 * Отправка журнала прослушиваний на сервер.
 *
 * Зачем вообще отправлять. Журнал живёт в MMKV на телефоне, и переустановка
 * приложения стирает историю: рекапы обнуляются, а рекомендации теряют
 * данные, на которых строятся. Сервер — резервная копия и источник семян
 * для подбора.
 *
 * Локальные события после отправки НЕ удаляются: рекап считается на
 * устройстве и должен открываться без сети.
 */

/** Одновременно идёт только одна отправка. */
let inFlight: Promise<void> | null = null;

async function push(): Promise<void> {
  const pending = unsyncedEvents();
  if (pending.length === 0) return;

  // Режем на пачки: после долгого офлайна их может накопиться больше,
  // чем сервер примет за раз.
  for (let offset = 0; offset < pending.length; offset += MAX_BATCH) {
    const chunk = pending.slice(offset, offset + MAX_BATCH);

    try {
      await uploadPlays(chunk);
    } catch {
      // Сеть отвалилась — отметку не двигаем, отправим в следующий раз.
      // Дублей это не создаст: сервер отсекает их по своему ключу.
      return;
    }

    // Сдвигаем ровно на последнее ушедшее событие, а не на «сейчас»:
    // иначе события, записанные во время отправки, потерялись бы.
    markSynced(chunk[chunk.length - 1].startedAt);
  }
}

/**
 * Отправить накопившееся. Повторные вызовы во время отправки
 * присоединяются к текущей, а не запускают вторую.
 */
export function syncPlays(): Promise<void> {
  if (!inFlight) {
    inFlight = push().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** Сколько событий ждёт отправки — для экрана профиля. */
export function pendingCount(): number {
  return unsyncedEvents().length;
}

export { getSyncedUpTo };
