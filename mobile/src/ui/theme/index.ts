export { ThemeProvider, useTheme, useThemeControls, useThemedStyles } from './context';
export {
  resolveTheme,
  checkContrast,
  failedChecks,
  suggestReadableColors,
  ThemeError,
} from './resolve';
export { validateThemeSource, parseThemeJson } from './validate';
export { BUILTIN_THEMES, DEFAULT_THEME_ID } from './themes';
export { FONTS, isKnownFont } from './fonts';
export { FONT_ASSETS } from './fontAssets';
export { contrastRatio, hexToHsl, hslToHex } from './color';
export {
  useCustomThemes,
  getCustomThemes,
  saveCustomTheme,
  removeCustomTheme,
  findTheme,
  isIdTaken,
} from './library';
export {
  importFromFile,
  importFromClipboard,
  importFromUrl,
  copyThemeToClipboard,
  shareTheme,
  serializeTheme,
} from './transfer';
export { EDITABLE_COLORS, draftFrom } from './editable';
export type { EditableColor } from './editable';
export type { Theme, ThemeSource, ThemeColors, TypeRoleName } from './types';
export type { ContrastCheck } from './resolve';

/** Длительность в секундах → «3:07». Отрицательные и NaN гасим в «0:00». */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const s = Math.floor(totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  return hours > 0
    ? `${hours}:${mm}:${String(seconds).padStart(2, '0')}`
    : `${mm}:${String(seconds).padStart(2, '0')}`;
}
