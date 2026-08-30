import TrackPlayer, { Event } from 'react-native-track-player';
import { useQueue, savePosition } from './queueStore';
import { recordListening } from '../local/stats';
import { creditSeconds, endPlay } from '../local/plays';

/**
 * Фоновый сервис плеера.
 *
 * Регистрируется в index.js и продолжает работать, когда приложения нет на
 * экране: именно он обрабатывает кнопки из шторки, с экрана блокировки и с
 * наушников. Логика должна быть здесь, а не в компонентах — компоненты
 * размонтированы, когда приложение свёрнуто.
 */
export async function PlaybackService(): Promise<void> {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());

  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    await TrackPlayer.pause();
    await TrackPlayer.seekTo(0);
    // Остановка — конец прослушивания: закрываем событие, иначе оно
    // осталось бы открытым до следующего запуска и слиплось бы с ним.
    endPlay();
  });

  // Переходы идут через стор, а не через TrackPlayer.skipToNext():
  // очередь знает про shuffle, repeat и про то, что дальше ещё не загружено.
  TrackPlayer.addEventListener(Event.RemoteNext, () => useQueue.getState().playNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => useQueue.getState().playPrevious());

  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) => TrackPlayer.seekTo(position));

  TrackPlayer.addEventListener(Event.RemoteJumpForward, ({ interval }) =>
    TrackPlayer.seekBy(interval),
  );
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, ({ interval }) =>
    TrackPlayer.seekBy(-interval),
  );

  /**
   * Движок сам перешёл на следующий трек — подтягиваем логический индекс,
   * чтобы интерфейс и очередь не разъехались с тем, что реально звучит.
   */
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (event) => {
    const id = event.track?.id;
    if (typeof id === 'string') useQueue.getState().syncFromPlayer(id);
  });

  /**
   * Кончилось то, что было заряжено в движок. Логическая очередь при этом
   * может быть длиннее — просто следующий трек ещё не догрузился.
   */
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
    const { index, queue, repeat } = useQueue.getState();
    const hasMore = index < queue.length - 1;
    if (hasMore || repeat === 'all') void useQueue.getState().playNext();
  });

  /**
   * Самая частая ошибка здесь — истёкшая presigned-ссылка (живёт час).
   * Не показываем пользователю сбой, а молча берём свежую и продолжаем
   * с той же секунды.
   */
  TrackPlayer.addEventListener(Event.PlaybackError, () => {
    void useQueue.getState().recoverFromError();
  });

  /**
   * Позицию сохраняем раз в 5 секунд, а не на каждое обновление прогресса:
   * запись в хранилище на каждом тике — лишняя работа при нулевой пользе.
   */
  const SAVE_INTERVAL_MS = 5000;
  /**
   * Потолок прироста статистики за один тик. События прогресса идут только во
   * время воспроизведения, но между ними может оказаться пауза, буферизация
   * или усыпление приложения — тогда разница по часам будет огромной. Всё,
   * что больше двух интервалов, считаем перерывом, а не прослушиванием.
   */
  const MAX_CREDIT_MS = SAVE_INTERVAL_MS * 2;

  let lastSaved = 0;
  TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, ({ position }) => {
    const now = Date.now();
    const elapsed = now - lastSaved;
    if (elapsed < SAVE_INTERVAL_MS) return;

    // Первый тик после запуска не засчитываем: lastSaved ещё нулевой,
    // и разница дала бы полвека прослушивания.
    if (lastSaved > 0) {
      const credited = Math.round(Math.min(elapsed, MAX_CREDIT_MS) / 1000);
      recordListening(credited);
      // Тем же секундам ведём поштучный учёт: из них потом считается,
      // дослушан трек или пропущен.
      creditSeconds(credited);
    }
    lastSaved = now;
    savePosition(position);
  });
}
