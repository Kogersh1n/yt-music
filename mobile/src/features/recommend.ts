import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { relatedTracks } from '../api/radio';
import { interleave, refine } from './feed';
import { displayArtist } from '../api/songText';
import { readJSON, writeJSON } from '../local/storage';
import { computeTaste, type Seed, type TasteProfile } from './taste';
import { usePlayEvents } from '../local/plays';
import { useLikedIds } from '../local/likes';
import type { Track } from '../api/types';

/**
 * Подсказки на главной.
 *
 * Делится ровно надвое. Кандидатов даёт YouTube (api/radio.ts) — своего
 * движка похожести у нас нет и быть не может. А вот что с ними делать,
 * решаем мы, и без этой части подсказки были бы бесполезны:
 *
 *   Затравки. Радио строится не от последнего трека, а от нескольких
 *   любимых, разнесённых по исполнителям (см. features/taste.ts).
 *
 *   Отсев. Убираем услышанное — это повтор, а не подсказка, — и
 *   исполнителей, которых стабильно пропускают.
 *
 *   Перемешивание. Берём из каждого радио по очереди, а не подряд:
 *   иначе первые десять подсказок все из одной затравки, и выдача
 *   выглядит как «ещё того же самого».
 *
 *   Потолок на исполнителя. Радио любит возвращаться к одному имени;
 *   без ограничения половина списка оказывается им.
 */

/** Сколько радио запрашиваем. Больше — дольше ждать, а разнообразия не прибавляет. */
const SEED_COUNT = 4;
/** Сколько треков берём из каждого радио. */
const PER_SEED = 25;
/** Свежесть подсказок. Чаще незачем: вкус за шесть часов не меняется. */
const TTL_MS = 6 * 60 * 60 * 1000;
// v3: отсев научился отрезать приписку исполнителя в названии. Старый кэш
// собран прежним правилом, и без смены ключа он прожил бы ещё шесть часов.
const CACHE_KEY = 'recommend.v3';

interface CachedFeed {
  /** Отпечаток затравок. Сменились — кэш больше не про этот вкус. */
  signature: string;
  at: number;
  tracks: Track[];
}

function signatureOf(seeds: readonly Seed[]): string {
  return seeds.map((seed) => seed.videoId).join(',');
}

async function buildFeed(seeds: readonly Seed[]): Promise<Track[]> {
  // Радио запрашиваем параллельно: четыре запроса по секунде подряд —
  // это четыре секунды пустой главной.
  const lists = await Promise.all(
    seeds.map(async (seed) => {
      try {
        return await relatedTracks(seed.videoId, PER_SEED);
      } catch {
        // Одна недоступная затравка не должна оставить экран без подсказок.
        return [];
      }
    }),
  );

  return interleave(lists);
}

/**
 * Профиль вкуса, пересчитываемый по мере прослушивания.
 *
 * Подписан и на журнал, и на лайки: любое действие пользователя меняет
 * подсказки, не дожидаясь перезапуска приложения.
 */
export function useTaste(seedLimit = SEED_COUNT): TasteProfile {
  const events = usePlayEvents();
  const liked = useLikedIds();

  return useMemo(
    () => computeTaste(events, liked, Date.now(), seedLimit),
    [events, liked, seedLimit],
  );
}

/**
 * Лента подсказок.
 *
 * Пока данных мало — ничего не выдумываем и возвращаем пустой список:
 * раздел на главной просто не появится. Показывать «рекомендации»,
 * построенные на двух случайных прослушиваниях, хуже, чем не показывать
 * ничего: подпись обещает понимание, которого нет.
 */
export function useRecommendations() {
  const taste = useTaste(SEED_COUNT);
  const signature = signatureOf(taste.seeds);

  // Чтение с диска и разбор JSON — в useMemo, а не на каждый рендер.
  // Главная перерисовывается на каждой смене трека (журнал меняется),
  // и без этого кэш подсказок перечитывался с диска столько же раз.
  const { usable, cachedAt } = useMemo(() => {
    const cached = readJSON<CachedFeed | null>(CACHE_KEY, null);
    const fresh =
      cached && cached.signature === signature && Date.now() - cached.at < TTL_MS;
    return { usable: fresh ? cached.tracks : undefined, cachedAt: cached?.at };
  }, [signature]);

  const query = useQuery({
    queryKey: ['recommendations', signature],
    enabled: taste.seeds.length > 0,
    // Кэш с диска — чтобы главная после запуска рисовалась сразу,
    // а не через секунду ожидания сети.
    initialData: usable,
    initialDataUpdatedAt: usable ? cachedAt : undefined,
    staleTime: TTL_MS,
    gcTime: TTL_MS,
    retry: 1,
    queryFn: async () => {
      const candidates = await buildFeed(taste.seeds);
      const tracks = refine(candidates, taste);

      writeJSON(CACHE_KEY, {
        signature,
        at: Date.now(),
        tracks,
      } satisfies CachedFeed);

      return tracks;
    },
  });

  return {
    tracks: query.data ?? [],
    isLoading: query.isLoading && taste.seeds.length > 0,
    /** Имя исполнителя, вокруг которого крутится подборка — для подписи раздела. */
    topArtist: topArtistName(taste),
    hasEnoughData: taste.seeds.length > 0,
    refetch: query.refetch,
  };
}

/**
 * Кем подписать подборку.
 *
 * Длинные составные каналы («Live Aid and Queen Official») в предложение
 * не влезают и читаются как мусор, поэтому такие просто не называем:
 * подпись останется общей, и это честнее натянутого имени.
 */
const NAME_LIMIT = 24;

function topArtistName(taste: TasteProfile): string | null {
  const top = taste.artists.find((artist) => artist.score > 0);
  if (!top) return null;

  const name = displayArtist(top.author);
  return name.length <= NAME_LIMIT ? name : null;
}

/**
 * Радио по одному треку — «похоже на это».
 *
 * Отдельно от ленты: здесь затравка задана пользователем явно, и отсев
 * по услышанному не нужен. Человек просил похожее на эту песню, а не
 * новое для себя.
 */
export function useTrackRadio(videoId: string | null) {
  return useQuery({
    queryKey: ['radio', videoId],
    enabled: Boolean(videoId),
    staleTime: TTL_MS,
    retry: 1,
    queryFn: () => relatedTracks(videoId as string, PER_SEED),
  });
}
