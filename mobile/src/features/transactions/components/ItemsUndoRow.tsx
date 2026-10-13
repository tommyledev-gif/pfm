import { useEffect, useRef } from "react";
import { LayoutChangeEvent, Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useReduceMotion } from "@/lib/use-reduce-motion";
import { FOLD_TIMING } from "@/features/transactions/components/ExpandableLine";
import { useItemsEditorStyles } from "@/features/transactions/components/items-editor-styles";

interface ItemsUndoRowProps {
  label: string;
  /** Height of the line it takes the place of; 0 when unknown. */
  fromHeight: number;
  /** Its time is up: fold away, then call onGone. */
  leaving: boolean;
  onUndo: () => void;
  onGone: () => void;
}

/**
 * What a removed line leaves for a few seconds. It takes the line's place at
 * the line's height and settles to its own, so removing an open line closes
 * the gap below it instead of jumping the list up; when its time is up it
 * folds away the same way.
 */
export function ItemsUndoRow({ label, fromHeight, leaving, onUndo, onGone }: ItemsUndoRowProps) {
  const styles = useItemsEditorStyles();
  const reduceMotion = useReduceMotion();
  // 0 at the removed line's height … 1 at this row's own.
  const settle = useSharedValue(0);
  // 1 shown … 0 folded away.
  const presence = useSharedValue(1);
  const ownHeight = useSharedValue(0);
  const onGoneRef = useRef(onGone);
  onGoneRef.current = onGone;

  useEffect(() => {
    settle.value = reduceMotion ? 1 : withTiming(1, FOLD_TIMING);
  }, [reduceMotion, settle]);

  useEffect(() => {
    if (!leaving) return;
    const gone = () => onGoneRef.current();
    if (reduceMotion) {
      gone();
      return;
    }
    presence.value = withTiming(0, FOLD_TIMING, (finished) => {
      if (finished) scheduleOnRN(gone);
    });
  }, [leaving, reduceMotion, presence]);

  const clipStyle = useAnimatedStyle(() => {
    // Until measured it holds the removed line's place, unseen.
    if (ownHeight.value === 0) return { height: fromHeight, opacity: 0 };
    const height = fromHeight + (ownHeight.value - fromHeight) * settle.value;
    return { height: height * presence.value, opacity: Math.min(settle.value, presence.value) };
  });

  const onLayout = (event: LayoutChangeEvent) => {
    ownHeight.value = event.nativeEvent.layout.height;
  };

  return (
    <Animated.View style={[styles.undoClip, clipStyle]}>
      <View style={styles.undoRow} onLayout={onLayout} accessibilityLiveRegion="polite">
        <Text style={styles.undoLabel} numberOfLines={1}>
          {label}
        </Text>
        <Pressable accessibilityRole="button" onPress={onUndo} hitSlop={12} testID="btn-items-undo">
          <Text style={styles.undoAction}>Hoàn tác</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
