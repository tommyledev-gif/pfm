import { ReactNode, useEffect, useRef, useState } from "react";
import { LayoutChangeEvent, View } from "react-native";
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { withAlpha } from "@/lib/color";
import { useColors } from "@/lib/theme";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { DAY_TOGGLE_ANIMATION_MS } from "@/features/transactions/hooks/use-collapsed-days";
import { LINE_CARD_BORDER, useItemsEditorStyles } from "@/features/transactions/components/items-editor-styles";

// The open line's marks: a lime edge and a faint lift. Lime only as a line;
// the footer's CTA keeps the solid fill.
const EDGE_ALPHA = 0.5;
const FILL_ALPHA = 0.04;

// The same motion as a Transactions day folding and unfolding.
export const FOLD_TIMING = { duration: DAY_TOGGLE_ANIMATION_MS, easing: Easing.out(Easing.cubic) };

interface ExpandableLineProps {
  expanded: boolean;
  /** The line's own row. `open` stays true until its fields have folded away. */
  header: (open: boolean) => ReactNode;
  /** The line's fields: mounted when it opens, unmounted once it has folded. */
  children: ReactNode;
}

/**
 * One line of the Items editor, opening in place as a card: its fields grow
 * out from under the row, pushing the lines below down, and fold back up
 * while they fade. Folded, the card is invisible and the line reads like any
 * other row of the list.
 *
 * The height is real layout, driven on the UI thread: the card clips itself to
 * `row + progress × fields`, both measured, so the lines below, the end of
 * the scroll content and anything else in the list move with it — no line
 * has to animate its own position. A line that mounts already open was just
 * added, and grows in from nothing, row and all.
 */
export function ExpandableLine({ expanded, header, children }: ExpandableLineProps) {
  const colors = useColors();
  const styles = useItemsEditorStyles();
  const reduceMotion = useReduceMotion();
  const [entering] = useState(expanded);
  // The fields stay mounted while they fold, so they fold away instead of vanishing.
  const [open, setOpen] = useState(expanded);
  if (expanded && !open) setOpen(true);

  // 0 folded … 1 open.
  const progress = useSharedValue(0);
  // 0 … 1 while a just-added line grows in; 1 for every other line.
  const arrival = useSharedValue(entering ? 0 : 1);
  const rowHeight = useSharedValue(0);
  const fieldsHeight = useSharedValue(0);
  const started = useRef(false);

  useEffect(() => {
    const target = expanded ? 1 : 0;
    // useReduceMotion resolves after mount: when it lands as true, cut
    // whatever already started straight to the end state.
    if (reduceMotion) {
      progress.value = target;
      if (!expanded) setOpen(false);
      return;
    }
    // Mounting folded is already the rest state: nothing to run, for every
    // line on the list at once.
    if (!started.current) {
      started.current = true;
      if (!expanded) return;
    }
    progress.value = withTiming(target, FOLD_TIMING, (finished) => {
      if (finished && !expanded) scheduleOnRN(setOpen, false);
    });
  }, [expanded, reduceMotion, progress]);

  useEffect(() => {
    if (entering) arrival.value = reduceMotion ? 1 : withTiming(1, FOLD_TIMING);
  }, [entering, reduceMotion, arrival]);

  const edgeOff = withAlpha(colors.green, 0);
  const edgeOn = withAlpha(colors.green, EDGE_ALPHA);
  const fillOff = withAlpha(colors.overlayBase, 0);
  const fillOn = withAlpha(colors.overlayBase, FILL_ALPHA);
  const cardStyle = useAnimatedStyle(() => {
    const marks = {
      borderColor: interpolateColor(progress.value, [0, 1], [edgeOff, edgeOn]),
      backgroundColor: interpolateColor(progress.value, [0, 1], [fillOff, fillOn]),
    };
    // Not measured yet: a line already on the list keeps its natural height,
    // a just-added one starts closed.
    if (rowHeight.value === 0) return entering ? { ...marks, height: 0 } : marks;
    const content = rowHeight.value + fieldsHeight.value * progress.value;
    return { ...marks, height: LINE_CARD_BORDER * 2 + content * arrival.value };
  });
  const fieldsStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const onRowLayout = (event: LayoutChangeEvent) => {
    rowHeight.value = event.nativeEvent.layout.height;
  };
  const onFieldsLayout = (event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    // Once fully open, a field appearing inside (the "Khác" label) eases in
    // too; while opening, the first measure is simply taken.
    const settled = !reduceMotion && fieldsHeight.value > 0 && progress.value === 1;
    fieldsHeight.value = settled ? withTiming(height, FOLD_TIMING) : height;
  };

  return (
    <Animated.View style={[styles.lineCard, cardStyle]}>
      <View style={styles.lineRow} onLayout={onRowLayout}>
        {header(open)}
      </View>
      {open ? (
        <Animated.View style={fieldsStyle} onLayout={onFieldsLayout}>
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
