/**
 * Нечёткий поиск по списку треков.
 *
 * Подстрочного совпадения мало: в названиях много служебных слов
 * («Official Video», «Lyrics»), и пользователь набирает обрывками — «crys van»
 * должно находить «Crystal Castles - Vanished». Поэтому совпадением считается
 * подпоследовательность, а порядок задаётся оценкой.
 *
 * Никакой библиотеки: правила у нас свои, а весь матчер короче, чем
 * его настройка в чужом.
 */

/** Хуже этой оценки результаты не показываем — иначе выдача превращается в шум. */
const MIN_SCORE = 1;

interface Scored<T> {
  item: T;
  score: number;
}

/**
 * Оценка совпадения запроса с текстом. `null` — не совпало.
 *
 * Что повышает оценку: совпадение подряд, начало слова, начало строки.
 * Так «van» ставит «Vanished» выше, чем «Advantage», хотя подпоследовательность
 * есть в обоих.
 */
export function scoreMatch(text: string, query: string): number | null {
  return scoreLowered(text.toLowerCase(), query.toLowerCase());
}

/**
 * То же, но обе строки уже приведены к нижнему регистру.
 *
 * Отдельная функция нужна, чтобы `fuzzyFilter` привёл запрос один раз,
 * а не на каждый из тысяч вызовов.
 */
function scoreLowered(haystack: string, needle: string): number | null {
  if (needle === '') return 0;
  if (needle.length > haystack.length) return null;

  let score = 0;
  let position = 0;
  let previousIndex = -1;

  for (const char of needle) {
    const index = haystack.indexOf(char, position);
    if (index === -1) return null;

    if (index === previousIndex + 1) {
      // Символы подряд — самый сильный признак осмысленного совпадения.
      score += 3;
    } else if (index === 0 || /[\s\-—_(\[/.]/.test(haystack[index - 1])) {
      // Начало слова: «cc» находит «Crystal Castles».
      score += 2;
    } else {
      score += 1;
    }

    previousIndex = index;
    position = index + 1;
  }

  // Короткое совпадение в коротком названии ценнее такого же в длинном.
  return score - haystack.length * 0.01;
}

export interface FuzzyField<T> {
  /** Что искать. */
  get: (item: T) => string;
  /** Во сколько раз важнее прочих полей. Название важнее исполнителя. */
  weight: number;
}

/**
 * Фильтрует и сортирует список. Пустой запрос возвращает исходный порядок:
 * поле поиска, в котором ничего не набрано, не должно перетасовывать медиатеку.
 */
export function fuzzyFilter<T>(
  items: readonly T[],
  query: string,
  fields: readonly FuzzyField<T>[],
): T[] {
  const trimmed = query.trim();
  // Исходная ссылка, а не копия: пустой запрос — обычное состояние экрана
  // медиатеки, и копировать на нём весь список незачем. Массив никто
  // не мутирует — очередь плеера копирует его у себя.
  if (trimmed === '') return items as T[];

  // Запрос приводится к нижнему регистру один раз на весь список, а не на
  // каждый его элемент: на тысяче треков это была тысяча лишних вызовов.
  const needle = trimmed.toLowerCase();
  const scored: Scored<T>[] = [];

  for (const item of items) {
    let best: number | null = null;

    for (const field of fields) {
      const score = scoreLowered(field.get(item).toLowerCase(), needle);
      if (score === null) continue;
      const weighted = score * field.weight;
      if (best === null || weighted > best) best = weighted;
    }

    if (best !== null && best >= MIN_SCORE) scored.push({ item, score: best });
  }

  // Стабильная сортировка: при равных оценках порядок остаётся исходным.
  return scored.sort((a, b) => b.score - a.score).map((entry) => entry.item);
}
