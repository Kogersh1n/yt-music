import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Thumb } from '../src/ui/components/Thumb';
import { EmptyState } from '../src/ui/components/states';
import { MiniPlayer } from '../src/ui/components/MiniPlayer';
import { NowPlayingMark } from '../src/ui/components/NowPlayingMark';
import { TrackTitle } from '../src/ui/components/TrackTitle';
import { useTheme, useThemedStyles, type Theme } from '../src/ui/theme';
import { useQueue } from '../src/player/queueStore';
import type { Track } from '../src/api/types';

/**
 * Очередь воспроизведения. Показывает логическую очередь целиком — она живёт
 * в сторе, а не в движке, поэтому виден весь список, а не только заряженные
 * вперёд треки.
 *
 * Разделена на «Сейчас играет» и «Далее». Раньше заголовок экрана обещал
 * «Далее», а первой строкой шёл текущий трек — то есть подпись врала.
 * Плюс так у списка появляется структура: видно, где граница между тем,
 * что уже играет, и тем, что ждёт.
 */
export default function QueueScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  const queue = useQueue((state) => state.queue);
  const index = useQueue((state) => state.index);
  const jumpTo = useQueue((state) => state.jumpTo);
  const removeFromQueue = useQueue((state) => state.removeFromQueue);
  const moveInQueue = useQueue((state) => state.moveInQueue);

  /**
   * Список с заголовками секций.
   *
   * FlashList принимает плоский массив, поэтому заголовки едут в нём же
   * отдельным типом элемента — так список остаётся переиспользуемым
   * и не превращается в ScrollView.
   */
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (queue[index]) {
      out.push({ kind: 'header', label: 'Сейчас играет' });
      out.push({ kind: 'track', track: queue[index], position: index });
    }

    const upcoming = queue
      .map((track, position) => ({ track, position }))
      .filter((item) => item.position !== index);

    if (upcoming.length > 0) {
      out.push({ kind: 'header', label: 'Далее' });
      for (const item of upcoming) out.push({ kind: 'track', ...item });
    }
    return out;
  }, [queue, index]);

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      if (item.kind === 'header') return <SectionHeader label={item.label} />;
      const position = item.position;
      return (
        <QueueRow
          track={item.track}
          isActive={position === index}
          onPlay={() => void jumpTo(position)}
          onRemove={() => removeFromQueue(position)}
          onMoveUp={position > 0 ? () => moveInQueue(position, position - 1) : undefined}
        />
      );
    },
    [index, jumpTo, removeFromQueue, moveInQueue],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + theme.spacing.sm }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerButton}>
          <MaterialIcons name="keyboard-arrow-down" size={28} color={theme.colors.text} />
        </Pressable>
        {/* «Очередь», а не «Далее»: секция с таким названием теперь
            внутри списка, и два одинаковых заголовка подряд путали. */}
        <Text style={styles.headerTitle}>Очередь</Text>
        <View style={styles.headerButton} />
      </View>

      {queue.length === 0 ? (
        <EmptyState title="Очередь пуста" hint="Запустите любой трек — он появится здесь." />
      ) : (
        <FlashList
          data={rows}
          renderItem={renderItem}
          keyExtractor={(item, i) =>
            item.kind === 'header' ? `h:${item.label}` : `${item.track.id}:${i}`
          }
          contentContainerStyle={styles.list}
        />
      )}

      {/* Управление не исчезает: очередь — ровно тот экран, где смотришь
          на одно, а слушаешь другое, и уходить назад ради паузы глупо. */}
      <MiniPlayer standalone />
    </View>
  );
}

type Row =
  | { kind: 'header'; label: string }
  | { kind: 'track'; track: Track; position: number };

function SectionHeader({ label }: { label: string }) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={styles.section}>{label}</Text>;
}

function QueueRow({
  track,
  isActive,
  onPlay,
  onRemove,
  onMoveUp,
}: {
  track: Track;
  isActive: boolean;
  onPlay: () => void;
  onRemove: () => void;
  onMoveUp?: () => void;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Pressable
      onPress={onPlay}
      style={styles.row}
      android_ripple={{ color: 'rgba(128,128,128,0.16)' }}
    >
      <Thumb track={track} size={40} />

      {/* Форма, а не только цвет: красным в теме покрашено и «играет»,
          и «удалить», а на беглый взгляд цвет вообще теряется. */}
      {isActive ? <NowPlayingMark /> : null}

      <View style={styles.text}>
        <TrackTitle
          title={track.title}
          style={[styles.title, isActive && styles.activeTitle]}
        />
        <Text numberOfLines={1} style={styles.meta}>
          {track.author}
        </Text>
      </View>

      {onMoveUp ? (
        <Pressable onPress={onMoveUp} hitSlop={10} style={styles.action}>
          <MaterialIcons name="arrow-upward" size={18} color={theme.colors.textDim} />
        </Pressable>
      ) : null}

      {/* Играющий трек убрать нельзя — иначе пришлось бы обрывать звук. */}
      {!isActive ? (
        <Pressable onPress={onRemove} hitSlop={10} style={styles.action}>
          <MaterialIcons name="close" size={18} color={theme.colors.textDim} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    section: {
      ...t.type.meta,
      color: t.colors.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 1,
      paddingHorizontal: t.layout.screenPadding,
      paddingTop: t.spacing.lg,
      paddingBottom: t.spacing.xs,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: t.spacing.lg,
      paddingBottom: t.spacing.sm,
    },
    headerButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { ...t.type.label, fontSize: 15, color: t.colors.text },
    list: { paddingBottom: t.spacing.xxl },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.sm,
    },
    text: { flex: 1, gap: 1 },
    title: { ...t.type.trackTitle, color: t.colors.text },
    meta: { ...t.type.meta, color: t.colors.textDim },
    activeTitle: { color: t.colors.brand },
    action: { width: 32, alignItems: 'center' },
  });
