import { useEffect, useRef, useState } from "react";
import { LayoutChangeEvent } from "react-native";
import { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const EXPAND = { duration: 300, easing: Easing.out(Easing.cubic) };

interface UseSheetExpandOptions {
  /** useSheetDrag's state: the sheet is (heading to) full screen. */
  expanded: boolean;
  /** Room the sheet can take: the window above the keyboard. */
  available: number;
  topInset: number;
  cornerRadius: number;
}

/**
 * The resting ⇄ full-screen glide of a Drawer sheet: its height, the status
 * bar padding at its top and its rounded corners, all on ONE UI-thread
 * progress, so they arrive together.
 *
 * ⚠️ It used to be a style swap (maxHeight 92% → height 100%, padding and
 * radius switched in place) left to the layout transition. The swap landed
 * in one commit: the content inside took its full-screen layout at once while
 * the frame around it was still gliding, and the handle jumped down by the
 * status bar's height. The sheet shook on the way up and flashed short on the
 * way down.
 *
 * The frame grows through minHeight, not height: 0 at rest leaves the sheet
 * sized by its content (no animated `height` left behind on the view after a
 * collapse). `fill` (children flex: 1) holds from the start of an expand to
 * the END of a collapse, so the content never goes back to its own size while
 * the frame is still tall.
 */
export function useSheetExpand({ expanded, available, topInset, cornerRadius }: UseSheetExpandOptions) {
  const [fill, setFill] = useState(expanded);
  const fillRef = useRef(fill);
  fillRef.current = fill;
  const restingHeight = useRef(0);
  const minHeight = useSharedValue(0);
  const progress = useSharedValue(expanded ? 1 : 0);
  const lastExpanded = useRef(expanded);

  useEffect(() => {
    const changed = lastExpanded.current !== expanded;
    lastExpanded.current = expanded;
    if (expanded) {
      if (changed) {
        // From the height it is at now, not from 0: no frame of a short sheet.
        minHeight.value = restingHeight.current;
        setFill(true);
        progress.value = withTiming(1, EXPAND);
      }
      // Also follows the keyboard while full screen.
      minHeight.value = withTiming(available, EXPAND);
      return;
    }
    if (!changed) return;
    progress.value = withTiming(0, EXPAND);
    minHeight.value = withTiming(restingHeight.current, EXPAND, (finished) => {
      if (!finished) return;
      minHeight.value = 0;
      scheduleOnRN(setFill, false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, available]);

  /** The sheet surface's onLayout: the resting height, measured at rest only. */
  const onSurfaceLayout = (event: LayoutChangeEvent) => {
    if (!fillRef.current) restingHeight.current = event.nativeEvent.layout.height;
  };

  const frameStyle = useAnimatedStyle(() => ({ minHeight: minHeight.value }));
  const surfaceStyle = useAnimatedStyle(() => {
    const radius = cornerRadius * (1 - progress.value);
    return { paddingTop: topInset * progress.value, borderTopLeftRadius: radius, borderTopRightRadius: radius };
  });

  return { fill, frameStyle, surfaceStyle, onSurfaceLayout };
}
