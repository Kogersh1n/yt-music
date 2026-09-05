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
 * Общий кэш собранных стилей: одна запись на фабрику.
 *
 * useMemo кэширует на экземпляр компонента, а не на приложение. В медиатеке
 * одновременно живут десятки строк, и каждая собирала собственную копию
 * ровно тех же стилей — десятки объектов StyleSheet вместо одного.
 *
 * Хранится одна запись на фабрику, а не таблица по темам: тема меняется
 * сразу для всего приложения, поэтому вторая запись никогда не пригодилась бы,
 * а редактор тем, где новый объект темы рождается на каждое движение
 * ползунка, за сеанс накопил бы их сотни. WeakMap по фабрике — чтобы
 * выгруженный модуль экрана не держал стили вечно.
 */
const styleCache = new WeakMap<object, { theme: Theme; styles: unknown }>();

function buildStyles<T>(factory: (theme: Theme) => T, theme: Theme): T {
  const hit = styleCache.get(factory);
  if (hit && hit.theme === theme) return hit.styles as T;

  const styles = factory(theme);
  styleCache.set(factory, { theme, styles });
  return styles;
}

/**
 * Стили, пересобираемые при смене темы.
 *
 * `factory` обязана быть объявлена вне компонента — тогда её ссылка стабильна,
 * и все экземпляры компонента получают один и тот же объект стилей,
 * собранный ровно один раз на смену темы.
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => buildStyles(factory, theme), [theme, factory]);
}
