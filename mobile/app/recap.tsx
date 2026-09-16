import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '../src/ui/components/states';
import { useTheme, useThemedStyles, type Theme } from '../src/ui/theme';
import { useMonthlyRecap, type Recap } from '../src/features/recap';
import type { ArtistSummary } from '../src/features/recap';
import { formatListening } from '../src/local/stats';
import { displayArtist } from '../src/api/songText';
import { hexToHsl, hslToHex, withAlpha } from '../src/ui/theme/color';
import { TrackTitle } from '../src/ui/components/TrackTitle';
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

          {/* Тройка лидеров — пьедесталом, остальные списком.
              Раньше все десять шли одинаковыми строками: список честно
              показывал порядок, но не показывал, что первое место есть.
              Кольцо градуировано, а не одинаковое у троих: пьедестал
              должен ранжировать, иначе он просто подсветка. */}
          <View style={styles.podium}>
            {recap.topArtists.slice(0, 3).map((artist, index) => (
              <PodiumPlace key={artist.author} artist={artist} place={index + 1} />
            ))}
          </View>

          {recap.topArtists.slice(3).map((artist, index) => (
            <View key={artist.author} style={styles.artist}>
              <Text style={styles.rank}>{index + 4}</Text>
              <ArtistAvatar artist={artist} size={28} />
              <View style={styles.artistBody}>
                <Text style={styles.artistName} numberOfLines={1}>
                  {displayArtist(artist.author)}
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
                <TrackTitle title={track.title} style={styles.trackTitle} />
                <Text style={styles.trackAuthor} numberOfLines={1}>
                  {displayArtist(track.author)}
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
                  {displayArtist(name)}
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

/**
 * Кружок исполнителя. Обложка самого слушаемого его трека, иначе буква.
 *
 * Вынесен отдельно, потому что нужен в двух видах — крупный на
 * пьедестале и мелкий в списке, — а правило «что показать» одно.
 */
function ArtistAvatar({ artist, size }: { artist: ArtistSummary; size: number }) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const box = { width: size, height: size, borderRadius: size / 2 };

  // Буква лежит в подложке, картинка кладётся поверх. Так не нужно ловить
  // ошибку загрузки: у части роликов hq720 просто нет (у концертных записей
  // особенно), и там оставался чёрный кружок вместо исполнителя.
  return (
    <View style={[styles.miniAvatar, box]}>
      <Text style={[styles.miniLetter, { fontSize: size * 0.42 }]}>
        {displayArtist(artist.author).slice(0, 1).toUpperCase()}
      </Text>
      {artist.youtubeId ? (
        <Image
          source={{ uri: `https://i.ytimg.com/vi/${artist.youtubeId}/hq720.jpg` }}
          style={[StyleSheet.absoluteFill, box]}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={theme.motion.scale === 0 ? 0 : Math.round(150 * theme.motion.scale)}
        />
      ) : null}
    </View>
  );
}

/**
 * Место на пьедестале.
 *
 * Аватарок у исполнителей нет и взять их неоткуда, поэтому кружок
 * собираем из имени: оттенок выводим из самого имени, а насыщенность
 * и светлоту берём у фирменного цвета темы. Так кружки различимы между
 * собой и при этом не спорят с темой, которую пользователь настроил сам.
 */
function PodiumPlace({ artist, place }: { artist: ArtistSummary; place: number }) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  const name = displayArtist(artist.author);

  const tint = useMemo(() => {
    const base = hexToHsl(theme.colors.brand);
    if (!base) return theme.colors.surfaceHigh;

    // Сумма кодов букв — не криптография, а всего лишь способ получить
    // из имени одно и то же число при каждом запуске.
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360;

    // Насыщенность и светлоту берём НЕ у бренда как есть: у фирменного
    // красного они предельные, и производные цвета выходили неоновыми —
    // три кислотных кружка спорили со всем остальным экраном. Приглушаем
    // и затемняем: различить исполнителей это не мешает, а светлая буква
    // поверх читается уверенно.
    return hslToHex({ h: hash, s: Math.min(base.s, 48), l: 32 });
  }, [name, theme.colors.brand, theme.colors.surfaceHigh]);

  // Первое место получает сплошное кольцо, третье — едва заметное.
  const ringAlpha = [100, 50, 28][place - 1] ?? 28;
  const ringWidth = place === 1 ? 2 : 1;

  return (
    <View
      style={[
        styles.place,
        { backgroundColor: withAlpha(theme.colors.brand, place === 1 ? 10 : 4) ?? 'transparent' },
      ]}
    >
      <View style={styles.avatarWrap}>
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: tint,
              borderWidth: ringWidth,
              borderColor: withAlpha(theme.colors.brand, ringAlpha) ?? theme.colors.brand,
            },
          ]}
        >
          {/* Буква под картинкой: если обложки у ролика нет, кружок
              не станет чёрным пятном. */}
          <Text style={styles.avatarLetter}>{name.slice(0, 1).toUpperCase()}</Text>
          {artist.youtubeId ? (
            <Image
              source={{ uri: `https://i.ytimg.com/vi/${artist.youtubeId}/hq720.jpg` }}
              style={[StyleSheet.absoluteFill, styles.avatarImage]}
              cachePolicy="memory-disk"
              contentFit="cover"
              transition={theme.motion.scale === 0 ? 0 : Math.round(150 * theme.motion.scale)}
            />
          ) : null}
        </View>
        <Text style={styles.placeNumber}>{place}</Text>
      </View>

      <Text numberOfLines={1} style={styles.placeName}>
        {name}
      </Text>
      <Text numberOfLines={1} style={styles.placeTime}>
        {formatListening(artist.seconds)}
      </Text>
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

    podium: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing.sm,
      marginBottom: t.spacing.sm,
    },
    place: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
      paddingTop: t.spacing.sm,
      paddingBottom: t.spacing.sm,
      paddingHorizontal: 4,
      borderRadius: t.radius.card,
    },
    avatarWrap: { alignItems: 'center', marginBottom: 8 },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      // Кадр 16:9 в круге обрежется по центру — там почти всегда лицо
      // или обложка, а не край. overflow нужен явно: на Android
      // borderRadius сам по себе картинку внутри не обрезает.
      overflow: 'hidden',
    },
    avatarImage: { width: '100%', height: '100%' },
    miniAvatar: {
      backgroundColor: t.colors.surfaceHigh,
      alignItems: 'center',
      justifyContent: 'center',
    },
    miniLetter: { color: t.colors.textDim, fontWeight: '600' },
    avatarLetter: { ...t.type.section, color: t.colors.onAccent },
    placeNumber: {
      ...t.type.meta,
      fontWeight: '700',
      color: t.colors.brand,
      backgroundColor: t.colors.bg,
      paddingHorizontal: 5,
      borderRadius: 4,
      marginTop: -9,
      fontVariant: ['tabular-nums'],
    },
    placeName: { ...t.type.meta, color: t.colors.text, textAlign: 'center' },
    placeTime: {
      ...t.type.meta,
      color: t.colors.textDim,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },

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
