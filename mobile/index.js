// Точка входа. Фоновый сервис плеера обязан быть зарегистрирован здесь,
// на уровне модуля: система может поднять его без запуска интерфейса —
// например, когда пользователь жмёт play в шторке после выгрузки приложения.
import 'expo-router/entry';
import TrackPlayer from 'react-native-track-player';
import { PlaybackService } from './src/player/service';

TrackPlayer.registerPlaybackService(() => PlaybackService);
