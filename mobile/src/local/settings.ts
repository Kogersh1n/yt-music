import { useSyncExternalStore } from 'react';
import { readJSON, writeJSON } from './storage';

/**
 * Пользовательские настройки приложения.
 *
 * Хранятся локально и читаются синхронно, поэтому доступны на первом кадре —
 * плеер применяет их при инициализации, не дожидаясь асинхронного чтения.
 */

const KEY = 'settings.v1';

export interface AppSettings {
  /** Имя, которым пользователь подписывает себя и свои темы. */
  alias: string;
  /** Тактильный отклик на действия. */
  haptics: boolean;
  /**
   * Пропуск тишины в начале и конце треков.
   *
   * Это НЕ нормализация громкости и НЕ переключатель gapless: первой в
   * react-native-track-player нет вовсе, второй не нужен — ExoPlayer играет
   * без пауз сам для поддерживаемых форматов. Пропуск тишины — единственная
   * из трёх вещей, которой можно реально управлять.
   */
  skipSilence: boolean;
  /**
   * Разгрузка декодирования на аудиочип. Экономит батарею при выключенном
   * экране, но на части устройств ломает отображение позиции — поэтому
   * выключено по умолчанию.
   */
  audioOffload: boolean;
}

const DEFAULTS: AppSettings = {
  alias: 'Слушатель',
  haptics: true,
  skipSilence: false,
  audioOffload: false,
};

let settings: AppSettings = { ...DEFAULTS, ...readJSON<Partial<AppSettings>>(KEY, {}) };
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSettings(): AppSettings {
  return settings;
}

export function updateSettings(patch: Partial<AppSettings>): void {
  settings = { ...settings, ...patch };
  writeJSON(KEY, settings);
  listeners.forEach((listener) => listener());
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribe, () => settings);
}
