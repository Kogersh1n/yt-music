import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles, type Theme } from '../theme';
import type { TrackFormat } from '../../features/useTrackFormat';

/**
 * Бейдж формата в плеере: «MP3 · 192k».
 *
 * Показывается только когда данные действительно есть. Признака «из кэша»
 * здесь нет намеренно: плеер не сообщает, играет ли трек из своего буфера
 * или из сети, а рисовать «CACHED» наугад — врать пользователю.
 */
export const FormatBadge = memo(function FormatBadge({ format }: { format: TrackFormat | null }) {
  const styles = useThemedStyles(makeStyles);

  if (!format) return null;

  return (
    <View style={styles.badge}>
      <Text style={styles.label}>
        {format.codec}
        {format.kbps !== null ? ` · ${format.kbps}k` : ''}
      </Text>
    </View>
  );
});

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: t.spacing.sm,
      paddingVertical: 3,
      borderRadius: t.radius.chip,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    label: {
      ...t.type.meta,
      fontSize: 10,
      color: t.colors.textDim,
      letterSpacing: 0.5,
      // Моноширинные цифры: битрейт меняется между треками, а бейдж
      // не должен от этого дёргаться в ширину.
      fontVariant: ['tabular-nums'],
    },
  });
