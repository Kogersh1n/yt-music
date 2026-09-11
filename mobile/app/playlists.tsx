import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ErrorState } from '../src/ui/components/states';
import { ActionSheet, type SheetAction } from '../src/ui/components/ActionSheet';
import { MiniPlayer } from '../src/ui/components/MiniPlayer';
import { plural, useTheme, useThemedStyles, formatDuration, type Theme } from '../src/ui/theme';
import { usePlaylists, usePlaylistActions } from '../src/features/usePlaylists';
import { tapMedium } from '../src/ui/haptics';
import type { PlaylistResponse } from '../src/api/types';

/**
 * Плейлисты.
 *
 * Модуль на бэкенде был написан целиком — семь ручек, — и всё это время
 * оставался недоступен: экрана не существовало. Здесь он наконец появляется.
 *
 * Без входа плейлистов нет по устройству бэкенда: они привязаны
 * к пользователю. Поэтому вместо пустого списка честно предлагаем войти.
 */
export default function PlaylistsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  const { playlists, isLoading, error, signedIn, refetch, isRefetching } = usePlaylists();
  const actions = usePlaylistActions();

  /**
   * Диалог имени — один на создание и переименование.
   *
   * Alert.prompt здесь не годится: он существует только на iOS, а цель
   * у проекта — Android. На нём вызов просто ничего не делает.
   */
  const [naming, setNaming] = useState<{ mode: 'create' | 'rename'; target?: PlaylistResponse } | null>(
    null,
  );
  const [name, setName] = useState('');
  const [menu, setMenu] = useState<PlaylistResponse | null>(null);

  const openCreate = useCallback(() => {
    setName('');
    setNaming({ mode: 'create' });
  }, []);

  const openRename = useCallback((target: PlaylistResponse) => {
    setName(target.playlist_name);
    setNaming({ mode: 'rename', target });
  }, []);

  const submit = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed || !naming) return;

    if (naming.mode === 'create') {
      actions.create.mutate(trimmed, {
        onError: (e: Error) => Alert.alert('Не удалось создать', e.message),
      });
    } else if (naming.target) {
      actions.rename.mutate(
        { id: naming.target.id, name: trimmed },
        { onError: (e: Error) => Alert.alert('Не удалось переименовать', e.message) },
      );
    }

    setName('');
    setNaming(null);
    tapMedium();
  }, [name, naming, actions.create, actions.rename]);

  const menuActions: SheetAction[] = menu
    ? [
        { label: 'Переименовать', icon: 'edit', onPress: () => openRename(menu) },
        {
          label: 'Удалить плейлист',
          icon: 'delete-outline',
          destructive: true,
          onPress: () =>
            Alert.alert('Удалить плейлист?', `«${menu.playlist_name}» исчезнет. Треки останутся.`, [
              { text: 'Отмена', style: 'cancel' },
              {
                text: 'Удалить',
                style: 'destructive',
                onPress: () => actions.remove.mutate(menu.id),
              },
            ]),
        },
      ]
    : [];

  const renderItem = useCallback(
    ({ item }: { item: PlaylistResponse }) => (
      <Pressable
        style={styles.row}
        onPress={() => router.push(`/playlist/${item.id}`)}
        android_ripple={{ color: 'rgba(128,128,128,0.16)' }}
      >
        <View style={styles.cover}>
          <MaterialIcons name="queue-music" size={22} color={theme.colors.textDim} />
        </View>

        <View style={styles.text}>
          <Text numberOfLines={1} style={styles.name}>
            {item.playlist_name}
          </Text>
          <Text style={styles.meta}>
            {item.songs_count === 0
              ? 'Пока пусто'
              : `${item.songs_count} ${plural(item.songs_count, 'трек', 'трека', 'треков')} · ${formatDuration(item.playlist_duration)}`}
          </Text>
        </View>

        <Pressable onPress={() => setMenu(item)} hitSlop={12} style={styles.more}>
          <MaterialIcons name="more-vert" size={20} color={theme.colors.textFaint} />
        </Pressable>
      </Pressable>
    ),
    [router, styles, theme.colors.textDim, theme.colors.textFaint],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + theme.spacing.sm }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerButton}>
          <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Плейлисты</Text>
        <Pressable
          onPress={openCreate}
          hitSlop={12}
          style={styles.headerButton}
          disabled={!signedIn}
        >
          <MaterialIcons
            name="add"
            size={26}
            color={signedIn ? theme.colors.text : theme.colors.textFaint}
          />
        </Pressable>
      </View>

      <Body
        signedIn={signedIn}
        isLoading={isLoading}
        error={error}
        count={playlists.length}
        onSignIn={() => router.push('/(auth)/login')}
        onRetry={() => void refetch()}
      >
        <FlashList
          data={playlists}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={theme.colors.text}
              colors={[theme.colors.text]}
              progressBackgroundColor={theme.colors.surface}
            />
          }
        />
      </Body>

      <ActionSheet
        visible={menu !== null}
        title={menu?.playlist_name ?? ''}
        subtitle={menu ? `${menu.songs_count} ${plural(menu.songs_count, 'трек', 'трека', 'треков')}` : undefined}
        actions={menuActions}
        onClose={() => setMenu(null)}
      />

      {/* Создание — модалка, а не отдельный экран: одно поле не стоит
          перехода, а возврат к списку сразу показывает результат. */}
      <Modal visible={naming !== null} transparent animationType="fade" onRequestClose={() => setNaming(null)}>
        <Pressable style={styles.backdrop} onPress={() => setNaming(null)} />
        <View style={styles.dialogWrap} pointerEvents="box-none">
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>
              {naming?.mode === 'rename' ? 'Новое название' : 'Новый плейлист'}
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Название"
              placeholderTextColor={theme.colors.textFaint}
              style={styles.input}
              maxLength={50}
              autoFocus
              selectionColor={theme.colors.brand}
              onSubmitEditing={submit}
              returnKeyType="done"
            />
            <View style={styles.dialogButtons}>
              <Pressable onPress={() => setNaming(null)} style={styles.dialogButton}>
                <Text style={styles.dialogCancel}>Отмена</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                style={[styles.dialogButton, styles.dialogPrimary]}
                disabled={name.trim().length === 0}
              >
                <Text style={styles.dialogPrimaryLabel}>
                  {naming?.mode === 'rename' ? 'Сохранить' : 'Создать'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <MiniPlayer standalone />
    </View>
  );
}

