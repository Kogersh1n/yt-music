import { useSyncExternalStore } from 'react';
import { createMMKV } from 'react-native-mmkv';
import { configureAuth } from '../api/client';
import * as authApi from '../api/auth';
import type { TokensResponse } from '../api/types';

/**
 * Сессия пользователя: пара токенов и её обновление.
 *
 * Хранилище отдельное от 'ytmusic' — чтобы очистка кэша или сброс настроек
 * никогда не выкидывали человека из аккаунта заодно.
 *
 * MMKV читается синхронно, поэтому на первом кадре уже известно, есть сессия
 * или нет: экрану входа не нужно состояние «загружаем».
 *
 * ЗАМЕЧАНИЕ ПРО БЕЗОПАСНОСТЬ. MMKV лежит в приватной директории приложения —
 * другие приложения на неразблокированном устройстве туда не попадут, но это
 * не аппаратное хранилище. Правильный дом для токенов — expo-secure-store
 * (Android Keystore). Он не поставлен: это нативный модуль, его добавление
 * требует `npx expo prebuild` и пересборки APK. Когда решишь ужесточить —
 * меняются только read/write ниже, остальной файл и всё приложение не трогаются.
 */

const store = createMMKV({ id: 'ytmusic.auth' });

const ACCESS_KEY = 'auth.access';
const REFRESH_KEY = 'auth.refresh';

export interface Session {
  accessToken: string;
  refreshToken: string;
}

function read(): Session | null {
  const accessToken = store.getString(ACCESS_KEY);
  const refreshToken = store.getString(REFRESH_KEY);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

let session: Session | null = read();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function write(next: Session | null): void {
  session = next;

  if (next) {
    store.set(ACCESS_KEY, next.accessToken);
    store.set(REFRESH_KEY, next.refreshToken);
  } else {
    store.remove(ACCESS_KEY);
    store.remove(REFRESH_KEY);
  }

  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSession(): Session | null {
  return session;
}

/** true, пока на устройстве есть пара токенов. Не гарантирует, что она живая. */
export function useIsSignedIn(): boolean {
  return useSyncExternalStore(subscribe, () => session !== null, () => false);
}

/* ------------------------------------------------------------------ */
/* Обновление токенов                                                  */
/* ------------------------------------------------------------------ */

/**
 * Незавершённое обновление. Ключевая деталь всей конструкции.
 *
 * Refresh-токен на сервере одноразовый: при обмене он помечается
 * использованным, а повторное предъявление трактуется как кража — сервер
 * гасит всю цепочку сессии и человека выбрасывает из аккаунта.
 *
 * Телефон после сна отправляет несколько запросов разом, и все они получают
 * 401 одновременно. Если каждый пойдёт обновляться сам, первый обменяет токен,
 * а остальные предъявят уже погашенный — и сработает детект кражи. Поэтому
 * обновление ровно одно: первый запускает, остальные ждут тот же промис.
 */
let inFlight: Promise<string | null> | null = null;

async function exchange(refreshToken: string): Promise<string | null> {
  try {
    const tokens: TokensResponse = await authApi.refresh(refreshToken);
    write({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
    return tokens.access_token;
  } catch {
    // Сюда попадает и «токен протух», и «сессия погашена детектом кражи»,
    // и обрыв сети. Различить их нельзя — сервер намеренно отвечает
    // одинаково, — поэтому во всех случаях считаем сессию потерянной.
    write(null);
    return null;
  }
}

/**
 * Обновляет пару и возвращает новый access-токен либо null.
 * Вызывается из src/api/client.ts при 401.
 */
export async function refreshSession(): Promise<string | null> {
  const current = session?.refreshToken;
  if (!current) return null;

  if (!inFlight) {
    inFlight = exchange(current).finally(() => {
      inFlight = null;
    });
  }

  return inFlight;
}

/* ------------------------------------------------------------------ */
/* Вход и выход                                                        */
/* ------------------------------------------------------------------ */

export function startSession(tokens: TokensResponse): void {
  write({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
}

/**
 * Выход. Сервер уведомляем, но результат не ждём в том смысле, что ошибка
 * не должна помешать выйти локально: пользователь нажал «выйти» — значит
 * на устройстве токенов быть не должно в любом случае.
 */
export async function signOut(): Promise<void> {
  const current = session?.refreshToken;
  write(null);

  if (!current) return;

  try {
    await authApi.logout(current);
  } catch {
    // Сервера нет или токен уже погашен — локально мы всё равно вышли.
  }
}

/* ------------------------------------------------------------------ */
/* Подключение к HTTP-клиенту                                          */
/* ------------------------------------------------------------------ */

let onUnauthorizedHandler: () => void = () => {};

/**
 * Клиент получает доступ к токенам сразу при импорте модуля, а не из эффекта:
 * иначе первые запросы приложения успели бы уйти без заголовка Authorization,
 * пока корневой layout ещё не смонтирован.
 */
configureAuth({
  getAccessToken: () => session?.accessToken ?? null,
  refreshSession,
  onUnauthorized: () => {
    write(null);
    onUnauthorizedHandler();
  },
});

/**
 * Вызывается из корневого layout. Задаёт только реакцию на потерю сессии —
 * навигация недоступна на уровне модуля.
 */
export function initSession(options: { onUnauthorized: () => void }): void {
  onUnauthorizedHandler = options.onUnauthorized;
}
