import { AppState } from 'react-native';
import { create } from 'zustand';
import TrackPlayer, { RepeatMode as RNTPRepeatMode } from 'react-native-track-player';
import type { Track } from '../api/types';
import { readJSON, writeJSON } from '../local/storage';
import { pushRecent } from '../local/recents';
import { recordPlay } from '../local/stats';
import { beginPlay } from '../local/plays';
import { resolveStreamUrl, invalidateStreamUrl } from './streamUrls';

export type RepeatMode = 'off' | 'all' | 'one';

/**
 * Очередь воспроизведения.
 *
 * Источник правды — логическая очередь здесь: `queue` + `index`, а не «текущий
 * трек» отдельно. Иначе «следующий/предыдущий» и перемешивание превращаются
 * в костыли.
 *
 * RNTP используется как движок: в него подкладываются только текущий трек и
 * ближайшие следующие. Целиком очередь в него не заливается намеренно —
 * presigned-ссылки живут час, и у хвоста длинной очереди они успели бы протухнуть.
 */

/** Сколько треков вперёд держим заряженными в движке. */
/**
 * Сколько следующих треков держать заряженными в движке.
 *
 * Было 2. Ссылка на трек с ютуба извлекается на сервере около полутора
 * секунд (в кэше — мгновенно), и двух треков не хватало: при быстром
 * перещёлкивании очередь упиралась в сеть. Четыре покрывают и это,
 * и короткие треки подряд.
 */
const LOOKAHEAD = 4;

const PERSIST_KEY = 'queue.v1';
/** Позиция лежит отдельно: она пишется каждые несколько секунд, очередь — редко. */
const POSITION_KEY = 'queue.position.v1';

interface PersistedQueue {
  queue: Track[];
  index: number;
  repeat: RepeatMode;
  shuffle: boolean;
}

interface QueueState {
  queue: Track[];
  index: number;
  repeat: RepeatMode;
  shuffle: boolean;
  /** Порядок до перемешивания — чтобы выключение shuffle возвращало исходный. */
  originalOrder: Track[] | null;
  /** Позиция, восстановленная из прошлой сессии и ещё не применённая. */
  restoredPosition: number;
  isLoading: boolean;
  error: string | null;
}

interface QueueActions {
  playNow: (tracks: Track[], startIndex: number) => Promise<void>;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  jumpTo: (index: number) => Promise<void>;
  toggleShuffle: () => Promise<void>;
  cycleRepeat: () => Promise<void>;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  moveInQueue: (from: number, to: number) => void;
  /** Реакция на смену активного трека внутри движка. */
  syncFromPlayer: (activeTrackId: string) => void;
  /** Восстановление ссылки после ошибки воспроизведения. */
  recoverFromError: () => Promise<void>;
  restore: () => void;
}

const persisted = readJSON<PersistedQueue | null>(PERSIST_KEY, null);

