import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { setupPlayer } from '../src/player/setup';
import { initSession, useIsSignedIn } from '../src/auth/session';
import { syncPlays } from '../src/features/playsSync';
import { useQueue } from '../src/player/queueStore';
import { ThemeProvider, useTheme, useThemedStyles, FONT_ASSETS, type Theme } from '../src/ui/theme';

/**
 * Корневой layout: провайдеры и однократная инициализация плеера.
 */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // На телефоне сеть отваливается постоянно — одна лишняя попытка
      // спасает от ложных «ошибок», но не заставляет ждать вечно.
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  },
});

export default function RootLayout() {
  // Шрифты для тем грузятся один раз при старте. Пока не готовы —
  // ничего не рисуем: иначе текст успеет отрисоваться системной гарнитурой
  // и прыгнуть при подмене.
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const restore = useQueue((state) => state.restore);

  useEffect(() => {
    let cancelled = false;

    setupPlayer()
      .then(() => {
        if (cancelled) return;
        // Очередь прошлой сессии поднимается, но воспроизведение НЕ стартует
        // само — приложение при запуске молчит, пока не нажали play.
        restore();
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setPlayerError(error instanceof Error ? error.message : 'Плеер не запустился');
      });

    return () => {
      cancelled = true;
    };
  }, [restore]);

  // Ошибку загрузки шрифта не считаем фатальной: темы просто откатятся
  // на системную гарнитуру, приложение должно открыться.
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <Shell playerError={playerError} />
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

/**
 * Всё, что зависит от темы, живёт ниже ThemeProvider — иначе useTheme()
 * возвращал бы значение по умолчанию и экран не перекрашивался бы.
 */
function Shell({ playerError }: { playerError: string | null }) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();

  // Подключаем сессию к HTTP-клиенту один раз.
  //
  // Жёсткого гарда нет намеренно: сейчас ни одна ручка бэкенда не требует
  // авторизации, а демо-режим рассчитан на работу вообще без сервера —
  // экран входа поверх всего сломал бы и то, и другое. На логин уводит
  // только реальный 401, то есть когда сессия действительно кончилась
  // и обновить её не удалось.
  // Журнал прослушиваний уходит на сервер: при запуске и раз в полчаса.
  // Отправка идемпотентна, поэтому лишний вызов ничего не портит,
  // а пропущенный догонит в следующий раз.
  const signedIn = useIsSignedIn();

  useEffect(() => {
    if (!signedIn) return;

    void syncPlays();
    const timer = setInterval(() => void syncPlays(), 30 * 60 * 1000);
    return () => clearInterval(timer);
  }, [signedIn]);

  useEffect(() => {
    initSession({
      // Путь относительный по той же причине, что и в (auth)/login.tsx:
      // типы роутов в .expo/ генерирует dev-сервер, и новые абсолютные пути
      // не типизированы до первого запуска.
      onUnauthorized: () => router.push('./(auth)/login'),
    });
  }, [router]);

  if (playerError) {
    return (
      <View style={styles.fatal}>
        <Text style={styles.fatalTitle}>Плеер не запустился</Text>
        <Text style={styles.fatalHint}>{playerError}</Text>
      </View>
    );
  }

  return (
    <>
      {/* Иконки системной строки — под светлоту темы, а не жёстко белые. */}
      <StatusBar style={theme.mode === 'light' ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
          animation: theme.motion.scale === 0 ? 'none' : 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" />
        {/* Вход открывается поверх приложения и закрывается возвратом назад. */}
        <Stack.Screen
          name="(auth)"
          options={{
            presentation: 'modal',
            animation: theme.motion.scale === 0 ? 'none' : 'slide_from_bottom',
          }}
        />
        {/* Полноэкранный плеер выезжает снизу, поверх вкладок. */}
        <Stack.Screen
          name="player"
          options={{
            presentation: 'modal',
            animation: theme.motion.scale === 0 ? 'none' : 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="queue"
          options={{
            presentation: 'modal',
            animation: theme.motion.scale === 0 ? 'none' : 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{ animation: theme.motion.scale === 0 ? 'none' : 'slide_from_right' }}
        />
        <Stack.Screen
          name="theme-editor"
          options={{ animation: theme.motion.scale === 0 ? 'none' : 'slide_from_right' }}
        />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    fatal: {
      flex: 1,
      backgroundColor: t.colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.sm,
      padding: t.spacing.xl,
    },
    fatalTitle: { ...t.type.section, color: t.colors.text },
    fatalHint: { ...t.type.meta, color: t.colors.textDim, textAlign: 'center' },
  });
