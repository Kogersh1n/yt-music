import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { audioCacheStats, clearAudioCache } from '../src/local/audioCache';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BUILTIN_THEMES,
  checkContrast,
  copyThemeToClipboard,
  importFromClipboard,
  importFromFile,
  importFromUrl,
  removeCustomTheme,
  resolveTheme,
  saveCustomTheme,
  shareTheme,
  useCustomThemes,
  useTheme,
  useThemeControls,
  useThemedStyles,
  type Theme,
  type ThemeSource,
} from '../src/ui/theme';

/**
 * Оформление: выбор темы.
 *
 * Встроенные темы проходят тот же путь, что и пользовательские — разбор,
 * проверка контраста, применение. Никаких привилегий у них нет, поэтому
 * экран заодно служит проверкой, что механизм работает.
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { source, applyTheme } = useThemeControls();
  const customThemes = useCustomThemes();

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState('');

  const handlePick = useCallback(
    (candidate: ThemeSource) => {
      try {
        applyTheme(candidate);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Тема не применилась');
      }
    },
    [applyTheme],
  );

  /**
   * Общий путь для всех источников импорта: получить тему → применить →
   * запомнить в библиотеке. Сохраняем только то, что прошло проверки,
   * иначе в списке копились бы заведомо нерабочие темы.
   */
  const runImport = useCallback(
    async (load: () => Promise<ThemeSource | null>) => {
      setBusy(true);
      try {
        const imported = await load();
        // null — пользователь закрыл выбор файла, это не ошибка.
        if (!imported) return;
        applyTheme(imported);
        saveCustomTheme(imported);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить тему');
      } finally {
        setBusy(false);
      }
    },
    [applyTheme],
  );

  const handleDelete = useCallback(
    (candidate: ThemeSource) => {
      Alert.alert(`Удалить «${candidate.name ?? candidate.id}»?`, 'Тему можно будет импортировать заново.', [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            // Если удаляем тему, которая сейчас применена, возвращаемся к базовой:
            // иначе после перезапуска её будет неоткуда взять.
            if (candidate.id === source.id) applyTheme(BUILTIN_THEMES[0]);
            removeCustomTheme(candidate.id);
          },
        },
      ]);
    },
    [applyTheme, source.id],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + theme.spacing.sm, paddingBottom: insets.bottom + theme.spacing.xxl },
      ]}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerButton}>
          <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Оформление</Text>
        <View style={styles.headerButton} />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Тема не применилась</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Темы</Text>
      <View style={styles.grid}>
        {BUILTIN_THEMES.map((candidate) => (
          <ThemeCard
            key={candidate.id}
            candidate={candidate}
            active={candidate.id === source.id}
            onPress={handlePick}
          />
        ))}
      </View>

      {customThemes.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Мои темы</Text>
          <View style={styles.grid}>
            {customThemes.map((candidate) => (
              <ThemeCard
                key={candidate.id}
                candidate={candidate}
                active={candidate.id === source.id}
                onPress={handlePick}
                onLongPress={handleDelete}
              />
            ))}
          </View>
          <Text style={styles.gridHint}>Долгое нажатие — удалить</Text>
        </>
      ) : null}

      <Text style={styles.sectionTitle}>Своя тема</Text>
      <View style={styles.buttons}>
        <ActionButton
          icon="tune"
          label="Открыть редактор"
          primary
          onPress={() => router.push('/theme-editor')}
        />
        <ActionButton
          icon="folder-open"
          label="Импорт из файла"
          onPress={() => void runImport(importFromFile)}
        />
        <ActionButton
          icon="content-paste"
          label="Вставить из буфера"
          onPress={() => void runImport(importFromClipboard)}
        />
        <ActionButton icon="link" label="Загрузить по ссылке" onPress={() => setUrlOpen(true)} />
        <ActionButton
          icon="content-copy"
          label="Скопировать текущую"
          onPress={() => {
            void copyThemeToClipboard(source);
            Alert.alert('Скопировано', 'JSON текущей темы в буфере обмена.');
          }}
        />
        <ActionButton
          icon="ios-share"
          label="Поделиться текущей"
          onPress={() => void shareTheme(source)}
        />
      </View>

      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator size="small" color={theme.colors.text} />
          <Text style={styles.busyText}>Загружаем тему…</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Офлайн-кэш</Text>
      <OfflineCache />

      <Text style={styles.sectionTitle}>Читаемость текущей темы</Text>
      <ContrastReport />

      <Modal visible={urlOpen} transparent animationType="fade" onRequestClose={() => setUrlOpen(false)}>
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ссылка на тему</Text>
            <Text style={styles.modalHint}>
              Прямая ссылка на .json — например, «raw» с гиста.
            </Text>
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="https://..."
              placeholderTextColor={theme.colors.textFaint}
              style={styles.modalInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              selectionColor={theme.colors.brand}
            />
            <View style={styles.modalButtons}>
              <Pressable onPress={() => setUrlOpen(false)} style={[styles.modalButton, styles.modalGhost]}>
                <Text style={styles.modalGhostLabel}>Отмена</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setUrlOpen(false);
                  void runImport(() => importFromUrl(url));
                }}
                style={[styles.modalButton, styles.modalPrimary]}
              >
                <Text style={styles.modalPrimaryLabel}>Загрузить</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Text style={styles.hint}>
        Тема — это обычный JSON. Образцы для своих лежат в папке themes/ репозитория; тема,
        в которой текст не читается, не применится — пороги видны выше.
      </Text>
    </ScrollView>
  );
}

