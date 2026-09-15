/**
 * Проверки рекомендательной логики — без сети и без запуска приложения.
 *
 * Проверяется ровно наша часть: веса сигналов, затухание, отсев и
 * разнесение по исполнителям. Качество самих кандидатов — не наша
 * ответственность, их отдаёт YouTube.
 *
 *   npm run check:taste
 */
import { computeTaste } from '../taste';
import { refine, interleave } from '../feed';
import { songSignature, songTitleKey, displayArtist, displayTitle } from '../../api/songText';
import type { PlayEvent } from '../../local/plays';
import type { Track } from '../../api/types';

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!condition) failures++;
}

const empty = {
  heard: new Set<string>(),
  heardSongs: new Set<string>(),
  avoided: new Set<string>(),
};

const NOW = new Date('2026-09-16T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

/** Событие журнала. По умолчанию — дослушанный сегодня трек. */
function play(over: Partial<PlayEvent> = {}): PlayEvent {
  return {
    trackId: over.youtubeId ?? 'aaaaaaaaaaa',
    youtubeId: 'aaaaaaaaaaa',
    author: 'Артист',
    title: 'Песня',
    startedAt: NOW - 60_000,
    seconds: 180,
    duration: 200,
    completed: true,
    ...over,
  };
}

function track(id: string, author: string): Track {
  return {
    id: `yt:${id}`,
    title: `Трек ${id}`,
    author,
    duration: 200,
    artwork: null,
    source: 'youtube',
    youtubeId: id,
  };
}

console.log('— вкус: сила сигналов');

check('пустая история — пустой профиль', computeTaste([], [], NOW).isEmpty);

const completed = computeTaste([play()], [], NOW);
const skipped = computeTaste(
  [play({ seconds: 5, duration: 200, completed: false })],
  [],
  NOW,
);
check('дослушанный даёт плюс', (completed.artists[0]?.score ?? 0) > 0,
  String(completed.artists[0]?.score.toFixed(2)));
check('пропущенный даёт минус', (skipped.artists[0]?.score ?? 0) < 0,
  String(skipped.artists[0]?.score.toFixed(2)));

const partial = computeTaste(
  [play({ seconds: 100, duration: 200, completed: false })],
  [],
  NOW,
);
check('слушали половину — слабый плюс',
  (partial.artists[0]?.score ?? 0) > 0 && (partial.artists[0]?.score ?? 0) < (completed.artists[0]?.score ?? 0));

console.log('— вкус: затухание');

const fresh = computeTaste([play({ startedAt: NOW - 60_000 })], [], NOW);
const month = computeTaste([play({ startedAt: NOW - 30 * DAY })], [], NOW);
const twoMonths = computeTaste([play({ startedAt: NOW - 60 * DAY })], [], NOW);

const f = fresh.artists[0]?.score ?? 0;
const m = month.artists[0]?.score ?? 0;
const t = twoMonths.artists[0]?.score ?? 0;

check('месячной давности весит вдвое меньше', Math.abs(m / f - 0.5) < 0.02, `${(m / f).toFixed(3)}`);
check('двухмесячной — вчетверо', Math.abs(t / f - 0.25) < 0.02, `${(t / f).toFixed(3)}`);
check('свежее весит больше старого', f > m && m > t);

console.log('— вкус: лайки');

const liked = computeTaste([play()], ['aaaaaaaaaaa'], NOW);
check('лайк усиливает трек', (liked.seeds[0]?.score ?? 0) > (completed.seeds[0]?.score ?? 0));

const likeOnly = computeTaste([], ['bbbbbbbbbbb'], NOW);
check('лайк без истории всё равно даёт затравку', likeOnly.seeds.length === 1);
check('лайк из медиатеки (UUID) затравкой не становится',
  computeTaste([], ['3f2a1c4e-0b7d-4a19-9c3e-77bb1f2d8e10'], NOW).seeds.length === 0);

console.log('— вкус: кого избегать');

const oneSkip = computeTaste([play({ author: 'Мимо', seconds: 3, completed: false })], [], NOW);
check('один пропуск — ещё не приговор', !oneSkip.avoided.has('Мимо'));

const twoSkips = computeTaste(
  [
    play({ author: 'Мимо', youtubeId: 'ccccccccccc', seconds: 3, completed: false }),
    play({ author: 'Мимо', youtubeId: 'ddddddddddd', seconds: 2, completed: false }),
  ],
  [],
  NOW,
);
check('два пропуска подряд — избегаем', twoSkips.avoided.has('Мимо'));

console.log('— вкус: затравки разнесены по исполнителям');

const many = computeTaste(
  [
    play({ author: 'A', youtubeId: 'a1aaaaaaaaa' }),
    play({ author: 'A', youtubeId: 'a2aaaaaaaaa' }),
    play({ author: 'A', youtubeId: 'a3aaaaaaaaa' }),
    play({ author: 'B', youtubeId: 'b1bbbbbbbbb' }),
    play({ author: 'C', youtubeId: 'c1ccccccccc' }),
  ],
  [],
  NOW,
  3,
);
check('три затравки — три разных исполнителя',
  new Set(many.seeds.map((s) => s.author)).size === 3,
  many.seeds.map((s) => s.author).join(','));

const onlyOne = computeTaste(
  [play({ author: 'A', youtubeId: 'a1aaaaaaaaa' }), play({ author: 'A', youtubeId: 'a2aaaaaaaaa' })],
  [],
  NOW,
  3,
);
check('исполнитель один — добираем его же треками', onlyOne.seeds.length === 2);

console.log('— лента: перемешивание');

const mixed = interleave([
  [track('x1xxxxxxxxx', 'X'), track('x2xxxxxxxxx', 'X')],
  [track('y1yyyyyyyyy', 'Y'), track('y2yyyyyyyyy', 'Y')],
]);
check('берём из радио по очереди',
  mixed.map((x) => x.author).join('') === 'XYXY',
  mixed.map((x) => x.author).join(''));

const uneven = interleave([[track('z1zzzzzzzzz', 'Z')], [track('w1wwwwwwwww', 'W'), track('w2wwwwwwwww', 'W')]]);
check('короткий список не обрывает длинный', uneven.length === 3);

console.log('— лента: отсев');

check('услышанное не попадает в подсказки',
  refine([track('a1aaaaaaaaa', 'A')], { ...empty, heard: new Set(['a1aaaaaaaaa']) }).length === 0);

check('избегаемый исполнитель отсеивается',
  refine([track('a1aaaaaaaaa', 'Мимо')], { ...empty, avoided: new Set(['Мимо']) }).length === 0);

check('дубликат из двух радио остаётся один',
  refine([track('a1aaaaaaaaa', 'A'), track('a1aaaaaaaaa', 'A')], empty).length === 1);

const spam = refine(
  [
    track('s1sssssssss', 'Один'),
    track('s2sssssssss', 'Один'),
    track('s3sssssssss', 'Один'),
    track('s4sssssssss', 'Один'),
  ],
  empty,
);
check('не больше двух треков одного исполнителя', spam.length === 2, `${spam.length}`);

check('потолок длины соблюдается',
  refine(Array.from({ length: 50 }, (_, i) => track(`k${String(i).padStart(10, '0')}`, `А${i}`)), empty, 10).length === 10);

console.log('— отпечаток песни: узнаём ту же песню в другой загрузке');

const clip = songSignature("Queen - Don't Stop Me Now (Official Video)", 'Queen Official');
const plain = songSignature("Don't Stop Me Now", 'Queen');
check('имя исполнителя в заголовке не мешает', clip === plain, `${clip} / ${plain}`);

check('перезалив узнаётся',
  songSignature('Bohemian Rhapsody (Remastered 2011)', 'Queen') ===
  songSignature('Queen — Bohemian Rhapsody', 'Queen'));

check('разные песни одного исполнителя не путаются',
  songSignature('Somebody To Love', 'Queen') !== songSignature('We Will Rock You', 'Queen'));

check('одинаковое название у разных исполнителей не совпадает',
  songSignature('Yesterday', 'The Beatles') !== songSignature('Yesterday', 'Boyz II Men'));

check('название из одного имени исполнителя не даёт пустой отпечаток',
  songSignature('Queen', 'Queen').startsWith('queen'));

console.log('— лента: отсев по отпечатку');

const heardSongs = new Set([songSignature('We Will Rock You', 'Queen')]);
check('услышанная песня отсеивается и в другой загрузке',
  refine(
    [{ ...track('n1nnnnnnnnn', 'Queen'), title: 'Queen - We Will Rock You (Live Aid 1985)' }],
    { ...empty, heardSongs },
  ).length === 0);

check('две загрузки одной песни в выдаче схлопываются в одну',
  refine(
    [
      { ...track('p1ppppppppp', 'Queen'), title: 'Somebody To Love (Official Video)' },
      { ...track('p2ppppppppp', 'Queen'), title: 'Queen - Somebody To Love' },
    ],
    empty,
  ).length === 1);

// Ровно тот случай, что вылез на экране: имя артиста внутри названия,
// а в поле автора — площадка концерта.
check('концертная запись не дублирует студийную в ленте',
  refine(
    [
      { ...track('q1qqqqqqqqq', 'Queen'), title: 'We Will Rock You' },
      { ...track('q2qqqqqqqqq', 'Live Aid'), title: 'Queen - We Will Rock You (Live Aid 1985)' },
    ],
    empty,
  ).length === 1);

console.log('— отпечаток: приписка исполнителя в названии');

check('приписка «Артист - » отрезается',
  songTitleKey('Queen - We Will Rock You (Live Aid 1985)', 'Live Aid') ===
  songTitleKey('We Will Rock You', 'Queen'),
  `${songTitleKey('Queen - We Will Rock You (Live Aid 1985)', 'Live Aid')} / ${songTitleKey('We Will Rock You', 'Queen')}`);

check('длинное первое звено не считается именем',
  songTitleKey('Я люблю тебя так сильно - и это правда', 'Некто').includes('люблю'));

check('название без разделителя не портится',
  songTitleKey('Bohemian Rhapsody', 'Queen') === 'bohemian rhapsody');

console.log('— имя исполнителя для показа');

check('«Queen Official» → «Queen»', displayArtist('Queen Official') === 'Queen');
check('«ArtistVEVO» → «Artist»', displayArtist('ArtistVEVO') === 'Artist');
check('«Имя - Topic» → «Имя»', displayArtist('Имя - Topic') === 'Имя');
check('составной канал укорачивается',
  displayArtist('Live Aid and Queen Official') === 'Live Aid and Queen',
  displayArtist('Live Aid and Queen Official'));
check('обычное имя не трогаем', displayArtist('Rauf & Faik') === 'Rauf & Faik');
check('имя из одного служебного слова не обнуляется',
  displayArtist('Official') === 'Official');

console.log('— название для показа');

const t1 = displayTitle('Rauf Faik - детство (Official audio)');
check('приписка исполнителя и служебные скобки уходят',
  t1.title === 'детство' && t1.badge === null, `«${t1.title}» / ${t1.badge}`);

const t2 = displayTitle('Queen - We Will Rock You (Live Aid 1985)');
check('концерт становится бейджем',
  t2.title === 'We Will Rock You' && t2.badge === 'LIVE', `«${t2.title}» / ${t2.badge}`);

const t3 = displayTitle('MORGENSHTERN - YUNG HEFNER (Клипец, 2020)');
check('русский служебный мусор уходит',
  t3.title === 'YUNG HEFNER' && t3.badge === null, `«${t3.title}» / ${t3.badge}`);

const t4 = displayTitle('Someone - Song Name (feat. Кто-то)');
check('feat. остаётся — это часть названия',
  t4.title === 'Song Name (feat. Кто-то)', `«${t4.title}»`);

const t5 = displayTitle('Artist - Track (Official Video) (Remix)');
check('из двух скобок остаётся бейдж, мусор уходит',
  t5.title === 'Track' && t5.badge === 'REMIX', `«${t5.title}» / ${t5.badge}`);

const t6 = displayTitle('Artist - Track (Live) (Remastered)');
check('первый бейдж выигрывает', t6.badge === 'LIVE', String(t6.badge));

const t7 = displayTitle('Bohemian Rhapsody');
check('чистое название не портится', t7.title === 'Bohemian Rhapsody' && t7.badge === null);

const t8 = displayTitle('Track (Part II)');
check('нераспознанные скобки остаются', t8.title === 'Track (Part II)', `«${t8.title}»`);

const t9 = displayTitle('(Official Video)');
check('из одних скобок не делаем пустую строку', t9.title.length > 0, `«${t9.title}»`);

const tDur = displayTitle('Queen - Greatest Hits (2) [1 hour 20 minutes long]');
check('описание длительности в скобках уходит',
  !tDur.title.includes('hour'), `«${tDur.title}»`);
check('номер тома при этом сохраняется',
  tDur.title === 'Greatest Hits (2)', `«${tDur.title}»`);

const tDurRu = displayTitle('Сборник [45 минут]');
check('то же по-русски', tDurRu.title === 'Сборник', `«${tDurRu.title}»`);

const t10 = displayTitle('Песня (2020)');
check('голый год выбрасывается', t10.title === 'Песня', `«${t10.title}»`);

console.log(failures === 0 ? '\nВСЁ ПРОШЛО' : `\nПРОВАЛОВ: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
