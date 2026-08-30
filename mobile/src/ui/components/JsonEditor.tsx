import { memo, useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme, useThemedStyles, serializeTheme, type Theme, type ThemeSource } from '../theme';
import { notifyError, notifySuccess } from '../haptics';

/**
 * Правка темы текстом.
 *
 * Нужен там, где ползунков не хватает: палитра со ссылками `$имя`,
 * прозрачность, точечная правка отдельных ролей текста. Применяется по кнопке,
 * а не на каждый символ — иначе тема пересобиралась бы посреди набора и
 * ошибка мелькала бы на каждом незакрытом скобке.
 */

interface JsonEditorProps {
  source: ThemeSource;
  /** Бросает ThemeError с человеческим текстом, если тема не подошла. */
  onApply: (raw: string) => void;
}

export const JsonEditor = memo(function JsonEditor({ source, onApply }: JsonEditorProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [text, setText] = useState(() => serializeTheme(source));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Тему могли поменять снаружи — ползунками или выбором пресета. Подтягиваем
  // текст, но только если его не начали править: иначе затёрли бы набранное.
  useEffect(() => {
    if (dirty) return;
    setText(serializeTheme(source));
  }, [source, dirty]);

  const handleChange = useCallback((next: string) => {
    setText(next);
    setDirty(true);
    setError(null);
  }, []);

  const handleApply = useCallback(() => {
    try {
      onApply(text);
      setDirty(false);
      setError(null);
      notifySuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не применилось');
      notifyError();
    }
  }, [onApply, text]);

  const handleRevert = useCallback(() => {
    setText(serializeTheme(source));
    setDirty(false);
    setError(null);
  }, [source]);

  return (
    <View style={styles.wrap}>
      <TextInput
        value={text}
        onChangeText={handleChange}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        style={styles.input}
        selectionColor={theme.colors.brand}
        // Клавиатура без автоподстановок: она портит кавычки и скобки.
        keyboardType="ascii-capable"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.buttons}>
        <Pressable
          onPress={handleRevert}
          disabled={!dirty}
          style={[styles.button, styles.ghost, !dirty && styles.disabled]}
        >
          <MaterialIcons name="undo" size={16} color={theme.colors.text} />
          <Text style={styles.ghostLabel}>Вернуть</Text>
        </Pressable>

        <Pressable
          onPress={handleApply}
          disabled={!dirty}
          style={[styles.button, styles.primary, !dirty && styles.disabled]}
        >
          <MaterialIcons name="check" size={16} color={theme.colors.onAccent} />
          <Text style={styles.primaryLabel}>Применить</Text>
        </Pressable>
      </View>
    </View>
  );
});

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: { gap: t.spacing.sm },
    input: {
      minHeight: 240,
      maxHeight: 420,
      backgroundColor: t.colors.bg,
      color: t.colors.text,
      borderRadius: t.radius.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: t.spacing.md,
      // Моноширинный: в JSON важна колонка, а не красота.
      fontFamily: 'monospace',
      fontSize: 12,
      lineHeight: 18,
      textAlignVertical: 'top',
    },
    error: { ...t.type.meta, color: t.colors.danger, lineHeight: 17 },
    buttons: { flexDirection: 'row', gap: t.spacing.sm },
    button: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: t.spacing.md,
      borderRadius: t.radius.chip,
    },
    ghost: { borderWidth: 1, borderColor: t.colors.border },
    ghostLabel: { ...t.type.meta, color: t.colors.text, fontWeight: '600' },
    primary: { backgroundColor: t.colors.accent },
    primaryLabel: { ...t.type.meta, color: t.colors.onAccent, fontWeight: '600' },
    disabled: { opacity: 0.4 },
  });