/**
 * Карточка темы с настоящим предпросмотром: маленький кусок интерфейса,
 * покрашенный цветами этой темы. Разбираем её здесь же — так видно
 * не название, а результат.
 */
function ThemeCard({
  candidate,
  active,
  onPress,
  onLongPress,
}: {
  candidate: ThemeSource;
  active: boolean;
  onPress: (source: ThemeSource) => void;
  onLongPress?: (source: ThemeSource) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const current = useTheme();

  // Разбор дешёвый и результат зависит только от самой темы.
  const preview = useMemo(() => {
    try {
      return resolveTheme(candidate);
    } catch {
      return null;
    }
  }, [candidate]);

  if (!preview) return null;

  return (
    <Pressable
      onPress={() => onPress(candidate)}
      onLongPress={onLongPress ? () => onLongPress(candidate) : undefined}
      style={[
        styles.card,
        { borderColor: active ? current.colors.accent : current.colors.border },
      ]}
    >
      {/* Мини-макет: фон, обложка, две строки текста, кнопка. */}
      <View style={[styles.preview, { backgroundColor: preview.colors.bg }]}>
        <View style={styles.previewRow}>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: preview.radius.thumb,
              backgroundColor: preview.colors.surfaceHigh,
            }}
          />
          <View style={styles.previewText}>
            <View
              style={{ height: 6, width: '80%', borderRadius: 2, backgroundColor: preview.colors.text }}
            />
            <View
              style={{ height: 5, width: '50%', borderRadius: 2, backgroundColor: preview.colors.textDim }}
            />
          </View>
        </View>

        <View style={[styles.previewBar, { backgroundColor: preview.colors.player }]}>
          <View
            style={{ height: 5, flex: 1, borderRadius: 2, backgroundColor: preview.colors.border }}
          />
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: preview.components.playButton === 'square' ? 0 : 9,
              backgroundColor: preview.colors.accent,
            }}
          />
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text numberOfLines={1} style={styles.cardName}>
          {preview.name}
        </Text>
        {active ? (
          <MaterialIcons name="check-circle" size={16} color={current.colors.accent} />
        ) : null}
      </View>
    </Pressable>
  );
}

