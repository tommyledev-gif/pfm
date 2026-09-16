import { ComponentType, ReactNode, useRef } from "react";
import { Animated, Dimensions, PanResponder, StyleProp, StyleSheet, Vibration, View, ViewStyle } from "react-native";

import { IconProps } from "@/components/ui/icons/primitives";
import { colors, radii } from "@/lib/theme";

export interface SwipeRowAction {
  Icon: ComponentType<IconProps>;
  // Armed background/border color — a solid fill, same "this is a different,
  // committed control, not a tinted resting one" language as
  // SwipeableMessageRow's own pencil.
  color: string;
  onTrigger: () => void;
}

interface SwipeableRowProps {
  children: ReactNode;
  // Revealed on the LEFT edge, dragging the row itself to the right.
  leftAction?: SwipeRowAction;
  // Revealed on the RIGHT edge, dragging the row itself to the left.
  rightAction?: SwipeRowAction;
  disabled?: boolean;
}

const SCREEN_WIDTH = Dimensions.get("window").width;
// Same cap/arm/vibration tuning as ai-chat's SwipeableMessageRow (see that
// file's doc comment for the full rationale) — this is its two-sided sibling:
// SwipeableMessageRow reveals one fixed action on one fixed edge per row,
// while this one lets either edge be armed depending on which way the row is
// actually dragged, for rows that need two distinct actions (Home's "Chờ xác
// nhận" list: edit on a right-drag, delete on a left-drag).
const MAX_SWIPE = SCREEN_WIDTH * 0.2;
const ARM_RATIO = 0.9;
const FADE_LEAD = 0.15;
const FIRE_EPSILON = 0.5;
const ACTIVATION_DISTANCE = 10;
const ARM_VIBRATION_MS = 10;
const FIRE_VIBRATION_MS = 25;

export function SwipeableRow({ children, leftAction, rightAction, disabled }: SwipeableRowProps) {
  // Signed: positive while dragging right (leftAction's territory), negative
  // while dragging left (rightAction's territory). Native-driven so the
  // transform stays off the JS thread.
  const translateX = useRef(new Animated.Value(0)).current;
  // Unsigned 0..1 magnitude per side — kept apart from translateX because
  // color interpolation only exists on the JS driver, and mixing a JS-driven
  // color interpolation onto a native-driven value is what RN rejects (see
  // SwipeableMessageRow's own comment on this exact trap).
  const leftProgress = useRef(new Animated.Value(0)).current;
  const rightProgress = useRef(new Animated.Value(0)).current;
  const armedRef = useRef(false);
  const atMaxRef = useRef(false);
  const activeSideRef = useRef<"left" | "right" | null>(null);
  const baseRef = useRef(0);
  const offsetRef = useRef(0);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const leftActionRef = useRef(leftAction);
  leftActionRef.current = leftAction;
  const rightActionRef = useRef(rightAction);
  rightActionRef.current = rightAction;

  const reset = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
    Animated.timing(leftProgress, { toValue: 0, duration: 180, useNativeDriver: false }).start();
    Animated.timing(rightProgress, { toValue: 0, duration: 180, useNativeDriver: false }).start();
    armedRef.current = false;
    atMaxRef.current = false;
    activeSideRef.current = null;
    offsetRef.current = 0;
    baseRef.current = 0;
  };

  const release = () => {
    if (!atMaxRef.current || disabledRef.current) {
      reset();
      return;
    }
    const side = activeSideRef.current;
    const action = side === "left" ? leftActionRef.current : side === "right" ? rightActionRef.current : undefined;
    if (action) {
      Vibration.vibrate(FIRE_VIBRATION_MS);
      action.onTrigger();
    }
    reset();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        if (disabledRef.current) return false;
        const draggingRight = gesture.dx > 0 && Boolean(leftActionRef.current);
        const draggingLeft = gesture.dx < 0 && Boolean(rightActionRef.current);
        return (
          (draggingRight || draggingLeft) &&
          Math.abs(gesture.dx) > ACTIVATION_DISTANCE &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy)
        );
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        baseRef.current = offsetRef.current;
      },
      onPanResponderMove: (_, gesture) => {
        const total = baseRef.current + gesture.dx;
        const max = leftActionRef.current ? MAX_SWIPE : 0;
        const min = rightActionRef.current ? -MAX_SWIPE : 0;
        const clampedTotal = Math.max(min, Math.min(max, total));
        offsetRef.current = clampedTotal;
        translateX.setValue(clampedTotal);

        const side: "left" | "right" | null = clampedTotal > 0 ? "left" : clampedTotal < 0 ? "right" : null;
        activeSideRef.current = side ?? activeSideRef.current;

        const fraction = Math.abs(clampedTotal) / MAX_SWIPE;
        leftProgress.setValue(side === "left" ? fraction : 0);
        rightProgress.setValue(side === "right" ? fraction : 0);

        if (fraction >= ARM_RATIO && !armedRef.current) {
          armedRef.current = true;
          Vibration.vibrate(ARM_VIBRATION_MS);
        } else if (fraction < ARM_RATIO && armedRef.current) {
          armedRef.current = false;
        }

        atMaxRef.current = Math.abs(clampedTotal) >= MAX_SWIPE - FIRE_EPSILON;
      },
      onPanResponderRelease: release,
      onPanResponderTerminate: reset,
    }),
  ).current;

  const renderIndicator = (
    action: SwipeRowAction | undefined,
    progress: Animated.Value,
    positionStyle: StyleProp<ViewStyle>,
  ) => {
    if (!action) return null;
    const iconOpacity = progress.interpolate({
      inputRange: [ARM_RATIO - FADE_LEAD, ARM_RATIO],
      outputRange: [0, 1],
      extrapolate: "clamp",
    });
    const armedIconOpacity = progress.interpolate({
      inputRange: [ARM_RATIO, 1],
      outputRange: [0, 1],
      extrapolate: "clamp",
    });
    const borderColor = progress.interpolate({
      inputRange: [ARM_RATIO, 1],
      outputRange: [colors.surfaceBorder, action.color],
      extrapolate: "clamp",
    });
    const backgroundColor = progress.interpolate({
      inputRange: [ARM_RATIO, 1],
      outputRange: [colors.surface, action.color],
      extrapolate: "clamp",
    });
    const scale = progress.interpolate({
      inputRange: [ARM_RATIO, 1],
      outputRange: [1, 1.15],
      extrapolate: "clamp",
    });
    const { Icon } = action;

    return (
      <View pointerEvents="none" style={[styles.indicator, positionStyle]}>
        <Animated.View style={[styles.pill, { opacity: iconOpacity, backgroundColor, borderColor, transform: [{ scale }] }]}>
          <Icon size={16} color={colors.textPrimary} />
          <Animated.View style={[StyleSheet.absoluteFill, styles.pillOverlay, { opacity: armedIconOpacity }]}>
            <Icon size={16} color={colors.onGreen} />
          </Animated.View>
        </Animated.View>
      </View>
    );
  };

  return (
    <View style={styles.wrapper}>
      {renderIndicator(leftAction, leftProgress, styles.indicatorLeft)}
      {renderIndicator(rightAction, rightProgress, styles.indicatorRight)}
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: "100%" },
  indicator: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: MAX_SWIPE,
    alignItems: "center",
    justifyContent: "center",
  },
  indicatorLeft: { left: 0 },
  indicatorRight: { right: 0 },
  pill: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  pillOverlay: { alignItems: "center", justifyContent: "center" },
});
