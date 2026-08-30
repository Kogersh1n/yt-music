import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  AndroidAudioContentType,
} from 'react-native-track-player';
import { getSettings } from '../local/settings';

/**
 * Инициализация плеера. Вызывается один раз при старте приложения.
 */

let ready: Promise<void> | null = null;

export function setupPlayer(): Promise<void> {
  if (ready) return ready;

  ready = (async () => {
    try {
      await TrackPlayer.setupPlayer({
        // Музыка, а не речь: система применит нужную обработку и громкость.
        androidAudioContentType: AndroidAudioContentType.Music,
        // Буфер побольше — на мобильной сети меньше заиканий на старте трека.
        minBuffer: 15,
        maxBuffer: 50,
        backBuffer: 30,
        playBuffer: 2.5,
      });
    } catch (error) {
      // Плеер уже поднят — так бывает после горячей перезагрузки в dev или
      // когда фоновый сервис пережил закрытие интерфейса. Это не ошибка,
      // настройки ниже всё равно нужно применить.
      const message = error instanceof Error ? error.message : String(error);
      const alreadyRunning =
        message.includes('already been initialized') || message.includes('already initialized');
      if (!alreadyRunning) throw error;
    }

    await applyAudioOptions();
  })().catch((error) => {
    // Сбрасываем, чтобы следующая попытка не наткнулась на отклонённый промис.
    ready = null;
    throw error;
  });

  return ready;
}

/**
 * Применяет настройки воспроизведения. Вызывается при инициализации и заново,
 * когда пользователь меняет переключатели, — чтобы не требовать перезапуска.
 *
 * Чего здесь нет и не может быть: переключателя gapless и нормализации
 * громкости. Первого не существует — ExoPlayer играет без пауз сам для
 * поддерживаемых форматов; второй потребовал бы обработки звука, наружу
 * react-native-track-player её не выводит.
 */
export async function applyAudioOptions(): Promise<void> {
  const settings = getSettings();

  await TrackPlayer.updateOptions({
    android: {
      // Звук продолжается, когда приложение убрали из недавних — как в YT Music.
      appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
      androidSkipSilence: settings.skipSilence,
      audioOffload: settings.audioOffload,
    },
    // Что плеер умеет — влияет на кнопки в системе и на наушниках.
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.SeekTo,
      Capability.Stop,
    ],
    // Что показывать в уведомлении. Какие из них влезут в свёрнутую шторку,
    // Media3 решает сам — отдельного списка для компактного вида в этой
    // версии больше нет.
    notificationCapabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.SeekTo,
    ],
    // Прогресс обновляем раз в секунду: чаще не нужно глазу,
    // а нагрузка на мост заметная.
    progressUpdateEventInterval: 1,
  });
}
