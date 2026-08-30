import { createMMKV } from 'react-native-mmkv';

/**
 * Локальное хранилище. MMKV, а не AsyncStorage: чтение синхронное, поэтому
 * состояние лайков и очереди доступно на первом кадре — без «мигания»
 * пустым списком при старте.
 *
 * В MMKV 4 экземпляр создаётся фабрикой createMMKV(); `new MMKV()` из
 * третьей версии больше нет — там теперь только тип.
 */
export const storage = createMMKV({ id: 'ytmusic' });

export function readJSON<T>(key: string, fallback: T): T {
  const raw = storage.getString(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Битое значение (например, после смены формата) лечим сбросом,
    // а не падением приложения на старте.
    storage.remove(key);
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}
