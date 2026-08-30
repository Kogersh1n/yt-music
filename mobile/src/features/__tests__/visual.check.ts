/**
 * Проверки чистой логики визуальных фич — без запуска приложения.
 *
 * Эталонные цвета сверены с библиотекой `blurhash`: она декодирует картинку
 * целиком, а мы берём только DC-член. Расхождение до 5 единиц на канал —
 * это округление при переводе sRGB, а не ошибка.
 *
 *   npm run check:visual
 */
import { averageColorFromBlurhash, rgbToHex, brightness } from '../../ui/blurhash';
import { scoreMatch, fuzzyFilter } from '../fuzzy';
import { artworkGlow, artworkGradient } from '../../ui/artworkColor';
import { hexToHsl } from '../../ui/theme/color';

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!condition) failures++;
}

console.log('— blurhash: средний цвет');
const REFERENCE: [string, string][] = [
  ['LEHV6nWB2yk8pyo0adR*.7kCMdnj', '#979695'],
  ['LGF5]+Yk^6#M@-5c,1J5@[or[Q6.', '#837e98'],
  ['L6PZfSi_.AyE_3t7t7R**0o#DgR4', '#ddd9d5'],
];
for (const [hash, expected] of REFERENCE) {
  const rgb = averageColorFromBlurhash(hash);
  const actual = rgb ? rgbToHex(rgb) : 'null';
  check(`${hash.slice(0, 10)}… → ${expected}`, actual === expected, actual);
}
check('мусор не ломает', averageColorFromBlurhash('!!!') === null);
check('пустая строка не ломает', averageColorFromBlurhash('') === null);
check('строка не blurhash не ломает', averageColorFromBlurhash('не хэш вовсе') === null);
check('яркость белого ≈ 1', Math.abs(brightness({ r: 255, g: 255, b: 255 }) - 1) < 0.01);
check('яркость чёрного = 0', brightness({ r: 0, g: 0, b: 0 }) === 0);

console.log('— ореол: согласование с обложкой');
const saturationOf = (hex: string) => hexToHsl(hex)?.s ?? -1;

// Насыщенная обложка → заметный цветной ореол.
const vivid = artworkGlow('track', 'dark', '#c0392b');
check('цветная обложка даёт цветной ореол', saturationOf(vivid) > 25, `${vivid} (S=${saturationOf(vivid)}%)`);
check('оттенок взят у обложки', Math.abs((hexToHsl(vivid)?.h ?? 0) - (hexToHsl('#c0392b')?.h ?? 0)) < 6);

// Чёрно-белая обложка → нейтральный ореол, а не случайный цвет.
const grey = artworkGlow('track', 'dark', '#8a8a8c');
check('серая обложка даёт нейтральный ореол', saturationOf(grey) <= 10, `${grey} (S=${saturationOf(grey)}%)`);

// Цвет ещё не посчитан → приглушённая временная подложка.
const pending = artworkGlow('track', 'dark', null);
check('без цвета — приглушённый временный оттенок',
  saturationOf(pending) > 10 && saturationOf(pending) < saturationOf(vivid) + 1,
  `${pending} (S=${saturationOf(pending)}%)`);

// Градиент всегда заканчивается фоном темы.
const gradient = artworkGradient('track', 'light', '#ffffff', '#c0392b');
check('градиент упирается в фон темы', gradient[2] === '#ffffff', gradient.join(' → '));
check('градиент из трёх остановок', gradient.length === 3);

console.log('— fuzzy: выдача');
interface Row {
  title: string;
  author: string;
}
const TRACKS: Row[] = [
  { title: 'Crystal Castles - Vanished', author: 'LastGangRadio' },
  { title: 'Crystal Castles - Untrust Us (Lyrics)', author: 'Cherry Lu' },
  { title: 'Кайрат Нуртас - Ауырмайды жүрек (Official video)', author: 'Kairat Nurtas' },
  { title: 'GONE.Fludd & IROH - Зашей (Official Video)', author: 'GONE.Fludd' },
  { title: 'Advantage', author: 'Someone' },
];
const FIELDS = [
  { get: (row: Row) => row.title, weight: 1 },
  { get: (row: Row) => row.author, weight: 0.8 },
];
const find = (query: string) => fuzzyFilter(TRACKS, query, FIELDS).map((row) => row.title);

check('«van» → Vanished первым', find('van')[0]?.includes('Vanished') === true, find('van')[0]);
check('«crys van» находит по обрывкам', find('crys van').some((t) => t.includes('Vanished')));
check('кириллица', find('зашей')[0]?.includes('Зашей') === true, find('зашей')[0]);
check('регистр не важен', find('KAIRAT')[0]?.includes('Кайрат') === true);
check('поиск по исполнителю', find('нуртас').length > 0);
check('пустой запрос → всё', fuzzyFilter(TRACKS, '  ', FIELDS).length === TRACKS.length);
check('бессмыслица → пусто', find('zzzzzz').length === 0);

console.log('— fuzzy: оценка');
const contiguous = scoreMatch('Vanished', 'van');
const scattered = scoreMatch('Advantage', 'van');
check(
  'подряд ценится выше разрозненного',
  contiguous !== null && scattered !== null && contiguous > scattered,
  `${contiguous?.toFixed(2)} против ${scattered?.toFixed(2)}`,
);
check('нет совпадения → null', scoreMatch('abc', 'xyz') === null);
check('запрос длиннее текста → null', scoreMatch('ab', 'abcdef') === null);

console.log(failures === 0 ? '\nВСЁ ПРОШЛО' : `\nПРОВАЛОВ: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
