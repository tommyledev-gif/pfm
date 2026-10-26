import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Dimensions, LayoutChangeEvent, PixelRatio, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { SwipeAction, SwipeActionButton } from "@/components/shared/SwipeActionButton";
import { DELETE_SWIPE_RATIO, EDIT_SWIPE_RATIO } from "@/components/shared/swipe-config";
import { markTouchOnRow } from "@/components/shared/swipe-registry";
import { useScrollSwipe } from "@/components/shared/use-scroll-swipe";

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
 * from deleting something. See use-scroll-swipe for the gesture itself.
 *
 * The strips sit behind a transparent ScrollView whose middle page is the
 * row: dragging slides the row off a strip's indicator, which fades and arms
 * with the travel. A parked row's real button is drawn in the ScrollView's
 * own strip page, over the indicator's place, since the ScrollView covers
 * anything behind it from touches.
 */
export function SwipeableRow({
  children,
  leftAction,
  rightAction,
  disabled = false,
  closeSignal,
  peek = false,
  fill = false,
}: SwipeableRowProps) {
  // A destructive side gets the wider cap so its parked button has room for a
  // label; a plain one keeps the narrower, long-standing feel. Whole device
  // pixels: a scroll offset is one, and a strip a fraction wider could never
  // be scrolled exactly home.
  const stripWidth = (action: SwipeAction | undefined) =>
    action ? PixelRatio.roundToNearestPixel(SCREEN_WIDTH * (action.destructive ? DELETE_SWIPE_RATIO : EDIT_SWIPE_RATIO)) : 0;
  const leftWidth = stripWidth(leftAction);
  const rightWidth = stripWidth(rightAction);
  const swipe = useScrollSwipe({ leftWidth, rightWidth, disabled });
  const { close, nudge, parkedSide, rest } = swipe;

  // ⚠️ The row page must be exactly the row's width, known before the first
  // frame: measured in a layout effect, which on the New Architecture reads
  // the layout just computed and re-renders before anything is drawn. Later
  // size changes (rotation) come through onLayout.
  const wrapperRef = useRef<View>(null);
  const [rowWidth, setRowWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    wrapperRef.current?.measure((_x, _y, width) => {
      if (width > 0) setRowWidth(width);
    });
  }, []);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0 && width !== rowWidth) setRowWidth(width);
  };

  useEffect(() => {
    close();
  }, [closeSignal, close]);

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

  const snapOffsets = [...(leftAction ? [0] : []), rest, ...(rightAction ? [rest + rightWidth] : [])];

  return (
    <View
      ref={wrapperRef}
      style={styles.wrapper}
      onLayout={onLayout}
      onTouchStart={(event) => markTouchOnRow(close, event)}
    >
      {leftAction && parkedSide !== "left" ? (
        <SwipeActionButton
          action={leftAction}
          progress={swipe.leftProgress}
          width={leftWidth}
          parked={false}
          positionStyle={styles.left}
          fill={fill}
        />
      ) : null}
      {rightAction && parkedSide !== "right" ? (
        <SwipeActionButton
          action={rightAction}
          progress={swipe.rightProgress}
          width={rightWidth}
          parked={false}
          positionStyle={styles.right}
          fill={fill}
        />
      ) : null}
      <Animated.ScrollView
        ref={swipe.scrollRef}
        horizontal
        onScroll={swipe.scrollHandler}
        scrollEventThrottle={16}
        contentOffset={{ x: rest, y: 0 }}
        snapToOffsets={snapOffsets}
        disableIntervalMomentum
        decelerationRate="fast"
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!disabled && rowWidth !== null}
      >
        {leftAction ? (
          <View style={{ width: leftWidth }}>
            {parkedSide === "left" ? (
              <SwipeActionButton
                action={wrap(leftAction)}
                progress={swipe.leftProgress}
                width={leftWidth}
                parked
                positionStyle={styles.left}
                fill={fill}
              />
            ) : null}
          </View>
        ) : null}
        <View style={rowWidth === null ? undefined : { width: rowWidth }}>{children}</View>
        {rightAction ? (
          <View style={{ width: rightWidth }}>
            {parkedSide === "right" ? (
              <SwipeActionButton
                action={wrap(rightAction)}
                progress={swipe.rightProgress}
                width={rightWidth}
                parked
                positionStyle={styles.right}
                fill={fill}
              />
            ) : null}
          </View>
        ) : null}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: "100%" },
  left: { left: 0 },
  right: { right: 0 },
});
