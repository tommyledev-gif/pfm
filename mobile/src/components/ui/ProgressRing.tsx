import Animated, { type SharedValue, useAnimatedProps } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Below this the round caps would still draw a dot at 12 o'clock.
const VISIBLE_FROM = 0.005;

interface ProgressRingProps {
  /** 0–1, read on the UI thread. */
  progress: SharedValue<number>;
  size: number;
  strokeWidth: number;
  color: string;
  trackColor: string;
}

/**
 * A determinate ring that fills clockwise from 12 o'clock: the App Store's
 * download ring at icon size. Driven straight from a shared value, so a
 * running fill costs no React renders.
 */
export function ProgressRing({ progress, size, strokeWidth, color, trackColor }: ProgressRingProps) {
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const arcProps = useAnimatedProps(() => {
    const value = Math.min(Math.max(progress.value, 0), 1);
    return { strokeDashoffset: circumference * (1 - value), strokeOpacity: value < VISIBLE_FROM ? 0 : 1 };
  });

  return (
    // Rotated as a whole so the arc starts at 12 o'clock instead of 3.
    <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
      <Circle cx={center} cy={center} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
      <AnimatedCircle
        cx={center}
        cy={center}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        fill="none"
        animatedProps={arcProps}
      />
    </Svg>
  );
}
