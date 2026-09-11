import { readJSON, writeJSON } from '../local/storage';

/**
 * Общая основа для запросов к внутреннему API YouTube.
 *
 * Приложение обращается к двум разным клиентам этого API:
 *
 *   VISIONOS   — за ссылкой на аудио (src/api/youtube.ts). Единственный,
 *                кого ещё не перевели на SABR, то есть кто отдаёт прямую
 *                ссылку, а не поток, который надо уметь собирать самому.
 *   WEB_REMIX  — за тем, что знает именно YouTube Music (src/api/ytmusic.ts):
 *                квадратные обложки альбомов и тексты песен. У обычного
 *                YouTube ни того, ни другого нет.
 *
 * Общего у них ровно две вещи, и обе неочевидные, поэтому живут здесь:
 * метка сессии visitorData и форма запроса.
 */

/**
 * Метка сессии.
 *
 * Без неё любой запрос к плееру отвечает LOGIN_REQUIRED — именно на этом
 * ломались все попытки повторить запрос вручную.
 *
 * Хранится на диске, а не только в памяти. Раньше первое включение после
 * каждого запуска приложения платило за неё целую секунду; метка при этом
 * живёт долго и между запусками не меняется, так что платить повторно
 * было не за что.
 */
const STORAGE_KEY = 'innertube.visitor.v1';

let visitorData: string | null = readJSON<string | null>(STORAGE_KEY, null);

/** Незавершённый запрос метки. Без него десять треков подряд запросили бы её десять раз. */
let pending: Promise<string> | null = null;

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/26.0 Safari/605.1.15';

export const INNERTUBE_USER_AGENT = USER_AGENT;

/**
 * Таймаут на запрос.
 *
 * У fetch в React Native таймаута нет: XMLHttpRequest.timeout по умолчанию 0,
 * и это значение уходит в нативный слой как «ждать сколько угодно». На столе
 * это незаметно, а на телефоне сокет протухает при каждой смене сети — и
 * запрос к ютубу повисает навсегда. Дальше по цепочке это выглядело так:
 * нажатие на трек ничего не делает, потому что loadCurrent() стоит на
 * `await resolveStreamUrl()`, который уже не вернётся. Хуже того, склейка
 * одновременных запросов метки (pending ниже) раздавала этот же зависший
 * промис всем следующим трекам, и воспроизведение умирало до перезапуска.
 *
 * Поэтому у каждого запроса к ютубу есть предел. Упавший запрос честно
 * бросает исключение, а вызывающий код уже умеет откатываться на бэкенд
 * и показывать ошибку.
 */
const REQUEST_TIMEOUT_MS = 10_000;
/** Главная страница — под мегабайт, ей нужно больше. */
const PAGE_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    // AbortError от нашего же таймера превращаем в понятное сообщение:
    // иначе в интерфейс уходит «Aborted» без всякого смысла.
    if (controller.signal.aborted) {
      throw new Error(`YouTube не ответил за ${Math.round(timeoutMs / 1000)} с`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}


/**
 * Откуда берём метку.
 *
 * sw.js_data — служебный ответ для service worker, около трёх килобайт.
 * Раньше метка добывалась с главной страницы youtube.com, а это 864 КБ
 * ради строки в 520 символов: замер показал секунду против трети секунды.
 * На мобильной сети разница больше.
 *
 * Главная оставлена запасным вариантом: служебный ответ не задокументирован
 * и может исчезнуть, а разметка главной меняется медленнее.
 */
const SW_DATA = 'https://www.youtube.com/sw.js_data';

/** Метка узнаётся по префиксу и длине: в ответе она лежит без имени поля. */
function findVisitorToken(node: unknown): string | null {
  if (typeof node === 'string') {
    return node.startsWith('Cgt') && node.length > 60 ? node : null;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findVisitorToken(item);
      if (found) return found;
    }
  }
  return null;
}

async function fromServiceWorkerData(): Promise<string | null> {
  const response = await fetchWithTimeout(SW_DATA, {
    headers: { 'User-Agent': USER_AGENT },
  });
  const text = await response.text();

  // Ответ начинается с защитного префикса )]}' — JSON идёт со второй строки.
  const body = text.startsWith(")]}'") ? text.slice(text.indexOf('\n') + 1) : text;

  try {
    return findVisitorToken(JSON.parse(body) as unknown);
  } catch {
    return null;
  }
}

