import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Carousel } from '../../src/ui/components/Carousel';
import { TrackRow } from '../../src/ui/components/TrackRow';
import { CarouselSkeleton, ErrorState, EmptyState } from '../../src/ui/components/states';
import { useTheme, useThemedStyles, type Theme } from '../../src/ui/theme';
import { useLibrary } from '../../src/features/useLibrary';
import { useRecents } from '../../src/local/recents';
import { usePlayback } from '../../src/player/usePlayback';
import { prefetchStreamUrl } from '../../src/player/streamUrls';
import type { Track } from '../../src/api/types';

const NEWEST_COUNT = 10;
const QUICK_PICKS_START = 10;

/**
 * Главная. Композиция каруселей поверх одной ленты медиатеки — вся логика
 * загрузки живёт в useLibrary(), страница только раскладывает.
 */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { tracks, isDemo, isLoading, error, refetch, isRefetching } = useLibrary();
  const recents = useRecents();

  // Прогрев ссылки на самое вероятное первое нажатие.
  //
  // Извлечение ссылки на трек с ютуба занимает около секунды, и первое
  // нажатие ждёт её целиком: очередь ещё не начата, упреждающая загрузка
  // не сработала. После прогрева запуск ощущается мгновенным.
  useEffect(() => {
    if (recents[0]) prefetchStreamUrl(recents[0]);
  }, [recents]);
  const { play } = usePlayback();

  const handlePlay = useCallback(
    (list: readonly Track[], index: number) => play(list, index),
    [play],
  );

  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  const handleRowPress = useCallback((index: number) => play(tracksRef.current, index), [play]);

  /**
   * Секция называется «Новое», а не «Рекомендуем»: сортировка на бэкенде —
   * по дате добавления, никакой рекомендательной логики за этим нет.
   * Врать в подписи не хочется.
   */
  const newest = useMemo(() => tracks.slice(0, NEWEST_COUNT), [tracks]);
  const quickPicks = useMemo(
    () => tracks.slice(QUICK_PICKS_START, QUICK_PICKS_START + NEWEST_COUNT),
    [tracks],
  );

  if (error && tracks.length === 0) {
    return (
      <ScrollView contentContainerStyle={{ paddingTop: insets.top }}>
        <ErrorState message={error.message} onRetry={() => void refetch()} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.md }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={theme.colors.text}
          colors={[theme.colors.text]}
          progressBackgroundColor={theme.colors.surface}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.brand}>
          <Text style={styles.brandMark}>▶</Text> Music
        </Text>
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={12}
          style={styles.settings}
          android_ripple={{ color: 'rgba(128,128,128,0.2)', borderless: true, radius: 22 }}
        >
          <MaterialIcons name="palette" size={22} color={theme.colors.textDim} />
        </Pressable>
      </View>

      {isDemo ? <DemoBanner /> : null}

      {isLoading ? (
        <View style={styles.loading}>
          <CarouselSkeleton />
          <CarouselSkeleton />
        </View>
      ) : tracks.length === 0 ? (
        <EmptyState
          title="Пока пусто"
          hint="Найдите трек на вкладке «Обзор» — его можно слушать сразу, не добавляя в медиатеку."
        />
      ) : (
        <>
          {recents.length > 0 ? (
            <Carousel title="Слушать снова" tracks={recents} onPressTrack={handlePlay} />
          ) : null}

          {newest.length > 0 ? (
            <Carousel title="Новое" tracks={newest} onPressTrack={handlePlay} />
          ) : null}

          {quickPicks.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Быстрый выбор</Text>
              {/* Индекс считаем арифметикой, а не indexOf: quickPicks —
                  это срез tracks с 10-го, и поиск по всей медиатеке
                  на каждую из десяти строк был чистой тратой. */}
              {quickPicks.map((track, offset) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={QUICK_PICKS_START + offset}
                  onPress={handleRowPress}
                />
              ))}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

/** Честно сообщаем, что играет демо-набор, а не медиатека пользователя. */
function DemoBanner() {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerTitle}>Демо-режим</Text>
      <Text style={styles.bannerHint}>
        Сервер недоступен — показаны демо-треки. Запустите бэкенд и потяните экран вниз.
      </Text>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    content: { paddingBottom: t.spacing.xxl, gap: t.spacing.xl },
    header: {
      paddingHorizontal: t.layout.screenPadding,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    brand: { ...t.type.title, color: t.colors.text, letterSpacing: -0.5 },
    brandMark: { color: t.colors.brand },
    settings: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    loading: { gap: t.spacing.xl },
    section: { gap: t.spacing.sm },
    sectionTitle: { ...t.type.section, color: t.colors.text, paddingHorizontal: t.layout.screenPadding },
    banner: {
      marginHorizontal: t.layout.screenPadding,
      padding: t.spacing.md,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      borderLeftWidth: 3,
      borderLeftColor: t.colors.brand,
      gap: 4,
    },
    bannerTitle: { ...t.type.label, color: t.colors.text },
    bannerHint: { ...t.type.meta, color: t.colors.textDim, lineHeight: 17 },
  });
