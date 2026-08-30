/**
 * Проверка резолвера тем и валидации — без запуска приложения.
 *
 * Работает потому, что resolve/validate/color/fonts не тянут React Native:
 * файлы шрифтов вынесены в отдельный модуль fontAssets. Запуск:
 *
 *   npm run check:themes
 */
import { resolveTheme, checkContrast, failedChecks, suggestReadableColors } from '../resolve';
import { validateThemeSource, parseThemeJson } from '../validate';
import { BUILTIN_THEMES } from '../themes';
import { contrastRatio } from '../color';

let failures = 0;
function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
}

console.log('— встроенные темы разбираются и читаемы:');
for (const source of BUILTIN_THEMES) {
  try {
    const theme = resolveTheme(validateThemeSource(source));
    const bad = failedChecks(theme.colors);
    check(
      `${theme.id}`,
      bad.length === 0,
      bad.map((b) => `${b.label} ${b.ratio?.toFixed(2)}<${b.required}`).join(', '),
    );
  } catch (e) {
    check(`${source.id}`, false, String(e));
  }
}

console.log('— ссылки в палитру:');
const withRefs = resolveTheme({
  id: 't', extends: 'base-dark',
  palette: { ink: '#112233' },
  colors: { bg: '$ink', scrim: '$ink@50' },
} as never);
check('$ink разрешается', withRefs.colors.bg === '#112233', withRefs.colors.bg);
check('$ink@50 даёт rgba', withRefs.colors.scrim === 'rgba(17,34,51,0.5)', withRefs.colors.scrim);

console.log('— наследование:');
const minimal = resolveTheme({ id: 'm', extends: 'base-dark', colors: { accent: '#89b4fa' } } as never);
check('своё значение применилось', minimal.colors.accent === '#89b4fa');
check('остальное из базы', minimal.colors.bg === '#030303', minimal.colors.bg);
check('метрики из базы', minimal.layout.rowThumb === 48);

console.log('— extends на светлую базу (была тихая ошибка):');
const light = resolveTheme({ id: 'l', extends: 'base-light', colors: { accent: '#89b4fa' } } as never);
check('фон светлый', light.colors.bg === '#ffffff', light.colors.bg);
check('поверхность светлая', light.colors.surface === '#f2f2f2', light.colors.surface);
check('текст тёмный', light.colors.text === '#0f0f0f', light.colors.text);
check('свой акцент сохранён', light.colors.accent === '#89b4fa', light.colors.accent);
check('onAccent выведен под акцент', light.colors.onAccent === '#000000', light.colors.onAccent);
check('минимальная светлая тема читаема', failedChecks(light.colors).length === 0,
  failedChecks(light.colors).map((c) => c.label).join(', '));

const explicit = resolveTheme({
  id: 'e', extends: 'base-dark',
  colors: { accent: '#89b4fa', onAccent: '#11111b' },
} as never);
check('явный onAccent не перебивается', explicit.colors.onAccent === '#11111b', explicit.colors.onAccent);

const darkAccent = resolveTheme({ id: 'd', extends: 'base-dark', colors: { accent: '#1e1e2e' } } as never);
check('на тёмном акценте подпись белая', darkAccent.colors.onAccent === '#ffffff', darkAccent.colors.onAccent);

console.log('— плотность и масштаб текста:');
const compact = resolveTheme({
  id: 'c', extends: 'base-dark',
  layout: { density: 'compact' },
  typography: { scale: 0.8 },
} as never);
check('compact уменьшает строку', compact.layout.rowHeight === 54, String(compact.layout.rowHeight));
check('scale уменьшает кегль', compact.type.title.fontSize === Math.round(22 * 0.8),
  String(compact.type.title.fontSize));

console.log('— ошибки понятны:');
const bads: [string, unknown][] = [
  ['radius строкой', { id: 'x', radius: { card: '8px' } }],
  ['неизвестный extends', { id: 'x', extends: 'nope' }],
  ['ссылка в пустоту', { id: 'x', colors: { bg: '$missing' } }],
  ['нет id', { name: 'без id' }],
  ['чужая схема', { id: 'x', schema: 'other/9' }],
  ['scale за пределами', { id: 'x', typography: { scale: 12 } }],
];
for (const [name, input] of bads) {
  try {
    resolveTheme(validateThemeSource(input));
    check(name, false, 'ошибки не было');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    check(name, msg.length > 10, msg);
    console.log(`       → ${msg}`);
  }
}

console.log('— нечитаемая тема отлавливается:');
const unreadable = resolveTheme({
  id: 'u', extends: 'base-dark', colors: { text: '#111111', bg: '#0a0a0a' },
} as never);
check('серое на чёрном не проходит', failedChecks(unreadable.colors).length > 0);

console.log('— незнакомые ключи не ломают:');
try {
  const future = validateThemeSource({ id: 'f', extends: 'base-dark', somethingNew: { a: 1 } });
  check('тема из будущего открывается', resolveTheme(future).id === 'f');
} catch (e) {
  check('тема из будущего открывается', false, String(e));
}

console.log('— контраст считается верно:');
check('чёрное на белом = 21', Math.round(contrastRatio('#000000', '#ffffff')!) === 21);
check('одинаковые = 1', contrastRatio('#345678', '#345678') === 1);
check('rgba не считается', contrastRatio('rgba(0,0,0,0.5)', '#fff') === null);

console.log('— битый JSON:');
try {
  parseThemeJson('{ не json }');
  check('битый JSON', false);
} catch (e) {
  check('битый JSON ловится', true);
  console.log(`       → ${(e as Error).message}`);
}

console.log('— автоподбор чинит нечитаемое:');
const broken = resolveTheme({
  id: 'b', extends: 'base-light',
  colors: { accent: '#efdd39', onAccent: '#ffffff', text: '#dddddd', bg: '#ffffff' },
} as never);
check('исходная не проходит', failedChecks(broken.colors).length > 0);
const repaired = suggestReadableColors(broken.colors);
check('после подбора проходит', failedChecks(repaired).length === 0,
  failedChecks(repaired).map((c) => c.label).join(', '));
check('фон не тронут', repaired.bg === broken.colors.bg, repaired.bg);
check('акцент не тронут', repaired.accent === broken.colors.accent, repaired.accent);
console.log(`       → onAccent ${broken.colors.onAccent} → ${repaired.onAccent}, text ${broken.colors.text} → ${repaired.text}`);

console.log('— уже читаемую тему не портит:');
const fine = resolveTheme({ id: 'f', extends: 'base-dark' } as never);
const untouched = suggestReadableColors(fine.colors);
check('цвета не изменились', JSON.stringify(untouched) === JSON.stringify(fine.colors));

console.log(failures === 0 ? '\nВСЁ ПРОШЛО' : `\nПРОВАЛОВ: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
