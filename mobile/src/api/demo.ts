import type { SongResponse } from './types';

/**
 * Демо-медиатека.
 *
 * Нужна затем, чтобы приложение можно было открыть и послушать, когда бэкенд
 * не поднят (прод на Railway отвечает 404, локальный стек поднимается не всегда).
 * Аудио — свободные примеры SoundHelix, обложки — детерминированные картинки
 * по seed, так что список выглядит как настоящая медиатека, а не как заглушка.
 */

interface DemoSeed {
  title: string;
  author: string;
  duration: number;
  track: number;
}

const SEEDS: DemoSeed[] = [
  { title: 'Ночной эфир', author: 'Kavinsky', duration: 372, track: 1 },
  { title: 'Северный ветер', author: 'Ólafur Arnalds', duration: 425, track: 2 },
  { title: 'Тихий город', author: 'Nils Frahm', duration: 291, track: 3 },
  { title: 'Отражения', author: 'Bonobo', duration: 348, track: 4 },
  { title: 'Долгая дорога', author: 'Tycho', duration: 311, track: 5 },
  { title: 'Первый снег', author: 'Emancipator', duration: 264, track: 6 },
  { title: 'Тёплый асфальт', author: 'Boards of Canada', duration: 398, track: 7 },
  { title: 'Между этажами', author: 'Jon Hopkins', duration: 456, track: 8 },
  { title: 'Полдень', author: 'Four Tet', duration: 303, track: 9 },
  { title: 'Обратный путь', author: 'Rival Consoles', duration: 337, track: 10 },
  { title: 'Стеклянный дом', author: 'Floating Points', duration: 289, track: 11 },
  { title: 'Последний вагон', author: 'Burial', duration: 412, track: 12 },
];

/**
 * Ссылка на аудио демо-трека. Отдаётся напрямую, минуя presigned-логику:
 * у этих файлов нет срока жизни.
 */
export function demoStreamUrl(songId: string): string {
  const index = SEEDS.findIndex((seed) => demoId(seed) === songId);
  const track = index >= 0 ? SEEDS[index].track : 1;
  return `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${track}.mp3`;
}

function demoId(seed: DemoSeed): string {
  return `demo-${seed.track}`;
}

export const DEMO_SONGS: SongResponse[] = SEEDS.map((seed) => ({
  id: demoId(seed),
  title: seed.title,
  author: seed.author,
  duration: seed.duration,
  listened: 120 + seed.track * 37,
  liked: seed.track * 3,
  audio_file_key: `demo/${seed.track}.mp3`,
  cover_file_key: `demo/${seed.track}.jpg`,
  cover_url: `https://picsum.photos/seed/ytmusic${seed.track}/400/400`,
}));

export function isDemoId(songId: string): boolean {
  return songId.startsWith('demo-');
}
