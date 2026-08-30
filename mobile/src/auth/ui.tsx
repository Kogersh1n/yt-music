import { forwardRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useTheme, useThemedStyles, type Theme } from '../ui/theme';

/**
 * Строительные блоки форм входа и регистрации.
 *
 * Лежат вне app/, потому что expo-router считает роутом каждый файл внутри
 * app/ — вспомогательному модулю там места нет.
 */

interface FieldProps extends TextInputProps {
  label: string;
}

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, style, ...props },
  ref,
) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        style={[styles.input, style]}
        placeholderTextColor={theme.colors.textFaint}
        selectionColor={theme.colors.brand}
        {...props}
      />
    </View>
  );
});

export function FormError({ message }: { message: string | null }) {
  const styles = useThemedStyles(makeStyles);
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

export function PrimaryButton({
  label,
  onPress,
  busy = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const blocked = busy || disabled;

  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      style={[styles.button, blocked && styles.buttonBlocked]}
      android_ripple={{ color: 'rgba(0,0,0,0.12)' }}
    >
      {busy ? (
        <ActivityIndicator color={theme.colors.onAccent} size="small" />
      ) : (
        <Text style={styles.buttonLabel}>{label}</Text>
      )}
    </Pressable>
  );
}

export function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable onPress={onPress} style={styles.link} hitSlop={8}>
      <Text style={styles.linkLabel}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    field: { gap: t.spacing.xs },
    label: { ...t.type.label, color: t.colors.textDim },
    input: {
      ...t.type.body,
      color: t.colors.text,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderRadius: t.radius.card,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
    },
    error: {
      ...t.type.meta,
      color: t.colors.danger,
    },
    button: {
      backgroundColor: t.colors.accent,
      borderRadius: t.radius.card,
      paddingVertical: t.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    buttonBlocked: { opacity: 0.5 },
    buttonLabel: { ...t.type.label, color: t.colors.onAccent, fontWeight: '600' },
    link: { alignSelf: 'center', paddingVertical: t.spacing.sm },
    linkLabel: { ...t.type.meta, color: t.colors.brand },
  });