export const useQueue = create<QueueState & QueueActions>((set, get) => ({
  queue: persisted?.queue ?? [],
  index: persisted?.index ?? 0,
  repeat: persisted?.repeat ?? 'off',
  shuffle: persisted?.shuffle ?? false,
  originalOrder: null,
  restoredPosition: readJSON<number>(POSITION_KEY, 0),
  isLoading: false,
  error: null,

  playNow: async (tracks, startIndex) => {
    if (tracks.length === 0) return;
    const safeIndex = Math.min(Math.max(startIndex, 0), tracks.length - 1);

    set({ queue: tracks, index: safeIndex, isLoading: true, error: null, originalOrder: null });
    await loadCurrent(get, set, 0);
  },

  playNext: async () => {
    const { index, queue, repeat } = get();
    const isLast = index >= queue.length - 1;

    if (isLast && repeat !== 'all') return;
    const nextIndex = isLast ? 0 : index + 1;

    // Если следующий трек уже заряжен в движок (его прогрел refillLookahead),
    // просто переключаемся — переход мгновенный, без сетевого запроса.
    // Полная перезарядка через loadCurrent() сбросила бы весь прогрев.
    if (await skipWithinPlayer(queue[nextIndex]?.id)) {
      set({ index: nextIndex });
      persist();
      await refillLookahead(get());
      return;
    }

    set({ index: nextIndex });
    await loadCurrent(get, set, 0);
  },

  playPrevious: async () => {
    const { index, queue, repeat } = get();
    // Как в YT Music: в первые секунды «назад» — это к предыдущему треку,
    // дальше — к началу текущего.
    const position = await TrackPlayer.getProgress().then((p) => p.position).catch(() => 0);
    if (position > 3) {
      await TrackPlayer.seekTo(0);
      return;
    }

    const isFirst = index <= 0;
    if (isFirst && repeat !== 'all') {
      await TrackPlayer.seekTo(0);
      return;
    }
    const prevIndex = isFirst ? queue.length - 1 : index - 1;

    set({ index: prevIndex });
    await loadCurrent(get, set, 0);
  },

  jumpTo: async (index) => {
    const { queue } = get();
    if (index < 0 || index >= queue.length) return;
    set({ index });
    await loadCurrent(get, set, 0);
  },

  toggleShuffle: async () => {
    const { shuffle, queue, index, originalOrder } = get();
    const current = queue[index];

    if (shuffle) {
      // Возвращаем исходный порядок, оставаясь на том же треке.
      const restored = originalOrder ?? queue;
      const newIndex = Math.max(
        restored.findIndex((track) => track.id === current?.id),
        0,
      );
      set({ shuffle: false, queue: restored, index: newIndex, originalOrder: null });
    } else {
      // Текущий трек остаётся первым, перемешивается только то, что после него.
      const rest = queue.filter((_, i) => i !== index);
      const shuffled = shuffleArray(rest);
      const next = current ? [current, ...shuffled] : shuffled;
      set({ shuffle: true, queue: next, index: 0, originalOrder: queue });
    }

    persist();
    await refillLookahead(get());
  },

  cycleRepeat: async () => {
    const order: RepeatMode[] = ['off', 'all', 'one'];
    const next = order[(order.indexOf(get().repeat) + 1) % order.length];
    set({ repeat: next });
    // Повтор одного трека умеет сам движок — это надёжнее, чем ловить конец
    // трека в JS и перематывать вручную.
    await TrackPlayer.setRepeatMode(
      next === 'one' ? RNTPRepeatMode.Track : RNTPRepeatMode.Off,
    );
    persist();
  },

  addToQueue: (track) => {
    const { queue } = get();
    if (queue.some((item) => item.id === track.id)) return;
    set({ queue: [...queue, track] });
    persist();
  },

  removeFromQueue: (target) => {
    const { queue, index } = get();
    if (target === index) return; // играющий трек не выкидываем
    const next = queue.filter((_, i) => i !== target);
    set({ queue: next, index: target < index ? index - 1 : index });
    persist();
  },

  moveInQueue: (from, to) => {
    const { queue, index } = get();
    if (from === to) return;
    const next = [...queue];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    // Индекс играющего трека пересчитываем по его id, а не по арифметике сдвигов.
    const currentId = queue[index]?.id;
    const newIndex = Math.max(next.findIndex((track) => track.id === currentId), 0);
    set({ queue: next, index: newIndex });
    persist();
  },

  syncFromPlayer: (activeTrackId) => {
    const { queue, index } = get();
    if (queue[index]?.id === activeTrackId) return;

    const found = queue.findIndex((track) => track.id === activeTrackId);
    if (found >= 0) {
      set({ index: found });
      const track = queue[found];
      if (track) {
        pushRecent(track);
        // Движок сам перешёл на следующий — это тоже прослушивание.
        recordPlay(track.id);
        // Закрывает событие предыдущего трека и открывает новое:
        // именно здесь становится известно, сколько тот проиграл.
        beginPlay(track);
      }
      persist();
      void refillLookahead(get());
    }
  },

  recoverFromError: async () => {
    const { queue, index } = get();
    const track = queue[index];
    if (!track) return;

    // Самая частая причина — истёкшая presigned-ссылка. Берём свежую
    // и продолжаем с той же секунды, чтобы пользователь ничего не заметил.
    const position = await TrackPlayer.getProgress()
      .then((p) => p.position)
      .catch(() => 0);

    invalidateStreamUrl(track.id);
    try {
      const url = await resolveStreamUrl(track, true);
      await TrackPlayer.load(toPlayerTrack(track, url));
      if (position > 0) await TrackPlayer.seekTo(position);
      await TrackPlayer.play();
      set({ error: null });
    } catch {
      set({ error: 'Не удалось возобновить воспроизведение' });
    }
  },

  restore: () => {
    const { queue, index, restoredPosition } = get();
    if (queue.length === 0 || !queue[index]) return;

    // Заряжаем трек прошлой сессии и перематываем на сохранённую секунду,
    // но НЕ запускаем: приложение при старте молчит, пока не нажали play.
    // Заряжать нужно именно текущий трек — иначе play заиграл бы следующий.
    void loadCurrent(get, set, restoredPosition, false).catch(() => undefined);
  },
}));

/**
 * Заряжает текущий трек в движок и подтягивает ближайшие следующие.
 * `startPosition` нужен при восстановлении сессии.
 */
