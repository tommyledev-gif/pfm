import { ReactNode } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, {
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

interface NavIconFadeProps {
  index: number;
  /** The lit tab, from useNavBallMotion. */
  activeIcon: SharedValue<number>;
  /** This tab is lit on first render. */
  initiallyActive: boolean;
  /** On the ball: shown while its tab is lit. In the row: hidden then, under the ball. */
  onBall: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * One BottomNav icon fading with the lit tab, on the UI thread. Every icon
 * is mounted at once and each fades itself: a switch is a cross-fade with
 * nothing swapped from JS (a JS swap landed frames after the native fade and
 * flashed the previous icon on the ball). Every icon goes to its resting
 * state, so a switch landing mid-way through the last leaves none half faded.
 */
export function NavIconFade({ index, activeIcon, initiallyActive, onBall, style, children }: NavIconFadeProps) {
  const opacity = useSharedValue(onBall === initiallyActive ? 1 : 0);

  useAnimatedReaction(
    () => activeIcon.value === index,
    (lit, wasLit) => {
      if (wasLit === null || lit === wasLit) return;
      opacity.value = onBall
        ? withDelay(lit ? 60 : 0, withTiming(lit ? 1 : 0, { duration: lit ? 180 : 120 }))
        : withTiming(lit ? 0 : 1, { duration: lit ? 160 : 220 });
    },
  );

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[style, fade]}>{children}</Animated.View>;
}
