import { useEffect, useRef } from "react";
import { Animated, Dimensions, PanResponder, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CloseIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { colors, radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useToastStore, type ToastVariant } from "@/stores/toast-store";

const AUTO_DISMISS_MS = 5000;
const CARD_MARGIN = spacing.xl;
const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = SCREEN_WIDTH - CARD_MARGIN * 2;
// "swipe it more than 80% of its width and continue a bit more" — the
// release threshold sits a little past 80% so a drag that merely touches
// 80% and stalls still springs back; only a drag that keeps going past it
// commits to the dismiss.
const HORIZONTAL_DISMISS_RATIO = 0.85;
const VERTICAL_DISMISS_PX = 24;
const OFFSCREEN_Y = -160;

// Getters, not values: read at render time so they follow a theme switch
// (see src/theme/active-palette.ts).
const VARIANT_ACCENT: Record<ToastVariant, string> = {
  get error() { return colors.error; },
  get warning() { return colors.warning; },
  get info() { return colors.info; },
};

// Slides down from above the screen to rest just under the safe area,
// auto-dismisses after 5s, and can be swiped away — up (any distance past a
// small threshold) or sideways (past ~85% of its own width) — mirroring an
// iOS-style notification banner's swipe-to-dismiss. Mounted once in
// app/_layout.tsx, driven globally via useToastStore (see that file's doc
// comment) — no react-native-gesture-handler/reanimated dependency, plain
// core PanResponder + Animated, same as SwipeableMessageRow/DebugBubble.
export function Toast() {
  const colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const visible = useToastStore((s) => s.visible);
  const message = useToastStore((s) => s.message);
  const variant = useToastStore((s) => s.variant);
  const token = useToastStore((s) => s.token);
  const hide = useToastStore((s) => s.hide);

  const translateY = useRef(new Animated.Value(OFFSCREEN_Y)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);

  const clearDismissTimer = () => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  };

  const dismiss = (direction: "up" | "left" | "right" | "none") => {
    clearDismissTimer();
    const target =
      direction === "up"
        ? { x: 0, y: OFFSCREEN_Y }
        : direction === "left"
          ? { x: -SCREEN_WIDTH, y: 0 }
          : direction === "right"
            ? { x: SCREEN_WIDTH, y: 0 }
            : { x: 0, y: OFFSCREEN_Y };
    Animated.parallel([
      Animated.timing(translateY, { toValue: target.y, duration: 200, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: target.x, duration: 200, useNativeDriver: true }),
    ]).start(() => hide());
  };

  // Re-triggers on every show() (token changes even if a toast was already
  // visible) — resets the swipe offset, slides in fresh, and restarts the
  // 5s auto-dismiss clock.
  useEffect(() => {
    if (!visible || token === 0) return;
    mounted.current = true;
    clearDismissTimer();
    translateX.setValue(0);
    translateY.setValue(OFFSCREEN_Y);
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
    dismissTimer.current = setTimeout(() => dismiss("up"), AUTO_DISMISS_MS);
    return clearDismissTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => clearDismissTimer, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6,
      onPanResponderGrant: () => {
        clearDismissTimer();
      },
      onPanResponderMove: (_, gesture) => {
        if (Math.abs(gesture.dy) > Math.abs(gesture.dx)) {
          // Vertical drag only ever follows upward — dragging down further
          // than the docked position isn't a gesture this banner supports.
          translateY.setValue(Math.min(0, gesture.dy));
          translateX.setValue(0);
        } else {
          translateX.setValue(gesture.dx);
          translateY.setValue(0);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        const verticalDominant = Math.abs(gesture.dy) > Math.abs(gesture.dx);
        if (verticalDominant && gesture.dy <= -VERTICAL_DISMISS_PX) {
          dismiss("up");
          return;
        }
        if (!verticalDominant && Math.abs(gesture.dx) >= CARD_WIDTH * HORIZONTAL_DISMISS_RATIO) {
          dismiss(gesture.dx < 0 ? "left" : "right");
          return;
        }
        // Snap back — didn't cross a dismiss threshold.
        Animated.parallel([
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 6 }),
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 6 }),
        ]).start();
        dismissTimer.current = setTimeout(() => dismiss("up"), AUTO_DISMISS_MS);
      },
    }),
  ).current;

  if (!mounted.current && !visible) return null;

  return (
    <View pointerEvents="box-none" style={[styles.container, { top: insets.top + spacing.sm }]}>
      <Animated.View
        style={[
          styles.card,
          { borderColor: withAlpha(VARIANT_ACCENT[variant], 0.45), transform: [{ translateX }, { translateY }] },
        ]}
        {...panResponder.panHandlers}
      >
        <Text style={styles.message} numberOfLines={3}>
          {message}
        </Text>
        <Pressable onPress={() => dismiss("up")} hitSlop={8}>
          <CloseIcon size={14} color={colors.textPrimary} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  container: {
    position: "absolute",
    left: CARD_MARGIN,
    right: CARD_MARGIN,
    zIndex: 10000,
    elevation: 10000,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    // The variant is carried by one even border all the way round, softened —
    // not a thick accent stripe down the left edge, which is the stock
    // "alert" look and read as decoration rather than as part of the card.
    borderWidth: 1,
    borderRadius: radii.listCard,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  message: { flex: 1, ...typography.label, color: colors.textPrimary },
}));
