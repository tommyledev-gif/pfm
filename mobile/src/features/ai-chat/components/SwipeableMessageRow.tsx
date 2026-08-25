import { ReactNode, useRef } from "react";
import { Animated, Dimensions, PanResponder, StyleSheet, Vibration, View } from "react-native";

import { EditIcon } from "@/components/ui/Icon";
import { colors, radii } from "@/lib/theme";

// Which way this row must be dragged to trigger edit — the opposite edge
// from wherever the bubble already sits, same convention as Messenger's own
// swipe-to-reply (drag a right-aligned bubble left, a left-aligned one
// right) so the edit icon reveals itself from the edge the bubble just
// vacated instead of colliding with it.
export type SwipeDirection = "left" | "right";

interface SwipeableMessageRowProps {
  children: ReactNode;
  direction: SwipeDirection;
  // True for the AI's own clarifying question and a budget-wizard card —
  // nothing there for the user to "correct" (mirrors the old
  // openLongPressTarget early-return this replaces).
  disabled?: boolean;
  onTriggerEdit: () => void;
}

const SCREEN_WIDTH = Dimensions.get("window").width;
// "swipe tới tầm 20%" — 20% of screen width, not the row's own (variable)
// width, so the gesture feels the same regardless of how short/long a given
// bubble is.
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.2;
// Minimum horizontal drag before this row claims the gesture away from
// FlatList's vertical scroll responder and any inner Pressable (e.g. the
// Confirm button on a TransactionActionCard) — small enough that the swipe
// still feels immediate, large enough that an ordinary vertical scroll or
// button tap never gets misread as a swipe.
const ACTIVATION_DISTANCE = 10;
// Short, single buzz standing in for the "rung nhẹ" (light haptic) the
// moment the drag crosses the trigger threshold — expo-haptics isn't a
// dependency of this project, and Vibration is the one haptic-adjacent API
// react-native ships with no extra install.
const THRESHOLD_VIBRATION_MS = 10;

// Replaces the old 500ms/2000ms long-press-to-edit gesture on chat bubbles
// (ai-chat.tsx) with a Messenger-style swipe: drag past SWIPE_THRESHOLD and
// release to open the edit modal, short of it and release to snap back with
// no effect. No react-native-gesture-handler/reanimated dependency — plain
// core PanResponder + Animated, since neither library is installed in this
// project (mobile/package.json) and this gesture doesn't need anything a
// spring-back Animated.Value can't already do.
export function SwipeableMessageRow({ children, direction, disabled, onTriggerEdit }: SwipeableMessageRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const crossedThreshold = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        if (disabled) return false;
        const draggingTriggerDirection = direction === "left" ? gesture.dx < 0 : gesture.dx > 0;
        return (
          draggingTriggerDirection &&
          Math.abs(gesture.dx) > ACTIVATION_DISTANCE &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy)
        );
      },
      onPanResponderMove: (_, gesture) => {
        const dx = direction === "left" ? Math.min(0, gesture.dx) : Math.max(0, gesture.dx);
        translateX.setValue(dx);
        const pastThreshold = Math.abs(dx) >= SWIPE_THRESHOLD;
        if (pastThreshold && !crossedThreshold.current) {
          crossedThreshold.current = true;
          Vibration.vibrate(THRESHOLD_VIBRATION_MS);
        } else if (!pastThreshold && crossedThreshold.current) {
          crossedThreshold.current = false;
        }
      },
      onPanResponderRelease: () => {
        const triggered = crossedThreshold.current;
        crossedThreshold.current = false;
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start();
        if (triggered) onTriggerEdit();
      },
      onPanResponderTerminate: () => {
        crossedThreshold.current = false;
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const iconOpacity = translateX.interpolate({
    inputRange: direction === "left" ? [-SWIPE_THRESHOLD, 0] : [0, SWIPE_THRESHOLD],
    outputRange: direction === "left" ? [1, 0] : [0, 1],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.wrapper}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.indicator,
          direction === "left" ? styles.indicatorRight : styles.indicatorLeft,
          { opacity: iconOpacity },
        ]}
      >
        <EditIcon size={16} color={colors.textPrimary} />
      </Animated.View>
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
    width: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
  },
  indicatorLeft: { left: 0 },
  indicatorRight: { right: 0 },
});
