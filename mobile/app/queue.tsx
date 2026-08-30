import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Thumb } from '../src/ui/components/Thumb';
import { EmptyState } from '../src/ui/components/states';
import { useTheme, useThemedStyles, type Theme } from '../src/ui/theme';
import { useQueue } from '../src/player/queueStore';
import type { Track } from '../src/api/types';

/**
 * Очередь воспроизведения. Показывает логическую очередь целиком — она живёт
 * в сторе, а не в движке, поэтому виден весь список, а не только заряженные
 * вперёд треки.
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

  const renderItem = useCallback(
    ({ item, index: position }: { item: Track; index: number }) => (
      <QueueRow
        track={item}
        position={position}
        isActive={position === index}
        onPlay={() => void jumpTo(position)}
        onRemove={() => removeFromQueue(position)}
        onMoveUp={position > 0 ? () => moveInQueue(position, position - 1) : undefined}
      />
    ),
    [index, jumpTo, removeFromQueue, moveInQueue],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + theme.spacing.sm }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerButton}>
          <MaterialIcons name="keyboard-arrow-down" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Далее</Text>
        <View style={styles.headerButton} />
      </View>

      {queue.length === 0 ? (
        <EmptyState title="Очередь пуста" hint="Запустите любой трек — он появится здесь." />
      ) : (
        <FlashList
          data={queue}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          // Держим играющий трек в поле зрения при открытии экрана.
          initialScrollIndex={Math.max(index - 1, 0)}
        />
      )}
    </View>
  );
}

function QueueRow({
  track,
  isActive,
  onPlay,
  onRemove,
  onMoveUp,
}: {
  track: Track;
  position: number;
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
      <Thumb uri={track.artwork} seed={track.title} size={40} />

      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.title, isActive && styles.activeTitle]}>
          {track.title}
        </Text>
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
