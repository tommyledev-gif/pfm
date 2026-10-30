import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, AppState, AppStateStatus, Easing, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";

import { withAlpha } from "@/lib/color";
import { clampLevel, useLevelAnimation } from "@/lib/motion";
import { colors, typography, createStyles } from "@/lib/theme";

// Home snapshot's "liquid fill" circle — a wavy-surfaced fill clipped to a
// circle, reading as a level of liquid rather than a plain progress ring.
//
// Neither motion ever rebuilds the path. The surface is drawn once, at the
// top of a body twice the circle's height, and both movements are native
// transforms on the view that holds it:
//  - translateX: shifted left by exactly one wavelength, forever
//    (Animated.loop), so it reads as an endlessly scrolling surface.
//  - translateY: the level. A progress change springs the whole body up or
//    down (LEVEL_SPRING — one overshoot, then settle); the extra height below
//    the surface is what stays behind to fill the circle as it moves.
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
// How far past MIN/MAX_FILL the spring's single overshoot may carry the
// surface. The overshoot is NOT clamped — a clamp would flatten the bounce
// into a stall against an invisible ceiling. levelSpringFor instead damps
// each move just enough that its one overshoot ends inside this margin, so a
// big jump to a near-full level settles in firmly while a small update keeps
// its full bounce. 3% of the circle is ~5px at Home's size.
const LEVEL_HEADROOM = 0.03;
// The empty part of the circle is transparent — only an outline ring marks
// its boundary, with a small gap between the ring and the liquid so the ring
// still reads as a separate edge once the liquid rises against it.
const OUTLINE_WIDTH = 2;
const OUTLINE_GAP = 4;

// The surface sits WAVE_AMPLITUDE below the top of a `height`-tall body.
function buildWavePath(width: number, height: number): string {
  const waterY = WAVE_AMPLITUDE;
  const hump = width / 2;
  let path = `M 0 ${waterY}`;
  for (let i = 0; i < 2; i++) {
    const x0 = i * hump;
    path += ` C ${x0 + hump * 0.25} ${waterY - WAVE_AMPLITUDE}, ${x0 + hump * 0.75} ${waterY + WAVE_AMPLITUDE}, ${x0 + hump} ${waterY}`;
  }
  path += ` L ${width} ${height} L 0 ${height} Z`;
  return path;
}

const isForeground = (status: AppStateStatus) => status !== "background" && status !== "inactive";

function useAppForeground(): boolean {
  const [foreground, setForeground] = useState(() => isForeground(AppState.currentState));
  useEffect(() => {
    const sub = AppState.addEventListener("change", (status) => setForeground(isForeground(status)));
    return () => sub.remove();
  }, []);
  return foreground;
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
  const clamped = clampLevel(progress, MIN_FILL, MAX_FILL);
  const waveWidth = size * WAVE_WIDTH_MULTIPLIER;
  const bodyHeight = size * 2;
  const hump = waveWidth / 2;
  const wavePath = useMemo(() => buildWavePath(waveWidth, bodyHeight), [waveWidth, bodyHeight]);

  // Mounts at MIN_FILL and rises to the real level: the intro fill-up.
  const level = useLevelAnimation(clamped, {
    initial: MIN_FILL,
    floor: MIN_FILL - LEVEL_HEADROOM,
    ceiling: MAX_FILL + LEVEL_HEADROOM,
  });
  // level 0 → surface at the circle's bottom edge; 1 → at its top. Left on
  // the default "extend" extrapolation so the overshoot can travel past the
  // target instead of stopping dead on it.
  const translateY = useMemo(
    () => level.interpolate({ inputRange: [0, 1], outputRange: [size - WAVE_AMPLITUDE, -WAVE_AMPLITUDE] }),
    [level, size],
  );

  // The wave only runs while it can be seen. Home stays mounted behind every
  // other tab, so an unconditional loop kept a native animation ticking for
  // the whole session.
  // ⚠️ Focus is followed through the navigator's focus/blur events, not
  // useIsFocused: that re-rendered the ring (its SVG and the auto-fitted
  // figure) on every tab switch, both leaving Home and coming back to it,
  // in the very frames the tab slide and the nav ball needed.
  const shift = useRef(new Animated.Value(0)).current;
  const navigation = useNavigation();
  const foreground = useAppForeground();

  useEffect(() => {
    let run: { cancelled: boolean; current: Animated.CompositeAnimation | null } | null = null;
    const cycle = (toValue: number, duration: number) =>
      Animated.timing(shift, { toValue, duration, easing: Easing.linear, useNativeDriver: true });
    const stop = () => {
      if (!run) return;
      run.cancelled = true;
      run.current?.stop();
      run = null;
    };
    const start = () => {
      if (run) return;
      const current = { cancelled: false, current: null as Animated.CompositeAnimation | null };
      run = current;
      const loopFromZero = () => {
        shift.setValue(0);
        current.current = Animated.loop(cycle(-hump, WAVE_LOOP_MS));
        current.current.start();
      };

      // ⚠️ Resumed from where it paused, by finishing that cycle first. A
      // native loop restarts every iteration from the value it STARTED at, so
      // looping straight from a paused offset would jump back there once per
      // cycle — a visible seam. Restarting at 0 instead would jump the surface
      // at the moment the screen comes back. Finishing the partial cycle and
      // then looping whole cycles from 0 avoids both: −hump and 0 draw the same.
      shift.stopAnimation((stoppedAt) => {
        if (current.cancelled) return;
        const done = (((-stoppedAt / hump) % 1) + 1) % 1;
        if (!Number.isFinite(done) || done === 0) {
          loopFromZero();
          return;
        }
        shift.setValue(-done * hump);
        current.current = cycle(-hump, WAVE_LOOP_MS * (1 - done));
        current.current.start(({ finished }) => {
          if (finished && !current.cancelled) loopFromZero();
        });
      });
    };

    const sync = () => (foreground && navigation.isFocused() ? start() : stop());
    sync();
    const offFocus = navigation.addListener("focus", sync);
    const offBlur = navigation.addListener("blur", sync);
    return () => {
      offFocus();
      offBlur();
      stop();
    };
  }, [foreground, navigation, shift, hump]);

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
          style={[
            styles.wave,
            { width: waveWidth, height: bodyHeight, transform: [{ translateY }, { translateX: shift }] },
          ]}
        >
          <Svg width={waveWidth} height={bodyHeight}>
            <Path d={wavePath} fill={color} />
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
