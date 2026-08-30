import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme, useThemedStyles, type Theme } from '../theme';

/**
 * Состояния загрузки, пустоты и ошибки.
 *
 * Вместо крутящегося спиннера — скелетоны в форме будущего контента:
 * экран не «прыгает» при появлении данных, и ожидание ощущается короче.
 */

const Shimmer = memo(function Shimmer({ style }: { style: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const opacity = useSharedValue(0.4);
  // Тема может запретить анимации — тогда мерцания нет вовсе.
  const duration = Math.round(700 * theme.motion.scale);

  useEffect(() => {
    if (duration === 0) {
      opacity.value = 0.6;
      return;
    }
    // Анимация живёт на UI-потоке и не спотыкается о загрузку данных.
    opacity.value = withRepeat(
      withSequence(withTiming(0.85, { duration }), withTiming(0.4, { duration })),
      -1,
      true,
    );
  }, [opacity, duration]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[{ backgroundColor: theme.colors.skeleton }, style, animated]} />;
});

/** Скелетон списка треков — повторяет геометрию TrackRow. */
export const TrackListSkeleton = memo(function TrackListSkeleton({ rows = 8 }: { rows?: number }) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <Shimmer
            style={{
              width: theme.layout.rowThumb,
              height: theme.layout.rowThumb,
              borderRadius: theme.radius.thumb,
            }}
          />
          <View style={styles.skeletonText}>
            <Shimmer style={{ height: 12, borderRadius: 3, width: `${55 + ((i * 7) % 30)}%` }} />
            <Shimmer style={{ height: 10, borderRadius: 3, width: `${30 + ((i * 5) % 25)}%` }} />
          </View>
        </View>
      ))}
    </View>
  );
});

/** Скелетон горизонтальной карусели на главной. */
export const CarouselSkeleton = memo(function CarouselSkeleton() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const size = theme.layout.cardWidth;

  return (
    <View style={styles.skeletonCarousel}>
      {Array.from({ length: 4 }, (_, i) => (
        <View key={i} style={{ gap: theme.spacing.sm }}>
          <Shimmer style={{ width: size, height: size, borderRadius: theme.radius.card }} />
          <Shimmer style={{ height: 11, borderRadius: 3, width: size * 0.8 }} />
          <Shimmer style={{ height: 9, borderRadius: 3, width: size * 0.5 }} />
        </View>
      ))}
    </View>
  );
});

export const EmptyState = memo(function EmptyState({
  icon = '♪',
  title,
  hint,
  action,
}: {
  icon?: string;
  title: string;
  hint?: string;
  action?: { label: string; onPress: () => void };
}) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.center}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.stateTitle}>{title}</Text>
      {hint ? <Text style={styles.stateHint}>{hint}</Text> : null}
      {action ? (
        <Pressable onPress={action.onPress} style={styles.button}>
          <Text style={styles.buttonLabel}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

export const ErrorState = memo(function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.center}>
      <Text style={[styles.icon, styles.iconDanger]}>⚠</Text>
      <Text style={styles.stateTitle}>Не удалось загрузить</Text>
      <Text style={styles.stateHint}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.button}>
          <Text style={styles.buttonLabel}>Повторить</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    skeletonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.sm,
    },
    skeletonText: { flex: 1, gap: t.spacing.sm },
    skeletonCarousel: {
      flexDirection: 'row',
      gap: t.spacing.md,
      paddingHorizontal: t.layout.screenPadding,
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: t.spacing.xxl * 2,
      paddingHorizontal: t.spacing.xl,
      gap: t.spacing.sm,
    },
    icon: { fontSize: 40, color: t.colors.textFaint },
    iconDanger: { color: t.colors.danger },
    stateTitle: { ...t.type.section, fontSize: 17, color: t.colors.text, textAlign: 'center' },
    stateHint: { ...t.type.meta, color: t.colors.textDim, textAlign: 'center', lineHeight: 18 },
    button: {
      marginTop: t.spacing.md,
      backgroundColor: t.colors.accent,
      paddingHorizontal: t.spacing.xl,
      paddingVertical: t.spacing.md,
      borderRadius: t.radius.chip,
    },
    buttonLabel: { ...t.type.label, color: t.colors.onAccent, fontWeight: '600' },
  });
