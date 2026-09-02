import { ReactNode, useRef, useState } from "react";
import { Animated, Dimensions, PanResponder, Pressable, StyleSheet, Vibration, View } from "react-native";

import { CloseIcon, EditIcon } from "@/components/ui/Icon";
import { colors, radii } from "@/lib/theme";

// Which way this row must be dragged to reveal its actions — the opposite
// edge from wherever the bubble already sits, same convention as Messenger's
// own swipe-to-reply (drag a right-aligned bubble left, a left-aligned one
// right) so the revealed edge is the one the bubble just vacated instead of
// colliding with it.
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
// bubble is. This is now a hard cap, not just a trigger point — the row can
// never be dragged past it (previously it kept following the finger with no
// upper bound, letting the card overflow off-screen).
const MAX_SWIPE = SCREEN_WIDTH * 0.2;
// Fraction of MAX_SWIPE the drag must cross for a release to snap the row
// fully open (revealing the Edit/Cancel buttons) instead of springing back
// closed with no effect.
const OPEN_RATIO = 0.6;
// Minimum horizontal drag before this row claims the gesture away from
// FlatList's vertical scroll responder and any inner Pressable (e.g. the
// Confirm button on a TransactionActionCard) — small enough that the swipe
// still feels immediate, large enough that an ordinary vertical scroll or
// button tap never gets misread as a swipe.
const ACTIVATION_DISTANCE = 10;
// Short, single buzz standing in for the "rung nhẹ" (light haptic) the
// moment the drag crosses into "would open on release" territory —
// expo-haptics isn't a dependency of this project, and Vibration is the one
// haptic-adjacent API react-native ships with no extra install.
const OPEN_VIBRATION_MS = 10;

// Messenger-style swipe: drag reveals two icon buttons (Edit / Cancel) at
// the vacated edge, capped at 20% of screen width so the row can never
// overflow off-screen. Unlike a flick-and-auto-fire gesture, releasing past
// the open ratio just leaves the row open — the user must explicitly tap
// Edit or Cancel (or drag it back closed) to act, which is also what makes
// the two buttons tappable targets instead of a decoration. No react-native-
// gesture-handler/reanimated dependency — plain core PanResponder + Animated,
// since neither library is installed in this project (mobile/package.json).
export function SwipeableMessageRow({ children, direction, disabled, onTriggerEdit }: SwipeableMessageRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);
  const crossedOpenRef = useRef(false);
  const lastTotalRef = useRef(0);
  const [open, setOpen] = useState(false);

  const cap = direction === "left" ? -MAX_SWIPE : MAX_SWIPE;

  const springTo = (toValue: number, isOpen: boolean) => {
    Animated.spring(translateX, { toValue, useNativeDriver: true, bounciness: 8 }).start();
    openRef.current = isOpen;
    setOpen(isOpen);
  };

  const close = () => springTo(0, false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        if (disabled) return false;
        if (openRef.current) return Math.abs(gesture.dx) > 2 && Math.abs(gesture.dx) > Math.abs(gesture.dy);
        const draggingTriggerDirection = direction === "left" ? gesture.dx < 0 : gesture.dx > 0;
        return (
          draggingTriggerDirection &&
          Math.abs(gesture.dx) > ACTIVATION_DISTANCE &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy)
        );
      },
      onPanResponderGrant: () => {
        const base = openRef.current ? cap : 0;
        translateX.setOffset(base);
        translateX.setValue(0);
        lastTotalRef.current = base;
      },
      onPanResponderMove: (_, gesture) => {
        const base = openRef.current ? cap : 0;
        const total = base + gesture.dx;
        const clampedTotal =
          direction === "left" ? Math.max(-MAX_SWIPE, Math.min(0, total)) : Math.min(MAX_SWIPE, Math.max(0, total));
        lastTotalRef.current = clampedTotal;
        translateX.setValue(clampedTotal - base);

        const pastOpenRatio = Math.abs(clampedTotal) >= MAX_SWIPE * OPEN_RATIO;
        if (pastOpenRatio && !crossedOpenRef.current) {
          crossedOpenRef.current = true;
          Vibration.vibrate(OPEN_VIBRATION_MS);
        } else if (!pastOpenRatio && crossedOpenRef.current) {
          crossedOpenRef.current = false;
        }
      },
      onPanResponderRelease: () => {
        translateX.flattenOffset();
        crossedOpenRef.current = false;
        const shouldOpen = Math.abs(lastTotalRef.current) >= MAX_SWIPE * OPEN_RATIO;
        springTo(shouldOpen ? cap : 0, shouldOpen);
      },
      onPanResponderTerminate: () => {
        translateX.flattenOffset();
        crossedOpenRef.current = false;
        springTo(openRef.current ? cap : 0, openRef.current);
      },
    }),
  ).current;

  const iconOpacity = translateX.interpolate({
    inputRange: direction === "left" ? [-MAX_SWIPE, 0] : [0, MAX_SWIPE],
    outputRange: direction === "left" ? [1, 0] : [0, 1],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.wrapper}>
      <View
        pointerEvents={open ? "box-none" : "none"}
        style={[styles.indicator, direction === "left" ? styles.indicatorRight : styles.indicatorLeft]}
      >
        {open ? (
          <View style={styles.actionRow}>
            <Pressable
              style={styles.actionButton}
              onPress={() => {
                close();
                onTriggerEdit();
              }}
              hitSlop={6}
            >
              <EditIcon size={14} color={colors.textPrimary} />
            </Pressable>
            <Pressable style={styles.actionButton} onPress={close} hitSlop={6}>
              <CloseIcon size={14} color={colors.textPrimary} />
            </Pressable>
          </View>
        ) : (
          <Animated.View style={[styles.singleIndicator, { opacity: iconOpacity }]}>
            <EditIcon size={16} color={colors.textPrimary} />
          </Animated.View>
        )}
      </View>
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
  singleIndicator: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: "center",
    justifyContent: "center",
  },
});
