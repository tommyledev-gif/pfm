import { ReactNode, useEffect } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";

import { SwipeAction, SwipeActionButton } from "@/components/shared/SwipeActionButton";
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
}

/**
 * A row with up to two swipe-revealed actions.
 *
 * ⚠️ Releasing the drag reveals a button; it does not act. The action fires
 * only when that button is tapped, which is what stops an accidental flick
 * from deleting something. See use-swipe-actions for the gesture itself.
 */
export function SwipeableRow({ children, leftAction, rightAction, disabled, closeSignal }: SwipeableRowProps) {
  // A destructive side gets the wider cap so its parked button has room for a
  // label; a plain one keeps the narrower, long-standing feel.
  const leftRatio = leftAction?.destructive ? DELETE_SWIPE_RATIO : EDIT_SWIPE_RATIO;
  const rightRatio = rightAction?.destructive ? DELETE_SWIPE_RATIO : EDIT_SWIPE_RATIO;

  const swipe = useSwipeActions({
    left: leftAction ? { ratio: leftRatio } : undefined,
    right: rightAction ? { ratio: rightRatio } : undefined,
    disabled,
  });

  const { close } = swipe;
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
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: "100%" },
  left: { left: 0 },
  right: { right: 0 },
});
