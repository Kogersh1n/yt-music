import Constants from 'expo-constants';

/**
 * Базовый адрес бэкенда. Задаётся в app.config.ts (EXPO_PUBLIC_API_URL).
 * Телефон не видит localhost машины — по умолчанию там LAN-адрес.
 */
export const API_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://192.168.8.12:8000';

/** Дольше ждать бессмысленно: пользователь уже решил, что «не грузится». */
const DEFAULT_TIMEOUT_MS = 15_000;
/** Импорт с YouTube — это скачивание yt-dlp + заливка в хранилище, тут нужен запас. */
export const LONG_TIMEOUT_MS = 180_000;

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }

  /** Сеть недоступна / таймаут — статуса от сервера не было. */
  get isNetwork(): boolean {
    return this.status === 0;
  }
}

/**
 * Точка вставки авторизации.
 *
 * Реализацию поставляет src/auth/session.ts — здесь только вызовы, чтобы
 * клиент не зависел от хранилища токенов и не возникало цикла импортов.
 *
 * refreshSession обязан быть single-flight: сервер помечает refresh-токен
 * использованным при обмене, и если два запроса пойдут обновляться
 * параллельно, второй предъявит уже погашенный токен — сервер сочтёт это
 * кражей и разлогинит пользователя. Гарантию даёт session.ts.
 */
let getAccessToken: () => string | null = () => null;
let refreshSession: () => Promise<string | null> = async () => null;
let onUnauthorized: () => void = () => {};

export function configureAuth(options: {
  getAccessToken: () => string | null;
  refreshSession: () => Promise<string | null>;
  onUnauthorized: () => void;
}): void {
  getAccessToken = options.getAccessToken;
  refreshSession = options.refreshSession;
  onUnauthorized = options.onUnauthorized;
}

interface RequestOptions extends Omit<RequestInit, 'signal'> {
  timeoutMs?: number;
  /** Внешняя отмена — например, когда пользователь дописал новый поисковый запрос. */
  signal?: AbortSignal;
  /**
   * Не подставлять токен и не пытаться обновиться при 401.
   * Нужно самим ручкам /auth/*: иначе обновление вызвало бы само себя.
   */
  skipAuth?: boolean;
}

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: externalSignal,
    headers,
    skipAuth = false,
    ...rest
  } = options;

  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;

  /** Одна попытка. Вынесена, чтобы повтор после обновления токена получил
   *  свежий таймаут и свой AbortController, а не догорающий от первой. */
  const send = async (token: string | null): Promise<Response> => {
    // Таймаут и внешняя отмена должны работать вместе, поэтому свой контроллер,
    // который слушает оба источника.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
    const forwardAbort = () => controller.abort(externalSignal?.reason);
    externalSignal?.addEventListener('abort', forwardAbort);

    try {
      return await fetch(url, {
        ...rest,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          // Content-Type ставим только когда реально есть тело: лишний заголовок
          // ломает подписанные PUT-загрузки в S3-совместимое хранилище.
          ...(rest.body ? { 'Content-Type': 'application/json' } : null),
          ...(token ? { Authorization: `Bearer ${token}` } : null),
          ...headers,
        },
      });
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', forwardAbort);
    }
  };

  try {
    let response = await send(skipAuth ? null : getAccessToken());

    if (response.status === 401 && !skipAuth) {
      // Повтор ровно один и только с реально новым токеном: если обновление
      // не удалось, второй заход дал бы тот же 401 и зациклил бы запрос.
      const fresh = await refreshSession();

      if (fresh) {
        response = await send(fresh);
      }

      if (response.status === 401) {
        onUnauthorized();
        throw new ApiError('Требуется вход', 401);
      }
    }

    if (!response.ok) {
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        // Тело не JSON — не страшно, сообщение соберём из статуса.
      }
      const detail =
        payload && typeof payload === 'object' && 'detail' in payload
          ? String((payload as { detail: unknown }).detail)
          : `Сервер ответил ${response.status}`;
      throw new ApiError(detail, response.status, payload);
    }

    if (response.status === 204) return undefined as T;

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    // Отмена по инициативе вызывающего — не ошибка, пробрасываем как есть,
    // чтобы React Query не показывал её пользователю.
    if (externalSignal?.aborted) throw error;

    const message =
      error instanceof Error && error.message === 'timeout'
        ? 'Сервер не ответил вовремя'
        : 'Нет связи с сервером';
    throw new ApiError(message, 0, error);
  }
}

/** Быстрая проверка, поднят ли бэкенд — от неё зависит включение демо-режима. */
export async function ping(): Promise<boolean> {
  try {
    await request<unknown>('/', { timeoutMs: 4_000 });
    return true;
  } catch {
    return false;
  }
}
