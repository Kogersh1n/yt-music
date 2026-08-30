import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip } from '../src/ui/components/Chip';
import { ColorPicker } from '../src/ui/components/ColorPicker';
import { Slider } from '../src/ui/components/Slider';
import { JsonEditor } from '../src/ui/components/JsonEditor';
import {
  EDITABLE_COLORS,
  FONTS,
  copyThemeToClipboard,
  draftFrom,
  saveCustomTheme,
  suggestReadableColors,
  resolveTheme,
  parseThemeJson,
  shareTheme,
  useTheme,
  useThemeControls,
  useThemedStyles,
  type Theme,
  type ThemeColors,
  type ThemeSource,
} from '../src/ui/theme';

/**
 * Редактор темы.
 *
 * Предпросмотра здесь нет намеренно: правка применяется сразу ко всему
 * приложению, и предпросмотром служит оно само. Достаточно выйти назад,
 * чтобы увидеть результат на живых экранах.
 */
export default function ThemeEditorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { source, applyTheme } = useThemeControls();

  // Черновик отвязан от исходной темы: правки не портят встроенную,
  // а сохраняются как новая.
  const [draft, setDraft] = useState<ThemeSource>(() =>
    source.id.startsWith('my-') ? source : draftFrom(theme.colors, theme.mode, source),
  );
  const [openColor, setOpenColor] = useState<keyof ThemeColors | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Применяет черновик немедленно; при провале проверок оставляет прежнее. */
  const push = useCallback(
    (next: ThemeSource) => {
      setDraft(next);
      try {
        applyTheme(next);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не применилось');
      }
    },
    [applyTheme],
  );

  const setColor = useCallback(
    (key: keyof ThemeColors, hex: string) => {
      push({ ...draft, colors: { ...draft.colors, [key]: hex } });
    },
    [draft, push],
  );

  /** Палитра текущей темы — быстрый способ переиспользовать её оттенки. */
  const swatches = useMemo(
    () => [...new Set(Object.values(theme.colors).filter((c) => c.startsWith('#')))],
    [theme.colors],
  );

  /**
   * Чинит цвета, из-за которых тема не прошла проверку. Считаем по черновику,
   * а не по применённой теме: на экране сейчас старая, а править надо ту,
   * которую пользователь только что собрал.
   */
  const handleAutoFix = useCallback(() => {
    try {
      const draftColors = resolveTheme(draft).colors;
      push({ ...draft, colors: { ...draft.colors, ...suggestReadableColors(draftColors) } });
    } catch {
      setError('Не удалось подобрать — проверьте цвета вручную');
    }
  }, [draft, push]);

  /**
   * Применяет тему, набранную текстом. Разбор и проверки — те же, что у
   * импорта: у ручной правки нет никаких поблажек.
   */
  const handleApplyJson = useCallback(
    (raw: string) => {
      const parsed = parseThemeJson(raw);
      setDraft(parsed);
      applyTheme(parsed);
      setError(null);
    },
    [applyTheme],
  );

  const handleSave = useCallback(() => {
    saveCustomTheme(draft);
    Alert.alert('Сохранено', `Тема «${draft.name}» добавлена в список.`);
  }, [draft]);

  const handleCopy = useCallback(async () => {
    await copyThemeToClipboard(draft);
    Alert.alert('Скопировано', 'JSON темы в буфере обмена.');
  }, [draft]);

  const handleShare = useCallback(async () => {
    const shared = await shareTheme(draft);
    if (!shared) Alert.alert('Недоступно', 'На этом устройстве нет способа поделиться файлом.');
  }, [draft]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + theme.spacing.sm,
          paddingBottom: insets.bottom + theme.spacing.xxl,
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerButton}>
          <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Редактор темы</Text>
        <Pressable onPress={handleSave} hitSlop={12} style={styles.headerButton}>
          <MaterialIcons name="save" size={22} color={theme.colors.accent} />
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={handleAutoFix} style={styles.fixButton}>
            <MaterialIcons name="auto-fix-high" size={16} color={theme.colors.onAccent} />
            <Text style={styles.fixLabel}>Подобрать читаемые</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.section}>Цвета</Text>
      <View style={styles.card}>
        {EDITABLE_COLORS.map((entry) => {
          const value = (draft.colors?.[entry.key] ?? theme.colors[entry.key]) as string;
          const isOpen = openColor === entry.key;

          return (
            <View key={entry.key}>
              <Pressable
                style={styles.colorRow}
                onPress={() => setOpenColor(isOpen ? null : entry.key)}
              >
                <View style={[styles.dot, { backgroundColor: theme.colors[entry.key] }]} />
                <View style={styles.colorText}>
                  <Text style={styles.colorLabel}>{entry.label}</Text>
                  <Text style={styles.colorHint}>{entry.hint}</Text>
                </View>
                <MaterialIcons
                  name={isOpen ? 'expand-less' : 'expand-more'}
                  size={22}
                  color={theme.colors.textFaint}
                />
              </Pressable>

              {isOpen ? (
                <View style={styles.picker}>
                  <ColorPicker
                    value={value.startsWith('#') ? value : theme.colors[entry.key]}
                    swatches={swatches}
                    onChange={(hex) => setColor(entry.key, hex)}
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <Text style={styles.section}>Форма</Text>
      <View style={styles.card}>
        <Slider
          label="Скругление обложек"
          value={draft.radius?.thumb ?? theme.radius.thumb}
          min={0}
          max={24}
          step={1}
          onChange={(thumb) => push({ ...draft, radius: { ...draft.radius, thumb } })}
        />
        <Slider
          label="Скругление карточек"
          value={draft.radius?.card ?? theme.radius.card}
          min={0}
          max={28}
          step={1}
          onChange={(card) => push({ ...draft, radius: { ...draft.radius, card } })}
        />
        <Slider
          label="Скругление чипов"
          value={draft.radius?.chip ?? theme.radius.chip}
          min={0}
          max={999}
          step={1}
          format={(v) => (v > 900 ? 'пилюля' : String(v))}
          onChange={(chip) => push({ ...draft, radius: { ...draft.radius, chip } })}
        />
      </View>

      <Text style={styles.section}>Текст</Text>
      <View style={styles.card}>
        <View style={styles.chips}>
          {FONTS.map((font) => (
            <Chip
              key={font.id}
              label={font.label}
              active={(draft.typography?.family ?? 'system') === font.id}
              onPress={() =>
                push({ ...draft, typography: { ...draft.typography, family: font.id } })
              }
            />
          ))}
        </View>
        <Slider
          label="Размер"
          value={draft.typography?.scale ?? 1}
          min={0.8}
          max={1.4}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(scale) => push({ ...draft, typography: { ...draft.typography, scale } })}
        />
        <Slider
          label="Разрядка"
          value={draft.typography?.letterSpacing ?? 0}
          min={0}
          max={0.12}
          step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(letterSpacing) =>
            push({ ...draft, typography: { ...draft.typography, letterSpacing } })
          }
        />
      </View>

      <Text style={styles.section}>Элементы</Text>
      <View style={styles.card}>
        <Row label="Кнопка воспроизведения">
          {(['circle', 'square', 'pill'] as const).map((shape) => (
            <Chip
              key={shape}
              label={{ circle: 'Круг', square: 'Квадрат', pill: 'Пилюля' }[shape]}
              active={(draft.components?.playButton ?? theme.components.playButton) === shape}
              onPress={() =>
                push({ ...draft, components: { ...draft.components, playButton: shape } })
              }
            />
          ))}
        </Row>

        <Row label="Полоса прогресса">
          {(['line', 'stepped'] as const).map((kind) => (
            <Chip
              key={kind}
              label={kind === 'line' ? 'Сплошная' : 'Сегментами'}
              active={(draft.components?.progress ?? theme.components.progress) === kind}
              onPress={() =>
                push({ ...draft, components: { ...draft.components, progress: kind } })
              }
            />
          ))}
        </Row>

        <Row label="Форма обложек">
          {(['rounded', 'square', 'circle'] as const).map((shape) => (
            <Chip
              key={shape}
              label={{ rounded: 'Скруглённая', square: 'Квадрат', circle: 'Круг' }[shape]}
              active={(draft.components?.thumb ?? theme.components.thumb) === shape}
              onPress={() => push({ ...draft, components: { ...draft.components, thumb: shape } })}
            />
          ))}
        </Row>

        <Row label="Плотность списка">
          {(['comfortable', 'compact'] as const).map((density) => (
            <Chip
              key={density}
              label={density === 'compact' ? 'Плотно' : 'Просторно'}
              active={(draft.layout?.density ?? 'comfortable') === density}
              onPress={() => push({ ...draft, layout: { ...draft.layout, density } })}
            />
          ))}
        </Row>

        <Row label="Анимации">
          {([1, 0] as const).map((scale) => (
            <Chip
              key={scale}
              label={scale === 0 ? 'Мгновенно' : 'Плавно'}
              active={(draft.motion?.scale ?? 1) === scale}
              onPress={() => push({ ...draft, motion: { ...draft.motion, scale } })}
            />
          ))}
        </Row>

        <Row label="Подписи вкладок">
          {([true, false] as const).map((show) => (
            <Chip
              key={String(show)}
              label={show ? 'Показывать' : 'Скрыть'}
              active={(draft.components?.tabBarLabels ?? true) === show}
              onPress={() =>
                push({ ...draft, components: { ...draft.components, tabBarLabels: show } })
              }
            />
          ))}
        </Row>
      </View>

      <Text style={styles.section}>Текстом</Text>
      <View style={styles.card}>
        <Text style={styles.jsonHint}>
          Для того, чего нет в ползунках: палитра со ссылками $имя, прозрачность
          вида $crust@70, отдельные роли текста.
        </Text>
        <JsonEditor source={draft} onApply={handleApplyJson} />
      </View>

      <View style={styles.actions}>
        <Pressable onPress={handleCopy} style={[styles.action, styles.actionGhost]}>
          <MaterialIcons name="content-copy" size={18} color={theme.colors.text} />
          <Text style={styles.actionGhostLabel}>Скопировать JSON</Text>
        </Pressable>
        <Pressable onPress={handleShare} style={[styles.action, styles.actionPrimary]}>
          <MaterialIcons name="ios-share" size={18} color={theme.colors.onAccent} />
          <Text style={styles.actionPrimaryLabel}>Поделиться</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>
        Правки применяются сразу — выйдите назад, чтобы посмотреть на настоящих экранах.
        «Сохранить» добавляет тему в список, чтобы к ней можно было вернуться.
      </Text>
    </ScrollView>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    content: { gap: t.spacing.sm },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: t.spacing.lg,
    },
    headerButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { ...t.type.label, fontSize: 15, color: t.colors.text },

    section: {
      ...t.type.section,
      fontSize: 15,
      color: t.colors.textDim,
      paddingHorizontal: t.layout.screenPadding,
      marginTop: t.spacing.lg,
    },
    card: {
      marginHorizontal: t.layout.screenPadding,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      padding: t.spacing.md,
      gap: t.spacing.sm,
    },

    colorRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingVertical: 6 },
    dot: {
      width: 26,
      height: 26,
      borderRadius: t.radius.thumb,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    colorText: { flex: 1 },
    colorLabel: { ...t.type.trackTitle, color: t.colors.text },
    colorHint: { ...t.type.meta, color: t.colors.textFaint },
    picker: {
      paddingVertical: t.spacing.sm,
      paddingLeft: 38,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      marginBottom: t.spacing.sm,
    },

    jsonHint: { ...t.type.meta, color: t.colors.textFaint, lineHeight: 17 },
    row: { gap: 6, paddingVertical: 4 },
    rowLabel: { ...t.type.meta, color: t.colors.textDim },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },

    actions: {
      flexDirection: 'row',
      gap: t.spacing.sm,
      paddingHorizontal: t.layout.screenPadding,
      marginTop: t.spacing.lg,
    },
    action: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: t.spacing.md,
      borderRadius: t.radius.chip,
    },
    actionGhost: { borderWidth: 1, borderColor: t.colors.border },
    actionGhostLabel: { ...t.type.label, color: t.colors.text },
    actionPrimary: { backgroundColor: t.colors.accent },
    actionPrimaryLabel: { ...t.type.label, color: t.colors.onAccent, fontWeight: '600' },

    errorBox: {
      marginHorizontal: t.layout.screenPadding,
      padding: t.spacing.md,
      borderRadius: t.radius.card,
      backgroundColor: t.colors.surface,
      borderLeftWidth: 3,
      borderLeftColor: t.colors.danger,
      gap: t.spacing.sm,
      alignItems: 'flex-start',
    },
    error: { ...t.type.meta, color: t.colors.danger, lineHeight: 17 },
    fixButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: t.colors.accent,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
      borderRadius: t.radius.chip,
    },
    fixLabel: { ...t.type.meta, color: t.colors.onAccent, fontWeight: '600' },
    hint: {
      ...t.type.meta,
      color: t.colors.textFaint,
      paddingHorizontal: t.layout.screenPadding,
      marginTop: t.spacing.md,
      lineHeight: 17,
    },
  });
