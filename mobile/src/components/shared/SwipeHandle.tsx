import Animated, { DerivedValue, Extrapolation, interpolate, useAnimatedStyle } from "react-native-reanimated";

import { PARK_THRESHOLD_RATIO, SwipeSide } from "@/components/shared/use-swipe-actions";
import { createStyles, useColors } from "@/lib/theme";

const HANDLE_WIDTH = 4;
const HANDLE_HEIGHT = 20;
// From the card's outer edge. Inside the row's own padding (12 + 1 border),
// so it clears whatever sits at the card's edge without taking any width.
const HANDLE_INSET = 5;
const HANDLE_OPACITY = 0.5;

interface SwipeHandleProps {
  side: SwipeSide;
  destructive?: boolean;
  /** Swipe travel toward either side, 0 at rest — the handle fades out with it. */
  progress: DerivedValue<number>;
  /** A row parked open hides its handles entirely. */
  hidden: boolean;
}

/**
 * A small grip bar at the edge of a swipeable row, on each side that has an
 * action — the row's own cue that it can be dragged, shown before anyone has
 * tried. Rides with the row (rendered inside its moving layer), fades out as
 * the drag gets going, and is gone while the row is parked open.
 */
export function SwipeHandle({ side, destructive, progress, hidden }: SwipeHandleProps) {
  const colors = useColors();
  const styles = useStyles();
  const fade = useAnimatedStyle(() => ({
    opacity: hidden ? 0 : interpolate(progress.value, [0, PARK_THRESHOLD_RATIO], [HANDLE_OPACITY, 0], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View
      testID={`swipe-handle-${side}`}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.handle,
        side === "left" ? styles.left : styles.right,
        { backgroundColor: destructive ? colors.danger : colors.textSecondary },
        fade,
      ]}
    />
  );
}

const useStyles = createStyles(() => ({
  handle: {
    position: "absolute",
    top: "50%",
    marginTop: -HANDLE_HEIGHT / 2,
    width: HANDLE_WIDTH,
    height: HANDLE_HEIGHT,
    borderRadius: HANDLE_WIDTH / 2,
  },
  left: { left: HANDLE_INSET },
  right: { right: HANDLE_INSET },
}));
