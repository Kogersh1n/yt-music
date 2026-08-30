import * as Haptics from 'expo-haptics';
import { getSettings } from '../local/settings';

/**
 * Тактильный отклик.
 *
 * Обёртка нужна по двум причинам: уважать выключатель в настройках и не дать
 * ошибке вибромотора уронить действие. Отклик — украшение; если устройство
 * его не умеет, нажатие всё равно должно сработать.
 */

function guard(run: () => Promise<void>): void {
  if (!getSettings().haptics) return;
  void run().catch(() => undefined);
}

/** Лёгкий тик: смена трека, переключение чипа, шаг перемотки. */
export function tapLight(): void {
  guard(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Заметный отклик: play/pause, лайк, применение темы. */
export function tapMedium(): void {
  guard(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Подтверждение завершённого действия: трек добавлен в очередь, тема сохранена. */
export function notifySuccess(): void {
  guard(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Действие не прошло: тема нечитаемая, файл не разобрался. */
export function notifyError(): void {
  guard(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

/** Выбор в ряду вариантов: ползунок дошёл до нового значения. */
export function selectionChanged(): void {
  guard(() => Haptics.selectionAsync());
}
