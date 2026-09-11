import { memo } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme, useThemedStyles, type Theme } from '../theme';
import { usePlaylists, usePlaylistActions } from '../../features/usePlaylists';
import { notifySuccess } from '../haptics';
import type { Track } from '../../api/types';

/**
 * Выбор плейлиста для трека.
 *
 * Отдельный лист, а не пункты в общем меню: плейлистов может быть много,
 * и подмешивать их к «Нравится» и «Удалить» значит получить меню, длина
 * которого зависит от данных.
 *
 * Показывается только для треков из медиатеки: плейлист хранит связь
 * с песней по её идентификатору на сервере, а у треков, играющих
 * по ссылке с ютуба, такого идентификатора нет.
 */

interface Props {
  track: Track | null;
  onClose: () => void;
}

export const AddToPlaylistSheet = memo(function AddToPlaylistSheet({ track, onClose }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { playlists, isLoading, signedIn } = usePlaylists();
  const actions = usePlaylistActions();

  const visible = track !== null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Закрыть" />

      <View style={styles.sheet}>
        <View style={styles.grip} />

        <View style={styles.head}>
          <Text style={styles.title}>В плейлист</Text>
          {track ? (
            <Text numberOfLines={1} style={styles.subtitle}>
              {track.title}
            </Text>
          ) : null}
        </View>

        {!signedIn ? (
          <Text style={styles.notice}>
            Плейлисты привязаны к аккаунту — войдите, чтобы ими пользоваться.
          </Text>
        ) : isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color={theme.colors.textDim} />
          </View>
        ) : playlists.length === 0 ? (
          <Text style={styles.notice}>
            Плейлистов пока нет. Создайте первый на экране «Плейлисты».
          </Text>
        ) : (
          playlists.map((playlist) => (
            <Pressable
              key={playlist.id}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              android_ripple={{ color: 'rgba(128,128,128,0.16)' }}
              onPress={() => {
                if (!track) return;
                onClose();
                actions.addSong.mutate({ id: playlist.id, songId: track.id });
                notifySuccess();
              }}
            >
              <MaterialIcons name="queue-music" size={20} color={theme.colors.text} />
              <Text numberOfLines={1} style={styles.name}>
                {playlist.playlist_name}
              </Text>
              <Text style={styles.count}>{playlist.songs_count}</Text>
            </Pressable>
          ))
        )}

        <Pressable style={styles.cancel} onPress={onClose}>
          <Text style={styles.cancelLabel}>Отмена</Text>
        </Pressable>
      </View>
    </Modal>
  );
});

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
    sheet: {
      backgroundColor: t.colors.surface,
      borderTopLeftRadius: t.radius.card,
      borderTopRightRadius: t.radius.card,
      paddingBottom: t.spacing.xl,
      paddingTop: t.spacing.sm,
      maxHeight: '70%',
    },
    grip: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.border,
      marginBottom: t.spacing.md,
    },
    head: {
      paddingHorizontal: t.layout.screenPadding,
      paddingBottom: t.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      gap: 2,
    },
    title: { ...t.type.body, fontWeight: '600', color: t.colors.text },
    subtitle: { ...t.type.meta, color: t.colors.textDim },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.md,
    },
    pressed: { backgroundColor: t.colors.bg },
    name: { ...t.type.body, color: t.colors.text, flex: 1 },
    count: { ...t.type.meta, color: t.colors.textFaint, fontVariant: ['tabular-nums'] },

    loading: { paddingVertical: t.spacing.xl, alignItems: 'center' },
    notice: {
      ...t.type.meta,
      color: t.colors.textDim,
      paddingHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.lg,
      textAlign: 'center',
    },

    cancel: {
      marginTop: t.spacing.sm,
      marginHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.md,
      alignItems: 'center',
      borderRadius: t.radius.chip,
      backgroundColor: t.colors.bg,
    },
    cancelLabel: { ...t.type.body, color: t.colors.textDim },
  });
