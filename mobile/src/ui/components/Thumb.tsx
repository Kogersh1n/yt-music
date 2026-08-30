import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Gradient } from './Gradient';
import { useTheme } from '../theme';

/**
 * Обложка трека.
 *
 * У песни может не быть обложки (на бэкенде поле nullable), а картинка с
 * YouTube иногда не грузится. Вместо серого прямоугольника рисуем градиент,
 * детерминированно выведенный из названия — список остаётся живым.
 *
 * Форму берёт из темы: `components.thumb` выбирает между скруглением из
 * `radius.thumb`, прямым углом и кругом.
 */

interface ThumbProps {
  uri: string | null;
  /** Из чего выводить цвет заглушки — обычно название трека. */
  seed: string;
  size: number;
  /** Переопределение скругления: карусель использует радиус карточки. */
  rounded?: number;
}

/** Пары оттенков для заглушки. Приглушённые — чтобы не спорить с интерфейсом. */
const PALETTES: readonly (readonly [string, string])[] = [
  ['#3d2b56', '#1a1230'],
  ['#123b3a', '#08201f'],
  ['#4a2233', '#22101a'],
  ['#1e3556', '#0d1a2c'],
  ['#4a3a1c', '#221a0c'],
  ['#2c4630', '#132015'],
  ['#432a4d', '#1d1223'],
  ['#14384a', '#091d26'],
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export const Thumb = memo(function Thumb({ uri, seed, size, rounded }: ThumbProps) {
  const theme = useTheme();

  const borderRadius = useMemo(() => {
    if (rounded !== undefined) return rounded;
    if (theme.components.thumb === 'square') return 0;
    if (theme.components.thumb === 'circle') return size / 2;
    return theme.radius.thumb;
  }, [rounded, theme.components.thumb, theme.radius.thumb, size]);

  const palette = useMemo(() => PALETTES[hashString(seed) % PALETTES.length], [seed]);
  const letter = useMemo(() => seed.trim().charAt(0).toUpperCase() || '♪', [seed]);

  const box = { width: size, height: size, borderRadius };

  if (!uri) {
    return (
      <Gradient colors={palette} style={[styles.center, box, styles.clip]}>
        <View style={styles.center}>
          <Text style={[styles.letter, { fontSize: size * 0.38 }]}>{letter}</Text>
        </View>
      </Gradient>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={[box, { backgroundColor: theme.colors.skeleton }]}
      // Диск-кэш: обложки не перекачиваются при каждом возврате на экран.
      cachePolicy="memory-disk"
      // Держим декодированный кадр в памяти при перемонтировании строки —
      // в списке с переиспользованием это убирает моргание при быстром скролле.
      recyclingKey={uri}
      contentFit="cover"
      // Мгновенная подстановка, если тема запретила анимации.
      transition={theme.motion.scale === 0 ? 0 : Math.round(150 * theme.motion.scale)}
      // Пока картинка едет, показываем ту же заглушку, что и при её отсутствии:
      // так строка не «моргает» пустым прямоугольником.
      placeholderContentFit="cover"
    />
  );
});

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  // Полосы градиента растянуты на всю область — обрезаем по скруглению.
  clip: { overflow: 'hidden' },
  letter: { color: 'rgba(255,255,255,0.55)', fontWeight: '700' },
});
