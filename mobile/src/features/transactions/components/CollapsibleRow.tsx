import { ReactNode, useEffect } from "react";
import { LayoutChangeEvent, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { DAY_TOGGLE_ANIMATION_MS } from "@/features/transactions/hooks/use-collapsed-days";
import { useReduceMotion } from "@/lib/use-reduce-motion";

interface CollapsibleRowProps {
  collapsed: boolean;
  /** The list's own `gap` between cells — cancelled while collapsed, see below. */
  listGap: number;
  children: ReactNode;
}

/**
 * One row of a Transactions day that can fold away: its height eases down
 * to zero (and back), so every later row and day glides to its new place
 * instead of jumping.
 *
 * ⚠️ The row stays mounted while folded. It used to be dropped from the list
 * and the move handed to LayoutAnimation, but the list mounts cells in its
 * own later batches, which that one-shot animation never covered — the rows
 * simply popped in and out.
 *
 * Folded, it also pulls itself up by the list's gap, so a folded day takes
 * exactly the space a day with no rows would — the gap is laid out between
 * cells whether a cell has height or not.
 *
 * Runs on the UI thread (reanimated): the height changes every frame, and a
 * JS-driven version would re-layout the list on the JS thread each time.
 */
export function CollapsibleRow({ collapsed, listGap, children }: CollapsibleRowProps) {
  const reduceMotion = useReduceMotion();
  // 1 = open, 0 = folded.
  const openness = useSharedValue(collapsed ? 0 : 1);
  // The row's natural height, measured from the unclipped inner view. 0 until
  // the first layout pass.
  const naturalHeight = useSharedValue(0);

  useEffect(() => {
    const target = collapsed ? 0 : 1;
    openness.value = reduceMotion
      ? target
      : withTiming(target, { duration: DAY_TOGGLE_ANIMATION_MS, easing: Easing.inOut(Easing.ease) });
  }, [collapsed, reduceMotion, openness]);

  const style = useAnimatedStyle(() => {
    const open = openness.value;
    // Not measured yet: an open row keeps its natural height (no style at
    // all), a folded one is simply zero.
    if (naturalHeight.value === 0) return open === 1 ? {} : { height: 0, marginTop: -listGap, opacity: 0 };
    return { height: naturalHeight.value * open, marginTop: -listGap * (1 - open), opacity: open };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const height = e.nativeEvent.layout.height;
    if (height > 0) naturalHeight.value = height;
  };

  return (
    <Animated.View
      style={[{ overflow: "hidden" }, style]}
      pointerEvents={collapsed ? "none" : "auto"}
      accessibilityElementsHidden={collapsed}
      importantForAccessibility={collapsed ? "no-hide-descendants" : "auto"}
    >
      {/* Never squeezed by the animated height above (RN's default
          flexShrink is 0), so it always reports the full row height. */}
      <View onLayout={onLayout}>{children}</View>
    </Animated.View>
  );
}
