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
 * ломались все попытки повторить запрос вручную. Живёт долго и одинакова
 * для всех запросов, поэтому берётся один раз за запуск: иначе на каждое
 * включение трека уходило бы два обращения вместо одного.
 */
let visitorData: string | null = null;

/** Незавершённый запрос метки. Без него десять треков подряд запросили бы её десять раз. */
let pending: Promise<string> | null = null;

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/26.0 Safari/605.1.15';

export const INNERTUBE_USER_AGENT = USER_AGENT;

async function fetchVisitorData(): Promise<string> {
  const response = await fetch('https://www.youtube.com/', {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' },
  });
  const html = await response.text();
  const match = html.match(/"visitorData":"([^"]+)"/);
  if (!match) throw new Error('YouTube не отдал visitorData');

  // Значение лежит внутри JS-литерала и содержит экранирование вида =.
  // JSON.parse разбирает его правильно, ручная замена — нет.
  return JSON.parse(`"${match[1]}"`) as string;
}

export async function getVisitorData(force = false): Promise<string> {
  if (!force && visitorData) return visitorData;

  // Склеиваем одновременные запросы в один: при старте очереди сюда
  // приходят сразу несколько треков.
  if (!force && pending) return pending;

  pending = fetchVisitorData()
    .then((value) => {
      visitorData = value;
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
  const response = await fetch(`https://${client.host}/youtubei/v1/${endpoint}?prettyPrint=false`, {
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
  });

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
