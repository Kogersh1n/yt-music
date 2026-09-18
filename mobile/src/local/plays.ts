import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { readJSON, writeJSON } from './storage';
import { trackKey, type Track } from '../api/types';

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

/**
 * Журнал разделён на две части, и это про скорость записи.
 *
 * Раньше он лежал одним ключом и переписывался целиком: при полном
 * журнале это 3,9 МБ на каждую запись, каждые десять секунд во время
 * прослушивания. Причём меняется всегда только хвост — события
 * append-only, старое не трогается никогда.
 *
 * Теперь свежие события живут отдельным маленьким ключом, который и
 * пишется часто. Старое уезжает в архив и переписывается только при
 * переполнении хвоста — раз в несколько сотен треков.
 *
 * Старый ключ читается как архив, поэтому накопленная история
 * не теряется и отдельная миграция не нужна.
 */
const ARCHIVE_KEY = 'plays.v1';
const RECENT_KEY = 'plays.recent.v1';

/** Сколько событий держим в часто пишущемся хвосте. */
const RECENT_LIMIT = 400;
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

let archive: PlayEvent[] = readJSON<PlayEvent[]>(ARCHIVE_KEY, []);
let recent: PlayEvent[] = readJSON<PlayEvent[]>(RECENT_KEY, []);

/** Весь журнал целиком. Порядок тот же, что был: от старых к новым. */
let events: PlayEvent[] = [...archive, ...recent];
let current: OpenPlay | null = readJSON<OpenPlay | null>(CURRENT_KEY, null);

const listeners = new Set<() => void>();
let snapshot: readonly PlayEvent[] = Object.freeze([...events]);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Отложенная запись журнала на диск.
 *
 * Сериализация всего журнала — операция не бесплатная: за год копится
 * десяток тысяч событий, а JSON.stringify идёт в основном потоке. Делать
 * это на каждой смене трека значит ронять кадры ровно в тот момент, когда
 * пользователь смотрит на плеер.
 *
 * Поэтому в память пишем сразу, на диск — редко. Было раз в две секунды,
 * стало раз в десять: замер показал, что журнал из двадцати тысяч событий
 * это 3,9 МБ, и переписывать их целиком каждые две секунды во время
 * прослушивания — заметная работа в потоке интерфейса на ровном месте.
 *
 * Потерять при внезапном завершении можно максимум последнее событие,
 * а незакрытое (`current`) сохраняется отдельно на каждом тике. Плюс
 * запись принудительно вытесняется при сворачивании — см. ниже.
 */
const FLUSH_DELAY_MS = 10_000;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Записать хвост, а при переполнении — перелить старое в архив.
 *
 * Архив трогается редко: он переписывается только в тот момент, когда
 * хвост дорос до RECENT_LIMIT, то есть раз в четыреста треков.
 */
function writeAll(): void {
  if (recent.length > RECENT_LIMIT) {
    const move = recent.length - RECENT_LIMIT;
    archive = [...archive, ...recent.slice(0, move)].slice(-(LIMIT - RECENT_LIMIT));
    recent = recent.slice(move);
    writeJSON(ARCHIVE_KEY, archive);
  }
  writeJSON(RECENT_KEY, recent);
}

function flush(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  writeAll();
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    writeAll();
  }, FLUSH_DELAY_MS);
}

function commit(): void {
  snapshot = Object.freeze([...events]);
  scheduleFlush();
  listeners.forEach((listener) => listener());
}

function close(): void {
  if (!current) return;

  // Событие без единой засчитанной секунды не пишем: это переключение
  // мимо трека, а не прослушивание. Иначе перелистывание очереди
  // засоряло бы журнал и портило статистику.
  if (current.seconds >= 1) {
    const ratio = current.duration > 0 ? current.seconds / current.duration : 0;
    const event: PlayEvent = {
      trackId: current.trackId,
      youtubeId: current.youtubeId,
      author: current.author,
      title: current.title,
      startedAt: current.startedAt,
      seconds: Math.round(current.seconds),
      duration: current.duration,
      completed: ratio >= COMPLETION_RATIO,
    };

    recent = [...recent, event];
    events = [...events, event].slice(-LIMIT);
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
    // Канонический ключ, а не track.id: иначе одна и та же песня,
    // сыгранная из медиатеки и с ютуба, попадёт в историю дважды
    // и в рекапе покажется двумя разными треками.
    trackId: trackKey(track),
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
  // Пишем сразу, не откладывая: за остановкой обычно следует сворачивание
  // или закрытие приложения, и отложенная запись может не успеть.
  flush();
}

// Сворачивание — последний момент, когда можно успеть записать: дальше
// систему никто не обязывает оставлять процесс живым. Без этого редкая
// запись означала бы потерю до десяти секунд журнала.
AppState.addEventListener('change', (next) => {
  if (next !== 'active') flush();
});

/** События за период. Полуинтервал: from включительно, to нет. */
export function eventsBetween(from: number, to: number): PlayEvent[] {
  return events.filter((e) => e.startedAt >= from && e.startedAt < to);
}

export function usePlayEvents(): readonly PlayEvent[] {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

/* ------------------------------------------------------------------ */
/* Отправка на сервер                                                  */
/* ------------------------------------------------------------------ */

/** Полная очистка журнала — рядом с кнопкой сброса статистики. */
export function resetPlays(): void {
  events = [];
  archive = [];
  recent = [];
  current = null;
  writeJSON(CURRENT_KEY, null);
  commit();
  flush();
}
