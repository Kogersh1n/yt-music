import { useQuery } from '@tanstack/react-query';
import { getLikedCatalog, getRecommendations } from '../api/sync';
import { useIsSignedIn } from '../auth/session';

/**
 * Данные для главной, которых нет в медиатеке.
 *
 * Обе ручки требуют авторизации, поэтому запрос вообще не уходит, пока
 * пользователь не вошёл — иначе на каждом открытии главной прилетал бы
 * бессмысленный 401.
 *
 * Ошибку наружу не считаем поводом ломать экран: секция просто не
 * отрисуется, а медиатека останется на месте.
 */

/**
 * Лайки из YouTube Music.
 *
 * Треки не скачаны — это ссылки, играются напрямую. Поэтому раздел
 * доступен сразу, без ожидания загрузки в хранилище.
 */
export function useLikedCatalog(limit = 40) {
  const signedIn = useIsSignedIn();

  return useQuery({
    queryKey: ['liked-catalog', limit],
    queryFn: ({ signal }) => getLikedCatalog(limit, signal),
    enabled: signedIn,
    // Лайки меняются редко, а на сервере запрос ходит в YouTube Music —
    // дёргать его при каждом возврате на экран незачем.
    staleTime: 15 * 60_000,
    retry: false,
  });
}

/**
 * Подбор по тому, что ты слушал.
 *
 * Запрос долгий: сервер спрашивает «радио» у YouTube Music по каждому
 * семени, это несколько секунд. Держим результат дольше и не повторяем
 * при сбое — лучше показать вчерашнюю подборку, чем крутить спиннер.
 */
export function useRecommendations(limit = 20) {
  const signedIn = useIsSignedIn();

  return useQuery({
    queryKey: ['recommendations', limit],
    queryFn: ({ signal }) => getRecommendations({ seeds: 10, limit }, signal),
    enabled: signedIn,
    staleTime: 30 * 60_000,
    retry: false,
  });
}