function Body({
  signedIn,
  isLoading,
  error,
  count,
  onSignIn,
  onRetry,
  children,
}: {
  signedIn: boolean;
  isLoading: boolean;
  error: Error | null;
  count: number;
  onSignIn: () => void;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(makeStyles);

  if (!signedIn) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon="♪"
          title="Нужен вход"
          hint="Плейлисты хранятся на сервере и привязаны к аккаунту — так они не пропадут при переустановке."
        />
        <Pressable onPress={onSignIn} style={styles.signIn}>
          <Text style={styles.signInLabel}>Войти</Text>
        </Pressable>
      </View>
    );
  }

  if (error) return <ErrorState message={error.message} onRetry={onRetry} />;
  if (isLoading) return <View style={styles.center} />;

  if (count === 0) {
    return (
      <EmptyState
        icon="＋"
        title="Плейлистов пока нет"
        hint="Создайте первый кнопкой в правом верхнем углу."
      />
    );
  }

  return <>{children}</>;
}

/** Заливка на весь экран. Вынесена: типы RN в этой версии не отдают absoluteFillObject. */
const FILL = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: t.spacing.md,
      paddingBottom: t.spacing.sm,
    },
    headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { ...t.type.title, fontSize: t.type.title.fontSize - 4, color: t.colors.text },

    list: { paddingBottom: t.spacing.xxl },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.sm,
      minHeight: t.layout.rowHeight,
    },
    cover: {
      width: t.layout.rowThumb,
      height: t.layout.rowThumb,
      borderRadius: t.radius.thumb,
      backgroundColor: t.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { flex: 1, gap: 2 },
    name: { ...t.type.trackTitle, color: t.colors.text },
    meta: { ...t.type.meta, color: t.colors.textDim },
    more: { width: 32, alignItems: 'center' },

    center: { flex: 1, justifyContent: 'center' },
    signIn: {
      alignSelf: 'center',
      marginTop: t.spacing.lg,
      paddingHorizontal: t.spacing.xl,
      paddingVertical: t.spacing.md,
      borderRadius: t.radius.chip,
      backgroundColor: t.colors.accent,
    },
    signInLabel: { ...t.type.body, fontWeight: '600', color: t.colors.onAccent },

    backdrop: { ...FILL, backgroundColor: 'rgba(0,0,0,0.6)' },
    dialogWrap: { ...FILL, justifyContent: 'center', padding: t.spacing.xl },
    dialog: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      padding: t.spacing.lg,
      gap: t.spacing.md,
    },
    dialogTitle: { ...t.type.body, fontWeight: '600', color: t.colors.text },
    input: {
      ...t.type.body,
      color: t.colors.text,
      backgroundColor: t.colors.bg,
      borderRadius: t.radius.chip,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
    },
    dialogButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: t.spacing.sm },
    dialogButton: {
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.sm,
      borderRadius: t.radius.chip,
    },
    dialogPrimary: { backgroundColor: t.colors.accent },
    dialogCancel: { ...t.type.body, color: t.colors.textDim },
    dialogPrimaryLabel: { ...t.type.body, fontWeight: '600', color: t.colors.onAccent },
  });
