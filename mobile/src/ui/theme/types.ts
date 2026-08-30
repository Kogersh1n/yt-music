/**
 * Тип оформления.
 *
 * Это результат разбора JSON-темы: здесь уже нет ссылок вида `$mauve` и нет
 * необязательных полей — всё разрешено и заполнено. Компоненты работают только
 * с этим типом и никогда не видят сырой JSON.
 */

/** Цветовые роли. Ролей ровно столько, сколько реально используется в интерфейсе. */
export interface ThemeColors {
  /** Фон приложения. */
  bg: string;
  /** Поверхность карточек, полей ввода, шторок. */
  surface: string;
  /** Приподнятая поверхность: активный чип, меню. */
  surfaceHigh: string;
  /** Плашка мини-плеера. */
  player: string;
  /** Разделители и рамки. */
  border: string;

  text: string;
  /** Вторичный текст: исполнитель, подписи. */
  textDim: string;
  /** Третичный: неактивные вкладки, счётчики. */
  textFaint: string;

  /** Бренд — только акцент, не заливка интерфейса. */
  brand: string;
  /** Основное действие: заливка кнопки воспроизведения, активный чип. */
  accent: string;
  /** Текст и иконки поверх accent. */
  onAccent: string;

  danger: string;
  /** Подложка поверх обложек. */
  scrim: string;
  skeleton: string;
  skeletonHighlight: string;
}

export interface ThemeRadius {
  thumb: number;
  card: number;
  sheet: number;
  chip: number;
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

/** Роли текста. Размер и начертание — здесь, цвет компонент берёт сам. */
export interface TypeRole {
  fontSize: number;
  fontWeight: '400' | '500' | '600' | '700';
  letterSpacing: number;
  fontFamily?: string;
}

export type TypeRoleName = 'title' | 'section' | 'trackTitle' | 'meta' | 'body' | 'label';

export type ThemeType = Record<TypeRoleName, TypeRole>;

export interface ThemeLayout {
  miniPlayerHeight: number;
  tabBarHeight: number;
  rowThumb: number;
  cardWidth: number;
  screenPadding: number;
  rowHeight: number;
}

export interface ThemeComponents {
  /** Форма кнопки воспроизведения. */
  playButton: 'circle' | 'square' | 'pill';
  /** Вид полосы прогресса. `stepped` — сегментами, для пиксельных тем. */
  progress: 'line' | 'stepped';
  /** Форма обложки: скругление берётся из radius.thumb либо переопределяется. */
  thumb: 'rounded' | 'square' | 'circle';
  /** Показывать подписи под иконками вкладок. */
  tabBarLabels: boolean;
}

export interface ThemeMotion {
  /**
   * Множитель длительности анимаций. 0 — мгновенно, без сглаживания:
   * именно этого требуют пиксельные темы.
   */
  scale: number;
}

export interface ThemeDecor {
  /** Плёнка поверх экрана. */
  overlay: 'none' | 'scanlines';
}

export interface Theme {
  id: string;
  name: string;
  /** Влияет на цвет иконок системной строки состояния. */
  mode: 'dark' | 'light';

  colors: ThemeColors;
  radius: ThemeRadius;
  spacing: ThemeSpacing;
  /** Готовые стили текста: размер, начертание, разрядка, гарнитура. */
  type: ThemeType;
  layout: ThemeLayout;
  components: ThemeComponents;
  motion: ThemeMotion;
  decor: ThemeDecor;
}

/* ------------------------------------------------------------------ */
/* Сырая тема — то, что лежит в JSON-файле                             */
/* ------------------------------------------------------------------ */

type Partial2<T> = { [K in keyof T]?: T[K] };

/**
 * Форма JSON-файла темы. Всё, кроме `id`, необязательно: недостающее
 * доезжает из темы, указанной в `extends`, а затем из встроенной базы.
 */
export interface ThemeSource {
  schema?: string;
  id: string;
  name?: string;
  author?: string;
  /** Идентификатор встроенной темы, от которой наследуемся. */
  extends?: string;
  mode?: 'dark' | 'light';

  /** Сырые цвета с авторскими именами. На них ссылаются роли через `$имя`. */
  palette?: Record<string, string>;
  /** Роли. Значение — либо HEX, либо ссылка `$имя` / `$имя@70`. */
  colors?: Partial2<ThemeColors>;

  radius?: Partial2<ThemeRadius>;
  spacing?: Partial2<ThemeSpacing>;
  typography?: {
    /** Имя гарнитуры из встроенного набора. Неизвестное — молча падает на системную. */
    family?: string;
    /** Множитель всех размеров текста. */
    scale?: number;
    /** Разрядка в долях кегля. Растровым шрифтам нужна положительная. */
    letterSpacing?: number;
    /** Точечная правка отдельных ролей. */
    roles?: { [K in TypeRoleName]?: Partial2<TypeRole> };
  };
  layout?: Partial2<Omit<ThemeLayout, 'rowHeight'>> & {
    density?: 'compact' | 'comfortable';
  };
  components?: Partial2<ThemeComponents>;
  motion?: Partial2<ThemeMotion>;
  decor?: Partial2<ThemeDecor>;
}
