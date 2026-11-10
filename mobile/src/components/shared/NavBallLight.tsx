import { memo, useMemo } from "react";
import { Animated, StyleSheet } from "react-native";
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from "react-native-svg";

import {
  BALL_SINK,
  BALL_SIZE,
  HOLLOW_DEPTH,
  PILL_HEIGHT,
  hollowPathAt,
  rimPathAt,
} from "@/components/shared/bottom-nav-styles";
import { useColors, useThemeDefinition } from "@/lib/theme";

// The light's own box: wider than the hollow so the glow can spill onto the
// bar either side of it, and as tall as the bar. Centred on the ball.
const HALF_WIDTH = 52;
const WIDTH = HALF_WIDTH * 2;
const CX = HALF_WIDTH;
const SOCKET_RADIUS = HOLLOW_DEPTH - BALL_SINK;
// Where the light leaves the ball: 30% of the way up from its bottom.
const SOURCE_Y = BALL_SINK + BALL_SIZE / 2 - BALL_SIZE * 0.3;
// The glow pools just above the hollow's floor and spills onto the bar.
const GLOW_CY = HOLLOW_DEPTH - 6;
const GLOW_RX = 46;
const GLOW_RY = 24;
// Narrower than tall, from the source: lights the floor of the bowl most and
// its upper sides least — a fan pointing down, without a hard-edged wedge.
const BEAM_RX = SOCKET_RADIUS - 2;
const BEAM_RY = (HOLLOW_DEPTH - SOURCE_Y) * 1.45;
// The rim catches the light where the beam lands — the bottom of the bowl —
// and fades out before the corners where it meets the bar.
const RIM_GLOW_R = SOCKET_RADIUS + 2;
// The light breathes with the ball's idle float: brightest seated, dimmer
// at the top of its drift.
const RAISED_INTENSITY = 0.7;

const HOLLOW = hollowPathAt(CX);
const RIM = rimPathAt(CX);

interface NavBallLightProps {
  /** The ball's left edge — the same value that moves the ball and its hollow. */
  ballX: Animated.Value;
  /** The ball's idle float, 0 seated → 1 raised. */
  bob: Animated.AnimatedInterpolation<number>;
}

/**
 * The active nav ball as a small lamp (dark theme only): a soft neon glow
 * cast down from it, a fan of light filling the hollow so it reads as a lit
 * bowl rather than a black hole, and a thin rim highlight where that light
 * meets the hollow's curved edge.
 *
 * Gradients only — no blur filter, which react-native-svg cannot be relied on
 * for — and one SVG riding ballX on the native driver, like the hollow
 * itself. The light theme keeps the plain ball: on white this reads as a
 * smudge.
 */
export const NavBallLight = memo(function NavBallLight({ ballX, bob }: NavBallLightProps) {
  const colors = useColors();
  const { isDark } = useThemeDefinition();
  // Built once: a new node on a native-driven view resets it for a frame.
  // One animated value per view (see useNavBallMotion): the box slides with
  // ballX, the light inside it breathes with the bob. Hidden until the ball
  // is placed by BottomNav's reveal layer, which this sits in.
  const slide = useMemo(() => ({ transform: [{ translateX: ballX }] }), [ballX]);
  const breathe = useMemo(
    () => ({ opacity: bob.interpolate({ inputRange: [0, 1], outputRange: [1, RAISED_INTENSITY] }) }),
    [bob],
  );
  if (!isDark) return null;

  const glow = colors.navGlow;

  return (
    <Animated.View pointerEvents="none" style={[styles.box, slide]}>
      <Animated.View style={[styles.fill, breathe]}>
        <Svg width={WIDTH} height={PILL_HEIGHT}>
          <Defs>
            <RadialGradient id="glow" gradientUnits="userSpaceOnUse" cx={CX} cy={GLOW_CY} rx={GLOW_RX} ry={GLOW_RY}>
              <Stop offset="0" stopColor={glow} stopOpacity={0.22} />
              <Stop offset="0.5" stopColor={glow} stopOpacity={0.08} />
              <Stop offset="1" stopColor={glow} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="beam" gradientUnits="userSpaceOnUse" cx={CX} cy={SOURCE_Y} rx={BEAM_RX} ry={BEAM_RY}>
              <Stop offset="0" stopColor={glow} stopOpacity={0.5} />
              <Stop offset="0.6" stopColor={glow} stopOpacity={0.18} />
              <Stop offset="1" stopColor={glow} stopOpacity={0.02} />
            </RadialGradient>
            <RadialGradient id="rim" gradientUnits="userSpaceOnUse" cx={CX} cy={HOLLOW_DEPTH} r={RIM_GLOW_R}>
              <Stop offset="0" stopColor={glow} stopOpacity={0.95} />
              <Stop offset="0.45" stopColor={glow} stopOpacity={0.45} />
              <Stop offset="1" stopColor={glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={CX} cy={GLOW_CY} rx={GLOW_RX} ry={GLOW_RY} fill="url(#glow)" />
          <Path d={HOLLOW} fill="url(#beam)" />
          {/* A faint wide pass under a thin bright one: the rim reads as a
              reflective edge, not a painted line. */}
          <Path d={RIM} stroke="url(#rim)" strokeWidth={3} strokeOpacity={0.3} fill="none" />
          <Path d={RIM} stroke="url(#rim)" strokeWidth={1.2} fill="none" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  box: { position: "absolute", top: 0, left: BALL_SIZE / 2 - HALF_WIDTH, width: WIDTH, height: PILL_HEIGHT },
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
});
