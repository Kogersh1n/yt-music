import { useSyncExternalStore } from 'react';
import { readJSON, writeJSON } from './storage';
import type { Track } from '../api/types';

/**
 * Журнал прослушиваний — событие на каждый запуск трека.
 *
 * Зачем отдельно от stats.ts. Тот хранит агрегаты: сколько всего запусков,
 * сколько секунд. Из агрегатов нельзя ни нарезать месяц для рекапа, ни
 * отличить «дослушал» от «переключил через десять секунд». А пропуск —
 * сигнал вкуса сильнее лайка: лайк ставят редко и вдумчиво, пропускают
 * честно и не задумываясь.
 *
 * Событие закрывается не при старте, а при переходе к следующему треку:
 * до этого момента неизвестно, сколько реально проиграло.
 */

const EVENTS_KEY = 'plays.v1';
const CURRENT_KEY = 'plays.current.v1';

/** Сколько событий помним. Тысяча в месяц по сотне байт — мегабайт в год. */
const LIMIT = 20000;

/** Доля трека, после которой считаем его дослушанным. */
const COMPLETION_RATIO = 0.8;

export interface PlayEvent {
  trackId: string;
  youtubeId: string | null;
  author: string;
  title: string;
  /** unix ms — по нему нарезаются месяцы для рекапа. */
  startedAt: number;
  /** Сколько реально проиграло, а не длина трека. */
  seconds: number;
  duration: number;
  /** Дослушал или переключил. Основной сигнал вкуса. */
  completed: boolean;
}

/** Незакрытое событие: трек ещё играет, итог неизвестен. */
interface OpenPlay {
  trackId: string;
  youtubeId: string | null;
  author: string;
  title: string;
  startedAt: number;
  seconds: number;
  duration: number;
}

let events: PlayEvent[] = readJSON<PlayEvent[]>(EVENTS_KEY, []);
let current: OpenPlay | null = readJSON<OpenPlay | null>(CURRENT_KEY, null);

const listeners = new Set<() => void>();
let snapshot: readonly PlayEvent[] = Object.freeze([...events]);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(): void {
  snapshot = Object.freeze([...events]);
  writeJSON(EVENTS_KEY, events);
  listeners.forEach((listener) => listener());
}

function close(): void {
  if (!current) return;

  // Событие без единой засчитанной секунды не пишем: это переключение
  // мимо трека, а не прослушивание. Иначе перелистывание очереди
  // засоряло бы журнал и портило статистику.
  if (current.seconds >= 1) {
    const ratio = current.duration > 0 ? current.seconds / current.duration : 0;
    events = [
      ...events,
      {
        trackId: current.trackId,
        youtubeId: current.youtubeId,
        author: current.author,
        title: current.title,
        startedAt: current.startedAt,
        seconds: Math.round(current.seconds),
        duration: current.duration,
        completed: ratio >= COMPLETION_RATIO,
      },
    ].slice(-LIMIT);
    commit();
  }

  current = null;
  writeJSON(CURRENT_KEY, null);
}

/**
 * Трек пошёл. Закрывает предыдущее событие и открывает новое.
 */
export function beginPlay(track: Track): void {
  close();

  current = {
    trackId: track.id,
    youtubeId: track.youtubeId ?? null,
    author: track.author,
    title: track.title,
    startedAt: Date.now(),
    seconds: 0,
    duration: track.duration,
  };
  writeJSON(CURRENT_KEY, current);
}

/**
 * Засчитать проигранные секунды текущему треку.
 *
 * Вызывается оттуда же, откуда пополняется общая статистика — там уже
 * отсечены паузы и засыпания приложения, второй раз это делать не нужно.
 */
export function creditSeconds(seconds: number): void {
  if (!current || seconds <= 0) return;

  current.seconds += seconds;
  // Пишем при каждом начислении: тики идут раз в пять секунд, а иначе
  // незакрытое событие терялось бы при выгрузке приложения из памяти.
  writeJSON(CURRENT_KEY, current);
}

/** Воспроизведение остановлено — закрыть текущее событие. */
export function endPlay(): void {
  close();
}

export function getEvents(): readonly PlayEvent[] {
  return snapshot;
}

/** События за период. Полуинтервал: from включительно, to нет. */
export function eventsBetween(from: number, to: number): PlayEvent[] {
  return events.filter((e) => e.startedAt >= from && e.startedAt < to);
}

export function usePlayEvents(): readonly PlayEvent[] {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

/** Полная очистка журнала — рядом с кнопкой сброса статистики. */
export function resetPlays(): void {
  events = [];
  current = null;
  writeJSON(CURRENT_KEY, null);
  commit();
}
