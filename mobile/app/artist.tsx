import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { TrackRow } from '../src/ui/components/TrackRow';
import { MiniPlayer } from '../src/ui/components/MiniPlayer';
import { EmptyState, ErrorState, TrackListSkeleton } from '../src/ui/components/states';
import { useTheme, useThemedStyles, type Theme } from '../src/ui/theme';
import { Image } from 'expo-image';
import { artistTracks, searchArtists } from '../src/api/ytmusic';
import { displayArtist } from '../src/api/songText';
import { usePlayEvents } from '../src/local/plays';
import { formatListening } from '../src/local/stats';
import { plural } from '../src/ui/plural';
import { usePlayback } from '../src/player/usePlayback';
import type { Track } from '../src/api/types';

/**
 * Исполнитель: что вы у него слушали и что у него есть ещё.
 *
 * Два блока намеренно рядом. Сверху — ваша собственная статистика по
 * этому имени, она есть всегда и мгновенно, потому что лежит в журнале
 * прослушиваний. Снизу — песни с YouTube Music, они едут по сети.
 *
 * Экран открывается по имени, а не по идентификатору канала: имя
 * приходит из журнала, где идентификаторов нет и взяться им неоткуда.
 */

const keyExtractor = (item: Track) => item.id;

export default function ArtistScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();

  const artist = (name ?? '').trim();
  const shown = displayArtist(artist);

  const events = usePlayEvents();
  const { play } = usePlayback();

  /** Своя статистика по этому исполнителю — из журнала, без сети. */
  const mine = useMemo(() => {
    let seconds = 0;
    let plays = 0;
    const titles = new Set<string>();

    for (const event of events) {
      if (event.author !== artist) continue;
      seconds += event.seconds;
      plays += 1;
      titles.add(event.title);
    }

    return { seconds, plays, unique: titles.size };
  }, [events, artist]);

  /**
   * Портрет и подпись исполнителя.
   *
   * Отдельным запросом от списка песен: если профиль не найдётся,
   * песни всё равно покажутся, и наоборот. Связывать их одним запросом
   * значило бы терять оба из-за одного.
   */
  const profile = useQuery({
    queryKey: ['artist-profile', artist],
    enabled: artist.length > 0,
    staleTime: 24 * 60 * 60_000,
    retry: 1,
    queryFn: async () => (await searchArtists(artist, 1))[0] ?? null,
  });

  const query = useQuery({
    queryKey: ['artist', artist],
    enabled: artist.length > 0,
    staleTime: 60 * 60_000,
    retry: 1,
    queryFn: () => artistTracks(artist),
  });

  const tracks = query.data ?? [];

  const handlePress = useCallback(
    (index: number) => play(query.data ?? [], index),
    [play, query.data],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Track; index: number }) => (
      <TrackRow track={item} index={index} onPress={handlePress} />
    ),
    [handlePress],
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {shown}
        </Text>
      </View>

      {profile.data ? (
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{shown.slice(0, 1).toUpperCase()}</Text>
            {profile.data.avatar ? (
              <Image
                source={{ uri: profile.data.avatar }}
                style={styles.avatarImage}
                cachePolicy="memory-disk"
                contentFit="cover"
                transition={theme.motion.scale === 0 ? 0 : 150}
              />
            ) : null}
          </View>
          <View style={styles.profileText}>
            <Text numberOfLines={1} style={styles.profileName}>
              {profile.data.name}
            </Text>
            <Text numberOfLines={2} style={styles.profileMeta}>
              {profile.data.subtitle}
            </Text>
          </View>
        </View>
      ) : null}

      {mine.plays > 0 ? (
        <View style={styles.mine}>
          <Text style={styles.mineTitle}>Вы слушали</Text>
          <Text style={styles.mineValue}>
            {formatListening(mine.seconds)} · {mine.plays}{' '}
            {plural(mine.plays, 'запуск', 'запуска', 'запусков')} · {mine.unique}{' '}
            {plural(mine.unique, 'трек', 'трека', 'треков')}
          </Text>
        </View>
      ) : null}

      {/* Обёртка с flex обязательна: в пустом состоянии и на ошибке
          внутри ничего не растягивается, и мини-плеер прилипал сразу
          за текстом — посреди экрана. */}
      <View style={styles.body}>
      {query.isLoading ? (
        <TrackListSkeleton rows={7} />
      ) : query.error ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} />
      ) : tracks.length === 0 ? (
        <EmptyState
          title="Песен не нашлось"
          hint={`YouTube Music ничего не отдал по запросу «${shown}». Так бывает у каналов, которые не заведены как исполнители.`}
        />
      ) : (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.section}>Песни</Text>
            <Pressable onPress={() => play(tracks, 0)} hitSlop={8} style={styles.playAll}>
              <MaterialIcons name="play-arrow" size={18} color={theme.colors.onAccent} />
              <Text style={styles.playAllLabel}>Слушать</Text>
            </Pressable>
          </View>

          <FlashList
            data={tracks as Track[]}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.list}
          />
        </>
      )}
      </View>

      <MiniPlayer standalone />
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    body: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingHorizontal: t.layout.screenPadding,
      paddingBottom: t.spacing.sm,
    },
    back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { ...t.type.section, color: t.colors.text, flex: 1 },

    profile: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingHorizontal: t.layout.screenPadding,
      paddingBottom: t.spacing.md,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: t.colors.surfaceHigh,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: { width: '100%', height: '100%', position: 'absolute' },
    avatarLetter: { ...t.type.section, color: t.colors.textDim },
    profileText: { flex: 1, gap: 2 },
    profileName: { ...t.type.section, color: t.colors.text },
    profileMeta: { ...t.type.meta, color: t.colors.textDim },

    mine: {
      marginHorizontal: t.layout.screenPadding,
      marginBottom: t.spacing.md,
      padding: t.spacing.md,
      borderRadius: t.radius.card,
      backgroundColor: t.colors.surface,
      gap: 2,
    },
    mineTitle: { ...t.type.meta, color: t.colors.textDim },
    mineValue: { ...t.type.body, color: t.colors.text },

    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: t.layout.screenPadding,
      paddingBottom: t.spacing.sm,
    },
    section: { ...t.type.section, color: t.colors.text },
    playAll: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: t.spacing.md,
      paddingVertical: 6,
      borderRadius: t.radius.chip,
      backgroundColor: t.colors.accent,
    },
    playAllLabel: { ...t.type.label, color: t.colors.onAccent },

    list: { paddingBottom: t.spacing.xxl },
  });
