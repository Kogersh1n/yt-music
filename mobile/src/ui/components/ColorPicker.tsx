import { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Slider } from './Slider';
import { useThemedStyles, type Theme } from '../theme';
import { hexToHsl, hslToHex } from '../theme/color';

/**
 * Выбор цвета тремя ползунками: тон, насыщенность, светлота.
 *
 * HSL, а не RGB, потому что редактируют оформление, а не пишут код: «сделать
 * темнее» или «убавить яркость» — это движение одного ползунка, тогда как
 * в RGB пришлось бы двигать три сразу.
 */

interface ColorPickerProps {
  /** Текущий цвет в HEX. Значения с прозрачностью редактировать нельзя. */
  value: string;
  onChange: (hex: string) => void;
  /** Готовые оттенки — быстрее, чем подбирать ползунками. */
  swatches?: readonly string[];
}

export const ColorPicker = memo(function ColorPicker({
  value,
  onChange,
  swatches,
}: ColorPickerProps) {
  const styles = useThemedStyles(makeStyles);

  // Цвет может быть полупрозрачным (scrim) — тогда ползунки не применимы.
  const hsl = useMemo(() => hexToHsl(value), [value]);

  const update = useCallback(
    (patch: Partial<{ h: number; s: number; l: number }>) => {
      if (!hsl) return;
      onChange(hslToHex({ ...hsl, ...patch }));
    },
    [hsl, onChange],
  );

  if (!hsl) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.unsupported}>
          Полупрозрачный цвет ползунками не правится — задайте его в JSON.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.previewRow}>
        <View style={[styles.preview, { backgroundColor: value }]} />
        <Text style={styles.hex}>{value.toUpperCase()}</Text>
      </View>

      <Slider
        label="Тон"
        value={hsl.h}
        min={0}
        max={360}
        step={1}
        format={(v) => `${v}°`}
        onChange={(h) => update({ h })}
      />
      <Slider
        label="Насыщенность"
        value={hsl.s}
        min={0}
        max={100}
        step={1}
        format={(v) => `${v}%`}
        onChange={(s) => update({ s })}
      />
      <Slider
        label="Светлота"
        value={hsl.l}
        min={0}
        max={100}
        step={1}
        format={(v) => `${v}%`}
        onChange={(l) => update({ l })}
      />

      {swatches && swatches.length > 0 ? (
        <View style={styles.swatches}>
          {swatches.map((swatch) => (
            <Pressable
              key={swatch}
              onPress={() => onChange(swatch)}
              style={[
                styles.swatch,
                { backgroundColor: swatch },
                swatch.toLowerCase() === value.toLowerCase() && styles.swatchActive,
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
});

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: { gap: t.spacing.xs },
    previewRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
    preview: {
      width: 40,
      height: 40,
      borderRadius: t.radius.thumb,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    hex: { ...t.type.label, color: t.colors.text, fontVariant: ['tabular-nums'] },
    unsupported: { ...t.type.meta, color: t.colors.textDim, lineHeight: 17 },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, marginTop: t.spacing.sm },
    swatch: {
      width: 30,
      height: 30,
      borderRadius: t.radius.thumb,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    swatchActive: { borderWidth: 3, borderColor: t.colors.accent },
  });
