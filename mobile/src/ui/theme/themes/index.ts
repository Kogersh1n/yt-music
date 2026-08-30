import type { ThemeSource } from '../types';
import { BASE_DARK, BASE_LIGHT } from '../base';

/**
 * Темы, поставляемые с приложением.
 *
 * Каждая — обычный объект той же формы, что и пользовательский JSON-файл:
 * никаких привилегий у встроенных тем нет, они проходят тот же резолвер.
 * Значит любую из них можно скопировать в файл и править как образец.
 */

const CATPPUCCIN_MOCHA: ThemeSource = {
  schema: 'ytmusic-theme/1',
  id: 'catppuccin-mocha',
  name: 'Catppuccin Mocha',
  author: 'Catppuccin',
  extends: 'base-dark',
  mode: 'dark',

  palette: {
    base: '#1e1e2e',
    mantle: '#181825',
    crust: '#11111b',
    surface0: '#313244',
    surface1: '#45475a',
    text: '#cdd6f4',
    subtext0: '#a6adc8',
    overlay0: '#6c7086',
    mauve: '#cba6f7',
    red: '#f38ba8',
  },

  colors: {
    bg: '$base',
    surface: '$surface0',
    surfaceHigh: '$surface1',
    player: '$mantle',
    border: '$surface1',
    text: '$text',
    textDim: '$subtext0',
    textFaint: '$overlay0',
    brand: '$red',
    accent: '$mauve',
    onAccent: '$crust',
    danger: '$red',
    scrim: '$crust@70',
    skeleton: '$mantle',
    skeletonHighlight: '$surface0',
  },

  radius: { thumb: 8, card: 12, sheet: 20, chip: 999 },
  typography: { family: 'IBM Plex Sans' },
};

const CATPPUCCIN_LATTE: ThemeSource = {
  schema: 'ytmusic-theme/1',
  id: 'catppuccin-latte',
  name: 'Catppuccin Latte',
  author: 'Catppuccin',
  extends: 'base-light',
  mode: 'light',

  palette: {
    base: '#eff1f5',
    mantle: '#e6e9ef',
    crust: '#dce0e8',
    surface0: '#ccd0da',
    surface1: '#bcc0cc',
    text: '#4c4f69',
    subtext0: '#5c5f77',
    overlay0: '#7c7f93',
    mauve: '#8839ef',
    red: '#d20f39',
  },

  colors: {
    bg: '$base',
    surface: '$mantle',
    surfaceHigh: '$surface0',
    player: '$crust',
    border: '$surface1',
    text: '$text',
    textDim: '$subtext0',
    textFaint: '$overlay0',
    brand: '$red',
    accent: '$mauve',
    onAccent: '$base',
    danger: '$red',
    scrim: '$base@70',
    skeleton: '$mantle',
    skeletonHighlight: '$surface0',
  },

  radius: { thumb: 8, card: 12, sheet: 20, chip: 999 },
  typography: { family: 'IBM Plex Sans' },
};

/**
 * Пиксельная. Показывает, что тема — это не только палитра: здесь нулевые
 * радиусы, растровый шрифт с разрядкой, ступенчатый прогресс, мгновенные
 * переходы и развёртка поверх экрана.
 */
const PIXEL_CRT: ThemeSource = {
  schema: 'ytmusic-theme/1',
  id: 'pixel-crt',
  name: 'Pixel CRT',
  extends: 'base-dark',
  mode: 'dark',

  palette: {
    void: '#0b1207',
    panel: '#101a0b',
    raised: '#16240f',
    grid: '#2b4a1c',
    phosphor: '#b6f36a',
    dim: '#8ab84f',
    faint: '#5d8232',
    alert: '#ffd166',
  },

  colors: {
    bg: '$void',
    surface: '$panel',
    surfaceHigh: '$raised',
    player: '$panel',
    border: '$grid',
    text: '$phosphor',
    textDim: '$dim',
    textFaint: '$faint',
    brand: '$alert',
    accent: '$phosphor',
    onAccent: '$void',
    danger: '$alert',
    scrim: '$void@75',
    skeleton: '$panel',
    skeletonHighlight: '$raised',
  },

  radius: { thumb: 0, card: 0, sheet: 0, chip: 0 },
  // Точечный шрифт требует воздуха между знаками, иначе буквы слипаются.
  // Handjet выбран из-за кириллицы: у Silkscreen и Press Start 2P её нет,
  // и русский текст выпадал бы в системную гарнитуру.
  typography: { family: 'Handjet', scale: 1.05, letterSpacing: 0.03 },
  layout: { density: 'compact' },
  motion: { scale: 0 },
  components: { playButton: 'square', progress: 'stepped', thumb: 'square' },
  decor: { overlay: 'scanlines' },
};

/** Светлая «бумажная» — проверка, что светлые темы живут наравне с тёмными. */
const PAPER: ThemeSource = {
  schema: 'ytmusic-theme/1',
  id: 'paper',
  name: 'Paper',
  extends: 'base-light',
  mode: 'light',

  palette: {
    sheet: '#fbfaf7',
    card: '#f2f0ea',
    edge: '#ddd8cc',
    ink: '#26241f',
    inkSoft: '#57534a',
    inkFaint: '#8a8479',
    stamp: '#a33b26',
  },

  colors: {
    bg: '$sheet',
    surface: '$card',
    surfaceHigh: '$edge',
    player: '$card',
    border: '$edge',
    text: '$ink',
    textDim: '$inkSoft',
    textFaint: '$inkFaint',
    brand: '$stamp',
    accent: '$ink',
    onAccent: '$sheet',
    danger: '$stamp',
    scrim: '$sheet@75',
    skeleton: '$card',
    skeletonHighlight: '$edge',
  },

  radius: { thumb: 2, card: 3, sheet: 6, chip: 4 },
  typography: { family: 'IBM Plex Sans', letterSpacing: 0.01 },
  components: { playButton: 'pill', progress: 'line' },
};

export const BUILTIN_THEMES: ThemeSource[] = [
  BASE_DARK,
  CATPPUCCIN_MOCHA,
  PIXEL_CRT,
  BASE_LIGHT,
  CATPPUCCIN_LATTE,
  PAPER,
];

export const DEFAULT_THEME_ID = BASE_DARK.id;