/** Кнопка в списке действий над темами. */
function ActionButton({
  icon,
  label,
  primary,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, primary ? styles.buttonPrimary : styles.buttonGhost]}
      android_ripple={{ color: 'rgba(128,128,128,0.18)' }}
    >
      <MaterialIcons
        name={icon}
        size={18}
        color={primary ? theme.colors.onAccent : theme.colors.text}
      />
      <Text style={[styles.buttonLabel, primary && styles.buttonLabelPrimary]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Отчёт по контрасту текущей темы. Пороги те же, что и в проверке перед
 * применением — здесь видно, с каким запасом тема их проходит.
 */
function ContrastReport() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const checks = useMemo(() => checkContrast(theme.colors), [theme.colors]);

  return (
    <View style={styles.checks}>
      {checks.map((check) => (
        <View key={check.label} style={styles.check}>
          <Text style={styles.checkLabel}>{check.label}</Text>
          <Text style={[styles.checkValue, !check.passed && styles.checkFailed]}>
            {check.ratio === null ? '—' : `${check.ratio.toFixed(1)}:1`}
            <Text style={styles.checkRequired}> / {check.required}</Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Скачанные треки. Заполняется сам, когда трек слушают дольше десяти секунд;
 * здесь только видно, сколько занято, и можно освободить место.
 */
function OfflineCache() {
  const styles = useThemedStyles(makeStyles);
  const [stats, setStats] = useState(() => audioCacheStats());

  const megabytes = (stats.bytes / (1024 * 1024)).toFixed(1);

  return (
    <View style={styles.buttons}>
      <Text style={styles.hint}>
        {stats.count === 0
          ? 'Пока пусто. Треки попадают сюда сами — последние пять из тех, что слушали.'
          : `${stats.count} из 5 треков, ${megabytes} МБ. Играют без сети и начинаются мгновенно.`}
      </Text>
      {stats.count > 0 ? (
        <ActionButton
          icon="delete-outline"
          label="Очистить кэш"
          onPress={() => {
            clearAudioCache();
            setStats(audioCacheStats());
          }}
        />
      ) : null}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    content: { gap: t.spacing.md },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: t.spacing.lg,
    },
    headerButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { ...t.type.label, fontSize: 15, color: t.colors.text },

    sectionTitle: {
      ...t.type.section,
      fontSize: 15,
      color: t.colors.textDim,
      paddingHorizontal: t.layout.screenPadding,
      marginTop: t.spacing.md,
    },

    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing.md,
      paddingHorizontal: t.layout.screenPadding,
    },
    card: {
      width: '47%',
      borderWidth: 2,
      borderRadius: t.radius.card,
      overflow: 'hidden',
      backgroundColor: t.colors.surface,
    },
    preview: { height: 92, padding: 8, justifyContent: 'space-between' },
    previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    previewText: { flex: 1, gap: 4 },
    previewBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 6,
      borderRadius: 4,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    cardName: { ...t.type.meta, color: t.colors.text, flex: 1 },
    gridHint: {
      ...t.type.meta,
      color: t.colors.textFaint,
      paddingHorizontal: t.layout.screenPadding,
    },

    buttons: { paddingHorizontal: t.layout.screenPadding, gap: t.spacing.sm },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.md,
      borderRadius: t.radius.chip,
    },
    buttonGhost: { borderWidth: 1, borderColor: t.colors.border },
    buttonPrimary: { backgroundColor: t.colors.accent },
    buttonLabel: { ...t.type.label, color: t.colors.text },
    buttonLabelPrimary: { color: t.colors.onAccent, fontWeight: '600' },

    busy: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingHorizontal: t.layout.screenPadding,
    },
    busyText: { ...t.type.meta, color: t.colors.textDim },

    modalScrim: {
      flex: 1,
      backgroundColor: t.colors.scrim,
      alignItems: 'center',
      justifyContent: 'center',
      padding: t.spacing.xl,
    },
    modalCard: {
      width: '100%',
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.sheet,
      padding: t.spacing.lg,
      gap: t.spacing.sm,
    },
    modalTitle: { ...t.type.section, fontSize: 17, color: t.colors.text },
    modalHint: { ...t.type.meta, color: t.colors.textDim, lineHeight: 17 },
    modalInput: {
      ...t.type.body,
      color: t.colors.text,
      backgroundColor: t.colors.bg,
      borderRadius: t.radius.card,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.md,
      marginTop: t.spacing.xs,
    },
    modalButtons: { flexDirection: 'row', gap: t.spacing.sm, marginTop: t.spacing.sm },
    modalButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: t.spacing.md,
      borderRadius: t.radius.chip,
    },
    modalGhost: { borderWidth: 1, borderColor: t.colors.border },
    modalGhostLabel: { ...t.type.label, color: t.colors.text },
    modalPrimary: { backgroundColor: t.colors.accent },
    modalPrimaryLabel: { ...t.type.label, color: t.colors.onAccent, fontWeight: '600' },

    checks: {
      marginHorizontal: t.layout.screenPadding,
      borderRadius: t.radius.card,
      backgroundColor: t.colors.surface,
      overflow: 'hidden',
    },
    check: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    checkLabel: { ...t.type.meta, color: t.colors.textDim },
    checkValue: { ...t.type.meta, color: t.colors.text, fontVariant: ['tabular-nums'] },
    checkRequired: { color: t.colors.textFaint },
    checkFailed: { color: t.colors.danger },

    errorBox: {
      marginHorizontal: t.layout.screenPadding,
      padding: t.spacing.md,
      borderRadius: t.radius.card,
      backgroundColor: t.colors.surface,
      borderLeftWidth: 3,
      borderLeftColor: t.colors.danger,
      gap: 4,
    },
    errorTitle: { ...t.type.label, color: t.colors.text },
    errorText: { ...t.type.meta, color: t.colors.textDim, lineHeight: 17 },

    hint: {
      ...t.type.meta,
      color: t.colors.textFaint,
      paddingHorizontal: t.layout.screenPadding,
      marginTop: t.spacing.md,
      lineHeight: 17,
    },
  });
