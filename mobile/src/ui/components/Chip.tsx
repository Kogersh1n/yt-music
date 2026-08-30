import { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useThemedStyles, type Theme } from '../theme';
import { tapLight } from '../haptics';

/**
 * Фильтр-пилюля. Активный чип залит цветом `accent` — это главный признак
 * выбранного состояния во всём интерфейсе, и он же меняется вместе с темой.
 */

interface ChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

export const Chip = memo(function Chip({ label, active, onPress }: ChipProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <Pressable
      onPress={() => {
        tapLight();
        onPress();
      }}
      style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
      android_ripple={{ color: 'rgba(128,128,128,0.2)' }}
    >
      <Text style={[styles.label, active ? styles.labelActive : styles.labelIdle]}>{label}</Text>
    </Pressable>
  );
});

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    chip: {
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.sm,
      borderRadius: t.radius.chip,
      borderWidth: 1,
    },
    chipActive: { backgroundColor: t.colors.accent, borderColor: t.colors.accent },
    chipIdle: { backgroundColor: 'transparent', borderColor: t.colors.border },
    label: { ...t.type.label },
    labelActive: { color: t.colors.onAccent },
    labelIdle: { color: t.colors.text },
  });
