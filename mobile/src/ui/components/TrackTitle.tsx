import { memo, useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { useThemedStyles, type Theme } from '../theme';
import { displayTitle } from '../../api/songText';

/**
 * Название трека с бейджем.
 *
 * Зачем отдельным компонентом. Название показывается в восьми местах —
 * список, карусель, мини-плеер, плеер, очередь, история, итоги, активность.
 * Разбор названия и вид бейджа должны быть одни на всех: иначе в одном
 * экране «(Live)» станет меткой, а в соседнем останется в тексте, и одна
 * песня будет выглядеть двумя.
 *
 * Про раскладку. Название сжимается и обрезается, бейдж — нет
 * (`shrink: 0`). Наоборот было бы хуже: длинное название сплющило бы
 * метку в нечитаемый огрызок, а сокращать нужно именно то, чего много.
 */

interface TrackTitleProps {
  /** Сырое название, как пришло с ютуба. Разбор внутри. */
  title: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** Скрыть метку там, где для неё нет места. */
  showBadge?: boolean;
}

export const TrackTitle = memo(function TrackTitle({
  title,
  style,
  numberOfLines = 1,
  showBadge = true,
}: TrackTitleProps) {
  const styles = useThemedStyles(makeStyles);
  const parsed = useMemo(() => displayTitle(title), [title]);

  if (!showBadge || !parsed.badge) {
    return (
      <Text numberOfLines={numberOfLines} style={style}>
        {parsed.title}
      </Text>
    );
  }

  return (
    <View style={styles.row}>
      <Text numberOfLines={numberOfLines} style={[styles.title, style]}>
        {parsed.title}
      </Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{parsed.badge}</Text>
      </View>
    </View>
  );
});

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    title: { flexShrink: 1 },
    badge: {
      flexShrink: 0,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 3,
      backgroundColor: t.colors.surfaceHigh,
    },
    badgeText: {
      fontSize: 10,
      lineHeight: 13,
      letterSpacing: 0.5,
      color: t.colors.textDim,
      fontWeight: '600',
    },
  });
