import { memo, useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { PressableScale } from './PressableScale';
import { useTheme, useThemedStyles, type Theme } from '../theme';
import { searchAlbums, searchArtists, type FoundAlbum, type FoundArtist } from '../../api/ytmusic';

/**
 * Исполнители и альбомы над списком песен.
 *
 * Поиск отдавал только песни, и это давало странную картину: на запрос
 * «queen» приходили двадцать роликов, а самого исполнителя — того, кого
 * искали, — в выдаче не было вовсе.
 *
 * Разделы запрашиваются отдельно, каждый со своим фильтром. Можно было
 * разобрать одну общую выдачу по секциям, но её структура у YouTube
 * меняется, а фильтры стабильны, и падение одного раздела не уносит
 * остальные.
 */

interface SearchSectionsProps {
  query: string;
  /** Нажали на альбом — подставляем его в строку поиска, чтобы показать треки. */
  onPickAlbum: (query: string) => void;
}

export const SearchSections = memo(function SearchSections({
  query,
  onPickAlbum,
}: SearchSectionsProps) {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();

  const artists = useQuery({
    queryKey: ['search-artists', query],
    enabled: query.length > 0,
    staleTime: 10 * 60_000,
    retry: 1,
    queryFn: () => searchArtists(query),
  });

  const albums = useQuery({
    queryKey: ['search-albums', query],
    enabled: query.length > 0,
    staleTime: 10 * 60_000,
    retry: 1,
    queryFn: () => searchAlbums(query),
  });

  const openArtist = useCallback(
    (name: string) => router.push(`/artist?name=${encodeURIComponent(name)}`),
    [router],
  );

  const renderArtist = useCallback(
    ({ item }: { item: FoundArtist }) => <ArtistCard artist={item} onPress={openArtist} />,
    [openArtist],
  );

  const renderAlbum = useCallback(
    ({ item }: { item: FoundAlbum }) => <AlbumCard album={item} onPress={onPickAlbum} />,
    [onPickAlbum],
  );

  const foundArtists = artists.data ?? [];
  const foundAlbums = albums.data ?? [];

  // Разделы не показываем, пока не приехали: пустой заголовок над
  // пустотой хуже, чем его отсутствие.
  if (foundArtists.length === 0 && foundAlbums.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {foundArtists.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.title}>Исполнители</Text>
          <FlatList
            data={foundArtists}
            renderItem={renderArtist}
            keyExtractor={(item, index) => `${item.browseId ?? item.name}-${index}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
          />
        </View>
      ) : null}

      {foundAlbums.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.title}>Альбомы</Text>
          <FlatList
            data={foundAlbums}
            renderItem={renderAlbum}
            keyExtractor={(item, index) => `${item.title}-${index}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
          />
        </View>
      ) : null}

      <Text style={styles.title}>Песни</Text>
    </View>
  );
});

const ArtistCard = memo(function ArtistCard({
  artist,
  onPress,
}: {
  artist: FoundArtist;
  onPress: (name: string) => void;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <PressableScale style={styles.artist} depth={0.94} onPress={() => onPress(artist.name)}>
      <View style={styles.avatar}>
        {/* Буква под портретом: у части исполнителей аватарки нет. */}
        <Text style={styles.avatarLetter}>{artist.name.slice(0, 1).toUpperCase()}</Text>
        {artist.avatar ? (
          <Image
            source={{ uri: artist.avatar }}
            style={styles.avatarImage}
            cachePolicy="memory-disk"
            contentFit="cover"
            transition={theme.motion.scale === 0 ? 0 : 150}
          />
        ) : null}
      </View>
      <Text numberOfLines={1} style={styles.artistName}>
        {artist.name}
      </Text>
    </PressableScale>
  );
});

const AlbumCard = memo(function AlbumCard({
  album,
  onPress,
}: {
  album: FoundAlbum;
  onPress: (query: string) => void;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <PressableScale
      style={styles.album}
      depth={0.95}
      onPress={() => onPress(`${album.title} ${album.subtitle.split('•')[1]?.trim() ?? ''}`.trim())}
    >
      <View style={styles.cover}>
        {album.cover ? (
          <Image
            source={{ uri: album.cover }}
            style={styles.coverImage}
            cachePolicy="memory-disk"
            contentFit="cover"
            transition={theme.motion.scale === 0 ? 0 : 150}
          />
        ) : null}
      </View>
      <Text numberOfLines={2} style={styles.albumTitle}>
        {album.title}
      </Text>
      <Text numberOfLines={1} style={styles.albumMeta}>
        {album.subtitle}
      </Text>
    </PressableScale>
  );
});

const AVATAR = 72;
const COVER = 120;

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: { gap: t.spacing.md, paddingBottom: t.spacing.sm },
    section: { gap: t.spacing.xs },
    title: { ...t.type.section, color: t.colors.text, paddingHorizontal: t.layout.screenPadding },
    row: { paddingHorizontal: t.layout.screenPadding, gap: t.spacing.md },

    artist: { width: AVATAR, alignItems: 'center', gap: 6 },
    avatar: {
      width: AVATAR,
      height: AVATAR,
      borderRadius: AVATAR / 2,
      backgroundColor: t.colors.surfaceHigh,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: { width: '100%', height: '100%', position: 'absolute' },
    avatarLetter: { ...t.type.section, color: t.colors.textDim },
    artistName: { ...t.type.meta, color: t.colors.text, textAlign: 'center' },

    album: { width: COVER, gap: 4 },
    cover: {
      width: COVER,
      height: COVER,
      borderRadius: t.radius.thumb,
      backgroundColor: t.colors.surfaceHigh,
      overflow: 'hidden',
    },
    coverImage: { width: '100%', height: '100%' },
    albumTitle: { ...t.type.meta, color: t.colors.text },
    albumMeta: { ...t.type.meta, color: t.colors.textDim, fontSize: 11 },
  });
