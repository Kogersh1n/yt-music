import { useCallback } from 'react';
import TrackPlayer, { useIsPlaying } from 'react-native-track-player';
import { useQueue } from './queueStore';
import { tapMedium, tapLight } from '../ui/haptics';
import type { Track } from '../api/types';

/**
 * Действия плеера для интерфейса.
 *
 * Специально не отдаёт позицию воспроизведения: она обновляется несколько раз
 * в секунду, и компонент, подписанный на неё, перерисовывал бы всё поддерево.
 * Позицию берут точечно через useProgress() те листья дерева, которым она нужна.
 */
export function usePlayback() {
  const { playing, bufferingDuringPlay } = useIsPlaying();
  const playNow = useQueue((state) => state.playNow);
  const playNext = useQueue((state) => state.playNext);
  const playPrevious = useQueue((state) => state.playPrevious);

  const toggle = useCallback(async () => {
    tapMedium();
    if (playing) await TrackPlayer.pause();
    else await TrackPlayer.play();
  }, [playing]);

  /** Запустить список с указанного трека — основной способ начать слушать. */
  const play = useCallback(
    (tracks: readonly Track[], index: number) => {
      tapMedium();
      void playNow([...tracks], index);
    },
    [playNow],
  );

  return {
    isPlaying: playing ?? false,
    isBuffering: bufferingDuringPlay ?? false,
    toggle,
    play,
    next: useCallback(() => {
      tapLight();
      return playNext();
    }, [playNext]),
    previous: useCallback(() => {
      tapLight();
      return playPrevious();
    }, [playPrevious]),
  };
}
