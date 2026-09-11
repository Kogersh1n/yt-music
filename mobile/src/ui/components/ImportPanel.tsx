import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme, useThemedStyles, type Theme } from '../theme';
import {
  clearFinished,
  dismissAll,
  retryFailed,
  useImportQueue,
  type QueueItem,
} from '../../features/importQueue';
import { plural } from '../plural';

/**
 * Что сейчас качается.
 *
 * Раньше на месте этого была полоска с одной строкой текста: «Качаем трек
 * на телефон…». Она годилась, пока трек добавлялся по одному, и перестала
 * годиться сразу, как появилась очередь: из неё не видно ни сколько
 * осталось, ни что уже добавилось, ни что сорвалось.
 *
 * Панель показывает очередь целиком и не закрывается сама: если что-то
 * не добавилось, это надо увидеть, а не обнаружить через неделю
 * по отсутствию трека.
 */

const STAGE_LABEL: Record<NonNullable<QueueItem['stage']>, string> = {
  extract: 'ищем дорожку',
  download: 'качаем',
  upload: 'загружаем',
  save: 'сохраняем',
};

export const ImportPanel = memo(function ImportPanel() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const queue = useImportQueue();

  if (queue.length === 0) return null;

  const done = queue.filter((i) => i.state === 'done').length;
  const failed = queue.filter((i) => i.state === 'failed').length;
  const left = queue.filter((i) => i.state === 'waiting' || i.state === 'active').length;
  const finished = left === 0;

  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <MaterialIcons
          name={finished ? (failed > 0 ? 'error-outline' : 'check-circle') : 'downloading'}
          size={18}
          color={finished && failed > 0 ? theme.colors.danger : theme.colors.text}
        />
        <Text style={styles.title}>
          {finished
            ? failed > 0
              ? `Добавлено ${done}, не вышло ${failed}`
              : `Добавлено ${done} ${plural(done, 'трек', 'трека', 'треков')}`
            : `Добавляем: осталось ${left}`}
        </Text>

        <Pressable
          onPress={finished ? (failed > 0 ? retryFailed : clearFinished) : dismissAll}
          hitSlop={10}
        >
          <Text style={styles.action}>
            {finished ? (failed > 0 ? 'Повторить' : 'Скрыть') : 'Отменить'}
          </Text>
        </Pressable>
      </View>

      {/* Полоса общего прогресса: по числу треков, а не по байтам.
          Байты знает только активный, и полоса от них дёргалась бы
          назад на каждом переходе к следующему. */}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${(done / queue.length) * 100}%` }]} />
      </View>

      <ScrollView style={styles.list} nestedScrollEnabled>
        {queue.map((item) => (
          <View key={item.key} style={styles.row}>
            <Mark state={item.state} />
            <View style={styles.text}>
              <Text numberOfLines={1} style={styles.name}>
                {item.track.title}
              </Text>
              {item.state === 'active' && item.stage ? (
                <Text style={styles.stage}>{STAGE_LABEL[item.stage]}</Text>
              ) : item.state === 'failed' ? (
                <Text numberOfLines={2} style={styles.failed}>
                  {item.error}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

function Mark({ state }: { state: QueueItem['state'] }) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (state === 'done') {
    return <MaterialIcons name="check" size={16} color={theme.colors.brand} />;
  }
  if (state === 'failed') {
    return <MaterialIcons name="close" size={16} color={theme.colors.danger} />;
  }
  if (state === 'active') {
    return <MaterialIcons name="arrow-downward" size={16} color={theme.colors.text} />;
  }
  return <View style={styles.waiting} />;
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    panel: {
      marginHorizontal: t.layout.screenPadding,
      marginBottom: t.spacing.sm,
      padding: t.spacing.md,
      borderRadius: t.radius.card,
      backgroundColor: t.colors.surface,
      gap: t.spacing.sm,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    title: { ...t.type.body, color: t.colors.text, flex: 1 },
    action: { ...t.type.meta, color: t.colors.brand },

    track: { height: 3, borderRadius: 2, backgroundColor: t.colors.border, overflow: 'hidden' },
    fill: { height: 3, backgroundColor: t.colors.brand },

    // Потолок высоты: очередь может быть длинной, а панель не должна
    // вытеснять сам список результатов.
    list: { maxHeight: 132 },
    row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, paddingVertical: 5 },
    text: { flex: 1 },
    name: { ...t.type.meta, color: t.colors.textDim },
    stage: { ...t.type.meta, color: t.colors.textFaint, fontSize: 11 },
    failed: { ...t.type.meta, color: t.colors.danger, fontSize: 11 },
    waiting: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginHorizontal: 5,
      backgroundColor: t.colors.textFaint,
    },
  });