async function fromHomePage(): Promise<string> {
  const response = await fetchWithTimeout(
    'https://www.youtube.com/',
    { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' } },
    PAGE_TIMEOUT_MS,
  );
  const html = await response.text();
  const match = html.match(/"visitorData":"([^"]+)"/);
  if (!match) throw new Error('YouTube не отдал visitorData');

  // Значение лежит внутри JS-литерала и содержит экранирование вида =.
  // JSON.parse разбирает его правильно, ручная замена — нет.
  return JSON.parse(`"${match[1]}"`) as string;
}

async function fetchVisitorData(): Promise<string> {
  try {
    const light = await fromServiceWorkerData();
    if (light) return light;
  } catch {
    // Служебный ответ недоступен — идём длинным путём.
  }
  return fromHomePage();
}

export async function getVisitorData(force = false): Promise<string> {
  if (!force && visitorData) return visitorData;

  // Склеиваем одновременные запросы в один: при старте очереди сюда
  // приходят сразу несколько треков.
  if (!force && pending) return pending;

  pending = fetchVisitorData()
    .then((value) => {
      visitorData = value;
      writeJSON(STORAGE_KEY, value);
      return value;
    })
    .finally(() => {
      pending = null;
    });

  return pending;
}

export interface InnertubeClient {
  /** Имя клиента в протоколе, например VISIONOS или WEB_REMIX. */
  name: string;
  version: string;
  /** Числовой идентификатор для заголовка X-Youtube-Client-Name. */
  id: string;
  /** Хост: у музыки он свой. */
  host: string;
  /** Дополнительные поля контекста, специфичные для клиента. */
  extra?: Record<string, unknown>;
}

/**
 * Запрос к InnerTube.
 *
 * Заголовки здесь не декоративные: без Origin и X-Goog-Visitor-Id ответ
 * приходит пустым или с отказом, а не с ошибкой — то есть молча неправильным.
 */
export async function innertube<T = unknown>(
  client: InnertubeClient,
  endpoint: string,
  body: Record<string, unknown>,
  visitor: string,
): Promise<T> {
  const response = await fetchWithTimeout(
    `https://${client.host}/youtubei/v1/${endpoint}?prettyPrint=false`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        'X-Youtube-Client-Name': client.id,
        'X-Youtube-Client-Version': client.version,
        'X-Goog-Visitor-Id': visitor,
        Origin: `https://${client.host}`,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: client.name,
            clientVersion: client.version,
            visitorData: visitor,
            ...client.extra,
          },
        },
        ...body,
      }),
    },
  );

  if (!response.ok) throw new Error(`YouTube ответил ${response.status}`);
  return (await response.json()) as T;
}

/**
 * Первое найденное значение по ключу в дереве ответа.
 *
 * Ответы InnerTube — глубоко вложенные и без стабильной схемы: один и тот же
 * videoId лежит то в navigationEndpoint, то в playlistItemData, и структура
 * меняется от клиента к клиенту. Разбирать их по точному пути — значит
 * ломаться на каждом изменении; надёжнее искать по ключу.
 */
export function findFirst<T>(node: unknown, key: string, guard: (value: unknown) => value is T): T | null {
  if (node === null || typeof node !== 'object') return null;

  if (!Array.isArray(node)) {
    const record = node as Record<string, unknown>;
    const own = record[key];
    if (guard(own)) return own;
  }

  for (const value of Object.values(node as Record<string, unknown>)) {
    const found = findFirst(value, key, guard);
    if (found !== null) return found;
  }

  return null;
}

/** Собрать все узлы, у которых есть заданный ключ. */
export function collect(node: unknown, key: string): unknown[] {
  const out: unknown[] = [];

  const visit = (current: unknown): void => {
    if (current === null || typeof current !== 'object') return;

    if (!Array.isArray(current)) {
      const record = current as Record<string, unknown>;
      if (key in record) out.push(record[key]);
    }

    for (const value of Object.values(current as Record<string, unknown>)) visit(value);
  };

  visit(node);
  return out;
}

export const isString = (value: unknown): value is string => typeof value === 'string';

/**
 * Запросить метку заранее, не дожидаясь первого включения.
 *
 * Вызывается при старте приложения. Без этого первое нажатие на трек
 * ждало и метку, и ответ плеера подряд; теперь метка обычно уже готова,
 * и остаётся только запрос плеера.
 *
 * Ошибку гасим: это фоновая подготовка, и её неудача не должна
 * ничего ломать — обычный путь всё равно запросит метку сам.
 */
export function warmVisitorData(): void {
  void getVisitorData().catch(() => undefined);
}
