import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { MiniPlayer } from '../src/ui/components/MiniPlayer';
import { TrackTitle } from '../src/ui/components/TrackTitle';
import { EmptyState } from '../src/ui/components/states';
import { plural, useTheme, useThemedStyles, type Theme } from '../src/ui/theme';
import { formatListening } from '../src/local/stats';
import { usePlayEvents } from '../src/local/plays';
import { computeRecap } from '../src/features/recap';
import { displayArtist } from '../src/api/songText';

/**
 * Прослушивание — всё про то, что и сколько слушали, на одном экране.
 *
 * Раньше это жило в профиле, между темами и управлением памятью. Профиль
 * от этого читался как свалка: настройки внешнего вида, гигабайты кэша и
 * любимые исполнители — три совершенно разных разговора подряд.
 *
 * Сюда же сходятся оба взгляда на те же данные: итоги по месяцам и лента
 * по дням. Искать их в разных углах приложения было незачем.
 */

/** Сколько строк показываем в каждом списке. Дальше — экраны итогов и истории. */
const TOP_LIMIT = 5;

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();

  const events = usePlayEvents();

  /**
   * Итоги за всё время.
   *
   * Тот же расчёт, что и у месячного рекапа, — просто на всём журнале:
   * границы периода задаются параметрами, поэтому отдельной функции
   * не нужно.
   */
  const allTime = useMemo(() => computeRecap(events, 0, Date.now(), [], TOP_LIMIT), [events]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Прослушивание</Text>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.content, { paddingBottom: theme.spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {allTime.totalPlays === 0 ? (
          <EmptyState
            title="Пока нечего показать"
            hint="Включите что-нибудь — здесь появятся цифры, любимые исполнители и вся история."
          />
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.stats}>
                <Stat value={formatListening(allTime.totalSeconds)} label="прослушано" />
                <Stat value={String(allTime.totalPlays)} label="запусков" />
                <Stat value={String(allTime.uniqueTracks)} label="разных треков" />
                <Stat value={String(allTime.uniqueArtists)} label="исполнителей" />
              </View>
            </View>

            {allTime.topArtists.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.subheading}>Чаще всего</Text>
                {allTime.topArtists.map((artist, index) => (
                  <View key={artist.author} style={styles.rank}>
                    <Text style={styles.rankNumber}>{index + 1}</Text>
                    {/* Буква в подложке, обложка поверх: у части роликов
                        hq720 отсутствует, и без этого оставался чёрный круг. */}
                    <View style={[styles.avatar, styles.avatarEmpty]}>
                      <Text style={styles.avatarLetter}>
                        {displayArtist(artist.author).slice(0, 1).toUpperCase()}
                      </Text>
                      {artist.youtubeId ? (
                        <Image
                          source={{ uri: `https://i.ytimg.com/vi/${artist.youtubeId}/hq720.jpg` }}
                          style={[StyleSheet.absoluteFill, styles.avatar]}
                          cachePolicy="memory-disk"
                          contentFit="cover"
                          transition={theme.motion.scale === 0 ? 0 : 150}
                        />
                      ) : null}
                    </View>
                    <Text numberOfLines={1} style={styles.rankName}>
                      {displayArtist(artist.author)}
                    </Text>
                    <Text style={styles.rankValue}>{formatListening(artist.seconds)}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {allTime.topTracks.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.subheading}>Любимые треки</Text>
                {allTime.topTracks.map((track, index) => (
                  <View key={track.trackId} style={styles.rank}>
                    <Text style={styles.rankNumber}>{index + 1}</Text>
                    <View style={styles.rankText}>
                      <TrackTitle title={track.title} style={styles.rankName} />
                      <Text numberOfLines={1} style={styles.rankSub}>
                        {displayArtist(track.author)}
                      </Text>
                    </View>
                    <Text style={styles.rankValue}>
                      {track.plays} {plural(track.plays, 'раз', 'раза', 'раз')}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}

        <Link
          icon="history"
          title="История прослушивания"
          hint="По дням, и на чём строятся подсказки"
          onPress={() => router.push('/history')}
        />

        <Link
          icon="insights"
          title="Итоги месяца"
          hint="То же самое, но по месяцам"
          onPress={() => router.push('/recap')}
        />
      </ScrollView>

      <MiniPlayer standalone />
    </View>
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

function Link({
  icon,
  title,
  hint,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  title: string;
  hint: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable style={styles.link} onPress={onPress} android_ripple={{ color: 'rgba(128,128,128,0.14)' }}>
      <MaterialIcons name={icon} size={22} color={theme.colors.text} />
      <View style={styles.linkText}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.linkHint}>{hint}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={theme.colors.textFaint} />
    </Pressable>
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

    body: { flex: 1 },
    content: { gap: t.spacing.md, paddingHorizontal: t.layout.screenPadding },

    card: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      padding: t.spacing.md,
      gap: t.spacing.sm,
    },
    stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: t.spacing.md },
    stat: { width: '50%', gap: 2 },
    statValue: { ...t.type.section, color: t.colors.text },
    statLabel: { ...t.type.meta, color: t.colors.textDim },

    subheading: { ...t.type.label, color: t.colors.textDim },
    rank: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
    rankNumber: {
      ...t.type.meta,
      color: t.colors.textFaint,
      width: 16,
      fontVariant: ['tabular-nums'],
    },
    avatar: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden' },
    avatarEmpty: {
      backgroundColor: t.colors.surfaceHigh,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarLetter: { ...t.type.meta, color: t.colors.textDim, fontWeight: '600' },

    rankText: { flex: 1, gap: 1 },
    rankName: { ...t.type.body, color: t.colors.text, flex: 1 },
    rankSub: { ...t.type.meta, color: t.colors.textDim },
    rankValue: { ...t.type.meta, color: t.colors.textDim, flexShrink: 0 },

    link: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      padding: t.spacing.md,
    },
    linkText: { flex: 1, gap: 1 },
    linkTitle: { ...t.type.body, color: t.colors.text },
    linkHint: { ...t.type.meta, color: t.colors.textDim },
  });
