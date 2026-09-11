import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStyles, type Theme } from '../theme';

/**
 * Экран на случай ошибки отрисовки.
 *
 * expo-router подхватывает функцию с именем ErrorBoundary, экспортированную
 * из layout, и показывает её вместо упавшего поддерева. Без этого любая
 * ошибка в любом экране означала белый экран без объяснения и без выхода,
 * кроме перезапуска приложения.
 *
 * Текст ошибки показываем целиком, а не прячем за «что-то пошло не так»:
 * приложение личное, чинить его будет тот же человек, который его видит,
 * и сообщение для него — единственный способ понять причину. Отчётов
 * о падениях в проекте нет.
 */
export function AppErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 32 }]}>
      <Text style={styles.mark}>✕</Text>
      <Text style={styles.title}>Экран не открылся</Text>
      <Text style={styles.hint}>
        Остальное приложение работает — музыка продолжает играть.
      </Text>

      <ScrollView style={styles.box} contentContainerStyle={styles.boxContent}>
        <Text selectable style={styles.message}>
          {error.message}
        </Text>
        {error.stack ? (
          <Text selectable style={styles.stack}>
            {error.stack.split('\n').slice(1, 6).join('\n')}
          </Text>
        ) : null}
      </ScrollView>

      <Pressable style={styles.button} onPress={retry}>
        <Text style={styles.buttonLabel}>Попробовать снова</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.colors.bg,
      padding: t.layout.screenPadding,
      gap: t.spacing.md,
    },
    mark: { fontSize: 34, color: t.colors.danger },
    title: { ...t.type.title, color: t.colors.text },
    hint: { ...t.type.body, color: t.colors.textDim },
    box: {
      maxHeight: 260,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
    },
    boxContent: { padding: t.spacing.md, gap: t.spacing.sm },
    message: { ...t.type.body, color: t.colors.text },
    stack: { ...t.type.meta, color: t.colors.textFaint, fontSize: 11 },
    button: {
      marginTop: 'auto',
      paddingVertical: t.spacing.md,
      alignItems: 'center',
      borderRadius: t.radius.chip,
      backgroundColor: t.colors.accent,
    },
    buttonLabel: { ...t.type.body, fontWeight: '600', color: t.colors.onAccent },
  });
