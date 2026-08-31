import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useThemeControls, useThemedStyles, type Theme } from '../../src/ui/theme';
import { useSettings, updateSettings } from '../../src/local/settings';
import { useStats, formatListening, resetStats } from '../../src/local/stats';
import { useLikedIds } from '../../src/local/likes';
import { useIsSignedIn, signOut } from '../../src/auth/session';
import { measureCache, clearCache, formatBytes, type CacheUsage } from '../../src/local/cache';
import { applyAudioOptions } from '../../src/player/setup';
import { tapMedium, notifySuccess } from '../../src/ui/haptics';

/**
 * Профиль: кто слушает, сколько наслушал, чем занято место и как всё это
 * настроено.
 *
 * Экран оформления сюда не дублируется — на него ведёт ссылка. Иначе рядом
 * оказались бы два переключателя тем, которые пришлось бы держать в согласии.
 */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { source } = useThemeControls();

  const settings = useSettings();
  const stats = useStats();
  const liked = useLikedIds();
  const signedIn = useIsSignedIn();

  const [cache, setCache] = useState<CacheUsage | null>(null);
  const [measuring, setMeasuring] = useState(false);

  /** Обход файловой системы — делаем по входу на экран, а не на каждый рендер. */
  const refreshCache = useCallback(async () => {
    setMeasuring(true);
    try {
      setCache(await measureCache());
    } finally {
      setMeasuring(false);
    }
  }, []);

  useEffect(() => {
    void refreshCache();
  }, [refreshCache]);

  const handleClearCache = useCallback(() => {
    Alert.alert(
      'Очистить кэш?',
      'Удалятся сохранённые обложки и буфер аудио. Медиатека, лайки и темы останутся.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Очистить',
          style: 'destructive',
          onPress: async () => {
            await clearCache();
            notifySuccess();
            await refreshCache();
          },
        },
      ],
    );
  }, [refreshCache]);

  const handleResetStats = useCallback(() => {
    Alert.alert('Сбросить статистику?', 'Счётчики начнут отсчёт заново.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Сбросить', style: 'destructive', onPress: () => { resetStats(); tapMedium(); } },
    ]);
  }, []);

  /** Аудио-настройки применяются к живому плееру, перезапуск не нужен. */
  const setAudio = useCallback((patch: { skipSilence?: boolean; audioOffload?: boolean }) => {
    updateSettings(patch);
    tapMedium();
    void applyAudioOptions().catch(() => undefined);
  }, []);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + theme.spacing.md, paddingBottom: theme.spacing.xxl },
      ]}
    >
      <Text style={styles.title}>Профиль</Text>

      {/* --- Карточка --- */}
      <View style={styles.card}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>
              {settings.alias.trim().charAt(0).toUpperCase() || '♪'}
            </Text>
          </View>
          <View style={styles.identityText}>
            <TextInput
              value={settings.alias}
              onChangeText={(alias) => updateSettings({ alias })}
              style={styles.alias}
              placeholder="Как вас звать"
              placeholderTextColor={theme.colors.textFaint}
              maxLength={32}
              selectionColor={theme.colors.brand}
            />
            <Text style={styles.identityHint}>
              {signedIn
                ? 'Медиатека синхронизируется с сервером'
                : 'Профиль локальный — вход не выполнен'}
            </Text>
          </View>
        </View>

        {/* Лайки и статистика остаются на устройстве при любом раскладе —
            выход не должен ощущаться как потеря своих данных. */}
        <Pressable
          style={styles.account}
          onPress={() => {
            tapMedium();
            if (!signedIn) {
              router.push('/(auth)/login');
              return;
            }
            Alert.alert('Выйти из аккаунта?', 'Лайки и настройки останутся на телефоне.', [
              { text: 'Отмена', style: 'cancel' },
              { text: 'Выйти', style: 'destructive', onPress: () => void signOut() },
            ]);
          }}
        >
          <MaterialIcons
            name={signedIn ? 'logout' : 'login'}
            size={18}
            color={signedIn ? theme.colors.danger : theme.colors.brand}
          />
          <Text style={[styles.accountLabel, signedIn && styles.accountLabelDanger]}>
            {signedIn ? 'Выйти из аккаунта' : 'Войти или зарегистрироваться'}
          </Text>
        </Pressable>

        <View style={styles.stats}>
          <Stat value={String(stats.played)} label="запусков" />
          <Stat value={String(stats.uniqueTracks)} label="разных треков" />
          <Stat value={formatListening(stats.seconds)} label="прослушано" />
          <Stat value={String(liked.length)} label="понравилось" />
        </View>
      </View>

      {/* --- Итоги --- */}
      <Text style={styles.section}>Итоги</Text>
      <Pressable style={styles.link} onPress={() => router.push('/recap')}>
        <MaterialIcons name="insights" size={22} color={theme.colors.text} />
        <View style={styles.linkText}>
          <Text style={styles.linkTitle}>Итоги месяца</Text>
          <Text style={styles.linkHint}>Что и сколько вы слушали</Text>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={theme.colors.textFaint} />
      </Pressable>

      {/* --- Оформление --- */}
      <Text style={styles.section}>Оформление</Text>
      <Pressable style={styles.link} onPress={() => router.push('/settings')}>
        <MaterialIcons name="palette" size={22} color={theme.colors.text} />
        <View style={styles.linkText}>
          <Text style={styles.linkTitle}>Темы</Text>
          <Text style={styles.linkHint}>Сейчас: {source.name ?? source.id}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={theme.colors.textFaint} />
      </Pressable>

      <Pressable style={styles.link} onPress={() => router.push('/theme-editor')}>
        <MaterialIcons name="tune" size={22} color={theme.colors.text} />
        <View style={styles.linkText}>
          <Text style={styles.linkTitle}>Редактор темы</Text>
          <Text style={styles.linkHint}>Цвета, форма, шрифт, JSON</Text>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={theme.colors.textFaint} />
      </Pressable>

      {/* --- Память --- */}
      <Text style={styles.section}>Память</Text>
      <View style={styles.card}>
        {cache === null ? (
          <View style={styles.measuring}>
            <ActivityIndicator size="small" color={theme.colors.textDim} />
            <Text style={styles.linkHint}>Считаем…</Text>
          </View>
        ) : (
          <>
            <UsageRow label="Обложки" value={formatBytes(cache.imagesBytes)} />
            <UsageRow label="Буфер аудио" value={formatBytes(cache.audioBytes)} />
            <UsageRow label="Прочее" value={formatBytes(cache.otherBytes)} />
            <UsageRow label="Всего" value={formatBytes(cache.totalBytes)} strong />
          </>
        )}

        <View style={styles.cacheButtons}>
          <Pressable
            onPress={() => void refreshCache()}
            disabled={measuring}
            style={[styles.smallButton, styles.ghost, measuring && styles.disabled]}
          >
            <MaterialIcons name="refresh" size={16} color={theme.colors.text} />
            <Text style={styles.smallGhostLabel}>Пересчитать</Text>
          </Pressable>
          <Pressable onPress={handleClearCache} style={[styles.smallButton, styles.primary]}>
            <MaterialIcons name="delete-sweep" size={16} color={theme.colors.onAccent} />
            <Text style={styles.smallPrimaryLabel}>Очистить кэш</Text>
          </Pressable>
        </View>
      </View>

      {/* --- Воспроизведение --- */}
      <Text style={styles.section}>Воспроизведение</Text>
      <View style={styles.card}>
        <Toggle
          title="Пропускать тишину"
          hint="Обрезает паузы в начале и конце треков"
          value={settings.skipSilence}
          onChange={(skipSilence) => setAudio({ skipSilence })}
        />
        <Toggle
          title="Разгружать декодирование"
          hint="Экономит батарею при выключенном экране. На части устройств сбивает показ позиции"
          value={settings.audioOffload}
          onChange={(audioOffload) => setAudio({ audioOffload })}
        />
        <Toggle
          title="Тактильный отклик"
          hint="Вибрация на нажатия и смахивания"
          value={settings.haptics}
          onChange={(haptics) => {
            updateSettings({ haptics });
            if (haptics) tapMedium();
          }}
        />
      </View>

      <Text style={styles.note}>
        Переключателей «без пауз» и «выравнивать громкость» здесь нет намеренно: первого не
        требуется — движок играет без пауз сам, второй react-native-track-player наружу
        не выводит.
      </Text>

      <Pressable onPress={handleResetStats} style={styles.reset}>
        <Text style={styles.resetLabel}>Сбросить статистику</Text>
      </Pressable>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function UsageRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.usageRow}>
      <Text style={[styles.usageLabel, strong && styles.usageStrong]}>{label}</Text>
      <Text style={[styles.usageValue, strong && styles.usageStrong]}>{value}</Text>
    </View>
  );
}

