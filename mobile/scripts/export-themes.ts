import { writeFileSync } from 'node:fs';
import { BUILTIN_THEMES } from '../src/ui/theme/themes';

/**
 * Выгружает встроенные темы в themes/*.json — как образцы для собственных.
 * Запуск: npm run themes:export
 */
for (const theme of BUILTIN_THEMES) {
  const path = `themes/${theme.id}.json`;
  writeFileSync(path, JSON.stringify(theme, null, 2) + '\n');
  console.log(path);
}
