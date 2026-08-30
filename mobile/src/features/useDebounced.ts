import { useEffect, useState } from 'react';

/**
 * Отложенное значение. Нужно поиску: без него каждый набранный символ
 * отправлял бы запрос к yt-dlp — так уже сделано в вебе, и там это даёт
 * гонки и «прыгающие» результаты.
 */
export function useDebounced<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
