import { useSyncExternalStore } from 'react';
import { importTrack, type ImportProgress } from './importTrack';
import { trackKey, type Track } from '../api/types';

/**
 * Очередь добавления треков в медиатеку.
 *
 * Зачем очередь, а не просто вызов importTrack. Добавить трек — это
 * скачать несколько мегабайт, залить их в хранилище и создать запись,
 * то есть секунды работы. Пока это делалось по одному, наполнить
 * медиатеку было практически невозможно: пятьдесят треков означали
 * двести нажатий и пятьдесят ожиданий подряд.
 *
 * Теперь отметил нужное, нажал один раз и занимаешься своими делами.
 *
 * Обрабатываем строго по одному. Параллельная заливка звучит быстрее,
 * но упирается в тот же канал, а YouTube на несколько одновременных
 * извлечений отвечает бот-проверкой охотнее — ту самую, из-за которой
 * извлечение и переехало на телефон.
 */

export type ItemState = 'waiting' | 'active' | 'done' | 'failed';

export interface QueueItem {
  key: string;
  track: Track;
  state: ItemState;
  /** Стадия — только у активного. */
  stage: ImportProgress['stage'] | null;
  error: string | null;
}

let items: QueueItem[] = [];
let running = false;

const listeners = new Set<() => void>();
let snapshot: readonly QueueItem[] = Object.freeze([]);

function commit(): void {
  snapshot = Object.freeze([...items]);

  // Каждый подписчик отдельно: падение одного не должно ронять остальных
  // и тем более выбрасывать исключение в середину обработки очереди.
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Перерисовка одного экрана — не повод останавливать загрузку.
    }
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function patch(key: string, change: Partial<QueueItem>): void {
  items = items.map((item) => (item.key === key ? { ...item, ...change } : item));
  commit();
}

/** Что делать после успешного добавления — задаёт экран, чтобы обновить медиатеку. */
let onAdded: (() => void) | null = null;

export function setImportListener(handler: (() => void) | null): void {
  onAdded = handler;
}

async function pump(): Promise<void> {
  if (running) return;
  running = true;

  let addedAny = false;

  try {
    for (;;) {
      const next = items.find((item) => item.state === 'waiting');
      if (!next) break;

      patch(next.key, { state: 'active', stage: 'extract' });

      let added = false;
      try {
        await importTrack(next.track, (progress) => patch(next.key, { stage: progress.stage }));
        patch(next.key, { state: 'done', stage: null });
        added = true;
      } catch (error) {
        patch(next.key, {
          state: 'failed',
          stage: null,
          error: error instanceof Error ? error.message : 'Не удалось добавить',
        });
      }

      if (added) addedAny = true;
    }
    // Уведомляем один раз на всю пачку, а не на каждый трек.
    //
    // Слушатель сбрасывает кэш медиатеки, а это перезапрос всех загруженных
    // страниц. На полусотне треков это полсотни таких перезапросов, и все
    // они лезут в тот же канал, которым идёт скачивание.
    //
    // Вне блока перехвата: пока вызов стоял внутри, ошибка в самом
    // слушателе помечала трек неудачным, хотя он уже добавился.
    if (addedAny) {
      try {
        onAdded?.();
      } catch {
        // Слушатель — дело вызывающего экрана; его сбой не касается очереди.
      }
    }
  } finally {
    running = false;
  }
}

/**
 * Поставить треки в очередь.
 *
 * Уже стоящие в очереди пропускаются: повторное нажатие на тот же трек
 * не должно приводить к двум скачиваниям одного файла.
 */
export function enqueue(tracks: readonly Track[]): void {
  // Неудачные тоже считаются известными. Раньше они исключались, и повторное
  // добавление того же трека создавало вторую запись с тем же ключом:
  // patch() правил обе, список рисовал два одинаковых ряда с одинаковым
  // ключом, а старая неудачная помечалась готовой, ничего не скачав.
  // Повтор делается кнопкой «Повторить», для этого есть retryFailed().
  const known = new Set(items.map((i) => i.key));

  const fresh = tracks
    .filter((track) => track.youtubeId && !known.has(trackKey(track)))
    .map<QueueItem>((track) => ({
      key: trackKey(track),
      track,
      state: 'waiting',
      stage: null,
      error: null,
    }));

  if (fresh.length === 0) return;

  items = [...items, ...fresh];
  commit();
  void pump();
}

/** Убрать завершённые. Неудачные остаются — по ним видно, что пошло не так. */
export function clearFinished(): void {
  items = items.filter((item) => item.state !== 'done');
  commit();
}

/** Повторить неудачные. */
export function retryFailed(): void {
  items = items.map((item) =>
    item.state === 'failed' ? { ...item, state: 'waiting', error: null } : item,
  );
  commit();
  void pump();
}

/** Убрать всё, кроме того, что качается прямо сейчас. */
export function dismissAll(): void {
  items = items.filter((item) => item.state === 'active');
  commit();
}

export function useImportQueue(): readonly QueueItem[] {
  return useSyncExternalStore(subscribe, () => snapshot);
}
