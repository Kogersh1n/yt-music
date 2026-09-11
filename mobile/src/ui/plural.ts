/**
 * Русское склонение после числа: 1 раз, 2 раза, 5 раз, 21 раз, 22 раза.
 *
 * Отдельной функцией, потому что простое «один или не один» врёт уже
 * на девятке: «9 раза». Правило зависит от двух последних цифр, а не
 * от последней, иначе 11–14 дают «11 раза».
 */
export function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
