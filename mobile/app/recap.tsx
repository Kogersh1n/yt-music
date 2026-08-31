import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '../src/ui/components/states';
import { useTheme, useThemedStyles, type Theme } from '../src/ui/theme';
import { useMonthlyRecap, type Recap } from '../src/features/recap';
import { formatListening } from '../src/local/stats';
import { tapLight } from '../src/ui/haptics';

/**
 * Итоги месяца.
 *
 * Считается на устройстве из журнала прослушиваний (src/features/recap.ts),
 * поэтому открывается без сети и мгновенно — сервер тут не участвует.
 *
 * Экран только раскладывает готовые цифры: вся арифметика живёт в хуке,
 * и это намеренно — так её можно менять, не трогая вёрстку.
 */

const MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];

/** Насколько далеко назад разрешаем листать. Дальше журнала всё равно нет. */
const MAX_OFFSET = 11;

function monthTitle(from: number): string {
  const d = new Date(from);
  const now = new Date();
  const name = MONTHS[d.getMonth()];
  // Год показываем, только если он не текущий — иначе лишний шум.
  return d.getFullYear() === now.getFullYear() ? name : `${name} ${d.getFullYear()}`;
}

function dayTitle(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getDate()} ${MONTHS[d.getMonth()].replace(/ь$/, 'я').replace(/т$/, 'та')}`;
}

export default function RecapScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();

  const [offset, setOffset] = useState(0);
  const recap = useMonthlyRecap(offset);

  const shift = (delta: number) => {
    const next = offset + delta;
    if (next < 0 || next > MAX_OFFSET) return;
    tapLight();
    setOffset(next);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.md }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconButton}>
          <MaterialIcons name="arrow-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Итоги месяца</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.switcher}>
        <Pressable
          onPress={() => shift(1)}
          hitSlop={12}
          style={styles.iconButton}
          disabled={offset >= MAX_OFFSET}
        >
          <MaterialIcons
            name="chevron-left"
            size={26}
            color={offset >= MAX_OFFSET ? theme.colors.textFaint : theme.colors.text}
          />
        </Pressable>

        <Text style={styles.month}>{monthTitle(recap.from)}</Text>

        <Pressable
          onPress={() => shift(-1)}
          hitSlop={12}
          style={styles.iconButton}
          disabled={offset === 0}
        >
          <MaterialIcons
            name="chevron-right"
            size={26}
            color={offset === 0 ? theme.colors.textFaint : theme.colors.text}
          />
        </Pressable>
      </View>

      {recap.isEmpty ? (
        <EmptyState
          icon="◷"
          title="Пока нечего показать"
          hint={
            offset === 0
              ? 'Итоги появятся, когда наберётся история прослушиваний за этот месяц.'
              : 'В этом месяце вы ещё не слушали музыку через приложение.'
          }
        />
      ) : (
        <RecapBody recap={recap} />
      )}
    </ScrollView>
  );
}

function RecapBody({ recap }: { recap: Recap }) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  // Полоски у исполнителей рисуем относительно лидера, а не от общего
  // времени: доли от суммы у всех получаются мелкими и неразличимыми.
  const leader = recap.topArtists[0]?.seconds ?? 1;

  return (
    <>
      <View style={styles.hero}>
        <Text style={styles.heroValue}>{formatListening(recap.totalSeconds)}</Text>
        <Text style={styles.heroLabel}>прослушано</Text>
      </View>

      <View style={styles.stats}>
        <Stat value={String(recap.totalPlays)} label="запусков" />
        <Stat value={String(recap.uniqueTracks)} label="треков" />
        <Stat value={String(recap.uniqueArtists)} label="исполнителей" />
        <Stat
          value={`${Math.round(recap.completionRate * 100)}%`}
          label="дослушано"
        />
      </View>

      {recap.topArtists.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Чаще всего слушали</Text>
          {recap.topArtists.map((artist, index) => (
            <View key={artist.author} style={styles.artist}>
              <Text style={styles.rank}>{index + 1}</Text>
              <View style={styles.artistBody}>
                <Text style={styles.artistName} numberOfLines={1}>
                  {artist.author}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.max((artist.seconds / leader) * 100, 4)}%` },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.artistTime}>{formatListening(artist.seconds)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {recap.topTracks.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Любимые треки</Text>
          {recap.topTracks.slice(0, 5).map((track, index) => (
            <View key={track.trackId} style={styles.track}>
              <Text style={styles.rank}>{index + 1}</Text>
              <View style={styles.trackBody}>
                <Text style={styles.trackTitle} numberOfLines={1}>
                  {track.title}
                </Text>
                <Text style={styles.trackAuthor} numberOfLines={1}>
                  {track.author}
                </Text>
              </View>
              <Text style={styles.trackPlays}>{track.plays}×</Text>
            </View>
          ))}
        </View>
      ) : null}

      {recap.newArtists.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Новые для вас</Text>
          <Text style={styles.sectionHint}>
            Их не было в прошлом месяце
          </Text>
          <View style={styles.chips}>
            {recap.newArtists.map((name) => (
              <View key={name} style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>
                  {name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.facts}>
        {recap.busiestDay !== null ? (
          <Fact
            icon="event"
            label="Самый активный день"
            value={dayTitle(recap.busiestDay)}
          />
        ) : null}
        {recap.favoriteHour !== null ? (
          <Fact
            icon="schedule"
            label="Любимое время"
            value={`около ${recap.favoriteHour}:00`}
          />
        ) : null}
      </View>

      <Text style={styles.footnote}>
        Считается на телефоне из истории прослушиваний. Данные никуда
        не отправляются ради этого экрана.
      </Text>
    </>
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

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  value: string;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.fact}>
      <MaterialIcons name={icon} size={18} color={theme.colors.brand} />
      <View style={styles.factBody}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={styles.factValue}>{value}</Text>
      </View>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    content: {
      paddingBottom: t.spacing.xxl,
      paddingHorizontal: t.layout.screenPadding,
      gap: t.spacing.lg,
    },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerTitle: { ...t.type.section, color: t.colors.text },
    iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

    switcher: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    month: { ...t.type.title, color: t.colors.text, textTransform: 'capitalize' },

    hero: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      paddingVertical: t.spacing.xl,
      alignItems: 'center',
      gap: 4,
    },
    heroValue: { ...t.type.title, fontSize: 34, color: t.colors.brand },
    heroLabel: { ...t.type.meta, color: t.colors.textDim },

    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
    stat: {
      flexGrow: 1,
      flexBasis: '45%',
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      paddingVertical: t.spacing.md,
      alignItems: 'center',
      gap: 2,
    },
    statValue: { ...t.type.section, color: t.colors.text },
    statLabel: { ...t.type.meta, color: t.colors.textFaint },

    section: { gap: t.spacing.sm },
    sectionTitle: { ...t.type.section, color: t.colors.text },
    sectionHint: { ...t.type.meta, color: t.colors.textFaint, marginTop: -4 },

    artist: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    artistBody: { flex: 1, gap: 6 },
    artistName: { ...t.type.body, color: t.colors.text },
    artistTime: { ...t.type.meta, color: t.colors.textDim, fontVariant: ['tabular-nums'] },
    barTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.surfaceHigh,
      overflow: 'hidden',
    },
    barFill: { height: 4, borderRadius: 2, backgroundColor: t.colors.accent },

    rank: {
      ...t.type.meta,
      color: t.colors.textFaint,
      width: 18,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },

    track: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    trackBody: { flex: 1 },
    trackTitle: { ...t.type.trackTitle, color: t.colors.text },
    trackAuthor: { ...t.type.meta, color: t.colors.textDim },
    trackPlays: { ...t.type.meta, color: t.colors.textDim, fontVariant: ['tabular-nums'] },

    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs },
    chip: {
      backgroundColor: t.colors.surfaceHigh,
      borderRadius: t.radius.chip,
      paddingHorizontal: t.spacing.sm,
      paddingVertical: 6,
      maxWidth: '100%',
    },
    chipText: { ...t.type.meta, color: t.colors.text },

    facts: { gap: t.spacing.sm },
    fact: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      padding: t.spacing.md,
    },
    factBody: { flex: 1 },
    factLabel: { ...t.type.meta, color: t.colors.textFaint },
    factValue: { ...t.type.body, color: t.colors.text },

    footnote: { ...t.type.meta, color: t.colors.textFaint, lineHeight: 17 },
  });
