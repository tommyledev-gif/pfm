import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, typography } from "@/lib/theme";

// Home snapshot's "liquid fill" circle — a wavy-surfaced fill clipped to a
// circle, reading as a level of liquid rather than a plain progress ring.
// The wave path itself never changes shape; it's shifted left continuously
// by exactly one wavelength (Animated.loop + native-driven translateX), so
// it reads as an endlessly scrolling liquid surface without recomputing the
// path per frame.
const WAVE_AMPLITUDE = 6;
// Two full humps drawn across double the circle's width — translating by
// exactly one hump-width (half of this) below is what makes the loop seam
// invisible.
const WAVE_WIDTH_MULTIPLIER = 2;
const WAVE_LOOP_MS = 3200;
// Keeps the wave visibly present (not a sliver) and never fully covers the
// label at the very top of the circle, at 0%/100% progress respectively.
const MIN_FILL = 0.08;
const MAX_FILL = 0.92;

function buildWavePath(width: number, height: number, waterY: number): string {
  const hump = width / 2;
  let path = `M 0 ${waterY}`;
  for (let i = 0; i < 2; i++) {
    const x0 = i * hump;
    path += ` C ${x0 + hump * 0.25} ${waterY - WAVE_AMPLITUDE}, ${x0 + hump * 0.75} ${waterY + WAVE_AMPLITUDE}, ${x0 + hump} ${waterY}`;
  }
  path += ` L ${width} ${height} L 0 ${height} Z`;
  return path;
}

interface LiquidCircleProps {
  size?: number;
  // 0..1 fraction of the circle's height the liquid fills, from the bottom.
  progress: number;
  color?: string;
  trackColor?: string;
  topLabel: string;
  topValue: string;
}

export function LiquidCircle({
  size = 180,
  progress,
  color = colors.green,
  trackColor = "rgba(255,255,255,0.06)",
  topLabel,
  topValue,
}: LiquidCircleProps) {
  const clamped = Math.min(MAX_FILL, Math.max(MIN_FILL, progress));
  const waterY = size * (1 - clamped);
  const waveWidth = size * WAVE_WIDTH_MULTIPLIER;
  const hump = waveWidth / 2;
  const shift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    shift.setValue(0);
    const loop = Animated.loop(
      Animated.timing(shift, {
        toValue: -hump,
        duration: WAVE_LOOP_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shift, hump]);

  return (
    <View style={[styles.wrapper, { width: size, height: size, borderRadius: size / 2, backgroundColor: trackColor }]}>
      <Animated.View
        style={[styles.wave, { width: waveWidth, height: size, transform: [{ translateX: shift }] }]}
      >
        <Svg width={waveWidth} height={size}>
          <Path d={buildWavePath(waveWidth, size, waterY)} fill={color} />
        </Svg>
      </Animated.View>
      <View style={[styles.label, { width: size * 0.78 }]} pointerEvents="none">
        <Text style={styles.caption} numberOfLines={1}>
          {topLabel}
        </Text>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
          {topValue}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  wave: { position: "absolute", left: 0, top: 0 },
  label: { position: "absolute", alignItems: "center", gap: 2 },
  caption: { ...typography.caption, color: colors.textSecondary },
  value: { ...typography.title, color: colors.textPrimary },
});
