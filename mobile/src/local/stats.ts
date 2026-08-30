import { useSyncExternalStore } from 'react';
import { readJSON, writeJSON } from './storage';

/**
 * Локальная статистика прослушивания.
 *
 * Ведётся на устройстве, потому что серверных счётчиков на пользователя нет:
 * `listened` и `liked` в API — общие по всем. Когда появится авторизация,
 * этот модуль заменяется запросом, интерфейс останется тем же.
 */

const KEY = 'stats.v1';

export interface Stats {
  /** Сколько раз запускали трек. Считается запуск, а не дослушивание. */
  played: number;
  /** Суммарное время прослушивания в секундах. */
  seconds: number;
  /** Сколько разных треков включали хотя бы раз. */
  uniqueTracks: number;
  /** Когда начали считать — чтобы показать «с такого-то числа». */
  since: number;
}

const EMPTY: Stats = { played: 0, seconds: 0, uniqueTracks: 0, since: Date.now() };

interface StoredStats extends Stats {
  /** Идентификаторы услышанных треков — только чтобы считать уникальные. */
  heard: string[];
}

let stored: StoredStats = readJSON<StoredStats>(KEY, { ...EMPTY, heard: [] });
let snapshot: Stats = toSnapshot(stored);
const listeners = new Set<() => void>();

/** Сколько идентификаторов помним. Дальше счётчик уникальных перестаёт расти. */
const HEARD_LIMIT = 2000;

function toSnapshot(value: StoredStats): Stats {
  return {
    played: value.played,
    seconds: value.seconds,
    uniqueTracks: value.uniqueTracks,
    since: value.since,
  };
}

function commit(): void {
  snapshot = toSnapshot(stored);
  writeJSON(KEY, stored);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Отметить запуск трека. */
export function recordPlay(trackId: string): void {
  stored.played += 1;

  if (!stored.heard.includes(trackId)) {
    stored.uniqueTracks += 1;
    // Список ограничен: на длинной истории он рос бы бесконечно, а на точность
    // счётчика уникальных это влияет только у очень активных слушателей.
    stored.heard = [...stored.heard, trackId].slice(-HEARD_LIMIT);
  }

  commit();
}

/**
 * Добавить прослушанное время. Вызывается редко, по таймеру из фонового
 * сервиса: писать на каждое обновление прогресса незачем.
 */
export function recordListening(seconds: number): void {
  if (seconds <= 0) return;
  stored.seconds += seconds;
  commit();
}

export function resetStats(): void {
  stored = { ...EMPTY, since: Date.now(), heard: [] };
  commit();
}

export function useStats(): Stats {
  return useSyncExternalStore(subscribe, () => snapshot);
}

/** 8241 → «2 ч 17 мин». Для нуля — «—», чтобы не показывать «0 мин». */
export function formatListening(seconds: number): string {
  if (seconds < 60) return seconds > 0 ? 'меньше минуты' : '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} мин`;
  return minutes === 0 ? `${hours} ч` : `${hours} ч ${minutes} мин`;
}
