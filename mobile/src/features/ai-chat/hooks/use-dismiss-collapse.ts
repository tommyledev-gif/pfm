import { useCallback, useRef, useState } from "react";
import { LayoutChangeEvent } from "react-native";
import { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, Easing } from "react-native-reanimated";

const COLLAPSE_MS = 220;

/**
 * A row that folds away (fades and gives its height back) before it is taken
 * out of the thread, so the rows around it glide into the gap instead of
 * jumping over it.
 *
 * `remove` runs once the fold has finished — that is when the message leaves
 * the list. Reduce Motion removes it at once. Until `dismiss` is called the
 * row is untouched: no animated style, no height of its own.
 */
export function useDismissCollapse(remove: () => void) {
  const reduceMotion = useReducedMotion();
  const [collapsing, setCollapsing] = useState(false);
  const height = useRef(0);
  const progress = useSharedValue(1);
  const startHeight = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    height: startHeight.value * progress.value,
    opacity: progress.value,
    overflow: "hidden" as const,
  }));

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    height.current = event.nativeEvent.layout.height;
  }, []);

  const dismiss = useCallback(() => {
    if (reduceMotion || height.current <= 0) {
      remove();
      return;
    }
    startHeight.value = height.current;
    progress.value = 1;
    setCollapsing(true);
    progress.value = withTiming(0, { duration: COLLAPSE_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(remove)();
    });
  }, [reduceMotion, remove, progress, startHeight]);

  return { dismiss, onLayout, style: collapsing ? style : undefined };
}
