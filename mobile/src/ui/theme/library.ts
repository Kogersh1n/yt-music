import { useSyncExternalStore } from 'react';
import { readJSON, writeJSON } from '../../local/storage';
import { validateThemeSource } from './validate';
import { BUILTIN_THEMES } from './themes';
import type { ThemeSource } from './types';

/**
 * Библиотека пользовательских тем.
 *
 * Импортированные темы хранятся целиком: исходный файл мог быть удалён сразу
 * после импорта, перечитать его будет неоткуда. Встроенные темы здесь не
 * лежат — они и так в коде.
 */

const KEY = 'theme.library.v1';

function load(): ThemeSource[] {
  const raw = readJSON<unknown[]>(KEY, []);
  if (!Array.isArray(raw)) return [];
  // Битую запись выбрасываем молча: одна испорченная тема не должна
  // лишать пользователя остальных.
  return raw.flatMap((item) => {
    try {
      return [validateThemeSource(item)];
    } catch {
      return [];
    }
  });
}

let themes: ThemeSource[] = load();
const listeners = new Set<() => void>();

function commit(next: ThemeSource[]): void {
  themes = next;
  writeJSON(KEY, next);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCustomThemes(): readonly ThemeSource[] {
  return useSyncExternalStore(subscribe, () => themes);
}

export function getCustomThemes(): readonly ThemeSource[] {
  return themes;
}

/** Занят ли идентификатор. Встроенные перекрывать нельзя — их неоткуда вернуть. */
export function isIdTaken(id: string): boolean {
  return BUILTIN_THEMES.some((theme) => theme.id === id);
}

/**
 * Добавляет тему в библиотеку. Тема с тем же id заменяется — так повторный
 * импорт исправленного файла обновляет её, а не плодит дубликаты.
 */
export function saveCustomTheme(source: ThemeSource): void {
  const without = themes.filter((theme) => theme.id !== source.id);
  commit([...without, source]);
}

export function removeCustomTheme(id: string): void {
  commit(themes.filter((theme) => theme.id !== id));
}

export function findTheme(id: string): ThemeSource | undefined {
  return BUILTIN_THEMES.find((theme) => theme.id === id) ?? themes.find((theme) => theme.id === id);
}
