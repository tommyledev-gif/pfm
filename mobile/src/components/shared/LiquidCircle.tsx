import { useEffect, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { withAlpha } from "@/lib/color";
import { colors, typography, createStyles } from "@/lib/theme";

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
// The empty part of the circle is transparent — only an outline ring marks
// its boundary, with a small gap between the ring and the liquid so the ring
// still reads as a separate edge once the liquid rises against it.
const OUTLINE_WIDTH = 2;
const OUTLINE_GAP = 4;

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
  /** Ring drawn around the circle. Defaults to the liquid color, softened. */
  outlineColor?: string;
  topLabel: string;
  topValue: string;
}

export function LiquidCircle({
  size: outerSize = 180,
  progress,
  color = colors.green,
  outlineColor,
  topLabel,
  topValue,
}: LiquidCircleProps) {
  const styles = useStyles();
  const size = outerSize - 2 * (OUTLINE_WIDTH + OUTLINE_GAP);
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
    <View
      style={[
        styles.outline,
        {
          width: outerSize,
          height: outerSize,
          borderRadius: outerSize / 2,
          borderColor: outlineColor ?? `${color}99`,
        },
      ]}
    >
      <View style={[styles.wrapper, { width: size, height: size, borderRadius: size / 2 }]}>
        <Animated.View
          style={[styles.wave, { width: waveWidth, height: size, transform: [{ translateX: shift }] }]}
        >
          <Svg width={waveWidth} height={size}>
            <Path d={buildWavePath(waveWidth, size, waterY)} fill={color} />
          </Svg>
        </Animated.View>
        <View style={[styles.label, { width: size * 0.86 }]} pointerEvents="none">
          <View style={styles.scrim}>
            <Text style={styles.caption} numberOfLines={1}>
              {topLabel}
            </Text>
            <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
              {topValue}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  outline: { alignItems: "center", justifyContent: "center", borderWidth: OUTLINE_WIDTH },
  wrapper: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  wave: { position: "absolute", left: 0, top: 0 },
  label: { position: "absolute", alignItems: "center" },
  scrim: {
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    // ⚠️ The label sits on the bare track at low fill and on a bright liquid
    // at high fill, and at intermediate levels the wave crosses the text
    // itself. A scrim behind the label is the only treatment that holds in all
    // three: a threshold that flips the text color cannot serve a line that is
    // half on each side, and deciding per frame from the animated wave position
    // would strobe as the surface moves. It is the theme's own ground, so it
    // carries the theme's text color over the lightest palette color a caller
    // can pass, and translucent enough that the fill still reads through it —
    // the circle's whole job is showing a level.
    backgroundColor: withAlpha(colors.bgApp, 0.62),
  },
  caption: { ...typography.caption, color: colors.textSecondary },
  value: { ...typography.title, color: colors.textPrimary },
}));
