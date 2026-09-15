import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Chip } from '../src/ui/components/Chip';
import { EmptyState } from '../src/ui/components/states';
import { MiniPlayer } from '../src/ui/components/MiniPlayer';
import { TrackTitle } from '../src/ui/components/TrackTitle';
import { useTheme, useThemedStyles, type Theme } from '../src/ui/theme';
import { usePlayEvents, type PlayEvent } from '../src/local/plays';
import { useTaste } from '../src/features/recommend';
import { formatListening } from '../src/local/stats';
import { plural } from '../src/ui/plural';
import { displayArtist } from '../src/api/songText';
import { usePlayback } from '../src/player/usePlayback';
import type { Track } from '../src/api/types';

/**
 * История прослушивания.
 *
 * Два разных вопроса на одном экране, и оба задаёт один и тот же человек:
 *
 *   «Что это была за песня вчера вечером?» — на него отвечает лента,
 *   разложенная по дням, в обратном порядке.
 *
 *   «Почему мне советуют именно это?» — на него отвечает разбор вкуса
 *   сверху. Рекомендации построены на этой самой истории, и прятать
 *   их основание было бы нечестно: пользователь вправе видеть, что
 *   именно приложение о нём поняло и на каком основании.
 */

type Filter = 'all' | 'completed' | 'skipped';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Всё' },
  { key: 'completed', label: 'Дослушано' },
  { key: 'skipped', label: 'Пропущено' },
];

/** Ниже этой доли трек считается пропущенным — тот же порог, что в профиле вкуса. */
const SKIP_RATIO = 0.3;

function isSkip(event: PlayEvent): boolean {
  if (event.completed) return false;
  const ratio = event.duration > 0 ? event.seconds / event.duration : 0;
  return ratio < SKIP_RATIO;
}

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function dayTitle(timestamp: number): string {
  const today = startOfDay(Date.now());
  const day = startOfDay(timestamp);
  const diff = Math.round((today - day) / (24 * 60 * 60 * 1000));

  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Вчера';

  return new Date(timestamp).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    // Год показываем только у прошлогоднего — иначе он шумит в каждом заголовке.
    year: new Date(timestamp).getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

function clockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Строка ленты: либо заголовок дня, либо событие. */
type Row =
  | { kind: 'day'; at: number; seconds: number; count: number }
  | { kind: 'event'; event: PlayEvent };

function buildRows(events: readonly PlayEvent[], filter: Filter): Row[] {
  const filtered = events.filter((event) => {
    if (filter === 'completed') return event.completed;
    if (filter === 'skipped') return isSkip(event);
    return true;
  });

  // Журнал копится по возрастанию времени, а читают историю с конца.
  const ordered = [...filtered].sort((a, b) => b.startedAt - a.startedAt);

  const rows: Row[] = [];
  let currentDay: number | null = null;
  let header: Extract<Row, { kind: 'day' }> | null = null;

  for (const event of ordered) {
    const day = startOfDay(event.startedAt);

    if (day !== currentDay) {
      currentDay = day;
      header = { kind: 'day', at: day, seconds: 0, count: 0 };
      rows.push(header);
    }

    // Итог дня набирается по ходу — второй проход по тем же событиям
    // не нужен, а заголовок уже лежит в массиве и правится по ссылке.
    if (header) {
      header.seconds += event.seconds;
      header.count += 1;
    }

    rows.push({ kind: 'event', event });
  }

  return rows;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();

  const events = usePlayEvents();
  const taste = useTaste();
  const { play } = usePlayback();

  const [filter, setFilter] = useState<Filter>('all');
  const [tasteOpen, setTasteOpen] = useState(false);

  const rows = useMemo(() => buildRows(events, filter), [events, filter]);

  const handlePress = useCallback(
    (event: PlayEvent) => {
      if (!event.youtubeId) return;
      const track: Track = {
        id: `yt:${event.youtubeId}`,
        title: event.title,
        author: event.author,
        duration: event.duration,
        artwork: `https://i.ytimg.com/vi/${event.youtubeId}/hq720.jpg`,
        source: 'youtube',
        youtubeId: event.youtubeId,
      };
      play([track], 0);
    },
    [play],
  );

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      if (item.kind === 'day') {
        return (
          <View style={styles.dayHeader}>
            <Text style={styles.dayTitle}>{dayTitle(item.at)}</Text>
            <Text style={styles.dayMeta}>
              {item.count} {plural(item.count, 'трек', 'трека', 'треков')} ·{' '}
              {formatListening(item.seconds)}
            </Text>
          </View>
        );
      }
      return <HistoryRow event={item.event} onPress={handlePress} />;
    },
    [handlePress, styles],
  );

  const keyExtractor = useCallback(
    (item: Row, index: number) =>
      item.kind === 'day' ? `d${item.at}` : `e${item.event.startedAt}-${index}`,
    [],
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>История</Text>
      </View>

      {events.length === 0 ? (
        <EmptyState
          title="История пуста"
          hint="Включите что-нибудь — здесь появится всё, что вы слушали, по дням."
        />
      ) : (
        <>
          <TasteCard open={tasteOpen} onToggle={() => setTasteOpen((v) => !v)} taste={taste} />

          <View style={styles.filters}>
            {FILTERS.map((item) => (
              <Chip
                key={item.key}
                label={item.label}
                active={filter === item.key}
                onPress={() => setFilter(item.key)}
              />
            ))}
          </View>

          <FlashList
            data={rows}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <EmptyState
                title="Ничего не нашлось"
                hint={
                  filter === 'skipped'
                    ? 'Вы пока ничего не пропускали.'
                    : 'Дослушанных треков пока нет.'
                }
              />
            }
          />
        </>
      )}

      <MiniPlayer standalone />
    </View>
  );
}

