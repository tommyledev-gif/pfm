import { ReactNode, useEffect, useMemo } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";

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
}

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
  const handleProgress = useMemo(() => Animated.add(leftProgress, rightProgress), [leftProgress, rightProgress]);
  const handlesHidden = swipe.parkedSide !== null;
  useEffect(() => {
    close();
  }, [closeSignal, close]);

  const wrap = (action: SwipeAction): SwipeAction => ({
    ...action,
    onPress: () => {
      // Closed before the action runs: a navigation that leaves this screen
      // must not come back to a row still hanging open.
      close();
      action.onPress();
    },
  });

  return (
    <View style={styles.wrapper}>
      {leftAction ? (
        <SwipeActionButton
          action={wrap(leftAction)}
          progress={swipe.leftProgress}
          width={SCREEN_WIDTH * leftRatio}
          parked={swipe.parkedSide === "left"}
          positionStyle={styles.left}
        />
      ) : null}
      {rightAction ? (
        <SwipeActionButton
          action={wrap(rightAction)}
          progress={swipe.rightProgress}
          width={SCREEN_WIDTH * rightRatio}
          parked={swipe.parkedSide === "right"}
          positionStyle={styles.right}
        />
      ) : null}
      <Animated.View style={{ transform: [{ translateX: swipe.translateX }] }} {...swipe.panHandlers}>
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
