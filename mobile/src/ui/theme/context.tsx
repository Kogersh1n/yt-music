import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { readJSON, writeJSON } from '../../local/storage';
import { resolveTheme, failedChecks, ThemeError } from './resolve';
import { validateThemeSource } from './validate';
import { BUILTIN_THEMES, DEFAULT_THEME_ID } from './themes';
import type { Theme, ThemeSource } from './types';

/**
 * Текущее оформление и его переключение.
 *
 * Что именно сохраняется, зависит от происхождения темы:
 *
 * - встроенная — только идентификатор. Тогда правки во встроенных темах
 *   (новый шрифт, поправленный цвет) доезжают до пользователя с обновлением
 *   приложения, а не остаются в снимке, сделанном при выборе;
 * - пользовательская — целиком. Её неоткуда перечитать: файл мог быть удалён
 *   сразу после импорта.
 */

const STORAGE_KEY = 'theme.v2';

type StoredTheme =
  | { kind: 'builtin'; id: string }
  | { kind: 'custom'; source: ThemeSource };

const FALLBACK: Theme = resolveTheme(BUILTIN_THEMES[0]);

interface ThemeContextValue {
  theme: Theme;
  /** Исходник текущей темы — нужен экрану настроек и экспорту. */
  source: ThemeSource;
  /**
   * Применить тему. Бросает ThemeError с человеческим текстом, если тема
   * не разобралась или не проходит по контрасту — вызывающий показывает
   * сообщение, а на экране остаётся прежнее оформление.
   */
  applyTheme: (source: ThemeSource) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: FALLBACK,
  source: BUILTIN_THEMES[0],
  applyTheme: () => {},
});

/**
 * Поднимает сохранённую тему. Любая проблема — молча откатываемся на базовую:
 * приложение без оформления не остаётся никогда, даже если в хранилище мусор
 * или тема сделана несовместимой версией.
 */
function loadSaved(): { theme: Theme; source: ThemeSource } {
  const fallback = { theme: FALLBACK, source: BUILTIN_THEMES[0] };
  const saved = readJSON<StoredTheme | null>(STORAGE_KEY, null);
  if (!saved) return fallback;

  try {
    const source =
      saved.kind === 'builtin'
        ? BUILTIN_THEMES.find((theme) => theme.id === saved.id)
        : saved.source;
    // Встроенную тему могли переименовать или убрать между версиями.
    if (!source) return fallback;

    const validated = validateThemeSource(source);
    return { theme: resolveTheme(validated), source: validated };
  } catch {
    return fallback;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(loadSaved);

  const applyTheme = useCallback((source: ThemeSource) => {
    const validated = validateThemeSource(source);
    const theme = resolveTheme(validated);

    // Тема, в которой не видно текста, обрекла бы пользователя на приложение,
    // где не найти настройки, чтобы её сменить. Такую не применяем.
    const failed = failedChecks(theme.colors);
    if (failed.length > 0) {
      const list = failed
        .map((check) => `${check.label} — ${check.ratio?.toFixed(2) ?? '?'}:1 вместо ${check.required}`)
        .join('; ');
      throw new ThemeError(`тема нечитаемая: ${list}`);
    }

    const isBuiltin = BUILTIN_THEMES.some((builtin) => builtin.id === validated.id);
    writeJSON(
      STORAGE_KEY,
      isBuiltin
        ? ({ kind: 'builtin', id: validated.id } satisfies StoredTheme)
        : ({ kind: 'custom', source: validated } satisfies StoredTheme),
    );
    setState({ theme, source: validated });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: state.theme, source: state.source, applyTheme }),
    [state, applyTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

export function useThemeControls(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Стили, пересобираемые при смене темы.
 *
 * `factory` обязана быть объявлена вне компонента — тогда её ссылка стабильна
 * и useMemo действительно кэширует, пересобирая стили ровно на смену темы,
 * а не на каждый рендер.
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme, factory]);
}
