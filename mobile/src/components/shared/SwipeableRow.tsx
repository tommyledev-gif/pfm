import { ReactNode, useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue } from "react-native-reanimated";

import { SwipeAction, SwipeActionButton } from "@/components/shared/SwipeActionButton";
import { SwipeHandle } from "@/components/shared/SwipeHandle";
import { DELETE_SWIPE_RATIO, EDIT_SWIPE_RATIO, useSwipeActions } from "@/components/shared/use-swipe-actions";

export type { SwipeAction } from "@/components/shared/SwipeActionButton";

const SCREEN_WIDTH = Dimensions.get("window").width;

interface SwipeableRowProps {
  children: ReactNode;
  /** Revealed on the LEFT edge, dragging the row to the right. */
  leftAction?: SwipeAction;
  /** Revealed on the RIGHT edge, dragging the row to the left. */
  rightAction?: SwipeAction;
  disabled?: boolean;
  /**
   * Bumped by the parent whenever the surrounding list changes, is scrolled,
   * or is refreshed. Any change closes a parked row — a revealed button must
   * never be left pointing at content that has moved underneath it.
   */
  closeSignal?: number | string;
  /**
   * Opt-in: a grip bar at the edge of each side that has an action, so the
   * row looks draggable before anyone has tried (see SwipeHandle). Off by
   * default — only lists that need the cue turn it on.
   */
  showHandles?: boolean;
  /**
   * Opt-in: one peek toward the right-hand action (else the left) shortly
   * after mounting, so the row says it swipes without grips on its edges.
   */
  peek?: boolean;
  /** The revealed actions fill their whole strip in their colour (SwipeActionButton). */
  fill?: boolean;
}

// After the row has settled into view, so the peek reads as a hint, not as
// part of the screen arriving.
const PEEK_DELAY_MS = 700;

/**
 * A row with up to two swipe-revealed actions.
 *
 * ⚠️ Releasing the drag reveals a button; it does not act. The action fires
 * only when that button is tapped, which is what stops an accidental flick
 * from deleting something. See use-swipe-actions for the gesture itself.
 */
export function SwipeableRow({
  children,
  leftAction,
  rightAction,
  disabled,
  closeSignal,
  showHandles = false,
  peek = false,
  fill = false,
}: SwipeableRowProps) {
  // A destructive side gets the wider cap so its parked button has room for a
  // label; a plain one keeps the narrower, long-standing feel.
  const leftRatio = leftAction?.destructive ? DELETE_SWIPE_RATIO : EDIT_SWIPE_RATIO;
  const rightRatio = rightAction?.destructive ? DELETE_SWIPE_RATIO : EDIT_SWIPE_RATIO;

  const swipe = useSwipeActions({
    left: leftAction ? { ratio: leftRatio } : undefined,
    right: rightAction ? { ratio: rightRatio } : undefined,
    disabled,
  });

  const { close, leftProgress, rightProgress } = swipe;
  // Only one side ever moves at a time, so the sum is "how far into a swipe,
  // either way" — both handles fade on any drag.
  const handleProgress = useDerivedValue(() => leftProgress.value + rightProgress.value);
  const { translateX } = swipe;
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const handlesHidden = swipe.parkedSide !== null;
  useEffect(() => {
    close();
  }, [closeSignal, close]);

  const { nudge } = swipe;
  const peekSide = rightAction ? "right" : leftAction ? "left" : null;
  useEffect(() => {
    if (!peek || !peekSide || disabled) return;
    const timer = setTimeout(() => nudge(peekSide), PEEK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [peek, peekSide, disabled, nudge]);

  const wrap = (action: SwipeAction): SwipeAction => ({
    ...action,
    onPress: () => {
      // Closed before the action runs: a navigation that leaves this screen
      // must not come back to a row still hanging open.
      close();
      action.onPress();
    },
  });

  // ⚠️ The gesture lives on this wrapper, which never moves; only the content
  // inside it slides. With the pan handlers on the sliding view itself, the
  // view under the finger moved on every move event while it was measuring
  // that same touch, and on Android the coordinates of a transformed
  // responder fed back into its own position: a finger held still mid-swipe
  // made the row shake from side to side. Here a drag that starts on a
  // revealed button can also close the row.
  //
  // ⚠️ collapsable={false}: a View with nothing but layout is flattened away
  // on Fabric, and the responder then had no native view to stop the parent
  // ScrollView intercepting from — the list stole the touch on any vertical
  // drift and the swipe kept restarting.
  return (
    <View style={styles.wrapper} collapsable={false} {...swipe.panHandlers}>
      {leftAction ? (
        <SwipeActionButton
          action={wrap(leftAction)}
          progress={swipe.leftProgress}
          width={SCREEN_WIDTH * leftRatio}
          parked={swipe.parkedSide === "left"}
          positionStyle={styles.left}
          fill={fill}
        />
      ) : null}
      {rightAction ? (
        <SwipeActionButton
          action={wrap(rightAction)}
          progress={swipe.rightProgress}
          width={SCREEN_WIDTH * rightRatio}
          parked={swipe.parkedSide === "right"}
          positionStyle={styles.right}
          fill={fill}
        />
      ) : null}
      <Animated.View style={slide}>
        {children}
        {/* After the content, so they paint over the card they sit on. */}
        {showHandles && leftAction ? (
          <SwipeHandle side="left" destructive={leftAction.destructive} progress={handleProgress} hidden={handlesHidden} />
        ) : null}
        {showHandles && rightAction ? (
          <SwipeHandle side="right" destructive={rightAction.destructive} progress={handleProgress} hidden={handlesHidden} />
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: "100%" },
  left: { left: 0 },
  right: { right: 0 },
});
