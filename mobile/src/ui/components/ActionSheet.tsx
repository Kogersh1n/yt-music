import { memo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme, useThemedStyles, type Theme } from '../theme';

/**
 * Меню действий над объектом.
 *
 * Замена системному Alert.alert со списком кнопок. Он выглядел и вёл себя
 * неправильно сразу в трёх местах, и увидеть это можно было только запустив
 * приложение:
 *
 *   Тема. Системный диалог рисуется белой панелью поверх тёмного экрана —
 *   всё оформление приложения мимо.
 *
 *   Порядок. Android раскладывает кнопки снизу вверх, то есть в обратном
 *   тому, в каком они переданы: «Отмена» оказывалась наверху, а опасное
 *   действие — посередине.
 *
 *   Опасность. `style: 'destructive'` на Android игнорируется, и удаление
 *   выглядело ровно так же, как безобидное «Нравится».
 */

export interface SheetAction {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  /** Опасные действия окрашены и стоят последними — перед отменой. */
  destructive?: boolean;
  onPress: () => void;
}

interface ActionSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: readonly SheetAction[];
  onClose: () => void;
}

export const ActionSheet = memo(function ActionSheet({
  visible,
  title,
  subtitle,
  actions,
  onClose,
}: ActionSheetProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Нажатие мимо листа закрывает его — привычнее, чем искать «Отмена». */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Закрыть" />

      <View style={styles.sheet}>
        <View style={styles.grip} />

        <View style={styles.head}>
          <Text numberOfLines={2} style={styles.title}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {actions.map((action) => (
          <Pressable
            key={action.label}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            android_ripple={{ color: 'rgba(128,128,128,0.16)' }}
            onPress={() => {
              onClose();
              action.onPress();
            }}
          >
            <MaterialIcons
              name={action.icon}
              size={22}
              color={action.destructive ? theme.colors.danger : theme.colors.text}
            />
            <Text style={[styles.label, action.destructive && styles.labelDanger]}>
              {action.label}
            </Text>
          </Pressable>
        ))}

        <Pressable style={styles.cancel} onPress={onClose}>
          <Text style={styles.cancelLabel}>Отмена</Text>
        </Pressable>
      </View>
    </Modal>
  );
});

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
    sheet: {
      backgroundColor: t.colors.surface,
      borderTopLeftRadius: t.radius.card,
      borderTopRightRadius: t.radius.card,
      paddingBottom: t.spacing.xl,
      paddingTop: t.spacing.sm,
    },
    // Полоска-ухватка: показывает, что панель снизу и её можно закрыть.
    grip: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.border,
      marginBottom: t.spacing.md,
    },
    head: {
      paddingHorizontal: t.layout.screenPadding,
      paddingBottom: t.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      gap: 2,
    },
    title: { ...t.type.body, fontWeight: '600', color: t.colors.text },
    subtitle: { ...t.type.meta, color: t.colors.textDim },

    action: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.md,
    },
    pressed: { backgroundColor: t.colors.bg },
    label: { ...t.type.body, color: t.colors.text },
    labelDanger: { color: t.colors.danger },

    cancel: {
      marginTop: t.spacing.sm,
      marginHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.md,
      alignItems: 'center',
      borderRadius: t.radius.chip,
      backgroundColor: t.colors.bg,
    },
    cancelLabel: { ...t.type.body, color: t.colors.textDim },
  });
