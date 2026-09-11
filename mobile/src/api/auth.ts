import { request } from './client';
import type { TokensResponse } from './types';

/**
 * Запросы авторизации.
 *
 * Все они идут со skipAuth: подставлять сюда старый access-токен незачем,
 * а попытка обновиться при 401 привела бы refresh к вызову самого себя.
 */

/** Шаг 1: заводит заявку и шлёт код на почту. Пользователя ещё нет. */
export function register(
  data: { email: string; username: string; password: string },
  signal?: AbortSignal,
): Promise<void> {
  return request<void>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
    skipAuth: true,
    signal,
  });
}

/** Шаг 2: код из письма. Здесь пользователь создаётся и сразу получает пару. */
export function verify(
  data: { email: string; code: string },
  signal?: AbortSignal,
): Promise<TokensResponse> {
  return request<TokensResponse>('/auth/verify', {
    method: 'POST',
    body: JSON.stringify(data),
    skipAuth: true,
    signal,
  });
}

/**
 * Вход.
 *
 * Единственная ручка с формой, а не JSON: на бэкенде она принимает
 * OAuth2PasswordRequestForm, а он читает только application/x-www-form-urlencoded.
 * Поле логина по стандарту OAuth2 называется username, хотя мы кладём туда почту.
 */
export function login(
  email: string,
  password: string,
  signal?: AbortSignal,
): Promise<TokensResponse> {
  const form = new URLSearchParams({ username: email, password });

  return request<TokensResponse>('/auth/login', {
    method: 'POST',
    body: form.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    skipAuth: true,
    signal,
  });
}

/** Обмен refresh-токена на новую пару. Старый после этого мёртв. */
export function refresh(refreshToken: string, signal?: AbortSignal): Promise<TokensResponse> {
  return request<TokensResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
    skipAuth: true,
    signal,
  });
}

/** Гасит сессию на сервере. Access-токен доживает свои минуты сам. */
export function logout(refreshToken: string, signal?: AbortSignal): Promise<void> {
  return request<void>('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
    skipAuth: true,
    signal,
  });
}

/**
 * Первый шаг восстановления: попросить код на почту.
 *
 * Ответ одинаков и для существующего адреса, и для неизвестного —
 * сервер намеренно не сообщает, зарегистрирован ли адрес. Экран поэтому
 * тоже не должен делать вид, что знает: он просто говорит «если адрес
 * есть, письмо отправлено».
 */
export function forgotPassword(email: string, signal?: AbortSignal): Promise<void> {
  return request<void>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
    signal,
  });
}

/** Второй шаг: обменять код на новый пароль. Все сессии при этом гасятся. */
export function resetPassword(
  email: string,
  code: string,
  newPassword: string,
  signal?: AbortSignal,
): Promise<void> {
  return request<void>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, new_password: newPassword }),
    signal,
  });
}