async function loadCurrent(
  get: () => QueueState & QueueActions,
  set: (partial: Partial<QueueState>) => void,
  startPosition: number,
  autoplay = true,
): Promise<void> {
  const state = get();
  const track = state.queue[state.index];
  if (!track) return;

  set({ isLoading: true, error: null });

  try {
    const url = await resolveStreamUrl(track);

    await TrackPlayer.reset();
    await TrackPlayer.add([toPlayerTrack(track, url)]);
    if (startPosition > 0) await TrackPlayer.seekTo(startPosition);
    if (autoplay) await TrackPlayer.play();

    // В «недавнее» и в статистику трек попадает, только когда его
    // действительно включили, а не при восстановлении очереди на старте.
    if (autoplay) {
      pushRecent(track);
      recordPlay(track.id);
      beginPlay(track);
    }
    set({ isLoading: false });
    persist();

    await refillLookahead(get());
  } catch (error) {
    set({
      isLoading: false,
      error: error instanceof Error ? error.message : 'Не удалось начать воспроизведение',
    });
  }
}

/**
 * Держит в движке ближайшие следующие треки — чтобы переход был мгновенным,
 * без паузы на сетевой запрос ссылки.
 */
async function refillLookahead(state: QueueState): Promise<void> {
  const upcoming = state.queue.slice(state.index + 1, state.index + 1 + LOOKAHEAD);
  if (upcoming.length === 0) return;

  let loaded: Awaited<ReturnType<typeof TrackPlayer.getQueue>>;
  try {
    loaded = await TrackPlayer.getQueue();
  } catch {
    return;
  }
  const loadedIds = new Set(loaded.map((item) => String(item.id)));

  const missing = upcoming.filter((track) => !loadedIds.has(track.id));
  if (missing.length === 0) return;

  // Ссылки запрашиваем параллельно, а не по очереди. Последовательный
  // обход упирался в сумму задержек: четыре трека по полторы секунды —
  // это шесть секунд, в течение которых очередь пуста.
  const resolved = await Promise.all(
    missing.map(async (track) => {
      try {
        return { track, url: await resolveStreamUrl(track) };
      } catch {
        // Один недоступный трек не должен ронять прогрев остальных.
        return null;
      }
    }),
  );

  // Добавляем строго по порядку: движок играет очередь так, как её сложили,
  // и параллельное добавление перемешало бы треки.
  for (const item of resolved) {
    if (!item) break;
    try {
      await TrackPlayer.add([toPlayerTrack(item.track, item.url)]);
    } catch {
      break;
    }
  }
}

function toPlayerTrack(track: Track, url: string) {
  return {
    id: track.id,
    url,
    title: track.title,
    artist: track.author,
    // Обложка едет в уведомление и на экран блокировки.
    artwork: track.artwork ?? undefined,
    duration: track.duration,
  };
}

/**
 * Сохранение очереди — отложенное.
 *
 * persist() зовётся из восьми действий, и каждое сериализовало всю очередь
 * целиком. При перелистывании очереди из сотни треков это JSON.stringify
 * сотни объектов на каждое нажатие «дальше», синхронно, в потоке
 * интерфейса — ровно то, из-за чего дёргался скролл.
 *
 * Приём тот же, что уже работает в журнале прослушиваний
 * (src/local/plays.ts): в память сразу, на диск — по таймеру.
 * Записывается всегда свежее состояние, а не то, что было в момент вызова.
 */
const PERSIST_DELAY_MS = 1500;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function writeQueue(): void {
  const state = useQueue.getState();
  writeJSON(PERSIST_KEY, {
    queue: state.queue,
    index: state.index,
    repeat: state.repeat,
    shuffle: state.shuffle,
  } satisfies PersistedQueue);
}

function persist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    writeQueue();
  }, PERSIST_DELAY_MS);
}

/** Записать немедленно. Нужно там, где приложение может не дожить до таймера. */
export function flushQueue(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  writeQueue();
}

// Сворачивание — последний момент, когда можно успеть записать: дальше
// систему никто не обязывает оставлять процесс живым.
AppState.addEventListener('change', (next) => {
  if (next !== 'active') flushQueue();
});

/**
 * Переключиться на трек, уже заряженный в движок. Возвращает false, если его
 * там нет — тогда вызывающий заряжает трек обычным путём.
 */
async function skipWithinPlayer(trackId: string | undefined): Promise<boolean> {
  if (!trackId) return false;
  try {
    const loaded = await TrackPlayer.getQueue();
    const position = loaded.findIndex((item) => String(item.id) === trackId);
    if (position < 0) return false;
    await TrackPlayer.skip(position);
    await TrackPlayer.play();
    return true;
  } catch {
    return false;
  }
}

/** Перемешивание Фишера—Йетса: равномерное, в отличие от sort(() => Math.random() - 0.5). */
function shuffleArray<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Текущий трек — отдельным селектором, чтобы не подписываться на всю очередь. */
export function useCurrentTrack(): Track | null {
  return useQueue((state) => state.queue[state.index] ?? null);
}

/**
 * Сохранение позиции воспроизведения. Пишет только число и только по таймеру
 * из сервиса — очередь при этом не трогается.
 */
export function savePosition(position: number): void {
  if (useQueue.getState().queue.length === 0) return;
  writeJSON(POSITION_KEY, position);
}