/**
 * Одно событие. Пропущенный трек помечен явно: это не брак данных,
 * а самый сильный сигнал вкуса, и видеть его полезно.
 */
function HistoryRow({
  event,
  onPress,
}: {
  event: PlayEvent;
  onPress: (event: PlayEvent) => void;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const skipped = isSkip(event);

  return (
    <Pressable
      style={styles.row}
      onPress={() => onPress(event)}
      android_ripple={{ color: 'rgba(128,128,128,0.14)' }}
    >
      <Text style={styles.time}>{clockTime(event.startedAt)}</Text>

      <View style={styles.rowText}>
        <TrackTitle title={event.title} style={styles.rowTitle} />
        <Text numberOfLines={1} style={styles.rowAuthor}>
          {event.author}
        </Text>
      </View>

      <View style={styles.rowRight}>
        <Text style={skipped ? styles.skipMark : styles.playedMark}>
          {formatListening(event.seconds)}
        </Text>
        <MaterialIcons
          name={event.completed ? 'check-circle' : skipped ? 'skip-next' : 'radio-button-unchecked'}
          size={15}
          color={
            event.completed
              ? theme.colors.brand
              : skipped
                ? theme.colors.textFaint
                : theme.colors.textDim
          }
        />
      </View>
    </Pressable>
  );
}

/**
 * Разбор вкуса — то, на чём построены подсказки.
 *
 * Свёрнут по умолчанию: большинству нужна лента, а не объяснение. Но если
 * подсказки кажутся странными, причина должна быть в одном нажатии, а не
 * в догадках.
 */
function TasteCard({
  open,
  onToggle,
  taste,
}: {
  open: boolean;
  onToggle: () => void;
  taste: ReturnType<typeof useTaste>;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  const liked = taste.artists.filter((artist) => artist.score > 0).slice(0, 5);
  const disliked = taste.artists.filter((artist) => artist.score < 0).slice(-3).reverse();

  return (
    <View style={styles.tasteCard}>
      <Pressable style={styles.tasteHead} onPress={onToggle} hitSlop={8}>
        <MaterialIcons name="auto-awesome" size={18} color={theme.colors.brand} />
        <Text style={styles.tasteTitle}>На чём строятся подсказки</Text>
        <MaterialIcons
          name={open ? 'expand-less' : 'expand-more'}
          size={20}
          color={theme.colors.textFaint}
        />
      </Pressable>

      {open ? (
        <View style={styles.tasteBody}>
          <Text style={styles.tasteHint}>
            Считается на устройстве по {taste.sampleSize}{' '}
            {plural(taste.sampleSize, 'прослушиванию', 'прослушиваниям', 'прослушиваниям')}.
            Дослушанный трек — плюс, пропущенный — минус, лайк — самый весомый плюс.
            Чем старше событие, тем меньше вес: за месяц он падает вдвое.
          </Text>

          {liked.length > 0 ? (
            <>
              <Text style={styles.tasteLabel}>Нравится</Text>
              {liked.map((artist) => (
                <View key={artist.author} style={styles.tasteRow}>
                  <Text numberOfLines={1} style={styles.tasteName}>
                    {displayArtist(artist.author)}
                  </Text>
                  <Meter value={artist.score} max={liked[0].score} />
                </View>
              ))}
            </>
          ) : null}

          {disliked.length > 0 ? (
            <>
              <Text style={styles.tasteLabel}>Пропускаете</Text>
              {disliked.map((artist) => (
                <View key={artist.author} style={styles.tasteRow}>
                  <Text numberOfLines={1} style={[styles.tasteName, styles.tasteNameDim]}>
                    {displayArtist(artist.author)}
                  </Text>
                  {/* Один пропуск ещё не приговор — исключаем только тех,
                      кого пропускают устойчиво. Подписываем, чтобы список
                      не обещал больше, чем делает. */}
                  <Text style={taste.avoided.has(artist.author) ? styles.tasteOut : styles.tasteSkips}>
                    {taste.avoided.has(artist.author)
                      ? 'не предлагаем'
                      : `${artist.skips} ${plural(artist.skips, 'пропуск', 'пропуска', 'пропусков')}`}
                  </Text>
                </View>
              ))}
            </>
          ) : null}

          {taste.seeds.length > 0 ? (
            <Text style={styles.tasteFoot}>
              Радио строится от {taste.seeds.length}{' '}
              {plural(taste.seeds.length, 'трека', 'треков', 'треков')} — по одному на
              исполнителя, чтобы подсказки не схлопнулись в одного артиста.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Полоска доли — нагляднее числа, которое всё равно ни с чем не сравнить. */
function Meter({ value, max }: { value: number; max: number }) {
  const styles = useThemedStyles(makeStyles);
  const ratio = max > 0 ? Math.max(0.06, Math.min(value / max, 1)) : 0;

  return (
    <View style={styles.meterTrack}>
      <View style={[styles.meterFill, { width: `${ratio * 100}%` }]} />
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingHorizontal: t.layout.screenPadding,
      paddingBottom: t.spacing.sm,
    },
    back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { ...t.type.section, color: t.colors.text },

    filters: {
      flexDirection: 'row',
      gap: t.spacing.sm,
      paddingHorizontal: t.layout.screenPadding,
      paddingBottom: t.spacing.sm,
    },
    list: { paddingBottom: t.spacing.xxl },

    dayHeader: {
      paddingHorizontal: t.layout.screenPadding,
      paddingTop: t.spacing.lg,
      paddingBottom: t.spacing.xs,
      gap: 1,
    },
    dayTitle: { ...t.type.label, color: t.colors.text },
    dayMeta: { ...t.type.meta, color: t.colors.textFaint },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.sm,
    },
    time: {
      ...t.type.meta,
      color: t.colors.textFaint,
      width: 42,
      fontVariant: ['tabular-nums'],
    },
    rowText: { flex: 1, gap: 1 },
    rowTitle: { ...t.type.trackTitle, color: t.colors.text },
    rowAuthor: { ...t.type.meta, color: t.colors.textDim },
    rowRight: { alignItems: 'flex-end', gap: 2 },
    playedMark: { ...t.type.meta, color: t.colors.textDim },
    skipMark: { ...t.type.meta, color: t.colors.textFaint },

    tasteCard: {
      marginHorizontal: t.layout.screenPadding,
      marginBottom: t.spacing.md,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      overflow: 'hidden',
    },
    tasteHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      padding: t.spacing.md,
    },
    tasteTitle: { ...t.type.label, color: t.colors.text, flex: 1 },
    tasteBody: {
      paddingHorizontal: t.spacing.md,
      paddingBottom: t.spacing.md,
      gap: t.spacing.xs,
    },
    tasteHint: { ...t.type.meta, color: t.colors.textDim, lineHeight: 18 },
    tasteLabel: {
      ...t.type.meta,
      color: t.colors.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: t.spacing.sm,
    },
    tasteRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    tasteName: { ...t.type.meta, color: t.colors.text, flex: 1 },
    tasteNameDim: { color: t.colors.textDim },
    tasteSkips: { ...t.type.meta, color: t.colors.textFaint },
    tasteOut: { ...t.type.meta, color: t.colors.brand },
    tasteFoot: {
      ...t.type.meta,
      color: t.colors.textFaint,
      lineHeight: 17,
      marginTop: t.spacing.sm,
    },

    meterTrack: {
      width: 92,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.border,
      overflow: 'hidden',
    },
    meterFill: { height: 4, borderRadius: 2, backgroundColor: t.colors.brand },
  });
