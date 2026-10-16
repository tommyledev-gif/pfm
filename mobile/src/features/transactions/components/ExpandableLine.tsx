import { ReactNode, useEffect } from "react";
import { LayoutAnimation, View } from "react-native";
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { withAlpha } from "@/lib/color";
import { useColors } from "@/lib/theme";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { DAY_TOGGLE_ANIMATION_MS } from "@/features/transactions/hooks/use-collapsed-days";
import { useItemsEditorStyles } from "@/features/transactions/components/items-editor-styles";

// The open line's marks: a lime edge and a faint lift. Lime only as a line;
// the footer's CTA keeps the solid fill.
const EDGE_ALPHA = 0.5;
const FILL_ALPHA = 0.04;

// The same motion as a Transactions day folding and unfolding.
const FOLD_TIMING = { duration: DAY_TOGGLE_ANIMATION_MS, easing: Easing.out(Easing.cubic) };
const LINE_LAYOUT_ANIMATION = LayoutAnimation.create(
  DAY_TOGGLE_ANIMATION_MS,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.opacity,
);

/**
 * Animates the next layout change of the Items editor's lines: a line opening
 * or folding, one added, removed or brought back. Call it right before the
 * state change. Everything that moves in that commit moves together — the
 * card growing, the lines below sliding down, fields fading in or out.
 */
export function animateLineLayout(reduceMotion: boolean): void {
  if (!reduceMotion) LayoutAnimation.configureNext(LINE_LAYOUT_ANIMATION);
}

interface ExpandableLineProps {
  expanded: boolean;
  /** The line's own row. `open` is whether its fields are showing. */
  header: (open: boolean) => ReactNode;
  /** The line's fields: mounted while it is open. */
  children: ReactNode;
}

/**
 * One line of the Items editor, opening in place as a card: its fields grow
 * out from under the row, pushing the lines below down, and fold back up.
 * Folded, the card is invisible and the line reads like any other row.
 *
 * ⚠️ The height is the card's own layout, animated by animateLineLayout (RN
 * LayoutAnimation, in the same commit as the change) — never a Reanimated
 * `height`. That version clipped the card to a measured height on the UI
 * thread, and the keyboard opening for a new line's name (useKeyboardHeight
 * runs its own LayoutAnimation on every keyboard event) left those updates
 * unapplied: a just-added line stayed at height 0, so "Thêm món" added a line
 * nobody could see or type in, and opening a line jumped instead of growing.
 * If an animation is ever dropped now, the line still opens at full height.
 * Only the colour marks stay on Reanimated.
 */
export function ExpandableLine({ expanded, header, children }: ExpandableLineProps) {
  const colors = useColors();
  const styles = useItemsEditorStyles();
  const reduceMotion = useReduceMotion();
  // 0 folded … 1 open.
  const progress = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    const target = expanded ? 1 : 0;
    progress.value = reduceMotion ? target : withTiming(target, FOLD_TIMING);
  }, [expanded, reduceMotion, progress]);

  const edgeOff = withAlpha(colors.green, 0);
  const edgeOn = withAlpha(colors.green, EDGE_ALPHA);
  const fillOff = withAlpha(colors.overlayBase, 0);
  const fillOn = withAlpha(colors.overlayBase, FILL_ALPHA);
  const cardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], [edgeOff, edgeOn]),
    backgroundColor: interpolateColor(progress.value, [0, 1], [fillOff, fillOn]),
  }));

  return (
    <Animated.View style={[styles.lineCard, cardStyle]}>
      <View style={styles.lineRow}>{header(expanded)}</View>
      {expanded ? <View>{children}</View> : null}
    </Animated.View>
  );
}
