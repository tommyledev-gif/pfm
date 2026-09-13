import { ReactNode, useEffect, useRef } from "react";
import { Animated, Dimensions, PanResponder, StyleSheet, Vibration, View } from "react-native";

import { EditIcon } from "@/components/ui/Icon";
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
  // True for any bubble with nothing for the user to "correct" — in practice
  // every assistant bubble that isn't a transaction proposal. Callers should
  // pass isEditLocked (features/ai-chat/edit-lock.ts) rather than re-deriving
  // this, so the gesture and the modal dispatch can never disagree about
  // which bubbles are editable.
  disabled?: boolean;
  onTriggerEdit: () => void;
}

const SCREEN_WIDTH = Dimensions.get("window").width;
// "swipe tới tầm 20%" — 20% of screen width, not the row's own (variable)
// width, so the gesture feels the same regardless of how short/long a given
// bubble is. This is a hard cap, not just a trigger point: the row can never
// be dragged past it, so "drag until it stops moving" is exactly the 100%
// that fires the edit below.
const MAX_SWIPE = SCREEN_WIDTH * 0.2;
// Where the pencil becomes visible — 90% of the cap. Below this the row just
// slides with no affordance; from here to the cap the pencil is fully opaque
// and filling in with green, which is what tells the user that letting go at
// the cap will commit.
const ARM_RATIO = 0.9;
// The pencil fades in over this much travel before ARM_RATIO, so it arrives
// rather than blinking into existence.
const FADE_LEAD = 0.15;
// Floating-point slack on the "held at the cap" test — clampedTotal is the
// result of a Math.min/max against MAX_SWIPE, so it lands on it exactly in
// practice, but a sub-pixel miss must not swallow the whole gesture.
const FIRE_EPSILON = 0.5;
// Minimum horizontal drag before this row claims the gesture away from
// FlatList's vertical scroll responder and any inner Pressable (e.g. the
// Confirm button on a TransactionActionCard) — small enough that the swipe
// still feels immediate, large enough that an ordinary vertical scroll or
// button tap never gets misread as a swipe.
const ACTIVATION_DISTANCE = 10;
// Two distinct buzzes standing in for haptics (expo-haptics isn't a
// dependency; Vibration is the one haptic-adjacent API react-native ships
// with no extra install): a light tick when the pencil arms at 90%, a
// longer one on the release that actually opens the editor.
const ARM_VIBRATION_MS = 10;
const FIRE_VIBRATION_MS = 25;
// How long the row stays held at the cap after a committing release, before
// springing back. Covers Drawer's own slide-up spring, so the order reads
// left-to-right: the row is still parked open while the sheet rises, and only
// tidies itself away once the sheet has settled at the top. Springing both at
// once made the bubble snap back under a sheet that had barely started
// moving, which looked like the gesture had been cancelled.
const SHEET_SETTLE_MS = 320;

