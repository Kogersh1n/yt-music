import type { ExpoConfig } from 'expo/config';

/**
 * Адрес бэкенда. Телефон не видит localhost машины — по умолчанию
 * подставляется LAN-адрес; переопределяется через EXPO_PUBLIC_API_URL.
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.8.12:8000';

/**
 * Android с API 28 режет http://. Разрешаем cleartext ровно тогда, когда
 * бэкенд действительно ходит по http (локальный docker-стек + MinIO),
 * и не разрешаем, когда адрес уже https — так release-сборка на прод
 * не тащит лишнее послабление.
 */
const needsCleartext = API_URL.startsWith('http://');

const config: ExpoConfig = {
  name: 'YT Music',
  slug: 'ytmusic',
  scheme: 'ytmusic',
  version: '1.0.1',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  backgroundColor: '#030303',
  icon: './assets/icon.png',

  android: {
    package: 'com.duklet.ytmusic',
    versionCode: 2,
    predictiveBackGestureEnabled: false,
    adaptiveIcon: {
      backgroundColor: '#030303',
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: [
      'android.permission.INTERNET',
      // Плеер живёт в foreground-сервисе — иначе Android убьёт звук при сворачивании.
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      // Без неё на Android 13+ не покажется уведомление-плеер.
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.WAKE_LOCK',
    ],
  },

  plugins: [
    'expo-router',
    'expo-image',
    'expo-font',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#030303',
      },
    ],
    // Подпись release своим ключом и разделение APK по архитектурам.
    './plugins/withAndroidRelease',
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: needsCleartext,
          // R8 + выкидывание неиспользуемых ресурсов: без этого release-APK
          // весит вдвое больше.
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    apiUrl: API_URL,
  },
};

export default config;