function Toggle({
  title,
  hint,
  value,
  onChange,
}: {
  title: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.toggle}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
        thumbColor={value ? theme.colors.onAccent : theme.colors.textFaint}
      />
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    content: { gap: t.spacing.sm },
    title: { ...t.type.title, color: t.colors.text, paddingHorizontal: t.layout.screenPadding },

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
      gap: t.spacing.md,
      marginTop: t.spacing.sm,
    },

    identity: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: t.components.thumb === 'square' ? 0 : 26,
      backgroundColor: t.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarLetter: { ...t.type.title, color: t.colors.onAccent },
    identityText: { flex: 1 },
    alias: { ...t.type.section, fontSize: 18, color: t.colors.text, padding: 0 },
    identityHint: { ...t.type.meta, color: t.colors.textFaint },
    account: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingVertical: t.spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    accountLabel: { ...t.type.label, color: t.colors.brand },
    accountLabelDanger: { color: t.colors.danger },

    stats: { flexDirection: 'row', flexWrap: 'wrap' },
    stat: { width: '50%', paddingVertical: t.spacing.sm },
    statValue: { ...t.type.section, fontSize: 19, color: t.colors.text },
    statLabel: { ...t.type.meta, color: t.colors.textDim },

    link: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      marginHorizontal: t.layout.screenPadding,
      marginTop: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.md,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
    },
    linkText: { flex: 1 },
    linkTitle: { ...t.type.trackTitle, color: t.colors.text },
    linkHint: { ...t.type.meta, color: t.colors.textDim },

    measuring: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    usageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    usageLabel: { ...t.type.meta, color: t.colors.textDim },
    usageValue: { ...t.type.meta, color: t.colors.text, fontVariant: ['tabular-nums'] },
    usageStrong: { color: t.colors.text, fontWeight: '600' },

    cacheButtons: { flexDirection: 'row', gap: t.spacing.sm, marginTop: t.spacing.xs },
    smallButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: t.spacing.sm,
      borderRadius: t.radius.chip,
    },
    ghost: { borderWidth: 1, borderColor: t.colors.border },
    primary: { backgroundColor: t.colors.accent },
    smallGhostLabel: { ...t.type.meta, color: t.colors.text, fontWeight: '600' },
    smallPrimaryLabel: { ...t.type.meta, color: t.colors.onAccent, fontWeight: '600' },
    disabled: { opacity: 0.4 },

    toggle: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
    toggleText: { flex: 1 },
    toggleTitle: { ...t.type.trackTitle, color: t.colors.text },
    toggleHint: { ...t.type.meta, color: t.colors.textFaint, lineHeight: 16 },

    note: {
      ...t.type.meta,
      color: t.colors.textFaint,
      paddingHorizontal: t.layout.screenPadding,
      marginTop: t.spacing.md,
      lineHeight: 17,
    },
    reset: { alignSelf: 'center', padding: t.spacing.lg, marginTop: t.spacing.sm },
    resetLabel: { ...t.type.meta, color: t.colors.danger },
  });
