import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gradient } from '../src/ui/components/Gradient';
import { EmptyState } from '../src/ui/components/states';
import { artworkGradient } from '../src/ui/artworkColor';
import { peekDominantColor, resolveDominantColor } from '../src/ui/dominantColor';
import { useTheme, useThemedStyles, type Theme } from '../src/ui/theme';
import { useCurrentTrack } from '../src/player/queueStore';
import { useLyrics } from '../src/features/useMusicMeta';

/**
 * Текст песни.
 *
 * Отдельный экран, а не панель поверх плеера: текст читают, а чтение хочет
 * всю высоту и прокрутку, не конфликтующую с жестами плеера.
 *
 * Фон тот же градиент, что и у плеера, и выводится из той же обложки —
 * переход между экранами не должен выглядеть сменой приложения.
 */
export default function LyricsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const track = useCurrentTrack();

  const lyrics = useLyrics(track, true);

  // Тот же приём, что в плеере: сразу берём известный цвет, чтобы фон
  // не мигал, и уточняем его, когда обложка разобрана.
  const [dominant, setDominant] = useState<string | null>(() =>
    peekDominantColor(track?.artwork ?? null),
  );

  useEffect(() => {
    let cancelled = false;
    const uri = track?.artwork ?? null;
    setDominant(peekDominantColor(uri));
    void resolveDominantColor(uri).then((color) => {
      if (!cancelled) setDominant(color);
    });
    return () => {
      cancelled = true;
    };
  }, [track?.artwork]);

  const seed = track ? track.id + track.title : 'empty';
  const gradient = useMemo(
    () => artworkGradient(seed, theme.mode, theme.colors.bg, dominant),
    [seed, theme.mode, theme.colors.bg, dominant],
  );

  // Строки нумеруем заранее: пустые строки между куплетами нужны как
  // отступы, но не как элементы с ключами по индексу содержимого.
  const lines = useMemo(() => (lyrics.text ?? '').split('\n'), [lyrics.text]);

  if (!track) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Ничего не играет" hint="Текст показывается для текущего трека." />
      </View>
    );
  }

  return (
    <Gradient colors={gradient} locations={GRADIENT_STOPS} style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerButton}>
          <MaterialIcons name="keyboard-arrow-down" size={28} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={styles.headerTitle}>
            {track.title}
          </Text>
          <Text numberOfLines={1} style={styles.headerAuthor}>
            {track.author}
          </Text>
        </View>
        <View style={styles.headerButton} />
      </View>

      <Body
        lyrics={lyrics}
        lines={lines}
        bottomInset={insets.bottom + theme.spacing.xxl}
      />
    </Gradient>
  );
}

function Body({
  lyrics,
  lines,
  bottomInset,
}: {
  lyrics: ReturnType<typeof useLyrics>;
  lines: string[];
  bottomInset: number;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (lyrics.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.text} />
        <Text style={styles.hint}>Ищем текст…</Text>
      </View>
    );
  }

  if (lyrics.error) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>Не удалось загрузить текст</Text>
        <Text style={styles.hintDim}>{lyrics.error.message}</Text>
      </View>
    );
  }

  if (lyrics.isAbsent || !lyrics.text) {
    return (
      <View style={styles.center}>
        <Text style={styles.absentMark}>♪</Text>
        <Text style={styles.hint}>Для этого трека текста нет</Text>
        <Text style={styles.hintDim}>
          У клипов и любительских загрузок он обычно отсутствует.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      showsVerticalScrollIndicator={false}
    >
      {lines.map((line, index) => (
        <Text
          key={index}
          style={line.trim() === '' ? styles.blank : styles.line}
          selectable
        >
          {line}
        </Text>
      ))}

      {/* Источник показываем обязательно: текст лицензирован, и условие
          его показа — указание правообладателя. */}
      {lyrics.source ? <Text style={styles.source}>{lyrics.source}</Text> : null}
    </ScrollView>
  );
}

/** Как у плеера: цвет держится сверху, ниже уходит в фон темы. */
const GRADIENT_STOPS = [0, 0.55, 1] as const;

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.lg,
      paddingBottom: t.spacing.md,
    },
    headerButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerText: { flex: 1, alignItems: 'center' },
    headerTitle: { ...t.type.body, fontWeight: '600', color: t.colors.text },
    headerAuthor: { ...t.type.meta, color: t.colors.textDim },

    scroll: { flex: 1 },
    // Отступ сверху: без него первая строка липла к заголовку.
    content: { paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.lg, gap: 2 },
    // Текст крупнее обычного: его читают с расстояния вытянутой руки,
    // часто не глядя пристально.
    line: {
      ...t.type.body,
      fontSize: t.type.body.fontSize + 3,
      lineHeight: (t.type.body.fontSize + 3) * 1.5,
      color: t.colors.text,
    },
    blank: { height: t.spacing.md },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.sm, padding: t.spacing.xl },
    absentMark: { fontSize: 40, color: t.colors.textFaint },
    hint: { ...t.type.body, color: t.colors.textDim, textAlign: 'center' },
    hintDim: { ...t.type.meta, color: t.colors.textFaint, textAlign: 'center' },

    source: {
      ...t.type.meta,
      color: t.colors.textFaint,
      marginTop: t.spacing.xl,
      textAlign: 'center',
    },
  });