// Messenger-style swipe-to-edit. Dragging the bubble toward its vacated edge
// reveals a pencil at 90% of the 20%-of-screen cap; carrying the drag the
// rest of the way turns that pencil fully green — filled, outlined and
// tinted, a different control rather than a shaded version of the same one —
// and *releasing there* opens the edit modal.
//
// Release, not the moment the cap is reached: holding at the cap is how the
// user reads the armed state and decides. Firing mid-drag took that decision
// away — the sheet appeared under a finger that was still down, with no way
// to back out — whereas sliding back below the cap before letting go now
// cancels cleanly.
//
// This also replaces the older release-then-tap flow, where the row parked
// open with Edit and Cancel buttons and correcting one message cost a swipe,
// a release, and a second aimed tap.
//
// No react-native-gesture-handler/reanimated dependency — plain core
// PanResponder + Animated, since neither library is installed in this
// project (mobile/package.json).
export function SwipeableMessageRow({ children, direction, disabled, onTriggerEdit }: SwipeableMessageRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  // Drives everything about the indicator (opacity, color, scale) as a plain
  // 0..1 fraction of MAX_SWIPE. Deliberately a second Animated.Value rather
  // than an interpolation of translateX: translateX is animated with
  // useNativeDriver so its transform can live on the UI thread, and color
  // interpolation only exists on the JS driver — feeding one from the other
  // would mix drivers on a single animated node, which RN rejects outright.
  const progress = useRef(new Animated.Value(0)).current;
  const armedRef = useRef(false);
  // Whether the drag is currently sitting at the cap — read on release to
  // decide whether this gesture commits or just springs back.
  const atMaxRef = useRef(false);
  // Where the row sat when the current gesture was granted. PanResponder
  // zeroes gesture.dx on every grant, so a drag that gets re-granted part-way
  // through (see onPanResponderTerminationRequest) must be measured from
  // wherever the row already is, not from zero.
  const baseRef = useRef(0);
  const offsetRef = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // PanResponder.create runs once, so `disabled` would otherwise be frozen at
  // whatever it was on first render.
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  const reset = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
    Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: false }).start();
    armedRef.current = false;
    atMaxRef.current = false;
    offsetRef.current = 0;
    baseRef.current = 0;
  };

  const release = () => {
    // disabled is re-checked here and not only in onMoveShouldSetPanResponder:
    // a row that becomes locked mid-drag (or any future caller that engages
    // the responder some other way) must still release into nothing rather
    // than into an edit modal.
    if (!atMaxRef.current || disabledRef.current) {
      reset();
      return;
    }
    // Open the sheet first and leave the row parked at the cap — see
    // SHEET_SETTLE_MS.
    Vibration.vibrate(FIRE_VIBRATION_MS);
    onTriggerEdit();
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(reset, SHEET_SETTLE_MS);
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        if (disabledRef.current) return false;
        const draggingTriggerDirection = direction === "left" ? gesture.dx < 0 : gesture.dx > 0;
        return (
          draggingTriggerDirection &&
          Math.abs(gesture.dx) > ACTIVATION_DISTANCE &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy)
        );
      },
      // Never hand the gesture back once this row owns it. FlatList's own
      // ScrollView asks for it repeatedly during a slow drag (every time the
      // finger wanders a pixel vertically), and granting that request was the
      // "row snaps home, then jumps back under my finger, over and over" bug:
      // each steal ran onPanResponderTerminate's reset, and each re-grant
      // restarted the drag from a freshly-zeroed gesture.dx.
      onPanResponderTerminationRequest: () => false,
      // Android counterpart — stops the native scroll container from taking
      // over the touch stream underneath us for the same reason.
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        if (settleTimer.current) {
          clearTimeout(settleTimer.current);
          settleTimer.current = null;
        }
        baseRef.current = offsetRef.current;
      },
      onPanResponderMove: (_, gesture) => {
        const total = baseRef.current + gesture.dx;
        const clampedTotal =
          direction === "left" ? Math.max(-MAX_SWIPE, Math.min(0, total)) : Math.min(MAX_SWIPE, Math.max(0, total));
        offsetRef.current = clampedTotal;
        translateX.setValue(clampedTotal);

        const fraction = Math.abs(clampedTotal) / MAX_SWIPE;
        progress.setValue(fraction);

        if (fraction >= ARM_RATIO && !armedRef.current) {
          armedRef.current = true;
          Vibration.vibrate(ARM_VIBRATION_MS);
        } else if (fraction < ARM_RATIO && armedRef.current) {
          armedRef.current = false;
        }

        atMaxRef.current = Math.abs(clampedTotal) >= MAX_SWIPE - FIRE_EPSILON;
      },
      onPanResponderRelease: release,
      // A terminated gesture (a parent responder stealing it mid-drag) is not
      // a deliberate release, so it never commits.
      onPanResponderTerminate: reset,
    }),
  ).current;

  const iconOpacity = progress.interpolate({
    inputRange: [ARM_RATIO - FADE_LEAD, ARM_RATIO],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  // Armed state is a solid green pill with a dark glyph — the app's primary
  // button, not a tinted version of the resting one — so "released here and
  // it opens" is unmistakable at a glance.
  //
  // The dark glyph is a second, stacked copy of the same icon cross-faded on
  // top of the neutral one: EditIcon's `color` lands on an SVG stroke, which
  // a plain Animated value can't drive without wrapping the whole icon in
  // createAnimatedComponent.
  const armedIconOpacity = progress.interpolate({
    inputRange: [ARM_RATIO, 1],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const borderColor = progress.interpolate({
    inputRange: [ARM_RATIO, 1],
    outputRange: [colors.surfaceBorder, colors.green],
    extrapolate: "clamp",
  });
  const backgroundColor = progress.interpolate({
    inputRange: [ARM_RATIO, 1],
    outputRange: [colors.surface, colors.green],
    extrapolate: "clamp",
  });
  const scale = progress.interpolate({
    inputRange: [ARM_RATIO, 1],
    outputRange: [1, 1.15],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.wrapper}>
      <View
        pointerEvents="none"
        style={[styles.indicator, direction === "left" ? styles.indicatorRight : styles.indicatorLeft]}
      >
        <Animated.View
          style={[styles.pencil, { opacity: iconOpacity, backgroundColor, borderColor, transform: [{ scale }] }]}
        >
          <EditIcon size={16} color={colors.textPrimary} />
          <Animated.View style={[StyleSheet.absoluteFill, styles.pencilOverlay, { opacity: armedIconOpacity }]}>
            <EditIcon size={16} color={colors.onGreen} />
          </Animated.View>
        </Animated.View>
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
  pencil: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  pencilOverlay: { alignItems: "center", justifyContent: "center" },
});
